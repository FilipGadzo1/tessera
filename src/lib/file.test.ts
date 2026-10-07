import { describe, expect, it } from "vitest";
import { formatFileSize, getFileKey, matchesAccept, validateFiles } from "./file";

const file = (name: string, type = "", size = 10, lastModified = 1) =>
  new File([new Uint8Array(size)], name, { type, lastModified });

/** `Intl`'s own text for a size in the given unit (ICU decides spacing and unit names). */
const intl = (value: number, unit: string, locale?: string) =>
  new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);

describe("matchesAccept", () => {
  it.each([
    // [name, type, accept, expected]
    ["photo.png", "image/png", undefined, true],
    ["photo.png", "image/png", "", true],
    ["photo.png", "image/png", "   ", true],
    ["photo.png", "image/png", "image/*", true],
    ["photo.png", "image/png", "image/png", true],
    ["photo.png", "image/png", "image/jpeg", false],
    ["photo.png", "image/png", "video/*", false],
    ["photo.png", "image/png", ".png", true],
    ["photo.PNG", "image/png", ".png", true],
    ["photo.png", "image/png", ".PNG", true],
    ["photo.png", "IMAGE/PNG", "image/png", true],
    ["photo.png", "image/png", "IMAGE/*", true],
    ["report.pdf", "application/pdf", "image/*,.pdf", true],
    ["report.pdf", "application/pdf", " image/* , .pdf ", true],
    ["notes.txt", "text/plain", "image/*,.pdf", false],
    ["archive.tar.gz", "application/gzip", ".gz", true],
    ["archive.tar.gz", "application/gzip", ".tar.gz", true],
    ["png", "", ".png", false],
    // An empty type matches only extension tokens.
    ["data.csv", "", ".csv", true],
    ["data.csv", "", "text/csv", false],
    ["data.csv", "", "text/*", false],
    ["data.csv", "", "*/*", false],
    ["data.csv", "text/csv", "*/*", true],
  ])("%s (%s) with accept %j → %s", (name, type, accept, expected) => {
    expect(matchesAccept({ name, type }, accept)).toBe(expected);
  });
});

describe("formatFileSize", () => {
  it.each([
    [0, 0, "byte"],
    [999, 999, "byte"],
    [1000, 1, "kilobyte"],
    [1536, 1.536, "kilobyte"],
    [5_000_000, 5, "megabyte"],
    [2_500_000_000, 2.5, "gigabyte"],
  ])("%d bytes is Intl's %d %s", (bytes, value, unit) => {
    expect(formatFileSize(bytes, "en-US")).toBe(intl(value, unit, "en-US"));
  });

  it("pins the familiar English output", () => {
    expect(formatFileSize(1536, "en-US")).toMatch(/^1\.5\s?kB$/);
    expect(formatFileSize(5_000_000, "en-US")).toMatch(/^5\s?MB$/);
  });

  it("de-DE uses a decimal comma", () => {
    expect(formatFileSize(1536, "de-DE")).toBe(intl(1.536, "kilobyte", "de-DE"));
    expect(formatFileSize(1536, "de-DE")).toContain("1,5");
  });

  it("without a locale uses the default locale", () => {
    expect(formatFileSize(1536)).toBe(intl(1.536, "kilobyte"));
  });
});

