import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { Button } from "../button/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import { cardDefaults, cardVariants } from "./card-variants";

function Example({ variant }: { variant?: "outlined" | "elevated" }) {
  return (
    <Card variant={variant} data-testid="card">
      <CardHeader>
        <CardTitle>Invite teammates</CardTitle>
        <CardDescription>They get access to every project in this workspace.</CardDescription>
      </CardHeader>
      <CardContent>3 seats left on your plan.</CardContent>
      <CardFooter>
        <Button>Send invites</Button>
        <Button variant="ghost" color="neutral">
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}

describe("Card", () => {
  it("cardVariants styles any element and merges className", () => {
    expect(cardDefaults.variant).toBe("outlined");
    expect(cardVariants()).toContain("border-border");
    const elevated = cardVariants({ variant: "elevated", className: "rounded-none" });
    expect(elevated).toContain("shadow-md");
    expect(elevated).toContain("rounded-none");
    expect(elevated).not.toContain("rounded-xl");
  });

  it("renders every part with its data-slot", async () => {
    const screen = await render(<Example />);
    const card = screen.getByTestId("card").element();
    expect(card.getAttribute("data-slot")).toBe("card");
    for (const slot of [
      "card-header",
      "card-title",
      "card-description",
      "card-content",
      "card-footer",
    ]) {
      expect(card.querySelector(`[data-slot="${slot}"]`)).not.toBeNull();
    }
    await expect
      .element(screen.getByText("Invite teammates"))
      .toHaveAttribute("data-slot", "card-title");
  });

  it("defaults to the outlined variant", async () => {
    const screen = await render(<Example />);
    const card = screen.getByTestId("card");
    await expect.element(card).toHaveAttribute("data-variant", "outlined");
    await expect.element(card).toHaveClass("border-border", "bg-card", "rounded-xl");
  });

  it("supports the elevated variant", async () => {
    const screen = await render(<Example variant="elevated" />);
    const card = screen.getByTestId("card");
    await expect.element(card).toHaveAttribute("data-variant", "elevated");
    await expect.element(card).toHaveClass("shadow-md");
    await expect.element(card).not.toHaveClass("border-border");
  });

  it("merges className on every part", async () => {
    const screen = await render(
      <Card data-testid="c" className="rounded-none">
        <CardHeader className="px-2">
          <CardTitle className="text-xl">T</CardTitle>
        </CardHeader>
      </Card>,
    );
    await expect.element(screen.getByTestId("c")).toHaveClass("rounded-none");
    await expect.element(screen.getByTestId("c")).not.toHaveClass("rounded-xl");
    await expect.element(screen.getByText("T")).toHaveClass("text-xl");
    await expect.element(screen.getByText("T")).not.toHaveClass("text-base");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Example />
        <Example variant="elevated" />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
