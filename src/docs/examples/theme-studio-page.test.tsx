import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { restorePlatform, stubMac, stubWindows } from "../../../test/platform";
import type { Theme } from "./theme-studio-data";
import { ThemeStudioPage } from "./theme-studio-page";

const el = (locator: { element(): Element }) => locator.element() as HTMLElement;

async function tabTo(element: Element, max = 80) {
  for (let i = 0; i < max && document.activeElement !== element; i++)
    await userEvent.keyboard("{Tab}");
  expect(document.activeElement).toBe(element);
}

const handle = () => page.getByRole("separator", { name: "Resize controls" });
const badge = () => document.querySelector<HTMLElement>("[data-contrast]");
const step = (name: string) => page.getByRole("button", { name: new RegExp(`^${name}`) });
const stepItem = (name: string) => el(step(name)).closest("li") as HTMLElement;
const nextButton = () => page.getByRole("button", { name: "Next", exact: true });
const saveButton = () => page.getByRole("button", { name: "Save", exact: true });
const codeSwitch = () => page.getByRole("switch", { name: "Show code" });
const surfaceTrigger = () => page.getByRole("button", { name: /Choose color/ });
const popup = () => document.querySelector<HTMLElement>("[data-slot=color-picker-popover]");
const panels = () => [...document.querySelectorAll<HTMLElement>("[data-slot=resizable-panel]")];
const status = () => page.getByRole("status");
const preview = () => page.getByRole("region", { name: "Preview" });
const previewSolid = () =>
  el(preview()).querySelector<HTMLElement>("[data-slot=button][data-variant=solid]");

/** The inline primary picker's text field (the popup's has the same name). */
const primaryInput = () =>
  document.querySelector<HTMLInputElement>(
    "[data-slot=theme-studio-controls] [data-slot=color-picker] [data-slot=color-input]",
  ) as HTMLInputElement;

/** Replaces a field's text by keyboard and presses Enter. */
async function retype(input: HTMLElement, text: string) {
  await tabTo(input);
  await userEvent.keyboard("{Control>}a{/Control}");
  await userEvent.keyboard(`${text}{Enter}`);
}

/** Records `defaultPrevented` of each keydown after the page's own listeners ran. */
function recordKeydowns() {
  const seen: { key: string; prevented: boolean }[] = [];
  const listener = (event: KeyboardEvent) =>
    seen.push({ key: event.key.toLowerCase(), prevented: event.defaultPrevented });
  window.addEventListener("keydown", listener);
  return { seen, stop: () => window.removeEventListener("keydown", listener) };
}

async function openSurface() {
  await tabTo(el(surfaceTrigger()));
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => popup()).not.toBeNull();
  await waitForPopupSettled(popup() as HTMLElement);
}

async function setSurface(hex: string) {
  await openSurface();
  const input = (popup() as HTMLElement).querySelector<HTMLElement>("[data-slot=color-input]");
  await retype(input as HTMLElement, hex);
}

async function goToReview() {
  await tabTo(el(nextButton()));
  await userEvent.keyboard("{Enter}");
  await expect.element(step("Shape")).toHaveAttribute("aria-current", "step");
  await tabTo(el(nextButton()));
  await userEvent.keyboard("{Enter}");
  await expect.element(step("Review")).toHaveAttribute("aria-current", "step");
}

beforeEach(async () => {
  await page.viewport(1280, 800);
  // Off Apple, whatever the host: the tests press Ctrl and read "Ctrl" hints.
  stubWindows();
});

afterEach(() => {
  document.documentElement.classList.remove("dark");
  restorePlatform();
});

afterAll(async () => {
  await page.viewport(414, 896);
});

