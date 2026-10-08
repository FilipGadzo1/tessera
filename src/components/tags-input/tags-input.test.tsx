import axe from "axe-core";
import { useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
  systemColor,
} from "../../../test/emulation";
import { waitForPopupSettled } from "../../../test/overlay";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { Input } from "../input";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { TagsInput, type TagsInputProps } from "./tags-input";

afterEach(async () => {
  document.documentElement.classList.remove("dark");
  await resetEmulatedMedia();
  vi.restoreAllMocks();
});

const root = (scope: ParentNode = document) =>
  scope.querySelector<HTMLElement>("[data-slot=tags-input]") as HTMLElement;
const input = (scope: ParentNode = document) =>
  scope.querySelector<HTMLInputElement>("[data-slot=tags-input-input]") as HTMLInputElement;
const list = (scope: ParentNode = document) =>
  scope.querySelector<HTMLElement>("[data-slot=tags-input-list]");
const chips = (scope: ParentNode = document) => [
  ...scope.querySelectorAll<HTMLElement>("[data-slot=tags-input-tag]"),
];
const tags = (scope: ParentNode = document) =>
  [...scope.querySelectorAll("[data-slot=tags-input-tag-text]")].map((t) => t.textContent);
const removes = (scope: ParentNode = document) => [
  ...scope.querySelectorAll<HTMLButtonElement>("[data-slot=tags-input-tag-remove]"),
];
const status = (scope: ParentNode = document) =>
  scope.querySelector<HTMLElement>("[data-slot=tags-input-status]") as HTMLElement;
const statusText = () => status().textContent?.replace(/ $/, "");
const focusedRemove = () => removes().indexOf(document.activeElement as HTMLButtonElement);

/** Sends one key at a time: focus may move between the input and the tags after each. */
async function press(...keys: string[]) {
  for (const key of keys) await userEvent.keyboard(key);
}

