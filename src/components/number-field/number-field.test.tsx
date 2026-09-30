import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia, systemColor } from "../../../test/emulation";
import { Field, FieldLabel } from "../field";
import { Input } from "../input";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldScrubArea,
} from "./number-field";

const inputOf = (root: Element) =>
  root.querySelector('[data-slot="number-field-input"]') as HTMLInputElement;
const incrementOf = (root: Element) =>
  root.querySelector('[data-slot="number-field-increment"]') as HTMLButtonElement;
const decrementOf = (root: Element) =>
  root.querySelector('[data-slot="number-field-decrement"]') as HTMLButtonElement;

afterEach(async () => {
  document.documentElement.classList.remove("dark");
  await resetEmulatedMedia();
});

describe("NumberField", () => {
  it("renders the default stepper: Group, Decrement, Input, Increment with data-slot", async () => {
    const screen = await render(<NumberField aria-label="Quantity" defaultValue={3} />);
    const input = screen.getByRole("textbox", { name: "Quantity" }).element();
    expect(input.getAttribute("data-slot")).toBe("number-field-input");
    const group = input.closest('[data-slot="number-field-group"]') as HTMLElement;
    expect(group).not.toBeNull();
    const root = group.closest('[data-slot="number-field"]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(decrementOf(root)).not.toBeNull();
    expect(incrementOf(root)).not.toBeNull();
    expect((input as HTMLInputElement).value).toBe("3");
  });

  it("names the increment/decrement buttons Increase/Decrease", async () => {
    await render(<NumberField aria-label="Quantity" defaultValue={1} />);
    await expect.element(page.getByRole("button", { name: "Increase" })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Decrease" })).toBeInTheDocument();
  });

  it("stepper buttons are excluded from the Tab order (focus stays reachable via the input)", async () => {
    const screen = await render(<NumberField aria-label="Quantity" defaultValue={1} />);
    const root = screen
      .getByRole("textbox", { name: "Quantity" })
      .element()
      .closest('[data-slot="number-field"]') as HTMLElement;
    expect(incrementOf(root).tabIndex).toBe(-1);
    expect(decrementOf(root).tabIndex).toBe(-1);
    await userEvent.tab();
    expect(document.activeElement).toBe(inputOf(root));
  });

  it("increments and decrements by click, clamped at max/min", async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <NumberField
        aria-label="Quantity"
        defaultValue={9}
        min={0}
        max={10}
        onValueChange={onValueChange}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Quantity" }).element() as HTMLInputElement;
    const root = input.closest('[data-slot="number-field"]') as HTMLElement;
    await userEvent.click(incrementOf(root));
    expect(input.value).toBe("10");
    // At the boundary the button becomes natively disabled, not just `aria-disabled`, so a second
    // click isn't attempted here (Playwright refuses to click a disabled element).
    await expect.element(incrementOf(root)).toHaveAttribute("data-disabled");
    await expect.element(incrementOf(root)).toBeDisabled();
    for (let i = 0; i < 10; i++) {
      await userEvent.click(decrementOf(root));
    }
    expect(input.value).toBe("0");
    await expect.element(decrementOf(root)).toHaveAttribute("data-disabled");
    expect(onValueChange).toHaveBeenCalled();
  });

  it("ArrowUp/ArrowDown step the value from the focused input", async () => {
    const screen = await render(<NumberField aria-label="Quantity" defaultValue={5} />);
    const input = screen.getByRole("textbox", { name: "Quantity" }).element() as HTMLInputElement;
    input.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(input.value).toBe("6");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{ArrowDown}");
    expect(input.value).toBe("4");
  });

  it("typing then blurring commits and formats the value", async () => {
    const onValueChange = vi.fn();
    const screen = await render(
      <NumberField aria-label="Quantity" defaultValue={1} onValueChange={onValueChange} />,
    );
    const input = screen.getByRole("textbox", { name: "Quantity" });
    await userEvent.clear(input);
    await userEvent.type(input, "42");
    await userEvent.tab();
    expect((input.element() as HTMLInputElement).value).toBe("42");
    expect(onValueChange).toHaveBeenLastCalledWith(42, expect.anything());
  });

  it("formats the value with a currency format", async () => {
    const screen = await render(
      <NumberField
        aria-label="Price"
        defaultValue={19.9}
        locale="en-US"
        format={{ style: "currency", currency: "USD" }}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Price" }).element() as HTMLInputElement;
    expect(input.value).toBe("$19.90");
  });

  it("submits its value through the hidden input (FormData)", async () => {
    let data: FormData | null = null;
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <NumberField aria-label="Quantity" name="quantity" defaultValue={7} />
        <button type="submit">Save</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => data?.get("quantity")).toBe("7");
  });

  it("shows a solid 1px focus-within outline on the group when the input is Tab-focused", async () => {
    const screen = await render(<NumberField aria-label="Quantity" defaultValue={1} />);
    const input = screen.getByRole("textbox", { name: "Quantity" }).element();
    const group = input.closest('[data-slot="number-field-group"]') as HTMLElement;
    expect(getComputedStyle(group).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(input);
    expect(getComputedStyle(group).outlineStyle).toBe("solid");
    expect(getComputedStyle(group).outlineWidth).toBe("1px");
  });

  it("shows no permanent outline on the group in forced colors, only on focus, in Highlight", async () => {
    await emulateForcedColors(true);
    const screen = await render(<NumberField aria-label="Quantity" defaultValue={1} />);
    const input = screen.getByRole("textbox", { name: "Quantity" }).element();
    const group = input.closest('[data-slot="number-field-group"]') as HTMLElement;
    expect(getComputedStyle(group).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(input);
    const style = getComputedStyle(group);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineColor).toBe(systemColor("Highlight"));
  });

  it("in forced colors: an invalid, focused group rings Highlight (in an invalid Field or with a bare aria-invalid)", async () => {
    await emulateForcedColors(true);
    await render(
      <div className="flex flex-col gap-2">
        <Field invalid>
          <FieldLabel>In field</FieldLabel>
          <NumberField defaultValue={1} />
        </Field>
        <NumberField defaultValue={1}>
          <NumberFieldGroup>
            <NumberFieldInput aria-label="Bare" aria-invalid />
          </NumberFieldGroup>
        </NumberField>
      </div>,
    );
    for (const name of ["In field", "Bare"]) {
      const input = page.getByRole("textbox", { name }).element() as HTMLInputElement;
      const group = input.closest('[data-slot="number-field-group"]') as HTMLElement;
      input.focus();
      const style = getComputedStyle(group);
      expect(style.outlineStyle).toBe("solid");
      // The danger outline (`data-invalid:` / `has-aria-invalid:` + `focus-within:`) is more
      // specific than `forced-colors:focus-within:`; without the restated forced-colors rule
      // Chromium forces it to CanvasText.
      expect(style.outlineColor).toBe(systemColor("Highlight"));
    }
  });

  it.each([
    ["sm", 32],
    ["md", 40],
    ["lg", 48],
  ] as const)("group height at size %s matches Input's height", async (size, height) => {
    const screen = await render(
      <div className="flex gap-2">
        <Input aria-label={`input-${size}`} size={size} />
        <NumberField defaultValue={1}>
          <NumberFieldGroup size={size}>
            <NumberFieldDecrement />
            <NumberFieldInput aria-label={`number-${size}`} />
            <NumberFieldIncrement />
          </NumberFieldGroup>
        </NumberField>
      </div>,
    );
    const input = screen.getByRole("textbox", { name: `input-${size}` }).element();
    const numberInput = screen.getByRole("textbox", { name: `number-${size}` }).element();
    const group = numberInput.closest('[data-slot="number-field-group"]') as HTMLElement;
    expect(Math.round(group.getBoundingClientRect().height)).toBe(height);
    expect(Math.round(input.getBoundingClientRect().height)).toBe(height);
    expect(group.getAttribute("data-size")).toBe(size);
  });

  it("disabled: input and buttons are disabled, group dims", async () => {
    const screen = await render(<NumberField aria-label="Quantity" defaultValue={1} disabled />);
    const input = screen.getByRole("textbox", { name: "Quantity" }).element() as HTMLInputElement;
    expect(input.disabled).toBe(true);
    const group = input.closest('[data-slot="number-field-group"]') as HTMLElement;
    expect(getComputedStyle(group).opacity).toBe("0.5");
    const root = group.closest('[data-slot="number-field"]') as HTMLElement;
    expect((incrementOf(root) as HTMLButtonElement).disabled).toBe(true);
    expect((decrementOf(root) as HTMLButtonElement).disabled).toBe(true);
  });

  it("read-only: input keeps its value, uses the muted group background, and buttons don't change it", async () => {
    const screen = await render(
      <div>
        <NumberField aria-label="Quantity" defaultValue={4} readOnly />
        <div data-testid="ref" className="bg-muted" />
      </div>,
    );
    const input = screen.getByRole("textbox", { name: "Quantity" }).element() as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    const group = input.closest('[data-slot="number-field-group"]') as HTMLElement;
    await expect.element(group).toHaveAttribute("data-readonly");
    expect(getComputedStyle(group).backgroundColor).toBe(
      getComputedStyle(screen.getByTestId("ref").element()).backgroundColor,
    );
    const root = group.closest('[data-slot="number-field"]') as HTMLElement;
    await expect.element(incrementOf(root)).toHaveAttribute("aria-disabled", "true");
    await expect.element(decrementOf(root)).toHaveAttribute("aria-disabled", "true");
  });

  it("a ScrubArea wraps a label and offers click-drag scrubbing", async () => {
    const screen = await render(
      <NumberField defaultValue={10}>
        <NumberFieldScrubArea>Volume</NumberFieldScrubArea>
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput aria-label="Volume" />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>,
    );
    const scrubArea = screen.getByText("Volume").element() as HTMLElement;
    expect(scrubArea.getAttribute("data-slot")).toBe("number-field-scrub-area");
    expect(getComputedStyle(scrubArea).cursor).toBe("ew-resize");
    // The ScrubArea labels nothing by itself (it's presentational, not a `<label>`); the input
    // gets its name from its own `aria-label`, set directly since `NumberField` has children here.
    await expect.element(screen.getByRole("textbox", { name: "Volume" })).toBeInTheDocument();
  });

  it("warns in dev when aria-label is passed together with children (it can't be forwarded)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await render(
        <NumberField aria-label="Quantity" defaultValue={1}>
          <NumberFieldGroup>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldGroup>
        </NumberField>,
      );
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toMatch(/aria-label.*children/i);
    } finally {
      warn.mockRestore();
    }
  });

  it("warns once per instance, not on every render", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const tree = (value: number) => (
        <NumberField aria-label="Quantity" value={value}>
          <NumberFieldGroup>
            <NumberFieldInput />
          </NumberFieldGroup>
        </NumberField>
      );
      const screen = await render(tree(1));
      await screen.rerender(tree(2));
      await screen.rerender(tree(3));
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("an aria-invalid input outside a Field gives the group the danger border", async () => {
    const screen = await render(
      <div>
        <NumberField defaultValue={1}>
          <NumberFieldGroup>
            <NumberFieldInput aria-label="Quantity" aria-invalid />
          </NumberFieldGroup>
        </NumberField>
        <div data-testid="ref" className="border border-danger" />
      </div>,
    );
    const group = screen.container.querySelector('[data-slot="number-field-group"]') as HTMLElement;
    expect(group.hasAttribute("data-invalid")).toBe(false);
    expect(getComputedStyle(group).borderTopColor).toBe(
      getComputedStyle(screen.getByTestId("ref").element()).borderTopColor,
    );
  });

  // v2 §4: hover styles are gated with `not-data-disabled:`. At its bound a stepper is disabled.
  it("a disabled stepper button keeps its background and colour on hover", async () => {
    const screen = await render(<NumberField aria-label="Quantity" defaultValue={5} max={5} />);
    const increment = incrementOf(screen.container);
    expect(increment.hasAttribute("data-disabled")).toBe(true);
    const before = getComputedStyle(increment);
    const [background, color] = [before.backgroundColor, before.color];
    await userEvent.hover(increment);
    expect(increment.matches(":hover")).toBe(true);
    expect(getComputedStyle(increment).backgroundColor).toBe(background);
    expect(getComputedStyle(increment).color).toBe(color);
  });

  it("does not warn when aria-label is used with the childless convenience default", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await render(<NumberField aria-label="Quantity" defaultValue={1} />);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  describe("inside Field", () => {
    it("is named by FieldLabel and shows the danger border when invalid", async () => {
      const screen = await render(
        <div>
          <Field invalid>
            <FieldLabel>Quantity</FieldLabel>
            <NumberField defaultValue={2} />
          </Field>
          <div data-testid="ref" className="border border-danger" />
        </div>,
      );
      const input = screen.getByRole("textbox", { name: "Quantity" });
      await expect.element(input).toBeInTheDocument();
      await expect.element(input).toHaveAttribute("aria-invalid", "true");
      const group = input.element().closest('[data-slot="number-field-group"]') as HTMLElement;
      await expect.element(group).toHaveAttribute("data-invalid");
      expect(getComputedStyle(group).borderTopColor).toBe(
        getComputedStyle(screen.getByTestId("ref").element()).borderTopColor,
      );
    });
  });

  it("merges className and sets data-slot on every part", async () => {
    const screen = await render(
      <NumberField defaultValue={1}>
        <NumberFieldGroup className="max-w-40">
          <NumberFieldDecrement className="text-lg" />
          <NumberFieldInput aria-label="Quantity" className="italic" />
          <NumberFieldIncrement className="text-lg" />
        </NumberFieldGroup>
      </NumberField>,
    );
    const input = screen.getByRole("textbox", { name: "Quantity" }).element();
    const group = input.closest('[data-slot="number-field-group"]') as HTMLElement;
    expect(group.classList.contains("max-w-40")).toBe(true);
    expect(input.classList.contains("italic")).toBe(true);
    const root = group.closest('[data-slot="number-field"]') as HTMLElement;
    expect(incrementOf(root).classList.contains("text-lg")).toBe(true);
    expect(decrementOf(root).classList.contains("text-lg")).toBe(true);
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Quantity</FieldLabel>
            <NumberField defaultValue={1} min={0} max={10} />
          </Field>
          <Field invalid>
            <FieldLabel>Weight</FieldLabel>
            <NumberField defaultValue={2} format={{ style: "unit", unit: "kilogram" }} />
          </Field>
          <NumberField aria-label="Disabled" defaultValue={1} disabled />
        </div>
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
