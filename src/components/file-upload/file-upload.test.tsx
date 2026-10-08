import axe from "axe-core";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
  systemColor,
} from "../../../test/emulation";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemRemove,
  FileUploadList,
  type FileUploadProps,
  FileUploadRejections,
} from "./file-upload";

afterEach(async () => {
  document.documentElement.classList.remove("dark");
  await resetEmulatedMedia();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const makeFile = (name: string, type: string, size = 1536, lastModified = 1) =>
  new File([new Uint8Array(size)], name, { type, lastModified });
/** A real 1×1 PNG, padded with zeros (after its IEND) to 1536 bytes, so it decodes as an image. */
const pngBytes = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);
const photo = () => {
  const bytes = new Uint8Array(1536);
  bytes.set(pngBytes);
  return new File([bytes], "photo.png", { type: "image/png", lastModified: 1 });
};
const report = () => makeFile("report.pdf", "application/pdf", 5_000_000);
const notes = () => makeFile("notes.txt", "text/plain", 20);

const slot = <T extends HTMLElement = HTMLElement>(name: string, scope: ParentNode = document) =>
  scope.querySelector<T>(`[data-slot=${name}]`) as T;
const root = (scope?: ParentNode) => slot("file-upload", scope);
const input = (scope?: ParentNode) => slot<HTMLInputElement>("file-upload-input", scope);
const dropzone = (scope?: ParentNode) => slot("file-upload-dropzone", scope);
const status = (scope?: ParentNode) => slot("file-upload-status", scope);
const statusText = () => status().textContent?.replace(/ $/, "");
const names = (scope: ParentNode = document) =>
  [...scope.querySelectorAll("[data-slot=file-upload-item-name]")].map((n) => n.textContent);
const items = (scope: ParentNode = document) => [
  ...scope.querySelectorAll<HTMLElement>("[data-slot=file-upload-item]"),
];
const removes = (scope: ParentNode = document) => [
  ...scope.querySelectorAll<HTMLButtonElement>("[data-slot=file-upload-item-remove]"),
];
const rejectionTexts = () =>
  [...document.querySelectorAll("[data-slot=file-upload-rejections] li")].map((li) =>
    li.textContent?.trim(),
  );
const inputNames = () => [...(input().files ?? [])].map((file) => file.name);

function dataTransfer(files: File[], strings: Record<string, string> = {}) {
  const data = new DataTransfer();
  for (const file of files) data.items.add(file);
  for (const [type, value] of Object.entries(strings)) data.items.add(value, type);
  return data;
}

/**
 * Outside a real drag session Chromium ignores writes to `dropEffect`; an own writable property
 * (starting at "move") records what the component sets.
 */
function recordDropEffect(data: DataTransfer) {
  Object.defineProperty(data, "dropEffect", { value: "move", writable: true });
  return data;
}

function dragEvent(type: string, data: DataTransfer) {
  return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data });
}

function fire(target: Element, type: string, data: DataTransfer) {
  const event = dragEvent(type, data);
  target.dispatchEvent(event);
  return event;
}

/** A whole drag: enter, over, drop. */
function drop(target: Element, files: File[]) {
  const data = dataTransfer(files);
  fire(target, "dragenter", data);
  fire(target, "dragover", data);
  return fire(target, "drop", data);
}

function Basic({ children, ...props }: FileUploadProps) {
  return (
    <FileUpload {...props}>
      <FileUploadDropzone />
      <FileUploadRejections />
      <FileUploadList />
      {children}
    </FileUpload>
  );
}