function paste(target: HTMLElement, text: string) {
  const data = new DataTransfer();
  data.setData("text/plain", text);
  const event = new ClipboardEvent("paste", {
    clipboardData: data,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

/** A mobile keyboard's edit: the value changes with no identifiable keydown. */
function setNativeValue(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
}

function Basic(props: TagsInputProps) {
  return <TagsInput inputProps={{ "aria-label": "Topics" }} {...props} />;
}

describe("TagsInput: structure", () => {
  it("renders the input, a list named Tags with one listitem per tag, remove buttons out of the Tab order, and a status region", async () => {
    await render(<TagsInput defaultValue={["react", "vue"]} className="w-80" />);
    const element = root();
    expect(element.classList.contains("w-80")).toBe(true);
    expect(element.getAttribute("data-size")).toBe("md");
    await expect.element(page.getByRole("textbox", { name: "Add a tag" })).toBeInTheDocument();
    const tagList = page.getByRole("list", { name: "Tags" });
    await expect.element(tagList).toBeInTheDocument();
    expect(list()?.className).toContain("contents");
    expect(tagList.getByRole("listitem").elements()).toHaveLength(2);
    expect(tags()).toEqual(["react", "vue"]);
    for (const [tag, button] of [
      ["react", removes()[0]],
      ["vue", removes()[1]],
    ] as const) {
      await expect.element(page.getByRole("button", { name: `Remove ${tag}` })).toBeInTheDocument();
      expect(button?.tabIndex).toBe(-1);
      expect(button?.type).toBe("button");
    }
    expect(status().getAttribute("role")).toBe("status");
    expect(status().className).toContain("sr-only");
    expect(input().getAttribute("enterkeyhint")).toBe("enter");
    expect(input().getAttribute("autocomplete")).toBe("off");
  });

  it("renders no list without tags, but the status region exists before any change", async () => {
    await render(<Basic />);
    expect(list()).toBeNull();
    expect(status()).not.toBeNull();
    expect(status().textContent).toBe("");
    await expect.element(page.getByRole("textbox", { name: "Topics" })).toBeInTheDocument();
  });

  it("a Field label names the input (label for) and the list; the description describes the input", async () => {
    await render(
      <Field>
        <FieldLabel>Topics</FieldLabel>
        <TagsInput defaultValue={["react"]} />
        <FieldDescription>Press Enter to add.</FieldDescription>
      </Field>,
    );
    const label = document.querySelector("[data-slot=field-label]") as HTMLLabelElement;
    expect(label.htmlFor).toBe(input().id);
    const textbox = page.getByRole("textbox", { name: "Topics" });
    await expect.element(textbox).toHaveAccessibleDescription("Press Enter to add.");
    expect(input().hasAttribute("aria-label")).toBe(false);
    await expect.element(page.getByRole("list", { name: "Topics" })).toBeInTheDocument();
    await userEvent.click(label);
    expect(document.activeElement).toBe(input());
  });

  it("takes custom labels: list, remove, added, removed", async () => {
    await render(
      <Basic
        defaultValue={["a"]}
        listLabel="Etiketten"
        removeLabel={(tag) => `${tag} entfernen`}
        addedLabel={(tag) => `${tag} hinzugefügt`}
        removedLabel={(tag) => `${tag} entfernt`}
      />,
    );
    await expect.element(page.getByRole("list", { name: "Etiketten" })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "a entfernen" })).toBeInTheDocument();
    await userEvent.click(input());
    await press("b", "{Enter}");
    await expect.poll(statusText).toBe("b hinzugefügt");
    await press("{Backspace}");
    await expect.poll(statusText).toBe("b entfernt");
  });
});

describe("TagsInput: commit", () => {
  it("Enter and ',' add the trimmed text, clear the input and announce it", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(input());
    await userEvent.keyboard("  react ");
    await press("{Enter}");
    await expect.poll(() => tags()).toEqual(["react"]);
    expect(onValueChange).toHaveBeenLastCalledWith(["react"]);
    expect(input().value).toBe("");
    await expect.poll(statusText).toBe("react added");
    await userEvent.keyboard("vue");
    await press(",");
    await expect.poll(() => tags()).toEqual(["react", "vue"]);
    expect(input().value).toBe("");
    await expect.poll(statusText).toBe("vue added");
  });

  it("the commit key is prevented: neither Enter nor the delimiter reaches the form or the text", async () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    await render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent)}>
        <Basic />
      </form>,
    );
    const prevented: boolean[] = [];
    const listener = (event: KeyboardEvent) => prevented.push(event.defaultPrevented);
    window.addEventListener("keydown", listener);
    try {
      await userEvent.click(input());
      await userEvent.keyboard("a");
      prevented.length = 0;
      await press("{Enter}");
      await userEvent.keyboard("b");
      await press(",");
      // A delimiter in an empty input is not typed either.
      await press(",");
    } finally {
      window.removeEventListener("keydown", listener);
    }
    expect(prevented).toEqual([true, false, true, true]);
    expect(tags()).toEqual(["a", "b"]);
    expect(input().value).toBe("");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Enter with an empty input is not handled: it submits the enclosing form and adds nothing", async () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    await render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent)}>
        <Basic defaultValue={["react"]} />
        <button type="submit">Save</button>
      </form>,
    );
    await userEvent.click(input());
    await press("{Enter}");
    await expect.poll(() => onSubmit.mock.calls.length).toBe(1);
    expect(tags()).toEqual(["react"]);
    // Whitespace only is empty too.
    await userEvent.keyboard("   ");
    await press("{Enter}");
    await expect.poll(() => onSubmit.mock.calls.length).toBe(2);
    expect(tags()).toEqual(["react"]);
  });

  it("delimiters={[',', ';']}: either commits", async () => {
    await render(<Basic delimiters={[",", ";"]} />);
    await userEvent.click(input());
    await userEvent.keyboard("a");
    await press(";");
    await userEvent.keyboard("b");
    await press(",");
    await expect.poll(() => tags()).toEqual(["a", "b"]);
  });

  it("delimiters={[';']}: a comma is ordinary text", async () => {
    await render(<Basic delimiters={[";"]} />);
    await userEvent.click(input());
    await userEvent.keyboard("a,b");
    await press(";");
    await expect.poll(() => tags()).toEqual(["a,b"]);
  });

  it("a mobile-style change containing delimiters commits each piece before the last and keeps the rest", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(input());
    setNativeValue(input(), "a,b,");
    await expect.poll(() => tags()).toEqual(["a", "b"]);
    expect(input().value).toBe("");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(["a", "b"]);
    await expect.poll(statusText).toBe("2 tags added");
    setNativeValue(input(), "c, d");
    await expect.poll(() => tags()).toEqual(["a", "b", "c"]);
    expect(input().value).toBe(" d");
  });

  it("paste 'a, b\\nc' adds three tags with one announcement", async () => {
    const onValueChange = vi.fn();
    await render(<Basic onValueChange={onValueChange} />);
    await userEvent.click(input());
    expect(paste(input(), "a, b\nc").defaultPrevented).toBe(true);
    await expect.poll(() => tags()).toEqual(["a", "b", "c"]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(input().value).toBe("");
    await expect.poll(statusText).toBe("3 tags added");
  });

  it("paste with a duplicate and an invalid piece keeps them in the input ('b, x') and announces", async () => {
    const onTagRejected = vi.fn();
    await render(
      <Basic
        defaultValue={["b"]}
        validate={(tag) => (tag === "x" ? "x is not allowed" : null)}
        onTagRejected={onTagRejected}
      />,
    );
    await userEvent.click(input());
    paste(input(), "a, b, x");
    await expect.poll(() => tags()).toEqual(["b", "a"]);
    await expect.poll(() => input().value).toBe("b, x");
    await expect.poll(statusText).toBe("a added. b is already added");
    expect(onTagRejected.mock.calls.map(([r]) => r.reason)).toEqual(["duplicate", "invalid"]);
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(root().hasAttribute("data-invalid")).toBe(true);
  });

  it("paste counts max as it goes", async () => {
    await render(<Basic max={2} defaultValue={["a"]} />);
    await userEvent.click(input());
    paste(input(), "b, c, d");
    await expect.poll(() => tags()).toEqual(["a", "b"]);
    await expect.poll(() => input().value).toBe("c, d");
    await expect.poll(statusText).toBe("b added. You can add up to 2 tags");
  });

  it("text without a delimiter pastes natively", async () => {
    await render(<Basic />);
    await userEvent.click(input());
    expect(paste(input(), "react").defaultPrevented).toBe(false);
    expect(tags()).toEqual([]);
  });
});