describe("ThemeStudioPage example", () => {
  it("resizes the controls panel from its handle: → grows it, Enter collapses and restores", async () => {
    await render(<ThemeStudioPage />);
    await tabTo(el(handle()));
    await expect.element(handle()).toHaveAttribute("aria-valuenow", "30");
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(handle()).toHaveAttribute("aria-valuenow", "40");
    await userEvent.keyboard("{Enter}");
    await expect.element(handle()).toHaveAttribute("aria-valuenow", "0");
    expect(panels()[0]?.hasAttribute("data-collapsed")).toBe(true);
    await userEvent.keyboard("{Enter}");
    await expect.element(handle()).toHaveAttribute("aria-valuenow", "40");
  });

  it("gates Colors on the primary-on-surface contrast and moves on once it passes", async () => {
    await render(<ThemeStudioPage />);
    expect(badge()?.textContent).toBe("Primary on surface 6.3:1 AA");
    await retype(primaryInput(), "#1d4ed8");
    await expect.poll(() => badge()?.textContent).toBe("Primary on surface 6.7:1 AA");
    await expect
      .poll(() => getComputedStyle(previewSolid() as HTMLElement).backgroundColor)
      .toBe("rgb(29, 78, 216)");

    await retype(primaryInput(), "#ffff66");
    await expect.poll(() => badge()?.textContent).toBe("Primary on surface 1.1:1 Fails AA");
    await tabTo(el(nextButton()));
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => stepItem("Colors").getAttribute("data-state")).toBe("error");
    await expect
      .element(page.getByText("The primary colour needs 4.5:1 against the surface"))
      .toBeVisible();
    await expect.element(step("Colors")).toHaveAttribute("aria-current", "step");
    await expect.element(step("Colors")).toHaveAccessibleName("Colors Error");

    await retype(primaryInput(), "#1d4ed8");
    await expect.poll(() => stepItem("Colors").getAttribute("data-state")).not.toBe("error");
    expect(
      page.getByText("The primary colour needs 4.5:1 against the surface").elements(),
    ).toHaveLength(0);
    await tabTo(el(nextButton()));
    await userEvent.keyboard("{Enter}");
    await expect.element(step("Shape")).toHaveAttribute("aria-current", "step");
    expect(el(step("Colors")).hasAttribute("aria-current")).toBe(false);
    expect(stepItem("Colors").getAttribute("data-state")).toBe("complete");
  });

  it("sets the surface from the popover; Escape closes it back to the trigger; its popup keeps the page theme", async () => {
    await render(<ThemeStudioPage />);
    await retype(primaryInput(), "#1d4ed8");
    await setSurface("#0f172a");
    await expect.poll(() => badge()?.textContent).toBe("Primary on surface 2.7:1 Fails AA");
    // The popup is portalled out of the preview, so the preview's tokens do not reach it.
    const style = getComputedStyle(popup() as HTMLElement);
    expect(style.getPropertyValue("--background").trim()).not.toBe("#0f172a");
    expect(style.getPropertyValue("--primary").trim()).not.toBe("#1d4ed8");
    expect(getComputedStyle(el(preview())).getPropertyValue("--background").trim()).toBe("#0f172a");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => popup()).toBeNull();
    expect(document.activeElement).toBe(el(surfaceTrigger()));

    await setSurface("#ffffff");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => popup()).toBeNull();
    await expect.poll(() => badge()?.textContent).toBe("Primary on surface 6.7:1 AA");
    await expect.element(surfaceTrigger()).toHaveAccessibleName(/Choose color: #ffffff$/);
  });

  it("keeps Shape and Review reachable after going Back to Colors (the completed set)", async () => {
    await render(<ThemeStudioPage />);
    expect(el(step("Shape")).getAttribute("aria-disabled")).toBe("true");
    await goToReview();
    await tabTo(el(step("Colors")));
    await userEvent.keyboard("{Enter}");
    await expect.element(step("Colors")).toHaveAttribute("aria-current", "step");
    expect(el(step("Shape")).getAttribute("aria-disabled")).not.toBe("true");
    expect(el(step("Review")).getAttribute("aria-disabled")).not.toBe("true");
    await tabTo(el(step("Review")));
    await userEvent.keyboard("{Enter}");
    await expect.element(step("Review")).toHaveAttribute("aria-current", "step");
  });

  it("Review: → rates, Ctrl+S saves anywhere (also in the name field) until the next change", async () => {
    const onSave = vi.fn<(theme: Theme) => void>();
    await render(<ThemeStudioPage onSave={onSave} />);
    await expect.element(saveButton()).toHaveAttribute("aria-keyshortcuts", "Control+S");
    const hint = el(saveButton()).querySelector<HTMLElement>("[data-slot=kbd-shortcut]");
    expect(hint?.getAttribute("aria-hidden")).toBe("true");
    const keys = [...(hint?.querySelectorAll(":scope > kbd") ?? [])];
    expect(keys).toHaveLength(2);
    expect(keys[0]?.textContent).toBe("Ctrl");
    expect(keys[1]?.textContent).toBe("S");

    await goToReview();
    const first = page.getByRole("radio", { name: "1 star" });
    await tabTo(el(first));
    await userEvent.keyboard(" ");
    await expect.element(first).toBeChecked();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(page.getByRole("radio", { name: "2 stars" })).toBeChecked();

    const keydowns = recordKeydowns();
    try {
      await userEvent.keyboard("{Control>}s{/Control}");
      await expect.poll(() => onSave.mock.calls.length).toBe(1);
      expect(onSave).toHaveBeenLastCalledWith({
        name: "My theme",
        primary: "#4f46e5",
        surface: "#ffffff",
        radius: 6,
        density: "comfortable",
        rating: 2,
      });
      expect(keydowns.seen.filter((event) => event.key === "s")).toEqual([
        { key: "s", prevented: true },
      ]);
      await expect.element(status()).toHaveTextContent("Theme saved");

      // While typing: the shortcut is an app command, so the name field does not swallow it.
      const name = page.getByRole("textbox", { name: "Theme name" });
      await tabTo(el(name));
      await userEvent.keyboard("{End}!");
      await expect.element(status()).toHaveTextContent("");
      await userEvent.keyboard("{Control>}s{/Control}");
      await expect.poll(() => onSave.mock.calls.length).toBe(2);
      expect(onSave.mock.lastCall?.[0].name).toBe("My theme!");
      await expect.element(status()).toHaveTextContent("Theme saved");
      expect(keydowns.seen.filter((event) => event.key === "s").at(-1)?.prevented).toBe(true);

      // The next change to the theme clears the status.
      await userEvent.keyboard("?");
      await expect.element(status()).toHaveTextContent("");
    } finally {
      keydowns.stop();
    }
  });

  it("ignores a repeated Ctrl+S keydown", async () => {
    const onSave = vi.fn();
    await render(<ThemeStudioPage onSave={onSave} />);
    const event = new KeyboardEvent("keydown", {
      key: "s",
      code: "KeyS",
      ctrlKey: true,
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("under a macOS stub ⌘+S saves and the Save hint shows ⌘", async () => {
    stubMac();
    const onSave = vi.fn();
    await render(<ThemeStudioPage onSave={onSave} />);
    await expect.element(saveButton()).toHaveAttribute("aria-keyshortcuts", "Meta+S");
    await expect.element(codeSwitch()).toHaveAttribute("aria-keyshortcuts", "Meta+J");
    expect(el(saveButton()).querySelector("[data-slot=kbd-glyph]")?.textContent).toBe("⌘");
    await userEvent.click(page.getByRole("heading", { name: "Theme Studio" }));
    await userEvent.keyboard("{Meta>}s{/Meta}");
    await expect.poll(() => onSave.mock.calls.length).toBe(1);
    await expect.element(status()).toHaveTextContent("Theme saved");
  });

  it("Ctrl+J (also from an input) mounts and removes the code panel", async () => {
    await render(<ThemeStudioPage />);
    await expect.element(codeSwitch()).toHaveAttribute("aria-keyshortcuts", "Control+J");
    const hint = el(codeSwitch())
      .closest("label")
      ?.querySelector<HTMLElement>("[data-slot=kbd-shortcut]");
    expect(hint?.getAttribute("aria-hidden")).toBe("true");
    expect(panels()).toHaveLength(2);

    const keydowns = recordKeydowns();
    try {
      await tabTo(primaryInput());
      await userEvent.keyboard("{Control>}j{/Control}");
      await expect.poll(() => panels().length).toBe(3);
      await expect.element(codeSwitch()).toBeChecked();
      await expect.element(page.getByRole("heading", { name: "Code" })).toBeVisible();
      expect(document.querySelector("pre")?.textContent).toContain("--primary: #4f46e5;");
      const total = panels().reduce((sum, panel) => sum + Number(panel.style.flexGrow), 0);
      expect(total).toBeCloseTo(100, 1);

      await userEvent.keyboard("{Control>}j{/Control}");
      await expect.poll(() => panels().length).toBe(2);
      await expect.element(codeSwitch()).not.toBeChecked();
      expect(keydowns.seen.filter((event) => event.key === "j")).toEqual([
        { key: "j", prevented: true },
        { key: "j", prevented: true },
      ]);
    } finally {
      keydowns.stop();
    }
  });

  it("stacks the panels at 390px (a vertical group)", async () => {
    await page.viewport(390, 800);
    await render(<ThemeStudioPage />);
    const group = document.querySelector<HTMLElement>("[data-slot=resizable-panel-group]");
    await expect.poll(() => group?.getAttribute("data-orientation")).toBe("vertical");
    const [controls, previewPanel] = panels().map((panel) => panel.getBoundingClientRect());
    expect(controls && previewPanel && controls.bottom <= previewPanel.top + 1).toBe(true);
    expect(Math.abs((controls?.left ?? 0) - (previewPanel?.left ?? 1))).toBeLessThan(1);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  });

  describe.each(["light", "dark"] as const)("axe (%s)", (theme) => {
    const setup = async () => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="bg-background p-4 text-foreground">
          <ThemeStudioPage />
        </div>,
      );
    };

    it("has no violations, with and without the code panel", async () => {
      await setup();
      await expect.poll(() => document.getAnimations().length).toBe(0);
      const closed = await auditOpenOverlay();
      expect(closed.violations).toEqual([]);
      expect(closed.incomplete).toEqual([]);
      await userEvent.click(codeSwitch());
      await expect.poll(() => panels().length).toBe(3);
      await expect.poll(() => document.getAnimations().length).toBe(0);
      const withCode = await auditOpenOverlay();
      expect(withCode.violations).toEqual([]);
      expect(withCode.incomplete).toEqual([]);
    });

    it("has no violations with the surface popover open", async () => {
      await setup();
      await openSurface();
      await expect.poll(() => document.getAnimations().length).toBe(0);
      // The popup covers part of the controls, and axe cannot decide the contrast of text next to
      // or under it (`bgOverlap`). The page is audited closed above; hide the panels here.
      const frame = el(page.getByRole("region", { name: "Preview" })).closest(
        "[data-slot=resizable-panel-group]",
      ) as HTMLElement;
      frame.style.visibility = "hidden";
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    });
  });
});