describe("FileUpload: structure", () => {
  it("renders a visually hidden native file input named 'Choose files', a dropzone with no role, and a status region before any change", async () => {
    await render(<Basic className="w-96" />);
    expect(root().classList.contains("w-96")).toBe(true);
    const element = input();
    expect(element.type).toBe("file");
    expect(element.multiple).toBe(true);
    expect(element.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    expect(getComputedStyle(element).clipPath).toBe("inset(50%)");
    expect(element.tabIndex).toBe(0);
    expect(element.getAttribute("aria-label")).toBe("Choose files");
    expect(dropzone().hasAttribute("role")).toBe(false);
    expect(dropzone().hasAttribute("tabindex")).toBe(false);
    expect(dropzone().textContent).toContain("Drag files here or click to browse");
    expect(status().getAttribute("role")).toBe("status");
    expect(status().className).toContain("sr-only");
    expect(status().textContent).toBe("");
    // No list or rejections without files.
    expect(slot("file-upload-list")).toBeNull();
    expect(slot("file-upload-rejections")).toBeNull();
  });

  it("the input is described by the dropzone's instructions (with the maxSize hint)", async () => {
    await render(<Basic maxSize={5_000_000} />);
    const instructions = slot("file-upload-instructions");
    expect(instructions.textContent).toMatch(/Up to 5\s?MB/);
    expect(input().getAttribute("aria-describedby")?.split(" ")).toContain(instructions.id);
    await expect
      .element(page.getByLabelText("Choose files"))
      .toHaveAccessibleDescription(/Drag files here or click to browse\s*Up to 5\s?MB/);
  });

  it("single mode: no multiple attribute and the name 'Choose a file'", async () => {
    await render(<Basic maxFiles={1} />);
    expect(input().multiple).toBe(false);
    expect(input().getAttribute("aria-label")).toBe("Choose a file");
    await render(<Basic multiple={false} aria-label="Avatar" />);
    expect(document.querySelectorAll("[data-slot=file-upload-input]")[1]?.ariaLabel).toBe("Avatar");
  });

  it("a Field label names the input (label for); the Field description describes it next to the instructions", async () => {
    await render(
      <Field>
        <FieldLabel>Attachments</FieldLabel>
        <Basic />
        <FieldDescription>PDF only.</FieldDescription>
      </Field>,
    );
    const label = document.querySelector("[data-slot=field-label]") as HTMLLabelElement;
    expect(label.htmlFor).toBe(input().id);
    expect(input().hasAttribute("aria-label")).toBe(false);
    await expect
      .element(page.getByLabelText("Attachments"))
      .toHaveAccessibleDescription(/Drag files here or click to browse.*PDF only\./);
  });

  it("passes accept to the input; consumer children replace the dropzone text inside the instructions", async () => {
    await render(
      <FileUpload accept="image/*,.pdf">
        <FileUploadDropzone>PNG or PDF, up to 5 MB</FileUploadDropzone>
      </FileUpload>,
    );
    expect(input().accept).toBe("image/*,.pdf");
    expect(slot("file-upload-instructions").textContent).toBe("PNG or PDF, up to 5 MB");
    await expect
      .element(page.getByLabelText("Choose files"))
      .toHaveAccessibleDescription("PNG or PDF, up to 5 MB");
  });

  it("warns once in development when no FileUploadDropzone is rendered", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rerender } = await render(
      <FileUpload>
        <FileUploadList />
      </FileUpload>,
    );
    await expect.poll(() => warn.mock.calls.length).toBe(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain(
      "FileUpload renders no FileUploadDropzone: the file input has no visible control or focus indicator",
    );
    await rerender(
      <FileUpload defaultValue={[photo()]}>
        <FileUploadList />
      </FileUpload>,
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(warn).toHaveBeenCalledTimes(1);
    // No aria-describedby to a missing instructions element.
    expect(input().hasAttribute("aria-describedby")).toBe(false);
  });

  it("does not warn with a dropzone", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await render(<Basic />);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("FileUpload: picking files", () => {
  it("userEvent.upload adds the files, reports the full list and announces them", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.upload(input(), [photo(), report()]);
    await expect.poll(() => names()).toEqual(["photo.png", "report.pdf"]);
    expect(onValueChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ name: "photo.png" }),
      expect.objectContaining({ name: "report.pdf" }),
    ]);
    await expect.poll(statusText).toBe("2 files added");
    await userEvent.upload(input(), notes());
    await expect.poll(() => names()).toEqual(["photo.png", "report.pdf", "notes.txt"]);
    expect(onValueChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: "notes.txt" })]),
    );
    expect(onValueChange.mock.lastCall?.[0]).toHaveLength(3);
    await expect.poll(statusText).toBe("notes.txt added");
  });

  it("writes the full list back to input.files after a second pick", async () => {
    await render(<Basic />);
    await userEvent.upload(input(), [photo()]);
    await expect.poll(inputNames).toEqual(["photo.png"]);
    await userEvent.upload(input(), [report()]);
    await expect.poll(() => names()).toEqual(["photo.png", "report.pdf"]);
    await expect.poll(inputNames).toEqual(["photo.png", "report.pdf"]);
  });

  it("multiple={false} replaces the file", async () => {
    const onValueChange = vi.fn();
    await render(<Basic multiple={false} onValueChange={onValueChange} />);
    await userEvent.upload(input(), photo());
    await expect.poll(() => names()).toEqual(["photo.png"]);
    await userEvent.upload(input(), report());
    await expect.poll(() => names()).toEqual(["report.pdf"]);
    expect(onValueChange.mock.lastCall?.[0]).toHaveLength(1);
    await expect.poll(inputNames).toEqual(["report.pdf"]);
  });

  it("custom addedLabel", async () => {
    await render(<Basic addedLabel={(files) => `${files.length} hinzugefügt`} />);
    await userEvent.upload(input(), [photo()]);
    await expect.poll(statusText).toBe("1 hinzugefügt");
  });
});