describe("TagsInput: rejections", () => {
  it.each([
    {
      name: "a case-insensitive duplicate",
      props: { defaultValue: ["react"] },
      text: "React",
      reason: "duplicate",
      message: "React is already added",
    },
    {
      name: "max",
      props: { defaultValue: ["a", "b"], max: 2 },
      text: "c",
      reason: "max",
      message: "You can add up to 2 tags",
    },
    {
      name: "validate",
      props: { validate: (tag: string) => (/\s/.test(tag) ? "Use no spaces" : null) },
      text: "two words",
      reason: "invalid",
      message: "Use no spaces",
    },
  ] as const)(
    "$name: the text stays, the field is invalid until the text changes, the reason is reported and announced",
    async ({ props, text, reason, message }) => {
      const onTagRejected = vi.fn();
      const onValueChange = vi.fn();
      await render(
        <Basic
          {...(props as TagsInputProps)}
          onTagRejected={onTagRejected}
          onValueChange={onValueChange}
        />,
      );
      const before = tags();
      await userEvent.click(input());
      await userEvent.keyboard(text);
      await press("{Enter}");
      expect(onTagRejected).toHaveBeenCalledWith({ tag: text, reason, message });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(tags()).toEqual(before);
      expect(input().value).toBe(text);
      await expect.poll(() => input().getAttribute("aria-invalid")).toBe("true");
      expect(root().hasAttribute("data-invalid")).toBe(true);
      await expect.poll(statusText).toBe(message);
      await userEvent.keyboard("x");
      await expect.poll(() => input().hasAttribute("aria-invalid")).toBe(false);
      expect(root().hasAttribute("data-invalid")).toBe(false);
    },
  );

  it("checks in order: max, then duplicate, then validate", async () => {
    const onTagRejected = vi.fn();
    const validate = vi.fn(() => "never");
    await render(
      <Basic defaultValue={["a"]} max={1} validate={validate} onTagRejected={onTagRejected} />,
    );
    await userEvent.click(input());
    await userEvent.keyboard("a");
    await press("{Enter}");
    expect(onTagRejected.mock.calls[0]?.[0].reason).toBe("max");
    expect(validate).not.toHaveBeenCalled();
  });

  it("validate receives the trimmed tag and the current tags", async () => {
    const validate = vi.fn(() => null);
    await render(<Basic defaultValue={["a"]} validate={validate} />);
    await userEvent.click(input());
    await userEvent.keyboard(" b ");
    await press("{Enter}");
    expect(validate).toHaveBeenCalledWith("b", ["a"]);
  });

  it("allowDuplicates accepts a duplicate", async () => {
    await render(<Basic defaultValue={["react"]} allowDuplicates />);
    await userEvent.click(input());
    await userEvent.keyboard("React");
    await press("{Enter}");
    await expect.poll(() => tags()).toEqual(["react", "React"]);
  });

  it("rejectionLabel translates the messages", async () => {
    const onTagRejected = vi.fn();
    await render(
      <Basic
        defaultValue={["a"]}
        max={1}
        rejectionLabel={(reason, tag, { max }) => `${reason}:${tag}:${max}`}
        onTagRejected={onTagRejected}
      />,
    );
    await userEvent.click(input());
    await userEvent.keyboard("b");
    await press("{Enter}");
    await expect.poll(statusText).toBe("max:b:1");
    expect(onTagRejected).toHaveBeenCalledWith({ tag: "b", reason: "max", message: "max:b:1" });
  });
});

describe("TagsInput: removal", () => {
  it("Backspace in the empty input removes the last tag and announces it", async () => {
    const onValueChange = vi.fn();
    await render(<Basic defaultValue={["a", "b"]} onValueChange={onValueChange} />);
    await userEvent.click(input());
    await press("{Backspace}");
    await expect.poll(() => tags()).toEqual(["a"]);
    expect(onValueChange).toHaveBeenLastCalledWith(["a"]);
    await expect.poll(statusText).toBe("b removed");
    expect(document.activeElement).toBe(input());
  });

  it("Backspace with text (caret at the end or at 0) edits the text, never a tag", async () => {
    await render(<Basic defaultValue={["a", "b"]} />);
    await userEvent.click(input());
    await userEvent.keyboard("xy");
    await press("{Backspace}");
    expect(input().value).toBe("x");
    input().setSelectionRange(0, 0);
    await press("{Backspace}");
    expect(input().value).toBe("x");
    expect(tags()).toEqual(["a", "b"]);
  });

  it("clicking × removes that tag and focuses the input", async () => {
    const onValueChange = vi.fn();
    await render(<Basic defaultValue={["a", "b", "c"]} onValueChange={onValueChange} />);
    await userEvent.click(page.getByRole("button", { name: "Remove b" }));
    await expect.poll(() => tags()).toEqual(["a", "c"]);
    expect(onValueChange).toHaveBeenLastCalledWith(["a", "c"]);
    await expect.poll(() => document.activeElement).toBe(input());
    await expect.poll(statusText).toBe("b removed");
  });

  it("clicking the padding or a tag's text focuses the input", async () => {
    await render(<Basic defaultValue={["react"]} className="w-80" />);
    const box = root().getBoundingClientRect();
    await userEvent.click(root(), { position: { x: 2, y: box.height / 2 } });
    expect(document.activeElement).toBe(input());
    input().blur();
    await userEvent.click(root().querySelector("[data-slot=tags-input-tag-text]") as HTMLElement);
    expect(document.activeElement).toBe(input());
  });
});

