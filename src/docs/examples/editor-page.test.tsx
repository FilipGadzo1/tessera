import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { EditorPage } from "./editor-page";

// "Today" is frozen to the picture the whole example is built around: only `Date` is faked, so
// React's scheduler and userEvent keep their real timers (see calendar.test.tsx).
const TODAY = new Date(2026, 8, 25, 12); // Friday, September 25, 2026

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.classList.remove("dark");
});

const dialog = () => page.getByRole("dialog");
const previewCard = () =>
  document.querySelector('[data-slot="preview-card-content"]') as HTMLElement | null;
const contextMenu = () => page.getByRole("menu");
const bodyTrigger = () =>
  document.querySelector('[data-slot="context-menu-trigger"]') as HTMLElement;

async function tabTo(element: Element) {
  for (let i = 0; i < 40 && document.activeElement !== element; i++)
    await userEvent.keyboard("{Tab}");
  expect(document.activeElement).toBe(element);
}

function rightClick(target: Element) {
  const rect = target.getBoundingClientRect();
  target.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 10,
      clientY: rect.top + 10,
    }),
  );
}

describe("EditorPage example", () => {
  it("renders the card, toolbar, body, byline and meter", async () => {
    await render(<EditorPage />);
    await expect.element(page.getByText("New post", { exact: true })).toBeVisible();
    await expect.element(page.getByRole("toolbar", { name: "Text formatting" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "@filip" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Publish on" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Embargo" })).toBeVisible();
    await expect.element(page.getByText("Characters")).toBeVisible();
    await expect.element(page.getByText("1,240 / 2,000")).toBeVisible();
  });

  it("toggles Bold with Space, arrows to alignment and picks Center, then opens Insert", async () => {
    await render(<EditorPage />);
    const bold = page.getByRole("button", { name: "Bold" });
    const center = page.getByRole("button", { name: "Align center" });
    const insert = page.getByRole("button", { name: "Insert" });

    await tabTo(bold.element());
    await expect.element(bold).toHaveAttribute("aria-pressed", "true");
    await userEvent.keyboard(" ");
    await expect.element(bold).toHaveAttribute("aria-pressed", "false");

    // Bold -> Italic -> Underline -> Align left -> Align center: crosses out of the formatting
    // ToggleGroup into the alignment one, same as the Toolbar component test.
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(document.activeElement).toBe(center.element());
    await userEvent.keyboard(" ");
    await expect.element(center).toHaveAttribute("aria-pressed", "true");
    await expect
      .element(page.getByRole("button", { name: "Align left" }))
      .toHaveAttribute("aria-pressed", "false");

    await userEvent.keyboard("{ArrowRight}{ArrowRight}{Enter}");
    await expect.element(page.getByRole("menuitem", { name: "Image" })).toBeVisible();
    expect(document.activeElement).not.toBe(insert.element());
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the body's context menu with a pointer contextmenu and picks Format → Bold", async () => {
    await render(<EditorPage />);
    const bold = page.getByRole("button", { name: "Bold" });
    await expect.element(bold).toHaveAttribute("aria-pressed", "true");

    rightClick(bodyTrigger());
    await expect.element(contextMenu()).toBeVisible();
    const popup = contextMenu().element() as HTMLElement;
    await waitForPopupSettled(popup);
    await userEvent.click(page.getByRole("menuitem", { name: "Format" }));
    const boldItem = page.getByRole("menuitemcheckbox", { name: "Bold" });
    await expect.element(boldItem).toHaveAttribute("aria-checked", "true");
    await userEvent.click(boldItem);
    await expect.element(boldItem).toHaveAttribute("aria-checked", "false");
    // Closing the menu (which had inerted the rest of the page) exposes the toolbar again: the
    // submenu pick is the same state the toolbar toggle reads. Escape closes the submenu first,
    // then the root context menu.
    await userEvent.keyboard("{Escape}{Escape}");
    await expect.element(contextMenu()).not.toBeInTheDocument();
    await expect.element(bold).toHaveAttribute("aria-pressed", "false");
  });

  it("opens the author PreviewCard on hover and on focus", async () => {
    await render(<EditorPage />);
    const trigger = page.getByRole("link", { name: "@filip" });
    expect(previewCard()).toBeNull();

    await userEvent.hover(trigger);
    await expect.poll(() => previewCard()).not.toBeNull();
    expect(previewCard()?.textContent).toContain("Builds Tessera");
    await userEvent.unhover(trigger);
    await expect.poll(() => previewCard()).toBeNull();

    await tabTo(trigger.element());
    await expect.poll(() => previewCard()).not.toBeNull();
  });

  it("picks a Publish date with the keyboard: open, arrow, Enter sets the trigger text", async () => {
    await render(<EditorPage />);
    // Captured once while the accessible name is still just "Publish on" — the trigger's own
    // name grows to include the value once one is picked (Field label + value, like DatePicker).
    const publishEl = page.getByRole("button", { name: "Publish on" }).element() as HTMLElement;
    await tabTo(publishEl);
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).toBeVisible();
    await userEvent.keyboard("{ArrowRight}{Enter}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(publishEl);
    expect(publishEl.textContent).toBe("Sep 26, 2026");
  });

  it("picks an embargo range: the first click sets the start and keeps it open, the second closes it", async () => {
    await render(<EditorPage />);
    const embargoEl = page.getByRole("button", { name: "Embargo" }).element() as HTMLElement;
    await userEvent.click(embargoEl);
    await expect.element(dialog()).toHaveAccessibleName("Choose date range");
    const start = page.getByRole("button", {
      name: new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(new Date(2026, 8, 28)),
      exact: true,
    });
    const end = page.getByRole("button", {
      name: new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(new Date(2026, 9, 3)),
      exact: true,
    });
    await userEvent.click(start);
    await expect.element(dialog()).toBeVisible();
    await userEvent.click(end);
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(embargoEl.textContent).toBe(
      new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).formatRange(
        new Date(2026, 8, 28),
        new Date(2026, 9, 3),
      ),
    );
  });

  it("shows the Meter's formatted value text and an aria-valuetext for screen readers", async () => {
    await render(<EditorPage />);
    await expect.element(page.getByText("Characters", { exact: true })).toBeVisible();
    const meter = document.querySelector('[role="meter"]') as HTMLElement;
    expect(meter.getAttribute("aria-valuenow")).toBe("1240");
    expect(meter.getAttribute("aria-valuemax")).toBe("2000");
    expect(meter.getAttribute("aria-valuetext")).toBe("1,240 of 2,000 characters");
    const value = meter.querySelector('[data-slot="meter-value"]') as HTMLElement;
    expect(value.textContent).toBe("1,240 / 2,000");
  });

  it("keeps exactly one alignment pressed: clicking the pressed item does not deselect it", async () => {
    await render(<EditorPage />);
    const left = page.getByRole("button", { name: "Align left" });
    await expect.element(left).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(left);
    await expect.element(left).toHaveAttribute("aria-pressed", "true");
  });

  describe.each(["light", "dark"] as const)("axe (%s)", (theme) => {
    it("has no violations closed", async () => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="bg-background p-4">
          <EditorPage />
        </div>,
      );
      await expect.poll(() => document.getAnimations().length).toBe(0);
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    });

    it("has no violations with the context menu open", async () => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="bg-background p-4">
          <EditorPage />
        </div>,
      );
      rightClick(bodyTrigger());
      await expect.element(contextMenu()).toBeVisible();
      await waitForPopupSettled(contextMenu().element() as HTMLElement);
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    });
  });
});