describe("FileUpload: rejections", () => {
  it.each([
    {
      name: "accept",
      props: { accept: "image/*,.pdf" },
      file: notes,
      reason: "type",
      message: "This file type is not accepted",
    },
    {
      name: "maxSize",
      props: { maxSize: 1_000_000 },
      file: report,
      reason: "too-large",
      message: "Larger than 1 MB",
    },
    {
      name: "minSize",
      props: { minSize: 100 },
      file: notes,
      reason: "too-small",
      message: "Smaller than 100 byte",
    },
    {
      name: "validate",
      props: { validate: (file: File) => (file.name.endsWith(".txt") ? "No text files" : null) },
      file: notes,
      reason: "invalid",
      message: "No text files",
    },
  ] as const)(
    "$name: onFilesRejected, FileUploadRejections and the status report it; the list is unchanged",
    async ({ props, file, reason, message }) => {
      const onFilesRejected = vi.fn();
      const onValueChange = vi.fn();
      await render(
        <Basic
          {...(props as FileUploadProps)}
          locale="en-US"
          onFilesRejected={onFilesRejected}
          onValueChange={onValueChange}
        />,
      );
      const rejected = file();
      await userEvent.upload(input(), rejected);
      await expect.poll(() => onFilesRejected.mock.calls.length).toBe(1);
      const [rejection] = onFilesRejected.mock.calls[0]?.[0] ?? [];
      expect(rejection.reason).toBe(reason);
      expect(rejection.file.name).toBe(rejected.name);
      expect(rejection.message.replace(/\s/g, " ")).toBe(message);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(names()).toEqual([]);
      await expect
        .poll(() => rejectionTexts().map((text) => text?.replace(/\s/g, " ")))
        .toEqual([`${rejected.name} — ${message}`]);
      await expect
        .poll(() => statusText()?.replace(/\s/g, " "))
        .toBe(`${rejected.name} rejected: ${message}`);
      // The rejected file is not left in the input either.
      await expect.poll(inputNames).toEqual([]);
      // Rejections never make the field invalid.
      expect(root().hasAttribute("data-invalid")).toBe(false);
      expect(input().hasAttribute("aria-invalid")).toBe(false);
    },
  );

  it("maxFiles={2} rejects the third; one announcement per batch, accepted first", async () => {
    const onFilesRejected = vi.fn();
    await render(<Basic maxFiles={2} onFilesRejected={onFilesRejected} />);
    await userEvent.upload(input(), [photo()]);
    await expect.poll(() => names()).toEqual(["photo.png"]);
    await userEvent.upload(input(), [report(), notes()]);
    await expect.poll(() => names()).toEqual(["photo.png", "report.pdf"]);
    expect(onFilesRejected.mock.lastCall?.[0].map((r: { reason: string }) => r.reason)).toEqual([
      "too-many",
    ]);
    await expect.poll(rejectionTexts).toEqual(["notes.txt — More than 2 files"]);
    await expect.poll(statusText).toBe("report.pdf added. notes.txt rejected: More than 2 files");
    await expect.poll(inputNames).toEqual(["photo.png", "report.pdf"]);
  });

  it("a duplicate (same name, size and lastModified) is rejected; several rejections are summed up", async () => {
    // Dropped, so the very same File objects arrive (a pick through the test driver restamps
    // `lastModified`).
    const onFilesRejected = vi.fn();
    await render(<Basic accept="image/*,.pdf" onFilesRejected={onFilesRejected} />);
    const first = photo();
    drop(dropzone(), [first]);
    await expect.poll(() => names()).toEqual(["photo.png"]);
    drop(dropzone(), [first, notes(), report()]);
    await expect.poll(() => names()).toEqual(["photo.png", "report.pdf"]);
    expect(onFilesRejected.mock.lastCall?.[0].map((r: { reason: string }) => r.reason)).toEqual([
      "duplicate",
      "type",
    ]);
    await expect
      .poll(rejectionTexts)
      .toEqual(["photo.png — Already added", "notes.txt — This file type is not accepted"]);
    await expect.poll(statusText).toBe("report.pdf added. 2 files rejected");
  });

  it("single mode: the other files of a drop are too-many ('More than 1 file')", async () => {
    await render(<Basic multiple={false} />);
    drop(dropzone(), [photo(), report()]);
    await expect.poll(() => names()).toEqual(["photo.png"]);
    await expect.poll(rejectionTexts).toEqual(["report.pdf — More than 1 file"]);
  });

  it("a later accepted pick clears the rejections; so does a removal", async () => {
    await render(<Basic accept="image/*" />);
    await userEvent.upload(input(), notes());
    await expect.poll(rejectionTexts).toHaveLength(1);
    await userEvent.upload(input(), photo());
    await expect.poll(() => slot("file-upload-rejections")).toBeNull();
    await userEvent.upload(input(), notes());
    await expect.poll(rejectionTexts).toHaveLength(1);
    await userEvent.click(page.getByRole("button", { name: "Remove photo.png" }));
    await expect.poll(() => slot("file-upload-rejections")).toBeNull();
  });

  it("custom rejectionMessage and rejectedLabel", async () => {
    await render(
      <Basic
        accept="image/*"
        rejectionMessage={(rejection) => `nicht erlaubt (${rejection.reason})`}
        rejectedLabel={(rejections) => `${rejections.length} abgelehnt`}
      />,
    );
    await userEvent.upload(input(), notes());
    await expect.poll(rejectionTexts).toEqual(["notes.txt — nicht erlaubt (type)"]);
    await expect.poll(statusText).toBe("1 abgelehnt");
  });

  it("the rejections list has no live region (the status announces)", async () => {
    await render(<Basic accept="image/*" />);
    await userEvent.upload(input(), notes());
    await expect.poll(rejectionTexts).toHaveLength(1);
    const list = slot("file-upload-rejections");
    expect(list.getAttribute("role")).toBe("list");
    expect(list.hasAttribute("aria-live")).toBe(false);
    expect(list.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("FileUpload: drag and drop", () => {
  it("data-dragging while a file drag is over the dropzone (also over a child); cleared on leave", async () => {
    await render(<Basic />);
    const zone = dropzone();
    const child = slot("file-upload-instructions");
    const data = dataTransfer([photo()]);
    fire(zone, "dragenter", data);
    await expect.poll(() => zone.hasAttribute("data-dragging")).toBe(true);
    expect(root().hasAttribute("data-dragging")).toBe(true);
    // Moving onto a child: enter the child, then leave the zone.
    fire(child, "dragenter", data);
    fire(zone, "dragleave", data);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(zone.hasAttribute("data-dragging")).toBe(true);
    fire(child, "dragleave", data);
    await expect.poll(() => zone.hasAttribute("data-dragging")).toBe(false);
    expect(root().hasAttribute("data-dragging")).toBe(false);
  });

  it("dragover prevents the default and sets dropEffect copy; the drop adds the files and clears dragging", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    const zone = dropzone();
    const data = recordDropEffect(dataTransfer([photo(), report()]));
    fire(zone, "dragenter", data);
    const over = fire(zone, "dragover", data);
    expect(over.defaultPrevented).toBe(true);
    expect(data.dropEffect).toBe("copy");
    const dropped = fire(zone, "drop", data);
    expect(dropped.defaultPrevented).toBe(true);
    await expect.poll(() => names()).toEqual(["photo.png", "report.pdf"]);
    expect(onValueChange.mock.lastCall?.[0]).toHaveLength(2);
    expect(zone.hasAttribute("data-dragging")).toBe(false);
    await expect.poll(statusText).toBe("2 files added");
    // The dropped files are written to the input too.
    await expect.poll(inputNames).toEqual(["photo.png", "report.pdf"]);
  });

  it("dropped files are validated like picked ones", async () => {
    const onFilesRejected = vi.fn();
    await render(<Basic accept="image/*" onFilesRejected={onFilesRejected} />);
    drop(dropzone(), [photo(), notes()]);
    await expect.poll(() => names()).toEqual(["photo.png"]);
    expect(onFilesRejected.mock.lastCall?.[0][0].reason).toBe("type");
    await expect.poll(rejectionTexts).toEqual(["notes.txt — This file type is not accepted"]);
  });

  it("a dropped folder is rejected with reason type", async () => {
    const onFilesRejected = vi.fn();
    vi.spyOn(DataTransferItem.prototype, "webkitGetAsEntry").mockImplementation(function (
      this: DataTransferItem,
    ) {
      return (
        this.getAsFile()?.name === "folder" ? { isDirectory: true } : null
      ) as FileSystemEntry | null;
    });
    await render(<Basic onFilesRejected={onFilesRejected} />);
    drop(dropzone(), [makeFile("folder", "", 0), photo()]);
    await expect.poll(() => names()).toEqual(["photo.png"]);
    expect(onFilesRejected.mock.lastCall?.[0].map((r: { file: File }) => r.file.name)).toEqual([
      "folder",
    ]);
    expect(onFilesRejected.mock.lastCall?.[0][0].reason).toBe("type");
  });

  it("a drag without files neither sets data-dragging nor is accepted", async () => {
    await render(<Basic />);
    const zone = dropzone();
    const data = dataTransfer([], { "text/plain": "hello" });
    fire(zone, "dragenter", data);
    const over = fire(zone, "dragover", data);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(zone.hasAttribute("data-dragging")).toBe(false);
    expect(over.defaultPrevented).toBe(false);
  });

  it("disabled: dropEffect none, no dragging, and the drop is ignored", async () => {
    const onValueChange = vi.fn();
    await render(<Basic disabled onValueChange={onValueChange} />);
    const zone = dropzone();
    const data = recordDropEffect(dataTransfer([photo()]));
    fire(zone, "dragenter", data);
    const over = fire(zone, "dragover", data);
    expect(over.defaultPrevented).toBe(true);
    expect(data.dropEffect).toBe("none");
    expect(zone.hasAttribute("data-dragging")).toBe(false);
    const dropped = fire(zone, "drop", data);
    // Prevented, so the browser does not open the file instead.
    expect(dropped.defaultPrevented).toBe(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(names()).toEqual([]);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("FileUpload: the dropzone click and focus", () => {
  it("a click on the dropzone calls the input's click and focuses the input without the ring", async () => {
    await render(<Basic />);
    const click = vi.spyOn(input(), "click").mockImplementation(() => {});
    await userEvent.click(dropzone());
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input());
    expect(dropzone().hasAttribute("data-focus-visible")).toBe(false);
    expect(getComputedStyle(dropzone()).outlineStyle).toBe("none");
  });

  it("disabled: the click does nothing and the input is disabled (out of the Tab order)", async () => {
    await render(
      <div>
        <Basic disabled defaultValue={[photo()]} />
        <button type="button">after</button>
      </div>,
    );
    const click = vi.spyOn(input(), "click").mockImplementation(() => {});
    await userEvent.click(dropzone(), { force: true });
    expect(click).not.toHaveBeenCalled();
    expect(input().disabled).toBe(true);
    expect(removes()[0]?.disabled).toBe(true);
    expect(dropzone().hasAttribute("data-disabled")).toBe(true);
    expect(root().hasAttribute("data-disabled")).toBe(true);
    expect(getComputedStyle(dropzone()).opacity).toBe("0.5");
    expect(getComputedStyle(dropzone()).cursor).toBe("not-allowed");
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("after");
  });

  it("Tab focuses the native input (the one Tab stop of the picker): the dropzone mirrors a solid 2px ring; the next Tab reaches a remove button, which rings itself", async () => {
    await render(<Basic defaultValue={[photo()]} />);
    expect(getComputedStyle(dropzone()).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(input());
    await expect.poll(() => dropzone().hasAttribute("data-focus-visible")).toBe(true);
    const ring = getComputedStyle(dropzone());
    expect(ring.outlineStyle).toBe("solid");
    expect(ring.outlineWidth).toBe("2px");
    await userEvent.tab();
    expect(document.activeElement).toBe(removes()[0]);
    await expect.poll(() => dropzone().hasAttribute("data-focus-visible")).toBe(false);
    expect(getComputedStyle(dropzone()).outlineStyle).toBe("none");
    expect(getComputedStyle(removes()[0] as HTMLElement).outlineStyle).toBe("solid");
    // Shift+Tab returns to the input and its mirrored ring.
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(input());
    await expect.poll(() => getComputedStyle(dropzone()).outlineStyle).toBe("solid");
  });
});

describe("FileUpload: the list", () => {
  it("shows each file's name and size in a list named 'Selected files'", async () => {
    await render(<Basic locale="en-US" defaultValue={[photo(), report()]} />);
    const list = page.getByRole("list", { name: "Selected files" });
    await expect.element(list).toBeInTheDocument();
    expect(list.getByRole("listitem").elements()).toHaveLength(2);
    expect(names()).toEqual(["photo.png", "report.pdf"]);
    expect(items()[0]?.textContent).toMatch(/1\.5\s?kB/);
    expect(items()[1]?.textContent).toMatch(/5\s?MB/);
    expect(items()[0]?.getAttribute("data-status")).toBe("idle");
  });

  it("an image gets a blob: preview after mount, revoked on removal; a non-image shows the file icon", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    await render(<Basic defaultValue={[photo(), report()]} />);
    const [image, document_] = items();
    await expect
      .poll(() => image?.querySelector("img")?.getAttribute("src") ?? "")
      .toMatch(/^blob:/);
    const img = image?.querySelector("img") as HTMLImageElement;
    expect(img.alt).toBe("");
    const url = img.src;
    const pdfPreview = document_?.querySelector(
      "[data-slot=file-upload-item-preview]",
    ) as HTMLElement;
    expect(pdfPreview.querySelector("img")).toBeNull();
    expect(pdfPreview.querySelector("svg")).not.toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Remove photo.png" }));
    await expect.poll(() => names()).toEqual(["report.pdf"]);
    expect(revoke).toHaveBeenCalledWith(url);
  });

  it("an image that cannot be decoded falls back to the file icon", async () => {
    const create = vi.spyOn(URL, "createObjectURL");
    await render(<Basic defaultValue={[makeFile("broken.png", "image/png", 64)]} />);
    const box = () => slot("file-upload-item-preview");
    await expect
      .poll(() => box().querySelector("svg") !== null && !box().querySelector("img"))
      .toBe(true);
    // It was tried: the object URL was made first.
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("preview={false} shows the icon for an image", async () => {
    await render(
      <FileUpload defaultValue={[photo()]}>
        <FileUploadDropzone />
        <FileUploadList>
          {(files) =>
            files.map((file) => <FileUploadItem key={file.name} file={file} preview={false} />)
          }
        </FileUploadList>
      </FileUpload>,
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(items()[0]?.querySelector("img")).toBeNull();
  });

  it("progress: a progressbar named 'Uploading photo.png' at 40; null is indeterminate; error shows the message and the danger border", async () => {
    const screen = await render(
      <div>
        <FileUpload defaultValue={[photo(), report(), notes()]}>
          <FileUploadDropzone />
          <FileUploadList>
            {(files) => (
              <>
                <FileUploadItem file={files[0] as File} progress={40} status="uploading" />
                <FileUploadItem file={files[1] as File} progress={null} status="uploading" />
                <FileUploadItem file={files[2] as File} status="error" error="Upload failed" />
              </>
            )}
          </FileUploadList>
        </FileUpload>
        <span data-testid="danger" className="border border-danger" />
      </div>,
    );
    const bar = page.getByRole("progressbar", { name: "Uploading photo.png" });
    await expect.element(bar).toHaveAttribute("aria-valuenow", "40");
    const indeterminate = page.getByRole("progressbar", { name: "Uploading report.pdf" });
    await expect.element(indeterminate).toBeInTheDocument();
    expect(indeterminate.element().hasAttribute("aria-valuenow")).toBe(false);
    expect(items()[0]?.getAttribute("data-status")).toBe("uploading");
    const errorItem = items()[2] as HTMLElement;
    expect(errorItem.getAttribute("data-status")).toBe("error");
    const error = slot("file-upload-item-error", errorItem);
    expect(error.textContent).toBe("Upload failed");
    expect(error.querySelector("svg")).not.toBeNull();
    expect(getComputedStyle(errorItem).borderTopColor).toBe(
      getComputedStyle(screen.getByTestId("danger").element()).borderTopColor,
    );
    // No bar without progress.
    expect(errorItem.querySelector("[role=progressbar]")).toBeNull();
  });

  it("custom progressLabel and an error without status=error is not shown", async () => {
    await render(
      <FileUpload defaultValue={[photo()]}>
        <FileUploadDropzone />
        <FileUploadList>
          {(files) => (
            <FileUploadItem
              file={files[0] as File}
              progress={10}
              error="hidden"
              progressLabel={(file) => `${file.name} wird hochgeladen`}
            />
          )}
        </FileUploadList>
      </FileUpload>,
    );
    await expect
      .element(page.getByRole("progressbar", { name: "photo.png wird hochgeladen" }))
      .toBeInTheDocument();
    expect(slot("file-upload-item-error")).toBeNull();
  });

  it("an item's children replace its layout; FileUploadItemRemove still removes it", async () => {
    await render(
      <FileUpload defaultValue={[photo()]}>
        <FileUploadDropzone />
        <FileUploadList>
          {(files) =>
            files.map((file) => (
              <FileUploadItem key={file.name} file={file}>
                <span data-testid="custom">{file.name}</span>
                <FileUploadItemRemove aria-label="Drop it" />
              </FileUploadItem>
            ))
          }
        </FileUploadList>
      </FileUpload>,
    );
    await expect.element(page.getByTestId("custom")).toHaveTextContent("photo.png");
    expect(slot("file-upload-item-name")).toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Drop it" }));
    await expect.poll(() => items().length).toBe(0);
  });
});

describe("FileUpload: removal", () => {
  it("the remove button named 'Remove photo.png' removes it and announces; focus moves next, else previous, else to the input", async () => {
    const onValueChange = vi.fn();
    await render(
      <Basic
        onValueChange={onValueChange}
        defaultValue={[photo(), report(), notes()]}
        removedLabel={(file) => `${file.name} weg`}
      />,
    );
    const button = page.getByRole("button", { name: "Remove report.pdf" });
    (button.element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => names()).toEqual(["photo.png", "notes.txt"]);
    expect(onValueChange.mock.lastCall?.[0].map((f: File) => f.name)).toEqual([
      "photo.png",
      "notes.txt",
    ]);
    await expect.poll(statusText).toBe("report.pdf weg");
    // The next item's remove button.
    await expect.poll(() => document.activeElement).toBe(removes()[1]);
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Remove notes.txt");
    await userEvent.keyboard(" ");
    await expect.poll(() => names()).toEqual(["photo.png"]);
    // No next: the previous one.
    await expect.poll(() => document.activeElement).toBe(removes()[0]);
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => names()).toEqual([]);
    // No items: the input.
    await expect.poll(() => document.activeElement).toBe(input());
    expect(slot("file-upload-list")).toBeNull();
    await expect.poll(inputNames).toEqual([]);
  });
});

describe("FileUpload: controlled and uncontrolled", () => {
  it("controlled value: onValueChange reports and the parent's list shows", async () => {
    function Controlled() {
      const [files, setFiles] = useState<File[]>([]);
      return (
        <div>
          <Basic value={files} onValueChange={setFiles} />
          <output data-testid="value">{files.map((f) => f.name).join("|")}</output>
        </div>
      );
    }
    const screen = await render(<Controlled />);
    await userEvent.upload(input(), [photo(), report()]);
    await expect.element(screen.getByTestId("value")).toHaveTextContent("photo.png|report.pdf");
    expect(names()).toEqual(["photo.png", "report.pdf"]);
    await userEvent.click(page.getByRole("button", { name: "Remove photo.png" }));
    await expect.element(screen.getByTestId("value")).toHaveTextContent("report.pdf");
  });

  it("a refusing parent keeps its list and the input's files", async () => {
    const onValueChange = vi.fn();
    const kept = photo();
    await render(<Basic value={[kept]} onValueChange={onValueChange} />);
    await expect.poll(inputNames).toEqual(["photo.png"]);
    await userEvent.upload(input(), [report()]);
    await expect.poll(() => onValueChange.mock.calls.length).toBe(1);
    expect(onValueChange.mock.lastCall?.[0].map((f: File) => f.name)).toEqual([
      "photo.png",
      "report.pdf",
    ]);
    await expect.poll(inputNames).toEqual(["photo.png"]);
    expect(names()).toEqual(["photo.png"]);
    // A refused removal keeps the item and the focus.
    const button = removes()[0] as HTMLButtonElement;
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith([]);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(names()).toEqual(["photo.png"]);
    expect(document.activeElement).toBe(button);
  });

  it("uncontrolled defaultValue is written to the input", async () => {
    await render(<Basic defaultValue={[photo()]} />);
    expect(names()).toEqual(["photo.png"]);
    await expect.poll(inputNames).toEqual(["photo.png"]);
  });
});

function NativeForm({
  children,
  onData,
}: {
  children: React.ReactNode;
  onData: (data: FormData) => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onData(new FormData(event.currentTarget));
      }}
    >
      {children}
      <button type="submit">Save</button>
    </form>
  );
}

const save = () => userEvent.click(page.getByRole("button", { name: "Save" }));
const send = () => userEvent.click(page.getByRole("button", { name: "Send", exact: true }));
const fileNames = (entries: FormDataEntryValue[]) =>
  entries.map((entry) => (entry instanceof File ? entry.name : `string:${entry}`));

function UploadForm({
  children,
  onFormSubmit = () => {},
  validationMode,
}: {
  children: React.ReactNode;
  onFormSubmit?: (values: Record<string, unknown>) => void;
  validationMode?: "onSubmit" | "onBlur" | "onChange";
}) {
  return (
    <Form aria-label="Upload" onFormSubmit={onFormSubmit} validationMode={validationMode}>
      <Field name="attachments">
        <FieldLabel>Attachments</FieldLabel>
        {children}
        <FieldError />
      </Field>
      <Button type="submit">Send</Button>
    </Form>
  );
}

describe("FileUpload: Form and Field", () => {
  it("name → FormData.getAll holds the listed files, picked and dropped", async () => {
    let data: FormData | null = null;
    await render(
      <NativeForm onData={(next) => (data = next)}>
        <Basic name="attachments" />
      </NativeForm>,
    );
    await userEvent.upload(input(), [photo()]);
    await expect.poll(() => names()).toEqual(["photo.png"]);
    drop(dropzone(), [report()]);
    await expect.poll(() => names()).toEqual(["photo.png", "report.pdf"]);
    await save();
    await expect.poll(() => data).not.toBeNull();
    const form = data as unknown as FormData;
    expect(fileNames(form.getAll("attachments"))).toEqual(["photo.png", "report.pdf"]);
    expect((form.getAll("attachments")[1] as File).size).toBe(5_000_000);
  });

  it("a Field name alone names the native file input (name ?? field.name)", async () => {
    let data: FormData | null = null;
    await render(
      <NativeForm onData={(next) => (data = next)}>
        <Field name="attachments">
          <FieldLabel>Attachments</FieldLabel>
          <Basic defaultValue={[photo(), report()]} />
        </Field>
      </NativeForm>,
    );
    expect(input().name).toBe("attachments");
    await save();
    await expect.poll(() => data).not.toBeNull();
    expect(fileNames((data as unknown as FormData).getAll("attachments"))).toEqual([
      "photo.png",
      "report.pdf",
    ]);
  });

  it("onFormSubmit reports File[] under the Field name; one registered control, nameless", async () => {
    const onFormSubmit = vi.fn();
    const files = [photo(), report()];
    await render(
      <UploadForm onFormSubmit={onFormSubmit}>
        <Basic defaultValue={files} />
      </UploadForm>,
    );
    const controls = document.querySelectorAll<HTMLInputElement>(
      "[data-slot=file-upload-form-control]",
    );
    expect(controls).toHaveLength(1);
    expect(controls[0]?.hasAttribute("name")).toBe(false);
    await send();
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({ attachments: files });
  });

  it("required: aria-required on the file input, native required only on the validation input; no files blocks submit and focuses the input", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <UploadForm onFormSubmit={onFormSubmit}>
        <Basic required />
      </UploadForm>,
    );
    expect(input().getAttribute("aria-required")).toBe("true");
    expect(input().required).toBe(false);
    expect(input().hasAttribute("required")).toBe(false);
    const control = document.querySelector(
      "[data-slot=file-upload-form-control]",
    ) as HTMLInputElement;
    expect(control.required).toBe(true);
    await send();
    await expect.element(page.getByText(/fill out this field/i)).toBeVisible();
    expect(onFormSubmit).not.toHaveBeenCalled();
    await expect.poll(() => document.activeElement).toBe(input());
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(root().hasAttribute("data-invalid")).toBe(true);
    expect(dropzone().hasAttribute("data-invalid")).toBe(true);
    await userEvent.upload(input(), photo());
    await expect.poll(() => names()).toEqual(["photo.png"]);
    await send();
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
  });

  it("required: a list holding only dropped files submits even without DataTransfer (no write-back)", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <UploadForm onFormSubmit={onFormSubmit}>
        <Basic required />
      </UploadForm>,
    );
    const file = photo();
    const data = dataTransfer([file]);
    const events = ["dragenter", "dragover", "drop"].map((type) => dragEvent(type, data));
    vi.stubGlobal("DataTransfer", undefined);
    for (const event of events) dropzone().dispatchEvent(event);
    await expect.poll(() => names()).toEqual(["photo.png"]);
    // The write-back was skipped: the native input holds nothing.
    expect(input().files?.length ?? 0).toBe(0);
    await send();
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({ attachments: [file] });
  });

  it("required in a native <form> (constraint validation on): dropped files without DataTransfer still submit", async () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    await render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent)}>
        <Basic name="attachments" required />
        <button type="submit">Save</button>
      </form>,
    );
    const data = dataTransfer([photo()]);
    const events = ["dragenter", "dragover", "drop"].map((type) => dragEvent(type, data));
    vi.stubGlobal("DataTransfer", undefined);
    for (const event of events) dropzone().dispatchEvent(event);
    await expect.poll(() => names()).toEqual(["photo.png"]);
    expect(input().files?.length ?? 0).toBe(0);
    await save();
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("Field validate receives the files", async () => {
    const validate = vi.fn((value: unknown) =>
      Array.isArray(value) && value.length > 1 ? "One file only" : null,
    );
    await render(
      <Form aria-label="Upload">
        <Field name="attachments" validate={validate}>
          <FieldLabel>Attachments</FieldLabel>
          <Basic defaultValue={[photo(), report()]} />
          <FieldError />
        </Field>
        <Button type="submit">Send</Button>
      </Form>,
    );
    await send();
    await expect.element(page.getByText("One file only")).toBeVisible();
    expect(validate.mock.lastCall?.[0]).toHaveLength(2);
  });

  it("the Field blur fires when focus leaves the input and its remove buttons, not between them", async () => {
    await render(
      <div>
        <UploadForm validationMode="onBlur">
          <Basic required defaultValue={[photo()]} />
        </UploadForm>
        <button type="button">after</button>
      </div>,
    );
    const fieldRoot = document.querySelector("[data-slot=field]") as HTMLElement;
    await userEvent.tab();
    expect(document.activeElement).toBe(input());
    expect(fieldRoot.hasAttribute("data-focused")).toBe(true);
    await userEvent.tab();
    expect(document.activeElement).toBe(removes()[0]);
    expect(fieldRoot.hasAttribute("data-touched")).toBe(false);
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => names()).toEqual([]);
    await expect.poll(() => document.activeElement).toBe(input());
    await expect.element(page.getByText(/fill out this field/i)).not.toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "after" }));
    await expect.element(page.getByText(/fill out this field/i)).toBeVisible();
    expect(fieldRoot.hasAttribute("data-touched")).toBe(true);
  });

  it("form reaches an outside <form id>", async () => {
    let data: FormData | null = null;
    await render(
      <div>
        <form
          id="outside"
          onSubmit={(event) => {
            event.preventDefault();
            data = new FormData(event.currentTarget);
          }}
        >
          <button type="submit">Save</button>
        </form>
        <Basic name="attachments" form="outside" defaultValue={[photo()]} />
      </div>,
    );
    await save();
    await expect.poll(() => data).not.toBeNull();
    expect(fileNames((data as unknown as FormData).getAll("attachments"))).toEqual(["photo.png"]);
  });

  it("disabled submits nothing; a disabled Field disables it; an invalid Field marks it", async () => {
    let data: FormData | null = null;
    await render(
      <div>
        <NativeForm onData={(next) => (data = next)}>
          <Basic name="attachments" disabled defaultValue={[photo()]} />
        </NativeForm>
        <Field disabled>
          <FieldLabel>Disabled</FieldLabel>
          <Basic />
        </Field>
        <Field invalid>
          <FieldLabel>Invalid</FieldLabel>
          <Basic />
        </Field>
      </div>,
    );
    await save();
    await expect.poll(() => data).not.toBeNull();
    expect((data as unknown as FormData).has("attachments")).toBe(false);
    const [, disabledRoot, invalidRoot] = [
      ...document.querySelectorAll<HTMLElement>("[data-slot=file-upload]"),
    ];
    expect(disabledRoot?.hasAttribute("data-disabled")).toBe(true);
    expect(input(disabledRoot).disabled).toBe(true);
    expect(invalidRoot?.hasAttribute("data-invalid")).toBe(true);
    expect(input(invalidRoot).getAttribute("aria-invalid")).toBe("true");
    expect(dropzone(invalidRoot).hasAttribute("data-invalid")).toBe(true);
  });
});

