import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Field, FieldLabel } from "../field";
import { Label } from "../label";
import { Textarea, type TextareaProps } from "./textarea";

function Labelled({ id, label, ...props }: TextareaProps & { id: string; label: string }) {
  return (
    <div className="flex w-80 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} {...props} />
    </div>
  );
}

describe("Textarea", () => {
  it("renders a <textarea> textbox named by its FieldLabel inside a Field", async () => {
    const screen = await render(
      <Field>
        <FieldLabel>Bio</FieldLabel>
        <Textarea />
      </Field>,
    );
    const textarea = screen.getByRole("textbox", { name: "Bio" });
    await expect.element(textarea).toBeInTheDocument();
    expect(textarea.element().tagName).toBe("TEXTAREA");
    await expect.element(textarea).toHaveAttribute("data-slot", "textarea");
  });

  it("updates its multi-line value when typed into and reports the string to onValueChange", async () => {
    const onValueChange = vi.fn();
    const screen = await render(<Labelled id="n" label="Notes" onValueChange={onValueChange} />);
    const textarea = screen.getByRole("textbox", { name: "Notes" });
    await userEvent.type(textarea, "one{Enter}two");
    await expect.element(textarea).toHaveValue("one\ntwo");
    expect(onValueChange).toHaveBeenLastCalledWith("one\ntwo", expect.anything());
    expect(typeof onValueChange.mock.calls[0]?.[0]).toBe("string");
  });

  it("grows taller as lines are added", async () => {
    const screen = await render(<Labelled id="n" label="Notes" />);
    const textarea = screen.getByRole("textbox", { name: "Notes" });
    const before = (textarea.element() as HTMLElement).getBoundingClientRect().height;
    await userEvent.type(textarea, "1{Enter}2{Enter}3{Enter}4{Enter}5{Enter}6{Enter}7{Enter}8");
    const after = (textarea.element() as HTMLElement).getBoundingClientRect().height;
    expect(after).toBeGreaterThan(before);
  });

  it("uses rows as the minimum height", async () => {
    const screen = await render(
      <div>
        <Labelled id="a" label="Short" />
        <Labelled id="b" label="Tall" rows={10} />
      </div>,
    );
    const height = (name: string) =>
      (screen.getByRole("textbox", { name }).element() as HTMLElement).getBoundingClientRect()
        .height;
    await expect
      .element(screen.getByRole("textbox", { name: "Tall" }))
      .toHaveAttribute("rows", "10");
    expect(height("Tall")).toBeGreaterThan(height("Short"));
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
    const textarea = screen.getByRole("textbox", { name: "Off" });
    await expect.element(textarea).toBeDisabled();
    await expect.element(textarea).toHaveAttribute("data-disabled");
  });

  it("is marked invalid with the danger border inside <Field invalid>", async () => {
    const screen = await render(
      <div>
        <Field invalid>
          <FieldLabel>Bio</FieldLabel>
          <Textarea />
        </Field>
        <div data-testid="ref" className="border border-danger" />
      </div>,
    );
    const textarea = screen.getByRole("textbox", { name: "Bio" });
    await expect.element(textarea).toHaveAttribute("data-invalid");
    const reference = screen.getByTestId("ref").element();
    expect(getComputedStyle(textarea.element()).borderTopColor).toBe(
      getComputedStyle(reference).borderTopColor,
    );
  });

  it("passes through textarea attributes and merges className", async () => {
    const screen = await render(
      <Labelled
        id="a"
        label="Bio"
        name="bio"
        maxLength={140}
        placeholder="Tell us"
        className="min-h-40"
      />,
    );
    const textarea = screen.getByRole("textbox", { name: "Bio" });
    await expect.element(textarea).toHaveAttribute("name", "bio");
    await expect.element(textarea).toHaveAttribute("maxlength", "140");
    await expect.element(textarea).toHaveAttribute("placeholder", "Tell us");
    await expect.element(textarea).toHaveClass("min-h-40");
    await expect.element(textarea).not.toHaveClass("min-h-20");
    await expect.element(textarea).toHaveClass("resize-y");
  });

  it("accepts a className state function", async () => {
    const screen = await render(
      <Labelled id="a" label="Bio" disabled className={(s) => (s.disabled ? "is-off" : "")} />,
    );
    await expect.element(screen.getByRole("textbox", { name: "Bio" })).toHaveClass("is-off");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Labelled id="a" label="Default" />
        <Labelled id="b" label="With placeholder" placeholder="Tell us about yourself" />
        <Labelled id="c" label="Disabled" disabled defaultValue="Locked" />
        <Labelled id="d" label="Read-only" readOnly defaultValue="Fixed" />
        <Field invalid>
          <FieldLabel>Invalid</FieldLabel>
          <Textarea defaultValue="oops" />
        </Field>
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
