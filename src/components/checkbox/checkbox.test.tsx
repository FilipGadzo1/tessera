import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Field, FieldLabel } from "../field";
import { Label } from "../label";
import { Checkbox, type CheckboxProps } from "./checkbox";

function Labelled({ label, ...props }: CheckboxProps & { label: string }) {
  return (
    <Label className="flex items-center gap-2">
      <Checkbox {...props} />
      {label}
    </Label>
  );
}

describe("Checkbox", () => {
  it("renders a checkbox named by its wrapping Label, with data-slot", async () => {
    const screen = await render(<Labelled label="Accept terms" />);
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    await expect.element(checkbox).toBeInTheDocument();
    await expect.element(checkbox).toHaveAttribute("data-slot", "checkbox");
    await expect.element(checkbox).toHaveAttribute("aria-checked", "false");
  });

  it("toggles aria-checked and data-checked on click and reports true to onCheckedChange", async () => {
    const onCheckedChange = vi.fn();
    const screen = await render(
      <Labelled label="Accept terms" onCheckedChange={onCheckedChange} />,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    await checkbox.click();
    await expect.element(checkbox).toHaveAttribute("aria-checked", "true");
    await expect.element(checkbox).toHaveAttribute("data-checked");
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
    await checkbox.click();
    await expect.element(checkbox).toHaveAttribute("aria-checked", "false");
    await expect.element(checkbox).toHaveAttribute("data-unchecked");
  });

  it("toggles when the label text is clicked", async () => {
    const screen = await render(<Labelled label="Accept terms" />);
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    await screen.getByText("Accept terms").click();
    await expect.element(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("toggles with Space when focused", async () => {
    const screen = await render(<Labelled label="Accept terms" />);
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    await userEvent.tab();
    expect(document.activeElement).toBe(checkbox.element());
    await userEvent.keyboard(" ");
    await expect.element(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("renders the check indicator when defaultChecked, and none when unchecked", async () => {
    const screen = await render(
      <div>
        <Labelled label="On" defaultChecked />
        <Labelled label="Off" />
      </div>,
    );
    const on = screen.getByRole("checkbox", { name: "On" }).element();
    const indicator = on.querySelector('[data-slot="checkbox-indicator"]');
    expect(indicator).not.toBeNull();
    const svg = indicator?.querySelector("svg");
    expect(svg?.getAttribute("data-icon")).toBe("check");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("width")).toBe("14");
    const off = screen.getByRole("checkbox", { name: "Off" }).element();
    expect(off.querySelector('[data-slot="checkbox-indicator"]')).toBeNull();
  });

  it("is mixed with a dash icon when indeterminate", async () => {
    const screen = await render(<Labelled label="Select all" indeterminate />);
    const checkbox = screen.getByRole("checkbox", { name: "Select all" });
    await expect.element(checkbox).toHaveAttribute("aria-checked", "mixed");
    await expect.element(checkbox).toHaveAttribute("data-indeterminate");
    const svg = checkbox.element().querySelector('[data-slot="checkbox-indicator"] svg');
    expect(svg?.getAttribute("data-icon")).toBe("dash");
  });

  it("ignores clicks when disabled", async () => {
    const onCheckedChange = vi.fn();
    const screen = await render(
      <Labelled label="Off" disabled onCheckedChange={onCheckedChange} />,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Off" });
    await checkbox.click({ force: true });
    await expect.element(checkbox).toHaveAttribute("aria-checked", "false");
    await expect.element(checkbox).toHaveAttribute("data-disabled");
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("shows a pointer cursor, and not-allowed when disabled", async () => {
    const screen = await render(
      <div>
        <Labelled label="Ready" />
        <Labelled label="Off" disabled />
      </div>,
    );
    const cursor = (name: string) =>
      getComputedStyle(screen.getByRole("checkbox", { name }).element()).cursor;
    expect(cursor("Ready")).toBe("pointer");
    expect(cursor("Off")).toBe("not-allowed");
  });

  it("shows a solid 2px outline on Tab focus and none before", async () => {
    const screen = await render(
      <div>
        <Labelled label="First" />
        <Labelled label="Second" />
      </div>,
    );
    const first = screen.getByRole("checkbox", { name: "First" }).element() as HTMLElement;
    const second = screen.getByRole("checkbox", { name: "Second" }).element() as HTMLElement;
    expect(getComputedStyle(first).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(first);
    const style = getComputedStyle(first);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
    expect(getComputedStyle(second).outlineStyle).toBe("none");
  });

  it("fills with the primary color when checked", async () => {
    const screen = await render(
      <div>
        <Labelled label="On" defaultChecked />
        <div data-testid="ref" className="bg-primary" />
      </div>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "On" }).element();
    const reference = screen.getByTestId("ref").element();
    // Let the background transition settle.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(getComputedStyle(checkbox).backgroundColor).toBe(
      getComputedStyle(reference).backgroundColor,
    );
  });

  it("is marked invalid with the danger border inside <Field invalid>", async () => {
    const screen = await render(
      <div>
        <Field invalid>
          <FieldLabel className="flex items-center gap-2">
            <Checkbox />
            Accept terms
          </FieldLabel>
        </Field>
        <div data-testid="ref" className="border border-danger" />
      </div>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    await expect.element(checkbox).toHaveAttribute("data-invalid");
    const reference = screen.getByTestId("ref").element();
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(getComputedStyle(checkbox.element()).borderTopColor).toBe(
      getComputedStyle(reference).borderTopColor,
    );
  });

  it("keeps the danger border when checked inside <Field invalid>, with the primary fill", async () => {
    const screen = await render(
      <div>
        <Field invalid>
          <FieldLabel className="flex items-center gap-2">
            <Checkbox defaultChecked />
            Accept terms
          </FieldLabel>
        </Field>
        <div data-testid="danger" className="border border-danger" />
        <div data-testid="primary" className="bg-primary" />
      </div>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    await expect.element(checkbox).toHaveAttribute("data-invalid");
    await expect.element(checkbox).toHaveAttribute("data-checked");
    await new Promise((resolve) => setTimeout(resolve, 250));
    const style = getComputedStyle(checkbox.element());
    expect(style.borderTopColor).toBe(
      getComputedStyle(screen.getByTestId("danger").element()).borderTopColor,
    );
    expect(style.backgroundColor).toBe(
      getComputedStyle(screen.getByTestId("primary").element()).backgroundColor,
    );
  });

  describe("hover", () => {
    const settle = () => new Promise((resolve) => setTimeout(resolve, 250));
    const border = (el: Element) => getComputedStyle(el).borderTopColor;

    it("uses the hover border on an unchecked checkbox (control)", async () => {
      const screen = await render(
        <div>
          <Labelled label="Plain" />
          <div data-testid="ref" className="border border-field-border-hover" />
        </div>,
      );
      const checkbox = screen.getByRole("checkbox", { name: "Plain" });
      await userEvent.hover(checkbox);
      await settle();
      expect(border(checkbox.element())).toBe(border(screen.getByTestId("ref").element()));
    });

    it("keeps the danger border when hovered inside <Field invalid>", async () => {
      const screen = await render(
        <div>
          <Field invalid>
            <FieldLabel className="flex items-center gap-2">
              <Checkbox />
              Accept terms
            </FieldLabel>
          </Field>
          <div data-testid="ref" className="border border-danger" />
        </div>,
      );
      const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
      await userEvent.hover(checkbox);
      await settle();
      expect(border(checkbox.element())).toBe(border(screen.getByTestId("ref").element()));
    });

    it("keeps the primary border when an indeterminate checkbox is hovered", async () => {
      const screen = await render(
        <div>
          <Labelled label="Select all" indeterminate />
          <div data-testid="ref" className="border border-primary" />
        </div>,
      );
      const checkbox = screen.getByRole("checkbox", { name: "Select all" });
      await userEvent.hover(checkbox);
      await settle();
      expect(border(checkbox.element())).toBe(border(screen.getByTestId("ref").element()));
    });
  });

  it("submits name=on with a form when checked, and nothing when unchecked", async () => {
    const screen = await render(
      <form data-testid="form">
        <Labelled label="Accept terms" name="terms" />
      </form>,
    );
    const form = screen.getByTestId("form").element() as HTMLFormElement;
    expect(new FormData(form).get("terms")).toBeNull();
    await screen.getByRole("checkbox", { name: "Accept terms" }).click();
    await expect
      .element(screen.getByRole("checkbox", { name: "Accept terms" }))
      .toHaveAttribute("aria-checked", "true");
    expect(new FormData(form).get("terms")).toBe("on");
  });

  it("submits a custom value", async () => {
    const screen = await render(
      <form data-testid="form">
        <Labelled label="News" name="topics" value="news" defaultChecked />
      </form>,
    );
    const form = screen.getByTestId("form").element() as HTMLFormElement;
    expect(new FormData(form).get("topics")).toBe("news");
  });

  it("merges className strings and accepts a className state function", async () => {
    const screen = await render(
      <div>
        <Labelled label="A" className="size-6" />
        <Labelled label="B" defaultChecked className={(s) => (s.checked ? "is-on" : "")} />
      </div>,
    );
    const a = screen.getByRole("checkbox", { name: "A" });
    await expect.element(a).toHaveClass("size-6");
    await expect.element(a).not.toHaveClass("size-5");
    await expect.element(screen.getByRole("checkbox", { name: "B" })).toHaveClass("is-on");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Labelled label="Unchecked" />
        <Labelled label="Checked" defaultChecked />
        <Labelled label="Indeterminate" indeterminate />
        <Labelled label="Disabled" disabled />
        <Labelled label="Disabled checked" disabled defaultChecked />
        <Field invalid>
          <FieldLabel className="flex items-center gap-2">
            <Checkbox />
            Invalid
          </FieldLabel>
        </Field>
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
