import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { Label } from "./label";

describe("Label", () => {
  it("renders a label element with its text and data-slot", async () => {
    const screen = await render(<Label>Email</Label>);
    const label = screen.getByText("Email");
    await expect.element(label).toBeInTheDocument();
    expect(label.element().tagName).toBe("LABEL");
    await expect.element(label).toHaveAttribute("data-slot", "label");
    await expect
      .element(label)
      .toHaveClass("text-sm", "font-medium", "leading-snug", "text-foreground");
  });

  it("focuses the associated input when clicked via htmlFor", async () => {
    const screen = await render(
      <div>
        <Label htmlFor="email">Email</Label>
        <input id="email" />
      </div>,
    );
    await screen.getByText("Email").click();
    expect(document.activeElement).toBe(document.getElementById("email"));
    await expect.element(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
  });

  it("passes through props and merges className", async () => {
    const screen = await render(
      <Label id="l1" className="text-base">
        Name
      </Label>,
    );
    const label = screen.getByText("Name");
    await expect.element(label).toHaveAttribute("id", "l1");
    await expect.element(label).toHaveClass("text-base", "font-medium");
    await expect.element(label).not.toHaveClass("text-sm");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Label htmlFor="name">Name</Label>
        <input id="name" className="border border-field-border bg-field text-foreground" />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
