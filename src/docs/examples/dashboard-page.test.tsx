import axe from "axe-core";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { resetEmulatedMedia } from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { restorePlatform, stubMac, stubWindows } from "../../../test/platform";
import { DashboardPage } from "./dashboard-page";

const trigger = () => page.getByRole("button", { name: "Toggle sidebar" });
const link = (name: string) => page.getByRole("link", { name, exact: true });
const aside = () => document.querySelector<HTMLElement>("aside[data-slot=sidebar]");
const segment = (type: "day" | "month" | "year") =>
  document.querySelector<HTMLElement>(`[data-slot=date-field-segment][data-type=${type}]`);

async function type(keys: string) {
  for (const key of keys) await userEvent.keyboard(key);
}

async function audit() {
  const results = await axe.run(document.body, { rules: { region: { enabled: false } } });
  return {
    violations: results.violations.map((v) => `${v.id}: ${v.help}`),
    incomplete: results.incomplete.map(
      (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.html).join(", ")})`,
    ),
  };
}

beforeEach(async () => {
  await page.viewport(1280, 800);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 30, 12));
  // Off Apple, whatever the host: the tests press Ctrl+K and read "Ctrl" hints.
  stubWindows();
});

afterEach(async () => {
  vi.useRealTimers();
  document.documentElement.classList.remove("dark");
  restorePlatform();
  await resetEmulatedMedia();
});

afterAll(async () => {
  await page.viewport(414, 896);
});

describe("DashboardPage shortcut hint", () => {
  const searchButton = () => page.getByRole("button", { name: "Search" });

  it("Search: Control+K, an aria-hidden Ctrl K hint, no Ctrl in the name", async () => {
    await render(<DashboardPage />);
    const button = searchButton().element() as HTMLElement;
    expect(button.getAttribute("aria-keyshortcuts")).toBe("Control+K");
    const hint = button.querySelector<HTMLElement>("[data-slot=kbd-shortcut]");
    expect(hint?.getAttribute("aria-hidden")).toBe("true");
    expect(
      Array.from(hint?.querySelectorAll(":scope > kbd") ?? []).map((key) => key.textContent),
    ).toEqual(["Ctrl", "K"]);
    await expect.element(searchButton()).toHaveAccessibleName("Search");
  });

  it("under a macOS stub: Meta+K and a ⌘ hint", async () => {
    stubMac();
    await render(<DashboardPage />);
    await expect.element(searchButton()).toHaveAttribute("aria-keyshortcuts", "Meta+K");
    const button = searchButton().element() as HTMLElement;
    expect(button.querySelector("[data-slot=kbd-glyph]")?.textContent).toBe("⌘");
    await expect.element(searchButton()).toHaveAccessibleName("Search");
  });
});

describe("DashboardPage example", () => {
  it("Ctrl+B collapses the sidebar to icons and the nav keeps its names", async () => {
    await render(<DashboardPage />);
    await expect.element(link("Overview")).toHaveAttribute("aria-current", "page");
    await userEvent.click(page.getByRole("heading", { level: 1 }));
    await userEvent.keyboard("{Control>}b{/Control}");
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("collapsed");
    for (const name of ["Overview", "Orders", "Customers", "Products"]) {
      await expect.element(link(name)).toBeInTheDocument();
    }
    await userEvent.hover(link("Orders"));
    await expect.element(page.getByRole("tooltip", { name: "Orders" })).toBeVisible();
    await userEvent.keyboard("{Control>}b{/Control}");
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("expanded");
  });

  it("navigates to Orders: aria-current, heading and breadcrumb follow", async () => {
    await render(<DashboardPage />);
    await userEvent.click(link("Orders"));
    await expect.element(link("Orders")).toHaveAttribute("aria-current", "page");
    expect(link("Overview").element().hasAttribute("aria-current")).toBe(false);
    await expect
      .element(page.getByRole("heading", { level: 1, name: "Orders" }))
      .toBeInTheDocument();
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect.element(breadcrumb.getByRole("link", { name: "Acme Inc." })).toBeVisible();
    await expect
      .poll(() => breadcrumb.element().querySelector("[aria-current=page]")?.textContent)
      .toBe("Orders");
  });

  it("a sub-item link navigates too (to its parent page)", async () => {
    await render(<DashboardPage />);
    await userEvent.click(link("Inventory"));
    await expect
      .element(page.getByRole("heading", { level: 1, name: "Products" }))
      .toBeInTheDocument();
    await expect.element(link("Products")).toHaveAttribute("aria-current", "page");
  });

  it("the workspace and account menu triggers are named by their visible text (WCAG 2.5.3)", async () => {
    await render(<DashboardPage />);
    await expect
      .element(page.getByRole("button", { name: "Acme Inc. Workspace", exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "AL Ada Lovelace ada@acme.test", exact: true }))
      .toBeInTheDocument();
  });

  it("the workspace Menu switches the workspace", async () => {
    await render(<DashboardPage />);
    await userEvent.click(page.getByRole("button", { name: "Acme Inc. Workspace" }));
    const item = page.getByRole("menuitem", { name: "Globex" });
    await expect.element(item).toBeVisible();
    await userEvent.click(item);
    await expect.element(page.getByRole("link", { name: "Globex" })).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Globex Workspace", exact: true }))
      .toBeInTheDocument();
  });

  it("the command palette opens from Search and runs a command", async () => {
    await render(<DashboardPage />);
    await userEvent.click(page.getByRole("button", { name: "Search" }));
    await expect.element(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await userEvent.keyboard("cust");
    await userEvent.keyboard("{Enter}");
    await expect
      .element(page.getByRole("heading", { level: 1, name: "Customers" }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("dialog", { name: "Command palette" }))
      .not.toBeInTheDocument();
  });

  it("Ctrl+K opens the palette; Escape clears the query first, then closes it", async () => {
    await render(<DashboardPage />);
    await userEvent.click(page.getByRole("heading", { level: 1 }));
    await userEvent.keyboard("{Control>}k{/Control}");
    const dialog = page.getByRole("dialog", { name: "Command palette" });
    await expect.element(dialog).toBeVisible();
    await waitForPopupSettled(dialog.element());
    const input = page.getByRole("combobox", { name: "Search commands" });
    await expect.poll(() => document.activeElement).toBe(input.element());
    await type("cust");
    await expect.element(input).toHaveValue("cust");
    await userEvent.keyboard("{Escape}");
    await expect.element(input).toHaveValue("");
    await expect.element(dialog).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).not.toBeInTheDocument();
  });

  it("typing a date and picking a period, then Apply, reports the ISO values", async () => {
    await render(<DashboardPage />);
    await userEvent.click(segment("month") as HTMLElement);
    await type("09012026");
    await expect.poll(() => segment("year")?.textContent).toBe("2026");

    await userEvent.click(page.getByRole("button", { name: /Period/ }));
    const dialog = page.getByRole("dialog", { name: "Choose date range" });
    await expect.element(dialog).toBeVisible();
    await waitForPopupSettled(dialog.element());
    await userEvent.click(page.getByRole("button", { name: /September 1, 2026/ }));
    await userEvent.click(page.getByRole("button", { name: /September 30, 2026/ }));
    await expect.element(dialog).not.toBeInTheDocument();

    await userEvent.click(page.getByRole("button", { name: "Apply" }));
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent("Filtered: From 2026-09-01 · Period 2026-09-01 – 2026-09-30");
  });

  it("Enter in the typed date submits the filter Form", async () => {
    await render(<DashboardPage />);
    await userEvent.click(segment("month") as HTMLElement);
    await type("09012026");
    await expect.poll(() => segment("year")?.textContent).toBe("2026");
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("status")).toHaveTextContent("Filtered: From 2026-09-01");
  });

  it("the editable DatePicker's calendar opens and passes axe", async () => {
    await render(<DashboardPage />);
    await userEvent.click(page.getByRole("button", { name: "Choose date", exact: true }));
    const dialog = page.getByRole("dialog", { name: "Choose date" });
    await expect.element(dialog).toBeVisible();
    await waitForPopupSettled(dialog.element());
    // The popup covers the table; hide the page so axe can decide the rest (as the Checkout test).
    document.querySelector("main")?.setAttribute("hidden", "");
    expect(await auditOpenOverlay()).toEqual({ violations: [], incomplete: [] });
  });

  for (const dark of [false, true]) {
    it(`axe: expanded and icon-collapsed (${dark ? "dark" : "light"})`, async () => {
      document.documentElement.classList.toggle("dark", dark);
      await render(<DashboardPage />);
      await expect.element(link("Overview")).toBeVisible();
      expect(await audit()).toEqual({ violations: [], incomplete: [] });
      await userEvent.click(trigger());
      await expect.poll(() => aside()?.getAttribute("data-state")).toBe("collapsed");
      expect(await audit()).toEqual({ violations: [], incomplete: [] });
    });
  }

  describe("mobile", () => {
    it("the trigger opens the Drawer and Escape returns focus to it", async () => {
      await page.viewport(390, 800);
      await render(<DashboardPage />);
      // The first render assumes desktop; the client switches to the Drawer after mounting.
      await expect.poll(aside).toBeNull();
      const button = trigger().element() as HTMLElement;
      await userEvent.click(trigger());
      const drawer = page.getByRole("dialog", { name: "Sidebar" });
      await expect.element(drawer).toBeVisible();
      await waitForPopupSettled(drawer.element());
      await expect.element(link("Orders")).toBeVisible();
      await userEvent.keyboard("{Escape}");
      await expect.element(drawer).not.toBeInTheDocument();
      await expect.poll(() => document.activeElement).toBe(button);
    });
  });
});
