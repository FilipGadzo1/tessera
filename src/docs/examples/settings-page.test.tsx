import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { SettingsPage } from "./settings-page";

const tab = (name: string) => page.getByRole("tab", { name });
const panel = () => page.getByRole("tabpanel");
const toasts = () => [...document.body.querySelectorAll<HTMLElement>('[data-slot="toast"]')];

async function tabTo(element: Element, key: "{Tab}" | "{Shift>}{Tab}{/Shift}" = "{Tab}") {
  for (let i = 0; i < 20 && document.activeElement !== element; i++) await userEvent.keyboard(key);
  expect(document.activeElement).toBe(element);
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("SettingsPage example", () => {
  it("opens on the Profile tab with an initials fallback avatar and the current language", async () => {
    await render(<SettingsPage />);
    await expect.element(page.getByRole("heading", { level: 2, name: "Settings" })).toBeVisible();
    await expect.element(tab("Profile")).toHaveAttribute("aria-selected", "true");
    await expect.element(page.getByText("AL", { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("textbox", { name: "Display name" }))
      .toHaveValue("Ada Lovelace");
    await expect
      .element(page.getByRole("combobox", { name: "Language" }))
      .toHaveTextContent("English");
  });

  it("changes settings with the keyboard only, then Save shows a success toast", async () => {
    await render(<SettingsPage />);

    // Tabs: one tab stop; ArrowRight moves focus, Enter activates (manual activation).
    await tabTo(tab("Profile").element());
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => document.activeElement).toBe(tab("Notifications").element());
    await userEvent.keyboard("{Enter}");
    await expect.element(tab("Notifications")).toHaveAttribute("aria-selected", "true");

    // Accordion: expand the Push channel.
    const push = page.getByRole("button", { name: "Push" });
    await tabTo(push.element());
    await expect.element(push).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{Enter}");
    await expect.element(push).toHaveAttribute("aria-expanded", "true");

    // Switch inside the channel: Space toggles it.
    const reviews = page.getByRole("switch", { name: "Review requests" });
    await tabTo(reviews.element());
    await expect.element(reviews).toHaveAttribute("aria-checked", "false");
    await userEvent.keyboard(" ");
    await expect.element(reviews).toHaveAttribute("aria-checked", "true");

    // Back to Profile: Shift+Tab to the tab list, ArrowLeft, Enter.
    await tabTo(tab("Notifications").element(), "{Shift>}{Tab}{/Shift}");
    await userEvent.keyboard("{ArrowLeft}{Enter}");
    await expect.element(tab("Profile")).toHaveAttribute("aria-selected", "true");

    // Select: open with Enter, typeahead to Deutsch, Enter selects.
    const language = page.getByRole("combobox", { name: "Language" });
    await tabTo(language.element());
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("listbox")).toBeVisible();
    await waitForPopupSettled(document.querySelector("[data-slot=select-content]") as HTMLElement);
    await userEvent.keyboard("de");
    await expect
      .element(page.getByRole("option", { name: "Deutsch" }))
      .toHaveAttribute("data-highlighted");
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("listbox")).not.toBeInTheDocument();
    await expect.element(language).toHaveTextContent("Deutsch");

    // Save: a plain (low-priority) success toast summarising the changes.
    await tabTo(page.getByRole("button", { name: "Save changes" }).element());
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => toasts().length).toBe(1);
    const toast = toasts()[0] as HTMLElement;
    expect(toast.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Settings saved");
    expect(toast.querySelector('[data-slot="toast-description"]')?.textContent).toBe(
      "Language: Deutsch · 5 of 6 notifications on.",
    );
    expect(toast.querySelector('[data-slot="toast-icon"]')).not.toBeNull();
    expect(toast.querySelector('[data-slot="toast-action"]')).toBeNull();
    expect(toast.getAttribute("role")).not.toBe("alertdialog");
  });

  it("keeps notification switches across a collapsed channel and a tab change", async () => {
    await render(<SettingsPage />);
    await userEvent.click(tab("Notifications"));
    await userEvent.click(page.getByRole("button", { name: "SMS" }));
    const codes = page.getByRole("switch", { name: "Sign-in codes" });
    await expect.element(codes).toHaveAttribute("aria-checked", "true");
    await userEvent.click(codes);
    await userEvent.click(page.getByRole("button", { name: "SMS" }));
    await expect.element(codes).not.toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "SMS" }));
    await expect.element(codes).toHaveAttribute("aria-checked", "false");
    await userEvent.click(tab("Billing"));
    await userEvent.click(tab("Notifications"));
    await expect
      .element(page.getByRole("button", { name: "SMS" }))
      .toHaveAttribute("aria-expanded", "true");
    await expect.element(codes).toHaveAttribute("aria-checked", "false");
  });

  it("shows storage and seats on the Billing tab", async () => {
    await render(<SettingsPage />);
    await userEvent.click(tab("Billing"));
    const storage = page.getByRole("progressbar", { name: "Storage" });
    await expect.element(storage).toHaveAttribute("aria-valuenow", "32.4");
    await expect.element(storage).toHaveAttribute("aria-valuemax", "50");
    await expect
      .element(page.getByRole("progressbar", { name: "Seats" }))
      .toHaveAttribute("aria-valuenow", "7");
    await expect.element(panel().getByRole("heading", { name: "Team plan" })).toBeVisible();
  });

  describe.each(["light", "dark"] as const)("axe (%s)", (theme) => {
    it.each(["Profile", "Notifications", "Billing"])(
      "has no violations on the %s tab",
      async (name) => {
        if (theme === "dark") document.documentElement.classList.add("dark");
        try {
          const screen = await render(
            <div className="bg-background p-4">
              <SettingsPage />
            </div>,
          );
          await userEvent.click(tab(name));
          await expect.element(tab(name)).toHaveAttribute("aria-selected", "true");
          if (name === "Notifications") {
            for (const channel of ["Email", "Push", "SMS"]) {
              const trigger = page.getByRole("button", { name: channel });
              if (trigger.element().getAttribute("aria-expanded") !== "true") {
                await userEvent.click(trigger);
              }
            }
            await expect.poll(() => page.getByRole("switch").elements().length).toBe(6);
            await expect.poll(() => document.getAnimations().length).toBe(0);
          }
          const results = await axe.run(screen.container);
          expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual(
            [],
          );
          expect(results.incomplete.flatMap((v) => v.nodes.map((n) => n.target))).toEqual([]);
        } finally {
          document.documentElement.classList.remove("dark");
        }
      },
    );

    it("has no violations with the success toast showing", async () => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      try {
        await render(
          <div className="bg-background p-4">
            <SettingsPage />
          </div>,
        );
        await userEvent.click(page.getByRole("button", { name: "Save changes" }));
        await expect.poll(() => toasts().length).toBe(1);
        // Expanded (as on hover or focus): Base UI hides the Close button from assistive tech
        // while the stack is collapsed, yet keeps it focusable, which axe flags for review.
        await userEvent.hover(page.elementLocator(toasts()[0] as HTMLElement));
        await expect
          .poll(() =>
            document.querySelector('[data-slot="toaster"]')?.hasAttribute("data-expanded"),
          )
          .toBe(true);
        await expect.poll(() => document.getAnimations().length).toBe(0);
        const { violations, incomplete } = await auditOpenOverlay();
        expect(violations).toEqual([]);
        expect(incomplete).toEqual([]);
      } finally {
        document.documentElement.classList.remove("dark");
      }
    });
  });
});
