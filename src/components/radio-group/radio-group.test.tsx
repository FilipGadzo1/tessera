import axe from "axe-core";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Field, FieldError, FieldItem, FieldLabel } from "../field";
import { Fieldset, FieldsetLegend } from "../fieldset";
import { Label } from "../label";
import { Radio, RadioGroup, type RadioGroupProps } from "./radio-group";
import { Horizontal } from "./radio-group.stories";

const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

/**
 * The canonical composition (Base UI docs): Fieldset renders the RadioGroup, so the legend names
 * the group; each option sits in a FieldItem so it gets its own label ids inside the Field.
 */
function Payment({
  invalid,
  fieldsetDisabled,
  ...groupProps
}: RadioGroupProps & { invalid?: boolean; fieldsetDisabled?: boolean }) {
  return (
    <Field invalid={invalid}>
      <Fieldset
        disabled={fieldsetDisabled}
        render={<RadioGroup defaultValue="card" {...groupProps} />}
      >
        <FieldsetLegend>Payment</FieldsetLegend>
        <FieldItem>
          <FieldLabel className="flex items-center gap-2">
            <Radio value="card" />
            Card
          </FieldLabel>
        </FieldItem>
        <FieldItem>
          <FieldLabel className="flex items-center gap-2">
            <Radio value="bank" />
            Bank transfer
          </FieldLabel>
        </FieldItem>
      </Fieldset>
      <FieldError>Choose a payment method.</FieldError>
    </Field>
  );
}

