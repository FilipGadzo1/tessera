import { describe, expect, it } from "vitest";
import { cn } from "./cn";
import { toneClass, toneColors } from "./tone";

describe("cn", () => {
  it("joins truthy class values and drops falsy ones", () => {
    expect(cn("a", false, undefined, null, "c", { d: true, e: false })).toBe("a c d");
  });

  it("lets later Tailwind utilities override conflicting earlier ones", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("treats Tessera token colors as colors when merging", () => {
    expect(cn("bg-primary text-primary-foreground", "bg-red-500")).toBe(
      "text-primary-foreground bg-red-500",
    );
  });

  it("resolves conflicting tone utilities to the last one", () => {
    expect(cn("tone-primary", "px-2", "tone-info")).toBe("px-2 tone-info");
  });

  it("groups every tone color's utility, each mapped to tone-<color>", () => {
    for (const color of toneColors) {
      expect(toneClass[color]).toBe(`tone-${color}`);
      expect(cn("tone-primary", toneClass[color])).toBe(toneClass[color]);
    }
  });
});
