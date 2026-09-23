import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { Badge } from "./badge";
import { badgeVariants } from "./badge-variants";

const variants = ["solid", "soft", "outline"] as const;
const colors = ["primary", "neutral", "success", "warning", "danger", "info"] as const;

describe("Badge", () => {
  it("renders a span with its text", async () => {
    const screen = await render(<Badge>Beta</Badge>);
    const badge = screen.getByText("Beta");
    await expect.element(badge).toBeInTheDocument();
    expect(badge.element().tagName).toBe("SPAN");
  });

  it("defaults to soft / neutral / md", async () => {
    const screen = await render(<Badge>Draft</Badge>);
    const badge = screen.getByText("Draft");
    await expect.element(badge).toHaveAttribute("data-slot", "badge");
    await expect.element(badge).toHaveAttribute("data-variant", "soft");
    await expect.element(badge).toHaveAttribute("data-color", "neutral");
    await expect.element(badge).toHaveAttribute("data-size", "md");
    await expect.element(badge).toHaveClass("bg-tone-soft", "tone-neutral", "h-6");
  });

  it.each([
    ["solid", "bg-tone"],
    ["outline", "border-tone-line"],
  ] as const)("applies the %s variant", async (variant, expectedClass) => {
    const screen = await render(<Badge variant={variant}>Tag</Badge>);
    await expect.element(screen.getByText("Tag")).toHaveClass(expectedClass);
  });

  it.each(colors)("applies the %s color", async (color) => {
    const screen = await render(<Badge color={color}>Tag</Badge>);
    const badge = screen.getByText("Tag");
    await expect.element(badge).toHaveAttribute("data-color", color);
    await expect.element(badge).toHaveClass(`tone-${color}`);
  });

  it("applies the sm size", async () => {
    const screen = await render(<Badge size="sm">Tag</Badge>);
    await expect.element(screen.getByText("Tag")).toHaveClass("h-5");
  });

  it("passes through span props and merges className", async () => {
    const screen = await render(
      <Badge id="b1" title="status" className="rounded-full px-4">
        Live
      </Badge>,
    );
    const badge = screen.getByText("Live");
    await expect.element(badge).toHaveAttribute("id", "b1");
    await expect.element(badge).toHaveAttribute("title", "status");
    await expect.element(badge).toHaveClass("rounded-full", "px-4");
    await expect.element(badge).not.toHaveClass("rounded-md");
  });

  it("badgeVariants returns classes for other elements", () => {
    const classes = badgeVariants({ variant: "solid", color: "success", size: "sm" });
    expect(classes).toContain("bg-tone");
    expect(classes).toContain("tone-success");
    expect(classes).toContain("h-5");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        {variants.map((variant) =>
          colors.map((color) => (
            <Badge key={`${variant}-${color}`} variant={variant} color={color}>
              {variant} {color}
            </Badge>
          )),
        )}
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