describe("RadioGroup", () => {
  it("renders a radiogroup named by the legend, with named radios and data-slots", async () => {
    const screen = await render(<Payment />);
    const group = screen.getByRole("radiogroup", { name: "Payment" });
    await expect.element(group).toBeInTheDocument();
    await expect.element(group).toHaveAttribute("data-slot", "radio-group");
    await expect.element(group).toHaveClass("flex", "flex-col");
    const card = screen.getByRole("radio", { name: "Card" });
    await expect.element(card).toHaveAttribute("data-slot", "radio");
    await expect.element(screen.getByRole("radio", { name: "Bank transfer" })).toBeInTheDocument();
    await expect
      .element(screen.getByText("Payment"))
      .toHaveAttribute("data-slot", "fieldset-legend");
    expect(card.element().closest('[data-slot="field-item"]')).not.toBeNull();
  });

  it("lays out the Horizontal story's options in one row, below the legend", async () => {
    const story = Horizontal.render as unknown as () => ReactElement;
    const screen = await render(story());
    const monthly = screen
      .getByRole("radio", { name: "Monthly" })
      .element()
      .getBoundingClientRect();
    const yearly = screen.getByRole("radio", { name: "Yearly" }).element().getBoundingClientRect();
    expect(yearly.top).toBe(monthly.top);
    expect(yearly.left).toBeGreaterThan(monthly.right);
    const legend = screen.getByText("Billing").element().getBoundingClientRect();
    expect(legend.bottom).toBeLessThanOrEqual(monthly.top);
  });

  it("ignores children (type-level: RadioProps omits children)", async () => {
    const screen = await render(
      <RadioGroup aria-label="Kids">
        {/* @ts-expect-error -- Tessera renders the indicator; children are not accepted. */}
        <Radio value="a" aria-label="A">
          ignored
        </Radio>
      </RadioGroup>,
    );
    await expect.element(screen.getByRole("radio", { name: "A" })).toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("ignored");
  });

  it("names radios by a wrapping Label when used without a Field", async () => {
    const screen = await render(
      <Fieldset render={<RadioGroup defaultValue="monthly" />}>
        <FieldsetLegend>Billing</FieldsetLegend>
        <Label className="flex items-center gap-2">
          <Radio value="monthly" />
          Monthly
        </Label>
        <Label className="flex items-center gap-2">
          <Radio value="yearly" />
          Yearly
        </Label>
      </Fieldset>,
    );
    await expect.element(screen.getByRole("radiogroup", { name: "Billing" })).toBeInTheDocument();
    const yearly = screen.getByRole("radio", { name: "Yearly" });
    await screen.getByText("Yearly").click();
    await expect.element(yearly).toHaveAttribute("aria-checked", "true");
    await expect
      .element(screen.getByRole("radio", { name: "Monthly" }))
      .toHaveAttribute("aria-checked", "false");
  });

  it("checks the default value", async () => {
    const screen = await render(<Payment />);
    await expect
      .element(screen.getByRole("radio", { name: "Card" }))
      .toHaveAttribute("aria-checked", "true");
    await expect
      .element(screen.getByRole("radio", { name: "Bank transfer" }))
      .toHaveAttribute("aria-checked", "false");
  });

  it("checks the clicked radio, unchecks the other and reports the value", async () => {
    const onValueChange = vi.fn();
    const screen = await render(<Payment onValueChange={onValueChange} />);
    const card = screen.getByRole("radio", { name: "Card" });
    const bank = screen.getByRole("radio", { name: "Bank transfer" });
    await bank.click();
    await expect.element(bank).toHaveAttribute("aria-checked", "true");
    await expect.element(bank).toHaveAttribute("data-checked");
    await expect.element(card).toHaveAttribute("aria-checked", "false");
    expect(onValueChange).toHaveBeenCalledWith("bank", expect.anything());
  });

  it("checks a radio when its label text is clicked", async () => {
    const screen = await render(<Payment />);
    await screen.getByText("Bank transfer").click();
    await expect
      .element(screen.getByRole("radio", { name: "Bank transfer" }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("moves selection and focus with the arrow keys", async () => {
    const screen = await render(<Payment />);
    const card = screen.getByRole("radio", { name: "Card" });
    const bank = screen.getByRole("radio", { name: "Bank transfer" });
    await userEvent.tab();
    expect(document.activeElement).toBe(card.element());
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(bank.element());
    await expect.element(bank).toHaveAttribute("aria-checked", "true");
    await expect.element(card).toHaveAttribute("aria-checked", "false");
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(card.element());
    await expect.element(card).toHaveAttribute("aria-checked", "true");
  });

  it("shows a solid 2px outline on Tab focus of the checked radio and none before", async () => {
    const screen = await render(<Payment defaultValue="bank" />);
    const card = screen.getByRole("radio", { name: "Card" }).element() as HTMLElement;
    const bank = screen.getByRole("radio", { name: "Bank transfer" }).element() as HTMLElement;
    expect(getComputedStyle(bank).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(bank);
    const style = getComputedStyle(bank);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
    expect(getComputedStyle(card).outlineStyle).toBe("none");
  });

  it("shows a pointer cursor, and not-allowed when the group is disabled", async () => {
    const screen = await render(
      <div>
        <RadioGroup aria-label="Ready" defaultValue="a">
          <Radio value="a" aria-label="Ready A" />
        </RadioGroup>
        <RadioGroup aria-label="Off" disabled defaultValue="a">
          <Radio value="a" aria-label="Off A" />
        </RadioGroup>
      </div>,
    );
    const cursor = (name: string) =>
      getComputedStyle(screen.getByRole("radio", { name }).element()).cursor;
    expect(cursor("Ready A")).toBe("pointer");
    expect(cursor("Off A")).toBe("not-allowed");
  });

  it.each([
    { how: "the group's disabled prop", props: { disabled: true } },
    { how: "a disabled Fieldset", props: { fieldsetDisabled: true } },
  ])("ignores clicks when disabled via $how", async ({ props }) => {
    const onValueChange = vi.fn();
    const screen = await render(<Payment {...props} onValueChange={onValueChange} />);
    const bank = screen.getByRole("radio", { name: "Bank transfer" });
    await expect.element(bank).toHaveAttribute("data-disabled");
    await bank.click({ force: true });
    await expect.element(bank).toHaveAttribute("aria-checked", "false");
    await expect
      .element(screen.getByRole("radio", { name: "Card" }))
      .toHaveAttribute("aria-checked", "true");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(getComputedStyle(bank.element()).cursor).toBe("not-allowed");
  });

  it("fills the checked radio with the primary color and shows the dot only on it", async () => {
    const screen = await render(
      <div>
        <Payment />
        <div data-testid="primary" className="bg-primary" />
        <div data-testid="border" className="border border-primary" />
      </div>,
    );
    const card = screen.getByRole("radio", { name: "Card" }).element();
    const bank = screen.getByRole("radio", { name: "Bank transfer" }).element();
    await settle();
    expect(getComputedStyle(card).backgroundColor).toBe(
      getComputedStyle(screen.getByTestId("primary").element()).backgroundColor,
    );
    expect(getComputedStyle(card).borderTopColor).toBe(
      getComputedStyle(screen.getByTestId("border").element()).borderTopColor,
    );
    const dot = card.querySelector('[data-slot="radio-indicator"]');
    expect(dot).not.toBeNull();
    expect(getComputedStyle(dot as Element).width).toBe("8px");
    expect(getComputedStyle(dot as Element).borderRadius).not.toBe("0px");
    expect(bank.querySelector('[data-slot="radio-indicator"]')).toBeNull();
  });

  describe("invalid", () => {
    it("draws the danger border inside <Field invalid> and shows the FieldError", async () => {
      const screen = await render(
        <div>
          <Payment invalid />
          <div data-testid="ref" className="border border-danger" />
        </div>,
      );
      const bank = screen.getByRole("radio", { name: "Bank transfer" });
      await expect.element(bank).toHaveAttribute("data-invalid");
      await expect.element(screen.getByText("Choose a payment method.")).toBeVisible();
      await settle();
      expect(getComputedStyle(bank.element()).borderTopColor).toBe(
        getComputedStyle(screen.getByTestId("ref").element()).borderTopColor,
      );
    });

    it("keeps the danger border on the checked radio, with the primary fill", async () => {
      const screen = await render(
        <div>
          <Payment invalid />
          <div data-testid="danger" className="border border-danger" />
          <div data-testid="primary" className="bg-primary" />
        </div>,
      );
      const card = screen.getByRole("radio", { name: "Card" });
      await expect.element(card).toHaveAttribute("data-invalid");
      await expect.element(card).toHaveAttribute("data-checked");
      await settle();
      const style = getComputedStyle(card.element());
      expect(style.borderTopColor).toBe(
        getComputedStyle(screen.getByTestId("danger").element()).borderTopColor,
      );
      expect(style.backgroundColor).toBe(
        getComputedStyle(screen.getByTestId("primary").element()).backgroundColor,
      );
    });
  });

  describe("hover", () => {
    const border = (el: Element) => getComputedStyle(el).borderTopColor;

    it("uses the hover border on an unchecked radio (control)", async () => {
      const screen = await render(
        <div>
          <Payment />
          <div data-testid="ref" className="border border-field-border-hover" />
        </div>,
      );
      const bank = screen.getByRole("radio", { name: "Bank transfer" });
      await userEvent.hover(bank);
      await settle();
      expect(border(bank.element())).toBe(border(screen.getByTestId("ref").element()));
    });

    it("keeps the primary border when the checked radio is hovered", async () => {
      const screen = await render(
        <div>
          <Payment />
          <div data-testid="ref" className="border border-primary" />
        </div>,
      );
      const card = screen.getByRole("radio", { name: "Card" });
      await userEvent.hover(card);
      await settle();
      expect(border(card.element())).toBe(border(screen.getByTestId("ref").element()));
    });

    it("keeps the danger border when hovered inside <Field invalid>", async () => {
      const screen = await render(
        <div>
          <Payment invalid />
          <div data-testid="ref" className="border border-danger" />
        </div>,
      );
      const bank = screen.getByRole("radio", { name: "Bank transfer" });
      await userEvent.hover(bank);
      await settle();
      expect(border(bank.element())).toBe(border(screen.getByTestId("ref").element()));
    });

    it("keeps the field border when a disabled radio is hovered", async () => {
      const screen = await render(
        <div>
          <Payment disabled />
          <div data-testid="ref" className="border border-field-border" />
        </div>,
      );
      const bank = screen.getByRole("radio", { name: "Bank transfer" });
      await userEvent.hover(bank, { force: true });
      await settle();
      expect(border(bank.element())).toBe(border(screen.getByTestId("ref").element()));
    });
  });

  it("submits the checked value with a form", async () => {
    const screen = await render(
      <form data-testid="form">
        <Payment name="payment" />
      </form>,
    );
    const form = screen.getByTestId("form").element() as HTMLFormElement;
    expect(new FormData(form).get("payment")).toBe("card");
    const bank = screen.getByRole("radio", { name: "Bank transfer" });
    await bank.click();
    await expect.element(bank).toHaveAttribute("aria-checked", "true");
    expect(new FormData(form).getAll("payment")).toEqual(["bank"]);
  });

  it("merges className strings and accepts className state functions", async () => {
    const screen = await render(
      <RadioGroup
        aria-label="Layout"
        defaultValue="a"
        className={(s) => (s.disabled ? "is-off" : "flex-row gap-6")}
      >
        <Radio value="a" aria-label="A" className="size-6" />
        <Radio value="b" aria-label="B" className={(s) => (s.checked ? "is-on" : "is-off")} />
      </RadioGroup>,
    );
    const group = screen.getByRole("radiogroup", { name: "Layout" });
    await expect.element(group).toHaveClass("flex-row", "gap-6");
    await expect.element(group).not.toHaveClass("gap-2");
    const a = screen.getByRole("radio", { name: "A" });
    await expect.element(a).toHaveClass("size-6");
    await expect.element(a).not.toHaveClass("size-5");
    await expect.element(screen.getByRole("radio", { name: "B" })).toHaveClass("is-off");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Payment />
        <Payment disabled />
        <Payment invalid />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
