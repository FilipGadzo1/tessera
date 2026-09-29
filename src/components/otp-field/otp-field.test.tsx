import axe from "axe-core";
import { type FormEvent, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia, systemColor } from "../../../test/emulation";
import { Field, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { Input } from "../input";
import { OTPField, OTPFieldInput, OTPFieldSeparator } from "./otp-field";

afterEach(async () => {
  await resetEmulatedMedia();
});

const slots = (container: Element) =>
  Array.from(container.querySelectorAll<HTMLInputElement>('[data-slot="otp-field-input"]'));
const values = (container: Element) => slots(container).map((slot) => slot.value);
const roots = (container: Element) =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-slot="otp-field"]'));

function paste(target: HTMLElement, text: string) {
  const data = new DataTransfer();
  data.setData("text/plain", text);
  target.dispatchEvent(
    new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
  );
}

describe("OTPField", () => {
  it("renders `length` inputs with data-slot, the first named by its Field label", async () => {
    const screen = await render(
      <Field>
        <FieldLabel>Code</FieldLabel>
        <OTPField length={4} />
      </Field>,
    );
    expect(roots(screen.container)).toHaveLength(1);
    expect(slots(screen.container)).toHaveLength(4);
    await expect
      .element(screen.getByRole("textbox", { name: "Code" }))
      .toHaveAttribute("data-slot", "otp-field-input");
    await expect
      .element(screen.getByRole("textbox", { name: "Character 2 of 4" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("textbox", { name: "Character 4 of 4" }))
      .toBeInTheDocument();
  });

  it("groups the convenience inputs with a separator between the groups", async () => {
    const screen = await render(
      <Field>
        <FieldLabel>Code</FieldLabel>
        <OTPField length={6} groups={[3, 3]} />
      </Field>,
    );
    const separators = screen.container.querySelectorAll('[data-slot="otp-field-separator"]');
    expect(separators).toHaveLength(1);
    expect(separators[0]?.getAttribute("aria-hidden")).toBe("true");
    const order = Array.from(
      screen.container.querySelectorAll(
        '[data-slot="otp-field-input"], [data-slot="otp-field-separator"]',
      ),
    ).map((el) => el.getAttribute("data-slot"));
    expect(order).toEqual([
      ...Array(3).fill("otp-field-input"),
      "otp-field-separator",
      ...Array(3).fill("otp-field-input"),
    ]);
    // Typing runs straight through the groups.
    await userEvent.type(screen.getByRole("textbox", { name: "Code" }), "123456");
    expect(values(screen.container)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("renders only the Root when given children", async () => {
    const screen = await render(
      <OTPField length={2} aria-label="Pair">
        <OTPFieldInput aria-label="Digit one" />
        <OTPFieldSeparator />
        <OTPFieldInput aria-label="Digit two" />
      </OTPField>,
    );
    expect(slots(screen.container)).toHaveLength(2);
    expect(screen.container.querySelectorAll('[data-slot="otp-field-separator"]')).toHaveLength(1);
  });

  it("types across the slots and reports the value and completion", async () => {
    const onValueChange = vi.fn();
    const onValueComplete = vi.fn();
    const screen = await render(
      <Field>
        <FieldLabel>Code</FieldLabel>
        <OTPField length={4} onValueChange={onValueChange} onValueComplete={onValueComplete} />
      </Field>,
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Code" }), "123");
    expect(values(screen.container)).toEqual(["1", "2", "3", ""]);
    expect(onValueChange).toHaveBeenLastCalledWith("123", expect.anything());
    expect(onValueComplete).not.toHaveBeenCalled();
    await userEvent.keyboard("4");
    expect(values(screen.container)).toEqual(["1", "2", "3", "4"]);
    expect(onValueComplete).toHaveBeenCalledTimes(1);
    expect(onValueComplete).toHaveBeenCalledWith("1234", expect.anything());
  });

  it("Backspace clears the slot and moves back", async () => {
    const screen = await render(
      <Field>
        <FieldLabel>Code</FieldLabel>
        <OTPField length={4} defaultValue="1234" />
      </Field>,
    );
    const inputs = slots(screen.container);
    inputs[3]?.focus();
    await userEvent.keyboard("{Backspace}");
    expect(values(screen.container)).toEqual(["1", "2", "3", ""]);
    await userEvent.keyboard("{Backspace}");
    expect(values(screen.container)).toEqual(["1", "2", "", ""]);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it("ArrowLeft / ArrowRight move between the slots", async () => {
    const screen = await render(
      <Field>
        <FieldLabel>Code</FieldLabel>
        <OTPField length={4} defaultValue="1234" />
      </Field>,
    );
    const inputs = slots(screen.container);
    inputs[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(inputs[1]);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(inputs[2]);
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(inputs[1]);
  });

  it("pasting a code fills every slot and completes", async () => {
    const onValueComplete = vi.fn();
    const screen = await render(
      <Field>
        <FieldLabel>Code</FieldLabel>
        <OTPField length={6} onValueComplete={onValueComplete} />
      </Field>,
    );
    const first = screen.getByRole("textbox", { name: "Code" }).element() as HTMLElement;
    first.focus();
    paste(first, "987654");
    await vi.waitFor(() => expect(values(screen.container).join("")).toBe("987654"));
    expect(onValueComplete).toHaveBeenCalledWith("987654", expect.anything());
  });

  it("numeric (default) rejects letters; alphanumeric accepts them", async () => {
    const onValueInvalid = vi.fn();
    const screen = await render(
      <div>
        <Field>
          <FieldLabel>Digits</FieldLabel>
          <OTPField length={4} onValueInvalid={onValueInvalid} />
        </Field>
        <Field>
          <FieldLabel>Recovery</FieldLabel>
          <OTPField length={4} validationType="alphanumeric" />
        </Field>
      </div>,
    );
    const [digits, recovery] = roots(screen.container) as [HTMLElement, HTMLElement];
    await userEvent.type(screen.getByRole("textbox", { name: "Digits" }), "a1b2");
    expect(values(digits).join("")).toBe("12");
    expect(onValueInvalid).toHaveBeenCalled();
    await userEvent.type(screen.getByRole("textbox", { name: "Recovery" }), "a1B2");
    expect(values(recovery).join("")).toBe("a1B2");
  });

  it("mask renders the slots as password inputs", async () => {
    const screen = await render(
      <Field>
        <FieldLabel>PIN</FieldLabel>
        <OTPField length={4} mask defaultValue="1234" />
      </Field>,
    );
    for (const slot of slots(screen.container)) expect(slot.type).toBe("password");
    expect(values(screen.container)).toEqual(["1", "2", "3", "4"]);
  });

  it("is controlled through value / onValueChange", async () => {
    function Controlled() {
      const [value, setValue] = useState("12");
      return (
        <Field>
          <FieldLabel>Code</FieldLabel>
          <OTPField length={4} value={value} onValueChange={setValue} />
          <output data-testid="out">{value}</output>
        </Field>
      );
    }
    const screen = await render(<Controlled />);
    expect(values(screen.container)).toEqual(["1", "2", "", ""]);
    await userEvent.type(slots(screen.container)[2] as HTMLElement, "9");
    await expect.element(screen.getByTestId("out")).toHaveTextContent("129");
  });

  it("submits one value under `name` in FormData", async () => {
    let submitted: Record<string, FormDataEntryValue> | undefined;
    const screen = await render(
      <Form
        aria-label="Verify"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          submitted = Object.fromEntries(new FormData(event.currentTarget));
        }}
      >
        <Field name="code">
          <FieldLabel>Code</FieldLabel>
          <OTPField length={4} />
        </Field>
        <button type="submit">Go</button>
      </Form>,
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Code" }), "4821");
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(submitted).toEqual({ code: "4821" });
  });

  it("marks every slot invalid with the danger border inside <Field invalid>", async () => {
    const screen = await render(
      <div>
        <Field invalid>
          <FieldLabel>Code</FieldLabel>
          <OTPField length={3} />
          <FieldError match>Wrong code</FieldError>
        </Field>
        <div data-testid="ref" className="border border-danger" />
      </div>,
    );
    const reference = getComputedStyle(screen.getByTestId("ref").element()).borderTopColor;
    for (const slot of slots(screen.container)) {
      expect(slot.hasAttribute("data-invalid")).toBe(true);
      expect(getComputedStyle(slot).borderTopColor).toBe(reference);
    }
  });

  it("Tab lands on one slot with a 1px solid outline; the others show none", async () => {
    const screen = await render(
      <Field>
        <FieldLabel>Code</FieldLabel>
        <OTPField length={3} defaultValue="123" />
      </Field>,
    );
    const inputs = slots(screen.container);
    for (const slot of inputs) expect(getComputedStyle(slot).outlineStyle).toBe("none");
    await userEvent.tab();
    const focused = inputs.find((slot) => slot === document.activeElement);
    expect(focused).toBeDefined();
    const style = getComputedStyle(focused as Element);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("1px");
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).not.toBe(focused);
    expect(getComputedStyle(document.activeElement as Element).outlineStyle).toBe("solid");
    expect(getComputedStyle(focused as Element).outlineStyle).toBe("none");
  });

  it("shows the focus outline in Highlight in forced colors, and none before focus", async () => {
    await emulateForcedColors(true);
    const screen = await render(
      <Field>
        <FieldLabel>Code</FieldLabel>
        <OTPField length={3} />
      </Field>,
    );
    const inputs = slots(screen.container);
    expect(getComputedStyle(inputs[0] as Element).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(inputs[0]);
    const style = getComputedStyle(inputs[0] as Element);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineColor).toBe(systemColor("Highlight"));
  });

  it("shows a text cursor, and not-allowed when disabled", async () => {
    const screen = await render(
      <div>
        <OTPField length={2} aria-label="Ready" />
        <OTPField length={2} aria-label="Off" disabled />
      </div>,
    );
    const [ready, off] = roots(screen.container) as [HTMLElement, HTMLElement];
    expect(getComputedStyle(slots(ready)[0] as Element).cursor).toBe("text");
    expect(getComputedStyle(slots(off)[0] as Element).cursor).toBe("not-allowed");
    expect(slots(off).every((slot) => slot.disabled)).toBe(true);
  });

  it.each([
    ["sm", 32],
    ["md", 40],
    ["lg", 48],
  ] as const)("size %s is square and lines up with an Input of the same size", async (size, px) => {
    const screen = await render(
      <div className="flex items-center gap-2">
        <Input aria-label="control" size={size} className="w-24" />
        <OTPField length={3} size={size} aria-label="code" />
      </div>,
    );
    const control = screen.getByLabelText("control").element().getBoundingClientRect();
    for (const slot of slots(screen.container)) {
      const rect = slot.getBoundingClientRect();
      expect(rect.height).toBe(px);
      expect(rect.width).toBe(px);
      expect(rect.height).toBe(control.height);
      expect(rect.top).toBe(control.top);
    }
    expect(roots(screen.container)[0]?.getAttribute("data-size")).toBe(size);
  });

  it("merges className on the Root, the inputs and the separator (string and function form)", async () => {
    const screen = await render(
      <div>
        <OTPField length={2} aria-label="A" className="gap-6" />
        <OTPField length={2} aria-label="B" className={() => "is-root"} />
        <OTPField length={2} aria-label="C">
          <OTPFieldInput className="text-blue-500" aria-label="C1" />
          <OTPFieldSeparator className="w-6" />
          <OTPFieldInput className={(s) => (s.filled ? "is-filled" : "is-empty")} aria-label="C2" />
        </OTPField>
      </div>,
    );
    const [a, b, c] = roots(screen.container) as [HTMLElement, HTMLElement, HTMLElement];
    expect(a.className).toContain("gap-6");
    expect(a.className).not.toContain("gap-2");
    expect(b.className).toContain("is-root");
    const third = slots(c);
    expect(third[0]?.className).toContain("text-blue-500");
    expect(third[1]?.className).toContain("is-empty");
    expect(c.querySelector('[data-slot="otp-field-separator"]')?.className).toContain("w-6");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Field>
          <FieldLabel>Grouped</FieldLabel>
          <OTPField length={6} groups={[3, 3]} defaultValue="123" />
        </Field>
        <Field invalid>
          <FieldLabel>Invalid</FieldLabel>
          <OTPField length={4} />
          <FieldError match>Wrong code</FieldError>
        </Field>
        <Field disabled>
          <FieldLabel>Disabled</FieldLabel>
          <OTPField length={4} defaultValue="12" />
        </Field>
        <Field>
          <FieldLabel>Masked</FieldLabel>
          <OTPField length={4} mask defaultValue="1234" />
        </Field>
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
