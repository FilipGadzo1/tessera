import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { Checkbox } from "../checkbox";
import { Field, FieldLabel } from "../field";
import { Fieldset, FieldsetLegend } from "./fieldset";

/** Base UI pattern: each control sits in a Field, which inherits the Fieldset disabled state. */
function Notifications({ disabled }: { disabled?: boolean }) {
  return (
    <Fieldset disabled={disabled}>
      <FieldsetLegend>Notifications</FieldsetLegend>
      <Field>
        <FieldLabel className="flex items-center gap-2">
          <Checkbox name="email" />
          Email
        </FieldLabel>
      </Field>
      <Field>
        <FieldLabel className="flex items-center gap-2">
          <Checkbox name="sms" />
          SMS
        </FieldLabel>
      </Field>
    </Fieldset>
  );
}

describe("Fieldset", () => {
  it("renders a fieldset group named by its legend, with data-slots", async () => {
    const screen = await render(<Notifications />);
    const group = screen.getByRole("group", { name: "Notifications" });
    await expect.element(group).toBeInTheDocument();
    await expect.element(group).toHaveAttribute("data-slot", "fieldset");
    expect(group.element().tagName).toBe("FIELDSET");
    const legend = screen.getByText("Notifications");
    await expect.element(legend).toHaveAttribute("data-slot", "fieldset-legend");
    await expect.element(group).toHaveClass("flex", "flex-col", "gap-3");
    await expect.element(legend).toHaveClass("text-sm", "font-medium", "text-foreground");
  });

  it("disables the controls inside a disabled fieldset", async () => {
    const screen = await render(<Notifications disabled />);
    await expect.element(screen.getByRole("group")).toHaveAttribute("data-disabled");
    await expect
      .element(screen.getByRole("checkbox", { name: "Email" }))
      .toHaveAttribute("data-disabled");
    expect(getComputedStyle(screen.getByRole("checkbox", { name: "Email" }).element()).cursor).toBe(
      "not-allowed",
    );
  });

  it("merges className strings and accepts a className state function", async () => {
    const screen = await render(
      <Fieldset className={(s) => (s.disabled ? "is-off" : "gap-6")}>
        <FieldsetLegend className="text-base">Plan</FieldsetLegend>
      </Fieldset>,
    );
    const group = screen.getByRole("group", { name: "Plan" });
    await expect.element(group).toHaveClass("gap-6");
    await expect.element(group).not.toHaveClass("gap-3");
    await expect.element(screen.getByText("Plan")).toHaveClass("text-base");
    await expect.element(screen.getByText("Plan")).not.toHaveClass("text-sm");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Notifications />
        <Notifications disabled />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
