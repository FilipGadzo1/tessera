import axe from "axe-core";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Button } from "./button";
import { buttonVariants } from "./button-variants";

const variants = ["solid", "soft", "outline", "ghost", "link"] as const;
const colors = ["primary", "neutral", "success", "warning", "danger", "info"] as const;

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

  it("defaults to solid / primary / md", async () => {
    const screen = await render(<Button>Save</Button>);
    const button = screen.getByRole("button");
    await expect.element(button).toHaveAttribute("data-slot", "button");
    await expect.element(button).toHaveAttribute("data-variant", "solid");
    await expect.element(button).toHaveAttribute("data-color", "primary");
    await expect.element(button).toHaveAttribute("data-size", "md");
    await expect.element(button).toHaveClass("bg-tone", "tone-primary", "h-10", "cursor-pointer");
  });

  it.each([
    ["soft", "bg-tone-soft"],
    ["outline", "border-tone-line"],
    ["ghost", "text-tone-ink"],
    ["link", "underline-offset-4"],
  ] as const)("applies the %s variant", async (variant, expectedClass) => {
    const screen = await render(<Button variant={variant}>Label</Button>);
    const button = screen.getByRole("button");
    await expect.element(button).toHaveAttribute("data-variant", variant);
    await expect.element(button).toHaveClass(expectedClass);
    await expect.element(button).not.toHaveClass("bg-tone");
  });

  it.each(colors)("applies the %s color through its tone", async (color) => {
    const screen = await render(<Button color={color}>Label</Button>);
    const button = screen.getByRole("button");
    await expect.element(button).toHaveAttribute("data-color", color);
    await expect.element(button).toHaveClass(`tone-${color}`);
  });

  it.each([
    ["xs", "h-7"],
    ["sm", "h-8"],
    ["lg", "h-12"],
    ["icon-xs", "size-7"],
    ["icon-sm", "size-8"],
    ["icon", "size-10"],
    ["icon-lg", "size-12"],
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

  it("shows a pointer cursor when clickable, not-allowed when disabled, progress when loading", async () => {
    const screen = await render(
      <div>
        <Button>Ready</Button>
        <Button disabled>Off</Button>
        <Button loading>Busy</Button>
      </div>,
    );
    const cursor = (name: string) =>
      getComputedStyle(screen.getByRole("button", { name }).element()).cursor;
    expect(cursor("Ready")).toBe("pointer");
    expect(cursor("Off")).toBe("not-allowed");
    expect(cursor("Busy")).toBe("progress");
  });

  it("shows a solid 2px outline on keyboard focus and none when unfocused", async () => {
    const screen = await render(
      <div>
        <Button>Focus me</Button>
        <Button>Idle</Button>
      </div>,
    );
    const focused = screen.getByRole("button", { name: "Focus me" }).element() as HTMLElement;
    const idle = screen.getByRole("button", { name: "Idle" }).element() as HTMLElement;
    expect(getComputedStyle(idle).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(focused);
    const style = getComputedStyle(focused);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
    expect(getComputedStyle(idle).outlineStyle).toBe("none");
  });

  it("calls onClick on keyboard Enter when not loading", async () => {
    const onClick = vi.fn();
    const screen = await render(<Button onClick={onClick}>Go</Button>);
    (screen.getByRole("button").element() as HTMLButtonElement).focus();
    await userEvent.keyboard("{Enter}");
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

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("does not call onClick on keyboard %s while loading", async (_key, keys) => {
    const onClick = vi.fn();
    const screen = await render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const element = screen.getByRole("button").element() as HTMLButtonElement;
    element.focus();
    expect(document.activeElement).toBe(element);
    await userEvent.keyboard(keys);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps a caller-provided aria-busy when not loading", async () => {
    const screen = await render(<Button aria-busy>Sync</Button>);
    await expect.element(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("renders only the spinner for icon sizes while loading", async () => {
    const screen = await render(
      <Button size="icon" loading aria-label="Add">
        <svg data-testid="icon" aria-hidden="true" />
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Add" });
    await expect.element(button).toBeInTheDocument();
    const element = button.element();
    expect(element.querySelector('[data-slot="button-spinner"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="icon"]')).toBeNull();
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
    const element = button.element() as HTMLSpanElement;
    expect(element.tagName).toBe("SPAN");
    await expect.element(button).toHaveClass("bg-tone");
    expect(element.tabIndex).toBe(0);
    element.focus();
    expect(document.activeElement).toBe(element);
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
    await expect.element(button).not.toHaveClass("bg-tone");
    await expect.element(button).not.toHaveClass("px-4");

    const toned = await render(
      <Button color="danger" className="tone-success">
        Tone
      </Button>,
    );
    const tonedButton = toned.getByRole("button", { name: "Tone" });
    await expect.element(tonedButton).toHaveClass("tone-success");
    await expect.element(tonedButton).not.toHaveClass("tone-danger");
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
    const classes = buttonVariants({
      variant: "outline",
      color: "danger",
      size: "sm",
      className: "px-6",
    });
    expect(classes).toContain("border-tone-line");
    expect(classes).toContain("tone-danger");
    expect(classes).toContain("h-8");
    expect(classes).toContain("px-6");
    expect(classes).not.toContain("px-3");
    expect(classes).toContain("cursor-pointer");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        {variants.map((variant) =>
          colors.map((color) => (
            <Button key={`${variant}-${color}`} variant={variant} color={color}>
              {variant} {color}
            </Button>
          )),
        )}
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
