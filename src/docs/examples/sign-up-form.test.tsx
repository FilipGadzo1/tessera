import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { SignUpForm } from "./sign-up-form";

describe("SignUpForm example", () => {
  it("shows the name, email and terms errors when submitted empty", async () => {
    const screen = await render(<SignUpForm />);
    await screen.getByRole("button", { name: "Create account" }).click();
    await expect.element(screen.getByText("Enter your name")).toBeVisible();
    await expect.element(screen.getByText("Enter a valid email address")).toBeVisible();
    await expect.element(screen.getByText("Accept the terms to continue")).toBeVisible();
    await expect
      .element(screen.getByRole("textbox", { name: "Name" }))
      .toHaveAttribute("aria-invalid", "true");
    expect(screen.container.querySelector("pre")).toBeNull();
  });

  it("focuses the first invalid control (Name) after submitting empty", async () => {
    const screen = await render(<SignUpForm />);
    await screen.getByRole("button", { name: "Create account" }).click();
    await expect.element(screen.getByText("Enter your name")).toBeVisible();
    await expect
      .poll(() => document.activeElement)
      .toBe(screen.getByRole("textbox", { name: "Name" }).element());
  });

  it("rejects an email without @", async () => {
    const screen = await render(<SignUpForm />);
    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "ada.example.com");
    await screen.getByRole("button", { name: "Create account" }).click();
    await expect.element(screen.getByText("Enter a valid email address")).toBeVisible();
  });

  it("submits valid values and shows them as JSON", async () => {
    const screen = await render(<SignUpForm />);
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Ada Lovelace");
    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "ada@example.com");
    await screen.getByRole("radio", { name: "Pro" }).click();
    await screen.getByRole("switch", { name: "Newsletter" }).click();
    await screen.getByRole("checkbox", { name: /I accept the terms/ }).click();
    await screen.getByRole("button", { name: "Create account" }).click();

    const output = screen.getByTestId("sign-up-result");
    await expect.element(output).toBeVisible();
    const json = output.element().textContent ?? "";
    const compact = json.replace(/\s/g, "");
    expect(compact).toContain('"plan":"pro"');
    expect(compact).toContain('"name":"AdaLovelace"');
    expect(compact).toContain('"email":"ada@example.com"');
    expect(compact).toContain('"newsletter":true');
    expect(compact).toContain('"terms":true');
    expect(screen.container.querySelector('[data-slot="field-error"]')).toBeNull();
  });

  it("resets to the initial values", async () => {
    const screen = await render(<SignUpForm />);
    const name = screen.getByRole("textbox", { name: "Name" });
    await userEvent.type(name, "Ada");
    await screen.getByRole("button", { name: "Reset" }).click();
    await expect.element(name).toHaveValue("");
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations in the %s theme, including the error state",
    async (theme) => {
      const screen = await render(
        <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
          <SignUpForm />
        </div>,
      );
      let results = await axe.run(screen.container);
      expect(results.violations.map((v) => v.id)).toEqual([]);
      expect(results.incomplete.flatMap((v) => v.nodes.map((n) => n.target))).toEqual([]);

      await screen.getByRole("button", { name: "Create account" }).click();
      await expect.element(screen.getByText("Enter your name")).toBeVisible();
      await new Promise((resolve) => setTimeout(resolve, 250));
      results = await axe.run(screen.container);
      expect(results.violations.map((v) => v.id)).toEqual([]);
      expect(results.incomplete.flatMap((v) => v.nodes.map((n) => n.target))).toEqual([]);
    },
  );
});
