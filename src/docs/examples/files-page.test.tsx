import axe from "axe-core";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { resetEmulatedMedia } from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { FilesPage } from "./files-page";

const heading = () => page.getByRole("heading", { level: 1 });
const tree = () => page.getByRole("tree", { name: "Folders" });
const folder = (name: string) => page.getByRole("treeitem", { name, exact: true });
const rows = () =>
  [...document.querySelectorAll("[data-slot=table-body] tr")].map(
    (row) => row.querySelector("td")?.textContent ?? "",
  );
const commandDialog = () => page.getByRole("dialog", { name: "Command menu" });
const preview = () => page.getByRole("region", { name: "Image preview" });
const slides = () => [...document.querySelectorAll<HTMLElement>("[data-slot=carousel-item]")];
const segment = (half: "start" | "end", type: "day" | "month" | "year") =>
  document.querySelector<HTMLElement>(
    `[data-slot=date-range-field-${half}] [data-slot=date-field-segment][data-type=${type}]`,
  );

async function type(keys: string) {
  for (const key of keys) await userEvent.keyboard(key);
}

async function tabTo(element: Element) {
  for (let i = 0; i < 40 && document.activeElement !== element; i++)
    await userEvent.keyboard("{Tab}");
  expect(document.activeElement).toBe(element);
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

async function openCommand() {
  await userEvent.click(heading());
  await userEvent.keyboard("{Control>}k{/Control}");
  await expect.element(commandDialog()).toBeVisible();
  await waitForPopupSettled(commandDialog().element());
  await expect.poll(() => document.activeElement?.getAttribute("data-slot")).toBe("command-input");
}

beforeEach(async () => {
  await page.viewport(1280, 800);
  // Only `Date` is faked: "today" for the calendar; React and userEvent keep real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 30, 12));
});

afterEach(async () => {
  vi.useRealTimers();
  document.documentElement.classList.remove("dark");
  delete (navigator as { userAgentData?: unknown }).userAgentData;
  await resetEmulatedMedia();
});

afterAll(async () => {
  await page.viewport(414, 896);
});

describe("FilesPage shortcut hints", () => {
  const commandsButton = () => page.getByRole("button", { name: "Commands" });
  const toggleHint = () =>
    page
      .getByRole("option", { name: "Toggle sidebar" })
      .element()
      .querySelector("[data-slot=command-shortcut]")?.textContent;

  it("Commands: Control+K, an aria-hidden Ctrl K hint, no Ctrl in the name; Toggle sidebar reads Ctrl+B", async () => {
    await render(<FilesPage />);
    const button = commandsButton().element() as HTMLElement;
    expect(button.getAttribute("aria-keyshortcuts")).toBe("Control+K");
    const hint = button.querySelector<HTMLElement>("[data-slot=kbd-shortcut]");
    expect(hint?.getAttribute("aria-hidden")).toBe("true");
    expect(
      Array.from(hint?.querySelectorAll(":scope > kbd") ?? []).map((key) => key.textContent),
    ).toEqual(["Ctrl", "K"]);
    await expect.element(commandsButton()).toHaveAccessibleName("Commands");
    await openCommand();
    expect(toggleHint()).toBe("Ctrl+B");
  });

  it("under a macOS stub: Meta+K, a ⌘ hint and ⌘B", async () => {
    Object.defineProperty(navigator, "userAgentData", {
      value: { platform: "macOS" },
      configurable: true,
    });
    await render(<FilesPage />);
    await expect.element(commandsButton()).toHaveAttribute("aria-keyshortcuts", "Meta+K");
    const button = commandsButton().element() as HTMLElement;
    expect(button.querySelector("[data-slot=kbd-glyph]")?.textContent).toBe("⌘");
    await expect.element(commandsButton()).toHaveAccessibleName("Commands");
    await userEvent.click(commandsButton());
    await expect.element(commandDialog()).toBeVisible();
    await waitForPopupSettled(commandDialog().element());
    expect(toggleHint()).toBe("⌘B");
  });
});

describe("FilesPage example", () => {
  it("Tab into the Tree, arrows and → expand a folder, Enter opens it: heading and Table change", async () => {
    await render(<FilesPage />);
    await expect.element(heading()).toHaveTextContent("Documents");
    expect(rows()).toContain("Budget 2026.xlsx");

    // The open folder is selected, so it is the Tree's tab stop.
    await tabTo(folder("Documents").element());
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(() => document.activeElement).toBe(folder("Pictures").element());
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(folder("Pictures")).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => document.activeElement).toBe(folder("Holiday").element());
    // Moving focus does not open a folder; Enter does.
    await expect.element(heading()).toHaveTextContent("Documents");
    await userEvent.keyboard("{Enter}");

    await expect.element(heading()).toHaveTextContent("Holiday");
    await expect.element(folder("Holiday")).toHaveAttribute("aria-selected", "true");
    await expect.element(folder("Documents")).toHaveAttribute("aria-selected", "false");
    await expect.poll(rows).toEqual(["Beach.png", "Harbour.png", "Itinerary.pdf"]);
    await expect.element(page.getByRole("table", { name: "Files in Holiday" })).toBeInTheDocument();
  });

  it("Enter and a double-click each open a folder once", async () => {
    const onOpenFolder = vi.fn();
    await render(<FilesPage onOpenFolder={onOpenFolder} />);
    await tabTo(folder("Documents").element());
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(() => document.activeElement).toBe(folder("Pictures").element());
    // Enter both selects (single mode) and runs onAction: still one opening.
    await userEvent.keyboard("{Enter}");
    await expect.element(heading()).toHaveTextContent("Pictures");
    expect(onOpenFolder.mock.calls).toEqual([["pictures"]]);
    const musicRow = folder("Music")
      .element()
      .querySelector("[data-slot=tree-item-content]") as HTMLElement;
    await userEvent.dblClick(musicRow);
    await expect.element(heading()).toHaveTextContent("Music");
    expect(onOpenFolder.mock.calls).toEqual([["pictures"], ["music"]]);
  });

  it("leaf folders are leaves: no aria-expanded and no group", async () => {
    await render(<FilesPage />);
    // Expand both parents (through the command palette) so their children are visible.
    for (const name of ["Invoices", "Holiday"]) {
      await openCommand();
      await type("go");
      await userEvent.keyboard("{Enter}");
      await type(name.toLowerCase());
      await userEvent.keyboard("{Enter}");
      await expect.element(heading()).toHaveTextContent(name);
    }
    for (const name of ["Music", "Invoices", "Holiday"]) {
      const item = folder(name).element();
      expect(item.hasAttribute("aria-expanded"), name).toBe(false);
      expect(item.querySelector("[role=group]"), name).toBeNull();
    }
    const parent = folder("Documents").element();
    expect(parent.getAttribute("aria-expanded")).toBe("true");
    expect(parent.querySelector(":scope > [role=group]")).not.toBeNull();
  });

  it("Ctrl+K opens Command; Go to folder…, typing and Enter navigate", async () => {
    await render(<FilesPage />);
    await openCommand();
    await userEvent.keyboard("go to");
    await expect.element(page.getByRole("option", { name: "Go to folder…" })).toBeVisible();
    await userEvent.keyboard("{Enter}");
    // The dialog stays open on the folder list, with an empty query.
    await expect.element(page.getByRole("option", { name: "Reports" })).toBeVisible();
    await expect.element(page.getByRole("combobox")).toHaveValue("");
    await type("rep");
    await expect.poll(() => page.getByRole("option").elements().length).toBe(1);
    await userEvent.keyboard("{Enter}");

    await expect.element(commandDialog()).not.toBeInTheDocument();
    await expect.element(heading()).toHaveTextContent("Reports");
    // The Tree follows: the parent expands and the folder is selected.
    await expect.element(folder("Documents")).toHaveAttribute("aria-expanded", "true");
    await expect.element(folder("Reports")).toHaveAttribute("aria-selected", "true");
    await expect.poll(rows).toEqual(["Q3 review.pdf", "Roadmap.pdf"]);
  });

  it("New folder creates and opens an empty folder; Toggle sidebar collapses the sidebar", async () => {
    await render(<FilesPage />);
    await openCommand();
    await type("new");
    await userEvent.keyboard("{Enter}");
    await expect.element(commandDialog()).not.toBeInTheDocument();
    await expect.element(heading()).toHaveTextContent("New folder");
    await expect.element(folder("New folder")).toHaveAttribute("aria-selected", "true");
    await expect.element(folder("Documents")).toHaveAttribute("aria-expanded", "true");
    await expect.element(page.getByText("This folder is empty.")).toBeVisible();

    const aside = () => document.querySelector("aside[data-slot=sidebar]");
    expect(aside()?.getAttribute("data-state")).toBe("expanded");
    await openCommand();
    await type("toggle");
    await userEvent.keyboard("{Enter}");
    await expect.element(commandDialog()).not.toBeInTheDocument();
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("collapsed");
  });

  it("the image preview Carousel moves on Next, with correct slide labels", async () => {
    await render(<FilesPage />);
    expect(document.querySelector("[aria-roledescription=carousel]")).toBeNull();
    await userEvent.click(folder("Pictures"));
    await expect.element(heading()).toHaveTextContent("Pictures");
    await expect.element(preview()).toBeVisible();
    expect(preview().element().getAttribute("aria-roledescription")).toBe("carousel");
    expect(slides().map((slide) => slide.getAttribute("aria-label"))).toEqual([
      "Aurora.png, 1 of 3",
      "Dunes.png, 2 of 3",
      "Glacier.png, 3 of 3",
    ]);
    const current = () =>
      slides()
        .filter((slide) => !slide.inert)
        .map((slide) => slide.getAttribute("aria-label"));
    expect(current()).toEqual(["Aurora.png, 1 of 3"]);

    const next = page.getByRole("button", { name: "Next image" });
    await userEvent.click(next);
    await expect.poll(current).toEqual(["Dunes.png, 2 of 3"]);
    await expect
      .element(page.getByRole("button", { name: "Show image 2" }))
      .toHaveAttribute("aria-current", "true");
    await userEvent.click(next);
    await expect.poll(current).toEqual(["Glacier.png, 3 of 3"]);
    await expect.element(next).toHaveAttribute("aria-disabled", "true");
  });

  it("typing a Modified range and submitting filters the Table and reports { start, end }", async () => {
    const onFilter = vi.fn();
    await render(<FilesPage onFilter={onFilter} />);
    expect(rows()).toHaveLength(4);
    await userEvent.click(segment("start", "month") as HTMLElement);
    // The start date completes and focus moves on into the end half.
    await type("09012026");
    await expect.poll(() => document.activeElement).toBe(segment("end", "month"));
    await type("09202026");
    await expect.poll(() => segment("end", "year")?.textContent).toBe("2026");
    await userEvent.click(page.getByRole("button", { name: "Apply" }));

    await expect.poll(() => onFilter.mock.calls.length).toBe(1);
    expect(onFilter.mock.calls[0]?.[0]).toEqual({
      modified: { start: "2026-09-01", end: "2026-09-20" },
    });
    await expect.poll(rows).toEqual(["Budget 2026.xlsx", "Notes.txt"]);
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent("2 of 4 files modified 2026-09-01 – 2026-09-20");
  });

  for (const dark of [false, true]) {
    const theme = dark ? "dark" : "light";

    it(`axe: the page with the image preview (${theme})`, async () => {
      document.documentElement.classList.toggle("dark", dark);
      await render(<FilesPage />);
      await userEvent.click(folder("Pictures"));
      await expect.element(preview()).toBeVisible();
      await userEvent.click(page.getByRole("button", { name: "Next image" }));
      await expect
        .element(page.getByRole("button", { name: "Show image 2" }))
        .toHaveAttribute("aria-current", "true");
      expect(await audit()).toEqual({ violations: [], incomplete: [] });
    });

    it(`axe: the Command dialog open (${theme})`, async () => {
      document.documentElement.classList.toggle("dark", dark);
      await render(<FilesPage />);
      await openCommand();
      expect(await auditOpenOverlay()).toEqual({ violations: [], incomplete: [] });
    });

    it(`axe: the Modified calendar open (${theme})`, async () => {
      document.documentElement.classList.toggle("dark", dark);
      await render(<FilesPage />);
      await userEvent.click(page.getByRole("button", { name: "Choose date range" }));
      const popup = page.getByRole("dialog", { name: "Choose date range" });
      await expect.element(popup).toBeVisible();
      await waitForPopupSettled(popup.element());
      // The popup covers the table; hide the page so axe can decide the rest (as the Dashboard test).
      document.querySelector("main")?.setAttribute("hidden", "");
      expect(await auditOpenOverlay()).toEqual({ violations: [], incomplete: [] });
    });
  }

  describe("mobile", () => {
    it("the Tree lives in the Drawer; opening a folder closes it", async () => {
      await page.viewport(390, 800);
      await render(<FilesPage />);
      await expect.poll(() => document.querySelector("aside[data-slot=sidebar]")).toBeNull();
      await userEvent.click(page.getByRole("button", { name: "Toggle sidebar" }));
      const drawer = page.getByRole("dialog", { name: "Sidebar" });
      await expect.element(drawer).toBeVisible();
      await waitForPopupSettled(drawer.element());
      await expect.element(tree()).toBeVisible();
      expect(await auditOpenOverlay()).toEqual({ violations: [], incomplete: [] });
      await userEvent.click(folder("Music"));
      await expect.element(drawer).not.toBeInTheDocument();
      await expect.element(heading()).toHaveTextContent("Music");
    });

    it("Enter on the folder that is already open closes the Drawer without reopening it", async () => {
      const onOpenFolder = vi.fn();
      await page.viewport(390, 800);
      await render(<FilesPage onOpenFolder={onOpenFolder} />);
      await expect.poll(() => document.querySelector("aside[data-slot=sidebar]")).toBeNull();
      await userEvent.click(page.getByRole("button", { name: "Toggle sidebar" }));
      const drawer = page.getByRole("dialog", { name: "Sidebar" });
      await expect.element(drawer).toBeVisible();
      await waitForPopupSettled(drawer.element());
      // Documents is open (and selected); focus it in the Tree and press Enter.
      await tabTo(folder("Documents").element());
      await userEvent.keyboard("{Enter}");
      await expect.element(drawer).not.toBeInTheDocument();
      await expect.element(heading()).toHaveTextContent("Documents");
      expect(onOpenFolder).not.toHaveBeenCalled();
    });

    it("Toggle sidebar from the command dialog opens the Drawer with focus inside it", async () => {
      await page.viewport(390, 800);
      await render(<FilesPage />);
      await expect.poll(() => document.querySelector("aside[data-slot=sidebar]")).toBeNull();
      await openCommand();
      await type("toggle");
      await userEvent.keyboard("{Enter}");
      await expect.element(commandDialog()).not.toBeInTheDocument();
      const drawer = page.getByRole("dialog", { name: "Sidebar" });
      await expect.element(drawer).toBeVisible();
      await waitForPopupSettled(drawer.element());
      await expect.poll(() => drawer.element().contains(document.activeElement)).toBe(true);
      // Still inside once everything has settled (the command dialog's focus return is done).
      await expect
        .poll(() => document.activeElement?.closest("[role=dialog]"))
        .toBe(drawer.element());
    });
  });
});
