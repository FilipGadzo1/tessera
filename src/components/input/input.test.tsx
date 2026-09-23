import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Label } from "../label";
import { Input, type InputProps } from "./input";
import { inputVariants } from "./input-variants";

function Labelled({ id, label, ...props }: InputProps & { id: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

describe("Input", () => {
  it("renders a textbox named by its Label", async () => {
    const screen = await render(<Labelled id="email" label="Email" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    await expect.element(input).toBeInTheDocument();
    expect(input.element().tagName).toBe("INPUT");
    await expect.element(input).toHaveAttribute("data-slot", "input");
  });

  it("defaults to the md size", async () => {
    const screen = await render(<Labelled id="n" label="Name" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    await expect.element(input).toHaveAttribute("data-size", "md");
    await expect.element(input).toHaveClass("h-10");
  });

  it.each([
    ["sm", "h-8"],
    ["lg", "h-12"],
  ] as const)("applies the %s size", async (size, expectedClass) => {
    const screen = await render(<Labelled id="n" label="Name" size={size} />);
    const input = screen.getByRole("textbox", { name: "Name" });
    await expect.element(input).toHaveAttribute("data-size", size);
    await expect.element(input).toHaveClass(expectedClass);
    await expect.element(input).not.toHaveClass("h-10");
  });

  it("updates its value when typed into and reports the string to onValueChange", async () => {
    const onValueChange = vi.fn();
    const screen = await render(<Labelled id="n" label="Name" onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "Name" });
    await userEvent.type(input, "Ada");
    await expect.element(input).toHaveValue("Ada");
    expect(onValueChange).toHaveBeenLastCalledWith("Ada", expect.anything());
    expect(typeof onValueChange.mock.calls[0]?.[0]).toBe("string");
  });

  it("shows a solid 1px outline on Tab focus and none before", async () => {
    const screen = await render(
      <div>
        <Labelled id="a" label="First" />
        <Labelled id="b" label="Second" />
      </div>,
    );
    const first = screen.getByRole("textbox", { name: "First" }).element() as HTMLElement;
    const second = screen.getByRole("textbox", { name: "Second" }).element() as HTMLElement;
    expect(getComputedStyle(first).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(first);
    const style = getComputedStyle(first);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("1px");
    expect(getComputedStyle(second).outlineStyle).toBe("none");
  });

  it("shows a text cursor, and not-allowed when disabled", async () => {
    const screen = await render(
      <div>
        <Labelled id="a" label="Ready" />
        <Labelled id="b" label="Off" disabled />
      </div>,
    );
    const cursor = (name: string) =>
      getComputedStyle(screen.getByRole("textbox", { name }).element()).cursor;
    expect(cursor("Ready")).toBe("text");
    expect(cursor("Off")).toBe("not-allowed");
  });

  it("is disabled when disabled", async () => {
    const screen = await render(<Labelled id="a" label="Off" disabled />);
    const input = screen.getByRole("textbox", { name: "Off" });
    await expect.element(input).toBeDisabled();
    await expect.element(input).toHaveAttribute("data-disabled");
  });

  it("uses the danger border when aria-invalid", async () => {
    const screen = await render(
      <div>
        <Labelled id="a" label="Bad" aria-invalid="true" />
        <div data-testid="ref" className="border border-danger" />
      </div>,
    );
    const input = screen.getByRole("textbox", { name: "Bad" }).element();
    const reference = screen.getByTestId("ref").element();
    expect(getComputedStyle(input).borderTopColor).toBe(getComputedStyle(reference).borderTopColor);
  });

  it("renders the placeholder attribute", async () => {
    const screen = await render(<Labelled id="a" label="Email" placeholder="you@example.com" />);
    await expect
      .element(screen.getByPlaceholder("you@example.com"))
      .toHaveAttribute("placeholder", "you@example.com");
  });

  it("passes through props and merges className", async () => {
    const screen = await render(<Labelled id="a" label="Name" name="full" className="h-14" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    await expect.element(input).toHaveAttribute("name", "full");
    await expect.element(input).toHaveClass("h-14");
    await expect.element(input).not.toHaveClass("h-10");
  });

  it("accepts a className state function", async () => {
    const screen = await render(
      <Labelled id="a" label="Name" disabled className={(s) => (s.disabled ? "is-off" : "")} />,
    );
    await expect.element(screen.getByRole("textbox", { name: "Name" })).toHaveClass("is-off");
  });

  it("inputVariants returns classes for other elements", () => {
    const classes = inputVariants({ size: "lg", className: "w-40" });
    expect(classes).toContain("h-12");
    expect(classes).toContain("border-field-border");
    expect(classes).toContain("w-40");
    expect(classes).not.toContain("w-full");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Labelled id="a" label="Default" />
        <Labelled id="b" label="With placeholder" placeholder="you@example.com" />
        <Labelled id="c" label="Disabled" disabled defaultValue="Locked" />
        <Labelled id="d" label="Invalid" aria-invalid="true" defaultValue="oops" />
        <Labelled id="e" label="Read-only" readOnly defaultValue="Fixed" />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
