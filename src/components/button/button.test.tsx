import axe from "axe-core";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { Button } from "./button";
import { buttonVariants } from "./button-variants";

const variants = ["primary", "secondary", "outline", "ghost", "destructive", "link"] as const;

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

describe("Button", () => {
  it("renders a native button with type=button and an accessible name", async () => {
    const screen = await render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    await expect.element(button).toBeInTheDocument();
    await expect.element(button).toHaveAttribute("type", "button");
    expect(button.element().tagName).toBe("BUTTON");
  });

  it("defaults to the primary variant and md size", async () => {
    const screen = await render(<Button>Save</Button>);
    const button = screen.getByRole("button");
    await expect.element(button).toHaveAttribute("data-slot", "button");
    await expect.element(button).toHaveAttribute("data-variant", "primary");
    await expect.element(button).toHaveAttribute("data-size", "md");
    await expect.element(button).toHaveClass("bg-primary", "h-9");
  });

  it.each([
    ["secondary", "bg-secondary"],
    ["outline", "border-border"],
    ["ghost", "hover:bg-accent"],
    ["destructive", "bg-destructive"],
    ["link", "underline-offset-4"],
  ] as const)("applies the %s variant", async (variant, expectedClass) => {
    const screen = await render(<Button variant={variant}>Label</Button>);
    const button = screen.getByRole("button");
    await expect.element(button).toHaveAttribute("data-variant", variant);
    await expect.element(button).toHaveClass(expectedClass);
  });

  it.each([
    ["xs", "h-7"],
    ["sm", "h-8"],
    ["lg", "h-10"],
    ["icon", "size-9"],
  ] as const)("applies the %s size", async (size, expectedClass) => {
    const screen = await render(
      <Button size={size} aria-label="Label">
        L
      </Button>,
    );
    await expect.element(screen.getByRole("button")).toHaveClass(expectedClass);
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const screen = await render(<Button onClick={onClick}>Go</Button>);
    await screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const onClick = vi.fn();
    const screen = await render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    const button = screen.getByRole("button");
    await expect.element(button).toBeDisabled();
    (button.element() as HTMLButtonElement).click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("marks loading buttons busy, keeps them focusable, and blocks clicks", async () => {
    const onClick = vi.fn();
    const screen = await render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving" });
    const element = button.element() as HTMLButtonElement;

    await expect.element(button).toHaveAttribute("aria-busy", "true");
    await expect.element(button).toHaveAttribute("aria-disabled", "true");
    await expect.element(button).toHaveAttribute("data-loading");

    element.focus();
    expect(document.activeElement).toBe(element);

    const spinner = element.querySelector('[data-slot="button-spinner"]');
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute("aria-hidden")).toBe("true");

    element.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("submits a form when type=submit", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const screen = await render(
      <form
        onSubmit={(event) => {
          onSubmit(event.nativeEvent as SubmitEvent);
        }}
      >
        <Button type="submit">Send</Button>
      </form>,
    );
    await screen.getByRole("button", { name: "Send" }).click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not submit a form by default", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const screen = await render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(event.nativeEvent as SubmitEvent);
        }}
      >
        <Button>Just a button</Button>
      </form>,
    );
    await screen.getByRole("button").click();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders a custom element via render + nativeButton={false}", async () => {
    const screen = await render(
      <Button nativeButton={false} render={<span />}>
        Menu
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button.element().tagName).toBe("SPAN");
    await expect.element(button).toHaveClass("bg-primary");
  });

  it("forwards ref to the DOM element", async () => {
    const ref = createRef<HTMLButtonElement>();
    await render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("merges className so caller utilities win conflicts", async () => {
    const screen = await render(<Button className="bg-red-500 px-8">Custom</Button>);
    const button = screen.getByRole("button");
    await expect.element(button).toHaveClass("bg-red-500", "px-8");
    await expect.element(button).not.toHaveClass("bg-primary");
    await expect.element(button).not.toHaveClass("px-4");
  });

  it("accepts a className function receiving Base UI state", async () => {
    const screen = await render(
      <Button disabled className={(state) => (state.disabled ? "is-off" : "is-on")}>
        State
      </Button>,
    );
    await expect.element(screen.getByRole("button")).toHaveClass("is-off");
  });

  it("buttonVariants styles non-button elements such as links", () => {
    const classes = buttonVariants({ variant: "outline", size: "sm", className: "px-6" });
    expect(classes).toContain("border-border");
    expect(classes).toContain("h-8");
    expect(classes).toContain("px-6");
    expect(classes).not.toContain("px-3");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        {variants.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
        <Button size="icon" aria-label="Add item">
          <PlusIcon />
        </Button>
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