describe("TagsInput: tag navigation", () => {
  it("← at caret 0 focuses the last remove button; ← / → / Home / End move; → past the last returns to the input at caret 0", async () => {
    await render(<Basic defaultValue={["a", "b", "c"]} />);
    await userEvent.click(input());
    await userEvent.keyboard("xy");
    // The caret is after the text: ← moves the caret.
    await press("{ArrowLeft}");
    expect(document.activeElement).toBe(input());
    await press("{ArrowLeft}");
    expect(input().selectionStart).toBe(0);
    await press("{ArrowLeft}");
    expect(focusedRemove()).toBe(2);
    await press("{ArrowLeft}");
    expect(focusedRemove()).toBe(1);
    await press("{ArrowLeft}", "{ArrowLeft}");
    expect(focusedRemove()).toBe(0);
    await press("{End}");
    expect(focusedRemove()).toBe(2);
    await press("{Home}");
    expect(focusedRemove()).toBe(0);
    await press("{ArrowRight}", "{ArrowRight}");
    expect(focusedRemove()).toBe(2);
    await press("{ArrowRight}");
    expect(document.activeElement).toBe(input());
    expect(input().selectionStart).toBe(0);
    expect(input().selectionEnd).toBe(0);
  });

  it("← with a selection in the input does not enter the tags", async () => {
    await render(<Basic defaultValue={["a"]} />);
    await userEvent.click(input());
    await userEvent.keyboard("xy");
    input().setSelectionRange(0, 2);
    await press("{ArrowLeft}");
    expect(document.activeElement).toBe(input());
  });

  it.each(["{Backspace}", "{Delete}", "{Enter}", " "])(
    "%s on a remove button removes the tag; focus goes to the tag now at that index, else the previous, else the input",
    async (key) => {
      const onSubmit = vi.fn((event: Event) => event.preventDefault());
      await render(
        <form onSubmit={(event) => onSubmit(event.nativeEvent)}>
          <Basic defaultValue={["a", "b", "c"]} />
        </form>,
      );
      await userEvent.click(input());
      await press("{ArrowLeft}", "{ArrowLeft}");
      expect(focusedRemove()).toBe(1);
      await press(key);
      await expect.poll(() => tags()).toEqual(["a", "c"]);
      await expect.poll(focusedRemove).toBe(1);
      await expect.poll(statusText).toBe("b removed");
      await press(key);
      await expect.poll(() => tags()).toEqual(["a"]);
      await expect.poll(focusedRemove).toBe(0);
      await press(key);
      await expect.poll(() => tags()).toEqual([]);
      await expect.poll(() => document.activeElement).toBe(input());
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("Escape on a remove button returns to the input; Tab from it goes on to the input", async () => {
    await render(<Basic defaultValue={["a", "b"]} />);
    await userEvent.click(input());
    await press("{ArrowLeft}");
    expect(focusedRemove()).toBe(1);
    await press("{Escape}");
    expect(document.activeElement).toBe(input());
    await press("{ArrowLeft}", "{ArrowLeft}");
    expect(focusedRemove()).toBe(0);
    await userEvent.tab();
    expect(document.activeElement).toBe(input());
  });

  it("RTL: → enters the tags and ← / → follow the visual order", async () => {
    await render(
      <div dir="rtl">
        <Basic defaultValue={["a", "b", "c"]} className="w-96" />
      </div>,
    );
    const [a, b, c] = chips().map((chip) => chip.getBoundingClientRect());
    // Right to left: a, b, c, then the input.
    expect(a?.left).toBeGreaterThan(b?.left ?? 0);
    expect(b?.left).toBeGreaterThan(c?.left ?? 0);
    expect(input().getBoundingClientRect().right).toBeLessThanOrEqual((c?.left ?? 0) + 1);
    await userEvent.click(input());
    await press("{ArrowLeft}");
    expect(document.activeElement).toBe(input());
    await press("{ArrowRight}");
    expect(focusedRemove()).toBe(2);
    // → goes to the visually right neighbour: the previous tag.
    await press("{ArrowRight}");
    expect(focusedRemove()).toBe(1);
    await press("{ArrowLeft}");
    expect(focusedRemove()).toBe(2);
    await press("{ArrowLeft}");
    expect(document.activeElement).toBe(input());
  });
});

describe("TagsInput: Escape, IME and blur", () => {
  it("Escape with text clears it and claims the key: a Popover around it closes on the second Escape", async () => {
    await render(
      <div className="p-16">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>Edit tags</PopoverTrigger>
          <PopoverContent aria-label="Tags editor">
            <Basic defaultValue={["a"]} />
          </PopoverContent>
        </Popover>
      </div>,
    );
    await userEvent.click(page.getByRole("button", { name: "Edit tags" }));
    const popup = page.getByRole("dialog").element() as HTMLElement;
    await waitForPopupSettled(popup);
    await userEvent.click(input());
    await userEvent.keyboard("draft");
    await press("{Escape}");
    expect(input().value).toBe("");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(popup.isConnected).toBe(true);
    expect(popup.hasAttribute("data-ending-style")).toBe(false);
    expect(document.activeElement).toBe(input());
    // Escape on a remove button is consumed too: it returns to the input.
    await press("{ArrowLeft}");
    expect(focusedRemove()).toBe(0);
    await press("{Escape}");
    expect(document.activeElement).toBe(input());
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(popup.hasAttribute("data-ending-style")).toBe(false);
    expect(popup.isConnected).toBe(true);
    await press("{Escape}");
    await expect.poll(() => document.querySelector("[role=dialog]")).toBeNull();
  });

  it("an Enter that belongs to an IME composition adds nothing; the committed text stays", async () => {
    await render(<Basic />);
    await userEvent.click(input());
    await cdp().send("Input.imeSetComposition", {
      text: "にほん",
      selectionStart: 3,
      selectionEnd: 3,
    });
    input().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        keyCode: 229,
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await cdp().send("Input.insertText", { text: "日本" });
    await expect.poll(() => input().value).toBe("日本");
    expect(tags()).toEqual([]);
    await press("{Enter}");
    await expect.poll(() => tags()).toEqual(["日本"]);
  });

  it("addOnBlur commits the text on blur; without it the text stays", async () => {
    const { rerender } = await render(
      <div>
        <Basic addOnBlur />
        <button type="button">after</button>
      </div>,
    );
    await userEvent.click(input());
    await userEvent.keyboard("react");
    await userEvent.click(page.getByRole("button", { name: "after" }));
    await expect.poll(() => tags()).toEqual(["react"]);
    expect(input().value).toBe("");
    await rerender(
      <div>
        <Basic addOnBlur={false} />
        <button type="button">after</button>
      </div>,
    );
    await userEvent.click(input());
    await userEvent.keyboard("vue");
    await userEvent.click(page.getByRole("button", { name: "after" }));
    expect(tags()).toEqual(["react"]);
    expect(input().value).toBe("vue");
  });
});

describe("TagsInput: read-only and disabled", () => {
  it("read-only: tags without remove buttons, a read-only input, no commit, removal or paste splitting", async () => {
    const onValueChange = vi.fn();
    await render(<Basic readOnly defaultValue={["a", "b"]} onValueChange={onValueChange} />);
    expect(root().hasAttribute("data-readonly")).toBe(true);
    expect(removes()).toHaveLength(0);
    expect(chips()[0]?.className).toContain("pe-1.5");
    expect(input().readOnly).toBe(true);
    await userEvent.click(input());
    await press("{Backspace}", "{ArrowLeft}");
    expect(document.activeElement).toBe(input());
    expect(paste(input(), "c, d").defaultPrevented).toBe(false);
    setNativeValue(input(), "e,");
    expect(tags()).toEqual(["a", "b"]);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(getComputedStyle(root()).backgroundColor).not.toBe(
      getComputedStyle(document.body).backgroundColor,
    );
  });

  it("disabled: nothing is focusable; opacity 0.5 and a not-allowed cursor", async () => {
    await render(
      <div>
        <Basic disabled defaultValue={["a"]} />
        <button type="button">after</button>
      </div>,
    );
    expect(root().hasAttribute("data-disabled")).toBe(true);
    expect(input().disabled).toBe(true);
    expect(removes()[0]?.disabled).toBe(true);
    expect(getComputedStyle(root()).opacity).toBe("0.5");
    expect(getComputedStyle(root()).cursor).toBe("not-allowed");
    expect(getComputedStyle(removes()[0] as HTMLElement).cursor).toBe("not-allowed");
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("after");
  });
});

describe("TagsInput: controlled and uncontrolled", () => {
  it("controlled value: onValueChange reports and the parent's value shows", async () => {
    function Controlled() {
      const [value, setValue] = useState(["a"]);
      return (
        <div>
          <Basic value={value} onValueChange={setValue} />
          <output data-testid="value">{value.join("|")}</output>
        </div>
      );
    }
    const screen = await render(<Controlled />);
    await userEvent.click(input());
    await userEvent.keyboard("b");
    await press("{Enter}");
    await expect.element(screen.getByTestId("value")).toHaveTextContent("a|b");
    expect(tags()).toEqual(["a", "b"]);
    expect(input().value).toBe("");
  });

  it("a controlled parent that refuses an add keeps its tags and the typed text", async () => {
    const onValueChange = vi.fn();
    await render(<Basic value={["a"]} onValueChange={onValueChange} />);
    await userEvent.click(input());
    await userEvent.keyboard("b");
    await press("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith(["a", "b"]);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(tags()).toEqual(["a"]);
    expect(input().value).toBe("b");
    // Refused removal: the tag stays.
    await userEvent.click(page.getByRole("button", { name: "Remove a" }));
    expect(onValueChange).toHaveBeenLastCalledWith([]);
    expect(tags()).toEqual(["a"]);
  });

  it("controlled inputValue: onInputValueChange reports typing and clearing", async () => {
    const onInputValueChange = vi.fn();
    function Controlled() {
      const [text, setText] = useState("re");
      return (
        <Basic
          inputValue={text}
          onInputValueChange={(next) => {
            onInputValueChange(next);
            setText(next);
          }}
        />
      );
    }
    await render(<Controlled />);
    expect(input().value).toBe("re");
    await userEvent.click(input());
    await userEvent.keyboard("act");
    expect(onInputValueChange).toHaveBeenLastCalledWith("react");
    await press("{Enter}");
    await expect.poll(() => tags()).toEqual(["react"]);
    expect(onInputValueChange).toHaveBeenLastCalledWith("");
    expect(input().value).toBe("");
  });

  it("a controlled inputValue the parent ignores stays", async () => {
    await render(<Basic inputValue="fixed" />);
    await userEvent.click(input());
    await userEvent.keyboard("x");
    expect(input().value).toBe("fixed");
  });

  it("uncontrolled defaults: defaultValue and defaultInputValue", async () => {
    await render(<Basic defaultValue={["a"]} defaultInputValue="b" />);
    expect(tags()).toEqual(["a"]);
    expect(input().value).toBe("b");
    await userEvent.click(input());
    await press("{Enter}");
    await expect.poll(() => tags()).toEqual(["a", "b"]);
  });
});

function TagsForm({
  children,
  onFormSubmit = () => {},
  validationMode,
}: {
  children: React.ReactNode;
  onFormSubmit?: (values: Record<string, unknown>) => void;
  validationMode?: "onSubmit" | "onBlur" | "onChange";
}) {
  return (
    <Form aria-label="Post" onFormSubmit={onFormSubmit} validationMode={validationMode}>
      <Field name="topics">
        <FieldLabel>Topics</FieldLabel>
        {children}
        <FieldError />
      </Field>
      <Button type="submit">Send</Button>
    </Form>
  );
}

const send = () => userEvent.click(page.getByRole("button", { name: "Send", exact: true }));

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

describe("TagsInput: Form and Field", () => {
  it("name → FormData.getAll is the tags in order; an empty value submits no entry", async () => {
    let data: FormData | null = null;
    await render(
      <NativeForm onData={(next) => (data = next)}>
        <Basic name="tags" defaultValue={["b", "a", "c"]} />
        <TagsInput inputProps={{ "aria-label": "Other" }} name="other" />
      </NativeForm>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    const form = data as unknown as FormData;
    expect(form.getAll("tags")).toEqual(["b", "a", "c"]);
    expect(form.has("other")).toBe(false);
    expect([...form.keys()]).toEqual(["tags", "tags", "tags"]);
  });

  it("a Field name alone names the native FormData entries (name ?? field.name)", async () => {
    let data: FormData | null = null;
    await render(
      <NativeForm onData={(next) => (data = next)}>
        <Field name="tags">
          <FieldLabel>Tags</FieldLabel>
          <TagsInput defaultValue={["react", "vue"]} />
        </Field>
      </NativeForm>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    expect((data as unknown as FormData).getAll("tags")).toEqual(["react", "vue"]);
  });

  it("allowDuplicates: two equal tags give two chips and two entries, with no React key warning", async () => {
    const consoleError = vi.spyOn(console, "error");
    let data: FormData | null = null;
    await render(
      <NativeForm onData={(next) => (data = next)}>
        <Basic name="tags" allowDuplicates defaultValue={["a"]} />
      </NativeForm>,
    );
    await userEvent.click(input());
    await userEvent.keyboard("a");
    await press("{Enter}");
    await expect.poll(() => tags()).toEqual(["a", "a"]);
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    expect((data as unknown as FormData).getAll("tags")).toEqual(["a", "a"]);
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/same key/i);
    // Removing the first of two equal tags keeps the second.
    await userEvent.click(removes()[0] as HTMLElement);
    await expect.poll(() => tags()).toEqual(["a"]);
  });

  it("onFormSubmit reports string[] under the Field name; one registered control, nameless", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <TagsForm onFormSubmit={onFormSubmit}>
        <TagsInput defaultValue={["react", "vue"]} />
      </TagsForm>,
    );
    const controls = document.querySelectorAll<HTMLInputElement>(
      "[data-slot=tags-input-form-control]",
    );
    expect(controls).toHaveLength(1);
    expect(controls[0]?.hasAttribute("name")).toBe(false);
    await send();
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({ topics: ["react", "vue"] });
  });

  it("the hidden inputs render after the root, outside its border", async () => {
    await render(<Basic name="tags" defaultValue={["a"]} />);
    const element = root();
    expect(element.querySelector("input[type=hidden]")).toBeNull();
    expect(element.querySelector("[data-slot=tags-input-form-control]")).toBeNull();
    const siblings: Element[] = [];
    for (let node = element.nextElementSibling; node; node = node.nextElementSibling) {
      siblings.push(node);
    }
    expect(
      siblings.map((node) => node.getAttribute("data-slot") ?? node.getAttribute("type")),
    ).toEqual(["tags-input-form-control", "hidden"]);
  });

  it("required with no tags blocks submit and focuses the input; aria-required on the input, native required on the validation input", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <TagsForm onFormSubmit={onFormSubmit}>
        <TagsInput required />
      </TagsForm>,
    );
    expect(input().getAttribute("aria-required")).toBe("true");
    expect(input().required).toBe(false);
    const control = document.querySelector(
      "[data-slot=tags-input-form-control]",
    ) as HTMLInputElement;
    expect(control.required).toBe(true);
    await send();
    await expect.element(page.getByText(/fill out this field/i)).toBeVisible();
    expect(onFormSubmit).not.toHaveBeenCalled();
    await expect.poll(() => document.activeElement).toBe(input());
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(root().hasAttribute("data-invalid")).toBe(true);
    await userEvent.keyboard("a");
    await press("{Enter}");
    await send();
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
  });

  it("Field validate receives the tags", async () => {
    const validate = vi.fn((value: unknown) =>
      Array.isArray(value) && value.length > 1 ? "At most one" : null,
    );
    await render(
      <Form aria-label="Post">
        <Field name="topics" validate={validate}>
          <FieldLabel>Topics</FieldLabel>
          <TagsInput defaultValue={["a", "b"]} />
          <FieldError />
        </Field>
        <Button type="submit">Send</Button>
      </Form>,
    );
    await send();
    await expect.element(page.getByText("At most one")).toBeVisible();
    expect(validate).toHaveBeenLastCalledWith(["a", "b"], expect.anything());
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
        <Basic name="tags" form="outside" defaultValue={["a", "b"]} />
      </div>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data).not.toBeNull();
    expect((data as unknown as FormData).getAll("tags")).toEqual(["a", "b"]);
  });

  it("a disabled Field disables it; an invalid Field marks it", async () => {
    await render(
      <div>
        <Field disabled>
          <FieldLabel>Disabled</FieldLabel>
          <TagsInput defaultValue={["a"]} />
        </Field>
        <Field invalid>
          <FieldLabel>Invalid</FieldLabel>
          <TagsInput />
        </Field>
      </div>,
    );
    const [disabled, invalid] = [
      ...document.querySelectorAll<HTMLElement>("[data-slot=tags-input]"),
    ];
    expect(disabled?.hasAttribute("data-disabled")).toBe(true);
    expect(input(disabled?.parentElement as ParentNode).disabled).toBe(true);
    expect(invalid?.hasAttribute("data-invalid")).toBe(true);
    expect(input(invalid?.parentElement as ParentNode).getAttribute("aria-invalid")).toBe("true");
  });

  it("onBlur validation runs when focus leaves the input and its tags, not between them", async () => {
    await render(
      <div>
        <TagsForm validationMode="onBlur">
          <TagsInput required defaultValue={["a"]} />
        </TagsForm>
        <button type="button">after</button>
      </div>,
    );
    await userEvent.click(input());
    await press("{Backspace}");
    await expect.poll(() => tags()).toEqual([]);
    await expect.element(page.getByText(/fill out this field/i)).not.toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "after" }));
    await expect.element(page.getByText(/fill out this field/i)).toBeVisible();
  });

  it("moving between the input and a remove button is not a blur", async () => {
    await render(
      <div>
        <TagsForm validationMode="onBlur">
          <TagsInput defaultValue={["a"]} validate={() => null} />
        </TagsForm>
      </div>,
    );
    const fieldRoot = document.querySelector("[data-slot=field]") as HTMLElement;
    await userEvent.click(input());
    expect(fieldRoot.hasAttribute("data-focused")).toBe(true);
    await press("{ArrowLeft}");
    expect(focusedRemove()).toBe(0);
    expect(fieldRoot.hasAttribute("data-focused")).toBe(true);
    expect(fieldRoot.hasAttribute("data-touched")).toBe(false);
  });

  it.each([
    ["keyed by text", false],
    ["allowDuplicates, keyed by index", true],
  ])("removing a focused tag with the keyboard is not a blur (%s)", async (_, allowDuplicates) => {
    await render(
      <div>
        <TagsForm validationMode="onBlur">
          <TagsInput required allowDuplicates={allowDuplicates} defaultValue={["a", "b", "c"]} />
        </TagsForm>
        <button type="button">after</button>
      </div>,
    );
    const fieldRoot = document.querySelector("[data-slot=field]") as HTMLElement;
    await userEvent.click(input());
    await press("{ArrowLeft}");
    expect(focusedRemove()).toBe(2);
    // The last tag: focus goes to the previous one.
    await press("{Enter}");
    await expect.poll(() => tags()).toEqual(["a", "b"]);
    expect(focusedRemove()).toBe(1);
    // The first tag: focus stays at its index (the next tag).
    await press("{Home}");
    await press("{Delete}");
    await expect.poll(() => tags()).toEqual(["b"]);
    expect(focusedRemove()).toBe(0);
    // The only tag: focus goes to the input.
    await press("{Backspace}");
    await expect.poll(() => tags()).toEqual([]);
    expect(document.activeElement).toBe(input());
    expect(fieldRoot.hasAttribute("data-focused")).toBe(true);
    expect(fieldRoot.hasAttribute("data-touched")).toBe(false);
    await expect.element(page.getByText(/fill out this field/i)).not.toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "after" }));
    await expect.element(page.getByText(/fill out this field/i)).toBeVisible();
    expect(fieldRoot.hasAttribute("data-touched")).toBe(true);
  });

  it("a controlled parent that refuses a keyboard removal keeps the tag and the focus", async () => {
    const onValueChange = vi.fn();
    await render(<Basic value={["a", "b"]} onValueChange={onValueChange} />);
    await userEvent.click(input());
    await press("{ArrowLeft}");
    const button = removes()[1] as HTMLButtonElement;
    expect(document.activeElement).toBe(button);
    await press("{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith(["a"]);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(tags()).toEqual(["a", "b"]);
    expect(document.activeElement).toBe(button);
  });
});

