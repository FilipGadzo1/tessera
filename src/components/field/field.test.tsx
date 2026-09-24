import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Checkbox } from "../checkbox";
import { Input } from "../input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldItem,
  FieldLabel,
  type FieldProps,
} from "./field";

const DESCRIPTION = "We never share your email.";
const ERROR = "Enter a valid email.";

function EmailField(props: FieldProps) {
  return (
    <Field {...props}>
      <FieldLabel>Email</FieldLabel>
      <Input />
      <FieldDescription>{DESCRIPTION}</FieldDescription>
      <FieldError>{ERROR}</FieldError>
    </Field>
  );
}

describe("Field", () => {
  it("associates the label and the description with the input", async () => {
    const screen = await render(<EmailField />);
    const input = screen.getByRole("textbox", { name: "Email" });
    await expect.element(input).toBeInTheDocument();
    await expect.element(input).toHaveAccessibleDescription(DESCRIPTION);
  });

  it("sets data-slot on every part", async () => {
    const screen = await render(<EmailField invalid />);
    const input = screen.getByRole("textbox", { name: "Email" }).element();
    const root = input.closest("[data-slot='field']");
    expect(root).not.toBeNull();
    expect(root?.querySelector("[data-slot='field-label']")?.textContent).toBe("Email");
    expect(root?.querySelector("[data-slot='field-description']")?.textContent).toBe(DESCRIPTION);
    expect(root?.querySelector("[data-slot='field-error']")?.textContent).toBe(ERROR);
    expect(root).toHaveClass("flex", "flex-col", "gap-1.5");
  });

  it("applies the spec classes to label, description and error", async () => {
    const screen = await render(<EmailField invalid />);
    await expect
      .element(screen.getByText("Email"))
      .toHaveClass("text-sm", "font-medium", "leading-snug", "text-foreground");
    await expect
      .element(screen.getByText(DESCRIPTION))
      .toHaveClass("text-sm", "text-muted-foreground");
    await expect.element(screen.getByText(ERROR)).toHaveClass("text-sm", "text-danger");
  });

  it("marks the input invalid, uses the danger border and shows the referenced error", async () => {
    const screen = await render(
      <div>
        <EmailField invalid />
        <div data-testid="ref" className="border border-danger" />
      </div>,
    );
    const input = screen.getByRole("textbox", { name: "Email" });
    await expect.element(input).toHaveAttribute("data-invalid");
    const reference = screen.getByTestId("ref").element();
    expect(getComputedStyle(input.element()).borderTopColor).toBe(
      getComputedStyle(reference).borderTopColor,
    );
    const error = screen.getByText(ERROR);
    await expect.element(error).toBeVisible();
    const describedBy = input.element().getAttribute("aria-describedby") ?? "";
    expect(describedBy.split(" ")).toContain(error.element().id);
  });

  it("does not render the error while valid", async () => {
    const screen = await render(<EmailField />);
    await expect.element(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
    expect(document.querySelector("[data-slot='field-error']")).toBeNull();
    await expect.element(screen.getByText(ERROR)).not.toBeInTheDocument();
  });

  it("unmounts the error and drops its id from aria-describedby when invalid is removed", async () => {
    const screen = await render(<EmailField invalid />);
    const input = screen.getByRole("textbox", { name: "Email" });
    const error = screen.getByText(ERROR);
    await expect.element(error).toBeVisible();
    const errorId = error.element().id;
    expect(errorId).not.toBe("");
    expect((input.element().getAttribute("aria-describedby") ?? "").split(" ")).toContain(errorId);

    await screen.rerender(<EmailField />);
    await expect.element(screen.getByText(ERROR)).not.toBeInTheDocument();
    expect(document.querySelector("[data-slot='field-error']")).toBeNull();
    await expect
      .poll(() => (input.element().getAttribute("aria-describedby") ?? "").split(" "))
      .not.toContain(errorId);
    await expect.element(input).toHaveAccessibleDescription(DESCRIPTION);
  });

  it("lets an explicit match override the Field's invalid prop", async () => {
    const screen = await render(
      <Field invalid>
        <FieldLabel>Email</FieldLabel>
        <Input />
        <FieldError match={false}>{ERROR}</FieldError>
      </Field>,
    );
    await expect.element(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
    expect(document.querySelector("[data-slot='field-error']")).toBeNull();
  });

  it("validates on blur and clears the error once the value is valid", async () => {
    const screen = await render(
      <Field
        validationMode="onBlur"
        validate={(v) => (String(v).includes("@") ? null : "Enter an email address")}
      >
        <FieldLabel>Email</FieldLabel>
        <Input />
        <FieldError />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Email" });
    await userEvent.type(input, "x");
    await userEvent.tab();
    await expect.element(screen.getByText("Enter an email address")).toBeVisible();
    await expect.element(input).toHaveAttribute("data-invalid");
    await userEvent.clear(input);
    await userEvent.type(input, "ada@example.com");
    await userEvent.tab();
    await expect.element(screen.getByText("Enter an email address")).not.toBeInTheDocument();
    await expect.element(input).not.toHaveAttribute("data-invalid");
  });

  it("disables the input and dims the label when disabled", async () => {
    const screen = await render(
      <div>
        <EmailField disabled />
        <span data-testid="muted-ref" className="text-muted-foreground" />
      </div>,
    );
    const input = screen.getByRole("textbox", { name: "Email" });
    await expect.element(input).toBeDisabled();
    const label = screen.getByText("Email");
    await expect.element(label).toHaveAttribute("data-disabled");
    expect(getComputedStyle(label.element()).opacity).toBe("1");
    expect(getComputedStyle(label.element()).color).toBe(
      getComputedStyle(screen.getByTestId("muted-ref").element()).color,
    );
    expect(getComputedStyle(input.element()).cursor).toBe("not-allowed");
  });

  it("dims a disabled label's text without compounding a nested control's opacity", async () => {
    const screen = await render(
      <div>
        <Field disabled>
          <FieldLabel className="flex items-center gap-2">
            <Checkbox />
            Email me
          </FieldLabel>
        </Field>
        <span data-testid="muted-ref" className="text-muted-foreground" />
      </div>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Email me" }).element();
    let opacity = 1;
    for (let el: Element | null = checkbox; el; el = el.parentElement) {
      opacity *= Number(getComputedStyle(el).opacity);
    }
    expect(opacity).toBe(0.5);
    const label = checkbox.closest("[data-slot='field-label']") as HTMLElement;
    expect(getComputedStyle(label).color).toBe(
      getComputedStyle(screen.getByTestId("muted-ref").element()).color,
    );
  });

  it("shows a solid 1px outline on the input on Tab focus", async () => {
    const screen = await render(<EmailField />);
    const input = screen.getByRole("textbox", { name: "Email" }).element() as HTMLElement;
    expect(getComputedStyle(input).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(input);
    expect(getComputedStyle(input).outlineStyle).toBe("solid");
    expect(getComputedStyle(input).outlineWidth).toBe("1px");
  });

  it("passes through props and merges className on every part", async () => {
    const screen = await render(
      <Field id="f1" className="gap-3">
        <FieldLabel className="text-base">Email</FieldLabel>
        <Input />
        <FieldDescription className="text-xs">{DESCRIPTION}</FieldDescription>
      </Field>,
    );
    const root = document.getElementById("f1");
    expect(root).toHaveClass("gap-3");
    expect(root).not.toHaveClass("gap-1.5");
    await expect.element(screen.getByText("Email")).toHaveClass("text-base");
    await expect.element(screen.getByText("Email")).not.toHaveClass("text-sm");
    await expect.element(screen.getByText(DESCRIPTION)).toHaveClass("text-xs");
    await expect.element(screen.getByText(DESCRIPTION)).not.toHaveClass("text-sm");
  });

  it("accepts a className state function", async () => {
    const screen = await render(
      <Field disabled className={(s) => (s.disabled ? "is-off" : "")}>
        <FieldLabel className={(s) => (s.disabled ? "label-off" : "")}>Email</FieldLabel>
        <Input />
      </Field>,
    );
    await expect.element(screen.getByText("Email")).toHaveClass("label-off");
    expect(document.querySelector("[data-slot='field']")).toHaveClass("is-off");
  });

  it("renders FieldItem with its data-slot, merging className and reflecting disabled", async () => {
    await render(
      <Field disabled>
        <FieldItem className={(s) => (s.disabled ? "item-off" : "")}>Option</FieldItem>
        <FieldItem className="gap-2">Other</FieldItem>
      </Field>,
    );
    const items = document.querySelectorAll("[data-slot='field-item']");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveClass("flex", "flex-col", "gap-1", "item-off");
    expect(items[0]).toHaveAttribute("data-disabled");
    expect(items[1]).toHaveClass("gap-2");
    expect(items[1]).not.toHaveClass("gap-1");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <div className="flex flex-col gap-4">
          <EmailField />
          <EmailField invalid />
          <EmailField disabled />
        </div>
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
