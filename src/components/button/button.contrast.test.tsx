import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { Button } from "./button";

const variants = ["solid", "soft", "outline", "ghost", "link"] as const;
const colors = ["primary", "neutral", "success", "warning", "danger", "info"] as const;
const primaries = ["malachite", "lapis", "amethyst", "carnelian"] as const;
const surfaces = ["marble", "slate", "sandstone"] as const;
const themes = ["light", "dark"] as const;

const cases = primaries.flatMap((primary) =>
  surfaces.flatMap((surface) => themes.map((theme) => [primary, surface, theme] as const)),
);

describe("Button contrast across every palette", () => {
  it.each(cases)("%s / %s / %s meets WCAG AA", async (primary, surface, theme) => {
    const screen = await render(
      <div
        data-primary={primary}
        data-surface={surface}
        className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}
      >
        {variants.map((variant) =>
          colors.map((color) => (
            <Button key={`${variant}-${color}`} variant={variant} color={color}>
              {variant} {color}
            </Button>
          )),
        )}
      </div>,
    );
    const results = await axe.run(screen.container, { runOnly: ["color-contrast"] });
    expect(results.violations.flatMap((v) => v.nodes.map((n) => n.target.join(" ")))).toEqual([]);
  });
});