describe("FileUpload: layout, forced colors and motion", () => {
  it("RTL: the item row runs right to left (preview at the inline start, remove at the end)", async () => {
    await render(
      <div dir="rtl" className="w-96">
        <Basic defaultValue={[photo()]} />
      </div>,
    );
    const item = items()[0] as HTMLElement;
    const preview = slot("file-upload-item-preview", item).getBoundingClientRect();
    const remove = (removes()[0] as HTMLElement).getBoundingClientRect();
    const name = slot("file-upload-item-name", item).getBoundingClientRect();
    expect(preview.left).toBeGreaterThan(name.left);
    expect(name.left).toBeGreaterThan(remove.left);
  });

  it("at 390px nothing overflows; a long name truncates", async () => {
    await page.viewport(390, 800);
    try {
      await render(
        <div className="p-4">
          <Basic
            defaultValue={[
              makeFile(
                "a-very-long-file-name-that-would-never-fit-on-a-phone-screen-at-all.pdf",
                "application/pdf",
              ),
            ]}
          />
        </div>,
      );
      const box = root().getBoundingClientRect();
      expect(box.right).toBeLessThanOrEqual(390);
      expect(dropzone().getBoundingClientRect().right).toBeLessThanOrEqual(box.right);
      const item = items()[0] as HTMLElement;
      expect(item.getBoundingClientRect().right).toBeLessThanOrEqual(box.right);
      const name = slot("file-upload-item-name", item);
      expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
    } finally {
      await page.viewport(1280, 720);
    }
  });

  it("forced colors: CanvasText dashed border, Highlight while dragging, a Highlight ring, no ring before focus", async () => {
    await render(<Basic />);
    await emulateForcedColors(true);
    const zone = dropzone();
    expect(getComputedStyle(zone).borderTopStyle).toBe("dashed");
    await expect.poll(() => getComputedStyle(zone).borderTopColor).toBe(systemColor("CanvasText"));
    expect(getComputedStyle(zone).outlineStyle).toBe("none");
    const data = dataTransfer([photo()]);
    fire(zone, "dragenter", data);
    await expect.poll(() => getComputedStyle(zone).borderTopColor).toBe(systemColor("Highlight"));
    fire(zone, "dragleave", data);
    await userEvent.tab();
    await expect.poll(() => getComputedStyle(zone).outlineStyle).toBe("solid");
    // The outline colour transitions (150ms): wait for it to settle.
    await expect.poll(() => getComputedStyle(zone).outlineColor).toBe(systemColor("Highlight"));
  });

  it("forced colors: the error item keeps its icon and text", async () => {
    await render(
      <FileUpload defaultValue={[photo()]}>
        <FileUploadDropzone />
        <FileUploadList>
          {(files) => <FileUploadItem file={files[0] as File} status="error" error="Failed" />}
        </FileUploadList>
      </FileUpload>,
    );
    await emulateForcedColors(true);
    const error = slot("file-upload-item-error");
    expect(error.querySelector("svg")).not.toBeNull();
    expect(error.textContent).toBe("Failed");
  });

  it("dragging uses the primary-soft look", async () => {
    const screen = await render(
      <div>
        <Basic />
        <span data-testid="soft" className="border border-primary bg-primary-soft" />
      </div>,
    );
    const zone = dropzone();
    fire(zone, "dragenter", dataTransfer([photo()]));
    const soft = getComputedStyle(screen.getByTestId("soft").element());
    await expect.poll(() => getComputedStyle(zone).backgroundColor).toBe(soft.backgroundColor);
    await expect.poll(() => getComputedStyle(zone).borderTopColor).toBe(soft.borderTopColor);
  });

  it("reduced motion: the dropzone has no transition", async () => {
    await render(<Basic />);
    expect(getComputedStyle(dropzone()).transitionProperty).not.toBe("none");
    await emulateReducedMotion(true);
    expect(getComputedStyle(dropzone()).transitionProperty).toBe("none");
  });
});