describe("validateFiles", () => {
  it("accepts everything with no constraints, appending (replace false)", () => {
    const current = [file("a.txt")];
    const incoming = [file("b.txt"), file("c.txt")];
    const result = validateFiles(incoming, current, {});
    expect(result.accepted).toEqual(incoming);
    expect(result.rejected).toEqual([]);
    expect(result.replace).toBe(false);
  });

  it.each([
    ["type", { accept: "image/*" }, file("a.txt", "text/plain")],
    ["too-small", { minSize: 100 }, file("a.txt", "", 50)],
    ["too-large", { maxSize: 100 }, file("a.txt", "", 500)],
    ["invalid", { validate: () => "Nope" }, file("a.txt")],
  ] as const)("reason %s", (reason, options, rejected) => {
    const result = validateFiles([rejected], [], options);
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.file).toBe(rejected);
    expect(result.rejected[0]?.reason).toBe(reason);
  });

  it("invalid carries validate's message; validate gets the file", () => {
    const bad = file("bad.txt");
    const result = validateFiles([bad], [], {
      validate: (candidate) => (candidate.name.startsWith("bad") ? "No bad files" : null),
    });
    expect(result.rejected).toEqual([{ file: bad, reason: "invalid", message: "No bad files" }]);
  });

  it("checks in order and reports the first failing check only: type, too-small, too-large, duplicate, invalid, too-many", () => {
    const current = [file("dup.txt", "text/plain", 50)];
    let validated = 0;
    const options = {
      accept: ".txt",
      minSize: 20,
      maxSize: 100,
      maxFiles: 2,
      validate: (candidate: File) => {
        validated++;
        return candidate.name === "invalid.txt" ? "Invalid" : null;
      },
    };
    const result = validateFiles(
      [
        file("a.png", "image/png", 5), // type (also too small)
        file("small.txt", "text/plain", 5), // too-small
        file("big.txt", "text/plain", 500), // too-large
        file("dup.txt", "text/plain", 50), // duplicate
        file("invalid.txt", "text/plain", 50), // invalid
        file("ok.txt", "text/plain", 50), // accepted (2 of 2)
        file("more.txt", "text/plain", 50), // too-many
      ],
      current,
      options,
    );
    expect(result.rejected.map((r) => [r.file.name, r.reason])).toEqual([
      ["a.png", "type"],
      ["small.txt", "too-small"],
      ["big.txt", "too-large"],
      ["dup.txt", "duplicate"],
      ["invalid.txt", "invalid"],
      ["more.txt", "too-many"],
    ]);
    expect(result.accepted.map((f) => f.name)).toEqual(["ok.txt"]);
    // validate runs only for files that passed the checks before it.
    expect(validated).toBe(3);
  });

  it("duplicates: same name, size and lastModified, against the current list and earlier incoming files", () => {
    const current = [file("a.txt", "", 10, 1)];
    const result = validateFiles(
      [
        file("a.txt", "", 10, 1), // duplicate of current
        file("a.txt", "", 11, 1), // different size: accepted
        file("a.txt", "", 10, 2), // different lastModified: accepted
        file("b.txt", "", 10, 1), // accepted
        file("b.txt", "", 10, 1), // duplicate within the batch
      ],
      current,
      {},
    );
    expect(result.rejected.map((r) => r.reason)).toEqual(["duplicate", "duplicate"]);
    expect(result.rejected.map((r) => r.file.name)).toEqual(["a.txt", "b.txt"]);
    expect(result.accepted).toHaveLength(3);
  });

  it("maxFiles counts the current list and the accepted files", () => {
    const current = [file("a.txt")];
    const result = validateFiles([file("b.txt"), file("c.txt"), file("d.txt")], current, {
      maxFiles: 3,
    });
    expect(result.accepted.map((f) => f.name)).toEqual(["b.txt", "c.txt"]);
    expect(result.rejected.map((r) => [r.file.name, r.reason])).toEqual([["d.txt", "too-many"]]);
    // A full list rejects everything as too-many.
    const full = validateFiles([file("x.txt")], [file("a"), file("b")], { maxFiles: 2 });
    expect(full.rejected.map((r) => r.reason)).toEqual(["too-many"]);
  });

  it("single mode (multiple false): the first acceptable file replaces the current one; the others are too-many", () => {
    const current = [file("old.png", "image/png")];
    const result = validateFiles(
      [file("a.txt", "text/plain"), file("b.png", "image/png"), file("c.png", "image/png")],
      current,
      { accept: "image/*", multiple: false },
    );
    expect(result.replace).toBe(true);
    expect(result.accepted.map((f) => f.name)).toEqual(["b.png"]);
    expect(result.rejected.map((r) => [r.file.name, r.reason])).toEqual([
      ["a.txt", "type"],
      ["c.png", "too-many"],
    ]);
  });

  it("maxFiles 1 is single mode too, even with multiple", () => {
    const result = validateFiles([file("b.png"), file("c.png")], [file("a.png")], {
      maxFiles: 1,
      multiple: true,
    });
    expect(result.replace).toBe(true);
    expect(result.accepted.map((f) => f.name)).toEqual(["b.png"]);
    expect(result.rejected.map((r) => [r.file.name, r.reason])).toEqual([["c.png", "too-many"]]);
  });

  it("single mode with nothing acceptable replaces nothing", () => {
    const result = validateFiles([file("a.txt", "text/plain")], [file("old.png")], {
      accept: "image/*",
      multiple: false,
    });
    expect(result.replace).toBe(false);
    expect(result.accepted).toEqual([]);
    expect(result.rejected.map((r) => r.reason)).toEqual(["type"]);
  });

  it("does not mutate its inputs", () => {
    const current = [file("a.txt")];
    const incoming = [file("b.txt")];
    validateFiles(incoming, current, { maxFiles: 1 });
    expect(current).toHaveLength(1);
    expect(incoming).toHaveLength(1);
  });
});

describe("getFileKey", () => {
  it("is stable per File object and distinct between objects", () => {
    const a = file("a.txt");
    const b = file("a.txt");
    expect(getFileKey(a)).toBe(getFileKey(a));
    expect(getFileKey(a)).not.toBe(getFileKey(b));
    expect(typeof getFileKey(a)).toBe("string");
  });
});