describe("TagsInput: sizes and geometry", () => {
  it("sits at the Input heights per size", async () => {
    await render(
      <div className="flex flex-col gap-2">
        {(["sm", "md", "lg"] as const).map((size) => (
          <div key={size} className="flex gap-2">
            <Input aria-label={`input-${size}`} size={size} />
            <TagsInput inputProps={{ "aria-label": `tags-${size}` }} size={size} />
          </div>
        ))}
      </div>,
    );
    for (const [size, height] of [
      ["sm", 32],
      ["md", 40],
      ["lg", 48],
    ] as const) {
      const tagsRoot = page.getByRole("textbox", { name: `tags-${size}` }).element()
        .parentElement as HTMLElement;
      expect(tagsRoot.getBoundingClientRect().height).toBe(height);
      expect(tagsRoot.getAttribute("data-size")).toBe(size);
    }
  });

  it("the input shares a line with the tags while it fits and wraps below them when not; the root grows", async () => {
    await render(<Basic defaultValue={["react"]} className="w-72" />);
    // The vertical centre: the input (h-7) and a chip (h-6) are centred on one line.
    const line = (element: Element) => {
      const box = element.getBoundingClientRect();
      return box.top + box.height / 2;
    };
    expect(Math.abs(line(input()) - line(chips()[0] as HTMLElement))).toBeLessThanOrEqual(1);
    const singleHeight = root().getBoundingClientRect().height;
    await userEvent.click(input());
    for (const tag of ["typescript", "javascript", "css-in-js"]) {
      await userEvent.keyboard(tag);
      await press("{Enter}");
    }
    await expect.poll(() => chips().length).toBe(4);
    const lastChip = chips()[3] as HTMLElement;
    expect(line(input())).toBeGreaterThan(line(chips()[0] as HTMLElement));
    expect(line(input())).toBeGreaterThanOrEqual(line(lastChip) - 1);
    expect(root().getBoundingClientRect().height).toBeGreaterThan(singleHeight);
    expect(root().scrollHeight).toBe(root().clientHeight);
    for (const chip of chips()) {
      expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(
        root().getBoundingClientRect().right,
      );
    }
  });

  it("at 390px nothing overflows, even with a long tag (it truncates)", async () => {
    await page.viewport(390, 800);
    try {
      await render(
        <div className="p-4">
          <Basic
            defaultValue={[
              "react",
              "a-very-long-tag-that-would-never-fit-on-a-phone-screen-at-all",
            ]}
          />
        </div>,
      );
      const box = root().getBoundingClientRect();
      expect(box.right).toBeLessThanOrEqual(390);
      for (const chip of chips()) {
        expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(box.right);
      }
      const text = chips()[1]?.querySelector("[data-slot=tags-input-tag-text]") as HTMLElement;
      expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
    } finally {
      await page.viewport(1280, 720);
    }
  });
});