describe("FileUpload: SSR and hydration", () => {
  it("renderToString renders the name and the icon box (no preview image); hydration raises no recoverable error", async () => {
    const files = [photo()];
    const element = (
      <Field name="attachments">
        <FieldLabel>Attachments</FieldLabel>
        <Basic locale="en-US" defaultValue={files} />
      </Field>
    );
    const html = renderToString(element);
    expect(html).toContain("photo.png");
    expect(html).toContain('data-slot="file-upload-item-preview"');
    expect(html).not.toContain("<img");
    expect(html).toContain('data-slot="file-upload-status"');
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const hydrated = hydrateRoot(container, element, { onRecoverableError });
    try {
      await expect
        .poll(() => container.querySelector("img")?.getAttribute("src") ?? "")
        .toMatch(/^blob:/);
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(names(container)).toEqual(["photo.png"]);
    } finally {
      consoleError.mockRestore();
      hydrated.unmount();
      container.remove();
    }
  });
});

describe("FileUpload: accessibility", () => {
  it.each(["light", "dark"] as const)(
    "has no axe violations or incomplete results (%s)",
    async (theme) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      const screen = await render(
        <div className="flex flex-col gap-6 bg-background p-4">
          <Field>
            <FieldLabel>Attachments</FieldLabel>
            <FileUpload defaultValue={[photo(), report(), notes()]} maxSize={10_000_000}>
              <FileUploadDropzone />
              <FileUploadList>
                {(files) => (
                  <>
                    <FileUploadItem file={files[0] as File} progress={60} status="uploading" />
                    <FileUploadItem file={files[1] as File} status="complete" />
                    <FileUploadItem file={files[2] as File} status="error" error="Upload failed" />
                  </>
                )}
              </FileUploadList>
            </FileUpload>
            <FieldDescription>Images and PDFs.</FieldDescription>
          </Field>
          <Basic aria-label="Empty" />
          <Basic aria-label="Required" required />
          <Basic aria-label="Dragging" />
          <Basic aria-label="Rejections" accept="image/*" />
          <Basic aria-label="Disabled" disabled defaultValue={[photo()]} />
          <Field invalid>
            <FieldLabel>Invalid</FieldLabel>
            <Basic />
            <FieldError match>Add a file.</FieldError>
          </Field>
          <div dir="rtl">
            <Basic aria-label="ملفات" defaultValue={[report()]} />
          </div>
          {/* A colour reference for the dragging look (not audited content). */}
          <span
            data-testid="soft"
            aria-hidden="true"
            className="bg-primary-soft text-primary-soft-foreground"
          />
        </div>,
      );
      const zones = [...document.querySelectorAll("[data-slot=file-upload-dropzone]")];
      fire(zones[2] as Element, "dragenter", dataTransfer([photo()]));
      await userEvent.upload(page.getByLabelText("Rejections"), notes());
      await expect.poll(rejectionTexts).toHaveLength(1);
      // The mirrored ring is audited too.
      await userEvent.tab();
      await expect.poll(() => zones[0]?.hasAttribute("data-focus-visible")).toBe(true);
      await expect.poll(() => zones[2]?.hasAttribute("data-dragging")).toBe(true);
      // The dragging colours transition (150ms): wait until they settle on the reference.
      const soft = getComputedStyle(screen.getByTestId("soft").element());
      await expect
        .poll(() => getComputedStyle(zones[2] as Element).backgroundColor)
        .toBe(soft.backgroundColor);
      await expect.poll(() => getComputedStyle(zones[2] as Element).color).toBe(soft.color);
      const results = await axe.run(screen.container);
      expect(
        results.violations.map(
          (v) =>
            `${v.id}: ${v.nodes.map((n) => `${n.target} ${JSON.stringify(n.any.map((c) => c.data))}`)}`,
        ),
      ).toEqual([]);
      expect(
        results.incomplete.map(
          (v) =>
            `${v.id}: ${v.nodes.map((n) => `${n.target} ${JSON.stringify(n.any.map((c) => c.data))}`)}`,
        ),
      ).toEqual([]);
    },
  );
});