describe("TagsInput: focus, forced colors and motion", () => {
  it("Tab focuses the input (the root's solid 1px ring); ← gives a remove button's chip a solid 2px ring", async () => {
    await render(<Basic defaultValue={["a", "b"]} />);
    expect(getComputedStyle(root()).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(input());
    const ring = getComputedStyle(root());
    expect(ring.outlineStyle).toBe("solid");
    expect(ring.outlineWidth).toBe("1px");
    for (const chip of chips()) expect(getComputedStyle(chip).outlineStyle).toBe("none");
    // Every focusable remove button: its chip rings, the others do not.
    for (const index of [1, 0]) {
      await press("{ArrowLeft}");
      expect(focusedRemove()).toBe(index);
      expect(removes()[index]?.matches(":focus-visible")).toBe(true);
      const chip = getComputedStyle(chips()[index] as HTMLElement);
      expect(chip.outlineStyle).toBe("solid");
      expect(chip.outlineWidth).toBe("2px");
      expect(getComputedStyle(chips()[1 - index] as HTMLElement).outlineStyle).toBe("none");
      // The root keeps its focus-within ring while a remove button has focus.
      expect(getComputedStyle(root()).outlineStyle).toBe("solid");
    }
  });

  it("forced colors: no ring until focused; the root ring, the chip ring and the chip border", async () => {
    await render(<Basic defaultValue={["a"]} />);
    await emulateForcedColors(true);
    expect(getComputedStyle(root()).outlineStyle).toBe("none");
    expect(getComputedStyle(chips()[0] as HTMLElement).borderTopColor).toBe(
      systemColor("CanvasText"),
    );
    expect(getComputedStyle(chips()[0] as HTMLElement).borderTopStyle).toBe("solid");
    await userEvent.tab();
    expect(getComputedStyle(root()).outlineStyle).toBe("solid");
    expect(getComputedStyle(root()).outlineColor).toBe(systemColor("Highlight"));
    await press("{ArrowLeft}");
    const chip = getComputedStyle(chips()[0] as HTMLElement);
    expect(chip.outlineStyle).toBe("solid");
    expect(chip.outlineColor).toBe(systemColor("Highlight"));
  });

  it("forced colors: an invalid, focused root still rings Highlight", async () => {
    await render(<Basic defaultValue={["a"]} />);
    await emulateForcedColors(true);
    await userEvent.tab();
    await userEvent.keyboard("a");
    await press("{Enter}");
    await expect.poll(() => root().hasAttribute("data-invalid")).toBe(true);
    expect(getComputedStyle(root()).outlineColor).toBe(systemColor("Highlight"));
  });

  it("an invalid root has the danger border and ring", async () => {
    const screen = await render(
      <div>
        <Basic defaultValue={["a"]} />
        <span data-testid="danger" className="border border-danger outline-danger" />
      </div>,
    );
    await userEvent.tab();
    await userEvent.keyboard("a");
    await press("{Enter}");
    await expect.poll(() => root().hasAttribute("data-invalid")).toBe(true);
    const danger = getComputedStyle(screen.getByTestId("danger").element());
    // The border colour transitions (150ms): wait for it to settle.
    await expect.poll(() => getComputedStyle(root()).borderTopColor).toBe(danger.borderTopColor);
    expect(getComputedStyle(root()).outlineColor).toBe(danger.outlineColor);
  });

  it("reduced motion: the root has no transition", async () => {
    await render(<Basic />);
    expect(getComputedStyle(root()).transitionProperty).not.toBe("none");
    await emulateReducedMotion(true);
    expect(getComputedStyle(root()).transitionProperty).toBe("none");
  });
});

describe("TagsInput: SSR and hydration", () => {
  it("renderToString renders the tags and the hidden inputs; hydration raises no recoverable error", async () => {
    const element = (
      <Field name="topics">
        <FieldLabel>Topics</FieldLabel>
        <TagsInput name="tags" defaultValue={["react", "vue"]} />
      </Field>
    );
    const html = renderToString(element);
    expect(html.match(/data-slot="tags-input-tag"/g)).toHaveLength(2);
    expect(html.match(/type="hidden"/g)).toHaveLength(2);
    expect(html).toContain('data-slot="tags-input-status"');
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const hydrated = hydrateRoot(container, element, { onRecoverableError });
    try {
      await expect
        .poll(() => container.querySelector("[data-slot=tags-input-input]"))
        .not.toBeNull();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(tags(container)).toEqual(["react", "vue"]);
    } finally {
      consoleError.mockRestore();
      hydrated.unmount();
      container.remove();
    }
  });
});

describe("TagsInput: accessibility", () => {
  it.each(["light", "dark"] as const)("has no axe violations (%s)", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    const screen = await render(
      <div className="flex flex-col gap-4 bg-background p-4">
        <Field>
          <FieldLabel>Topics</FieldLabel>
          <TagsInput defaultValue={["react", "vue"]} placeholder="Add a topic" />
          <FieldDescription>Press Enter to add.</FieldDescription>
        </Field>
        <TagsInput inputProps={{ "aria-label": "Empty" }} placeholder="Add a tag" />
        <TagsInput inputProps={{ "aria-label": "Rejected" }} defaultValue={["react"]} />
        <TagsInput inputProps={{ "aria-label": "Read-only" }} readOnly defaultValue={["a"]} />
        <TagsInput inputProps={{ "aria-label": "Disabled" }} disabled defaultValue={["a"]} />
        <Field invalid>
          <FieldLabel>Invalid</FieldLabel>
          <TagsInput defaultValue={["x"]} />
        </Field>
        <div dir="rtl">
          <TagsInput inputProps={{ "aria-label": "وسوم" }} defaultValue={["أ", "ب"]} />
        </div>
      </div>,
    );
    const rejected = page.getByRole("textbox", { name: "Rejected" });
    await userEvent.click(rejected);
    await userEvent.keyboard("React");
    await press("{Enter}");
    await expect.poll(() => rejected.element().getAttribute("aria-invalid")).toBe("true");
    // A remove button focused, so its chip ring is audited too.
    await userEvent.click(page.getByRole("textbox", { name: "Topics" }));
    await press("{ArrowLeft}");
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(
      results.incomplete.map(
        (v) =>
          `${v.id}: ${v.nodes.map((n) => `${n.target} ${JSON.stringify(n.any.map((c) => c.data))}`)}`,
      ),
    ).toEqual([]);
  });
});
