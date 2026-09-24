import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, emulateReducedMotion, systemColor } from "../../../test/emulation";
import { Tabs, TabsList, type TabsListProps, TabsPanel, type TabsProps, TabsTab } from "./tabs";

function Account({
  variant,
  activateOnFocus,
  disableNotifications,
  ...rootProps
}: TabsProps & {
  variant?: TabsListProps["variant"];
  activateOnFocus?: boolean;
  disableNotifications?: boolean;
}) {
  return (
    <Tabs defaultValue="profile" {...rootProps}>
      <TabsList aria-label="Account" variant={variant} activateOnFocus={activateOnFocus}>
        <TabsTab value="profile">Profile</TabsTab>
        <TabsTab value="notifications" disabled={disableNotifications}>
          Notifications
        </TabsTab>
        <TabsTab value="billing">Billing</TabsTab>
      </TabsList>
      <TabsPanel value="profile">Profile settings</TabsPanel>
      <TabsPanel value="notifications">Notification settings</TabsPanel>
      <TabsPanel value="billing">Billing settings</TabsPanel>
    </Tabs>
  );
}

const indicatorOf = (list: Element) =>
  list.querySelector('[data-slot="tabs-indicator"]') as HTMLElement | null;

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Waits (polling, no fixed sleep) until nothing in the document is animating. */
async function animationsSettled() {
  await nextFrame();
  await expect.poll(() => document.getAnimations().length, { timeout: 2000 }).toBe(0);
}

/**
 * Resolves once the indicator is shown, has no running transitions and matches the tab along
 * `axis` (x: left + width, y: top + height) within 1px — or returns the last indicator on timeout.
 */
async function settledIndicator(list: Element, tab: Element, axis: "x" | "y" = "x") {
  const [start, size] = axis === "x" ? (["left", "width"] as const) : (["top", "height"] as const);
  const deadline = performance.now() + 2000;
  for (;;) {
    const indicator = indicatorOf(list);
    if (indicator && !indicator.hidden && indicator.getAnimations().length === 0) {
      const a = indicator.getBoundingClientRect();
      const b = tab.getBoundingClientRect();
      if (Math.abs(a[start] - b[start]) <= 1 && Math.abs(a[size] - b[size]) <= 1) return indicator;
    }
    if (performance.now() > deadline) return indicator;
    await nextFrame();
  }
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("Tabs", () => {
  it("renders a named tablist with data-slots on every part", async () => {
    const screen = await render(<Account />);
    const list = screen.getByRole("tablist", { name: "Account" });
    await expect.element(list).toHaveAttribute("data-slot", "tabs-list");
    await expect.element(list).toHaveAttribute("data-variant", "underline");
    expect(list.element().closest('[data-slot="tabs"]')).not.toBeNull();
    await expect
      .element(screen.getByRole("tab", { name: "Profile" }))
      .toHaveAttribute("data-slot", "tabs-tab");
    await expect
      .element(screen.getByRole("tabpanel", { name: "Profile" }))
      .toHaveAttribute("data-slot", "tabs-panel");
    await expect.poll(() => indicatorOf(list.element())).not.toBeNull();
  });

  it("wires aria-selected, aria-controls and the panel's aria-labelledby", async () => {
    const screen = await render(<Account />);
    const profile = screen.getByRole("tab", { name: "Profile" });
    const billing = screen.getByRole("tab", { name: "Billing" });
    await expect.element(profile).toHaveAttribute("aria-selected", "true");
    await expect.element(billing).toHaveAttribute("aria-selected", "false");
    const panel = screen.getByRole("tabpanel");
    const panelId = panel.element().id;
    expect(panelId).not.toBe("");
    await expect.element(profile).toHaveAttribute("aria-controls", panelId);
    await expect.element(panel).toHaveAttribute("aria-labelledby", profile.element().id);
    await expect.element(panel).toHaveTextContent("Profile settings");
  });

  it("activates a tab on click and reports the value", async () => {
    const onValueChange = vi.fn();
    const screen = await render(<Account onValueChange={onValueChange} />);
    await screen.getByRole("tab", { name: "Billing" }).click();
    await expect
      .element(screen.getByRole("tab", { name: "Billing" }))
      .toHaveAttribute("aria-selected", "true");
    await expect.element(screen.getByRole("tabpanel")).toHaveTextContent("Billing settings");
    expect(onValueChange).toHaveBeenCalledWith("billing", expect.anything());
  });

  it("moves focus with the arrow keys (looping) and Home/End; Enter and Space activate", async () => {
    const screen = await render(<Account />);
    const tab = (name: string) => screen.getByRole("tab", { name }).element();
    const [profile, notifications, billing] = [
      tab("Profile"),
      tab("Notifications"),
      tab("Billing"),
    ];
    await userEvent.tab();
    expect(document.activeElement).toBe(profile);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(notifications);
    // Manual activation: focus moved, selection did not.
    expect(profile.getAttribute("aria-selected")).toBe("true");
    await userEvent.keyboard("{Enter}");
    await expect.element(notifications).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(billing);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(profile);
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(billing);
    await userEvent.keyboard(" ");
    await expect.element(billing).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(profile);
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(billing);
  });

  it("activates on arrow focus with activateOnFocus", async () => {
    const screen = await render(<Account activateOnFocus />);
    const notifications = screen.getByRole("tab", { name: "Notifications" });
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(notifications.element());
    await expect.element(notifications).toHaveAttribute("aria-selected", "true");
    await expect.element(screen.getByRole("tabpanel")).toHaveTextContent("Notification settings");
  });

  /*
   * Base UI 1.8 keeps disabled tabs focusable (TabsTab `focusableWhenDisabled: true`, TabsList
   * `disabledIndices: []`), as the WAI-ARIA APG allows, so screen-reader users still discover
   * them. "Skipped" therefore means skipped for activation: focus lands on it, nothing selects it.
   */
  it("never activates a disabled tab: not by Enter, activateOnFocus or a click", async () => {
    const screen = await render(<Account disableNotifications activateOnFocus />);
    const profile = screen.getByRole("tab", { name: "Profile" });
    const notifications = screen.getByRole("tab", { name: "Notifications" });
    const billing = screen.getByRole("tab", { name: "Billing" });
    await expect.element(notifications).toHaveAttribute("data-disabled");
    await expect.element(notifications).toHaveAttribute("aria-disabled", "true");
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(notifications.element());
    await expect.element(profile).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Enter}");
    await expect.element(notifications).toHaveAttribute("aria-selected", "false");
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(billing.element());
    await expect.element(billing).toHaveAttribute("aria-selected", "true");
    await notifications.click({ force: true });
    await expect.element(notifications).toHaveAttribute("aria-selected", "false");
    expect(getComputedStyle(notifications.element()).cursor).toBe("not-allowed");
    expect(getComputedStyle(notifications.element()).opacity).toBe("0.5");
  });

  it("works vertically with ArrowDown and ArrowUp", async () => {
    const screen = await render(<Account orientation="vertical" />);
    const list = screen.getByRole("tablist");
    await expect.element(list).toHaveAttribute("aria-orientation", "vertical");
    const profile = screen.getByRole("tab", { name: "Profile" }).element();
    const notifications = screen.getByRole("tab", { name: "Notifications" }).element();
    // Stacked: the second tab sits below the first.
    expect(notifications.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      profile.getBoundingClientRect().bottom - 1,
    );
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(notifications);
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(profile);
    const style = getComputedStyle(list.element());
    expect(style.flexDirection).toBe("column");
    expect(style.borderLeftWidth).toBe("1px");
    expect(style.borderBottomWidth).toBe("0px");
  });

  describe("underline indicator", () => {
    it("matches the active tab's left and width, and follows a new selection", async () => {
      const screen = await render(
        <div>
          <Account />
          <div data-testid="primary" className="bg-primary" />
        </div>,
      );
      const list = screen.getByRole("tablist").element();
      const profile = screen.getByRole("tab", { name: "Profile" }).element();
      let indicator = await settledIndicator(list, profile);
      expect(indicator).not.toBeNull();
      let a = (indicator as HTMLElement).getBoundingClientRect();
      let b = profile.getBoundingClientRect();
      expect(Math.abs(a.left - b.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
      expect(a.height).toBe(2);
      // It sits on the list's bottom edge, just above the 1px border.
      expect(Math.abs(a.bottom - (list.getBoundingClientRect().bottom - 1))).toBeLessThanOrEqual(1);
      expect(getComputedStyle(indicator as HTMLElement).backgroundColor).toBe(
        getComputedStyle(screen.getByTestId("primary").element()).backgroundColor,
      );

      const billing = screen.getByRole("tab", { name: "Billing" });
      await billing.click();
      indicator = await settledIndicator(list, billing.element());
      a = (indicator as HTMLElement).getBoundingClientRect();
      b = billing.element().getBoundingClientRect();
      expect(Math.abs(a.left - b.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
      expect(getComputedStyle(indicator as HTMLElement).transitionProperty).toBe("left, width");
    });

    it("runs down the left edge in vertical orientation", async () => {
      const screen = await render(<Account orientation="vertical" />);
      const list = screen.getByRole("tablist").element();
      const billing = screen.getByRole("tab", { name: "Billing" });
      await billing.click();
      const tab = billing.element();
      const indicator = await settledIndicator(list, tab, "y");
      expect(indicator).not.toBeNull();
      const a = (indicator as HTMLElement).getBoundingClientRect();
      const b = tab.getBoundingClientRect();
      expect(Math.abs(a.top - b.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
      expect(a.width).toBe(2);
      // Just inside the 1px left border.
      expect(Math.abs(a.left - (list.getBoundingClientRect().left + 1))).toBeLessThanOrEqual(1);
      expect(getComputedStyle(indicator as HTMLElement).transitionProperty).toBe("top, height");
    });

    /*
     * Real media emulation through the Chrome DevTools Protocol (vitest/browser `cdp()`, Chromium
     * + Playwright provider): `prefers-reduced-motion: reduce` actually matches, so this checks the
     * cascade (specificity of the vertical variant vs motion-reduce), not just the class list.
     */
    describe("under prefers-reduced-motion: reduce", () => {
      afterEach(async () => {
        await emulateReducedMotion(false);
      });

      it.each(["horizontal", "vertical"] as const)(
        "has no %s indicator transition",
        async (orientation) => {
          await emulateReducedMotion(true);
          expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
          const screen = await render(<Account orientation={orientation} />);
          const list = screen.getByRole("tablist").element();
          await expect.poll(() => indicatorOf(list)).not.toBeNull();
          expect(getComputedStyle(indicatorOf(list) as HTMLElement).transitionProperty).toBe(
            "none",
          );
        },
      );
    });
  });

  it("colours the active underline tab foreground and the others muted", async () => {
    const screen = await render(
      <div>
        <Account />
        <div data-testid="fg" className="text-foreground" />
        <div data-testid="muted" className="text-muted-foreground" />
      </div>,
    );
    const color = (el: Element) => getComputedStyle(el).color;
    const fg = color(screen.getByTestId("fg").element());
    const muted = color(screen.getByTestId("muted").element());
    await expect.poll(() => color(screen.getByRole("tab", { name: "Profile" }).element())).toBe(fg);
    await expect
      .poll(() => color(screen.getByRole("tab", { name: "Billing" }).element()))
      .toBe(muted);
  });

  it("styles the segmented variant: muted track, raised active tab, no indicator", async () => {
    const screen = await render(
      <div>
        <Account variant="segmented" />
        <div data-testid="muted" className="bg-muted" />
        <div data-testid="background" className="bg-background text-foreground shadow-xs" />
      </div>,
    );
    const list = screen.getByRole("tablist");
    await expect.element(list).toHaveAttribute("data-variant", "segmented");
    await animationsSettled();
    const ref = getComputedStyle(screen.getByTestId("background").element());
    expect(getComputedStyle(list.element()).backgroundColor).toBe(
      getComputedStyle(screen.getByTestId("muted").element()).backgroundColor,
    );
    const active = getComputedStyle(screen.getByRole("tab", { name: "Profile" }).element());
    expect(active.backgroundColor).toBe(ref.backgroundColor);
    expect(active.color).toBe(ref.color);
    expect(active.boxShadow).toBe(ref.boxShadow);
    const idle = getComputedStyle(screen.getByRole("tab", { name: "Billing" }).element());
    expect(idle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(indicatorOf(list.element())).toBeNull();
  });

  it("shows a pointer cursor on tabs", async () => {
    const screen = await render(<Account variant="segmented" />);
    expect(getComputedStyle(screen.getByRole("tab", { name: "Billing" }).element()).cursor).toBe(
      "pointer",
    );
  });

  it.each(["underline", "segmented"] as const)(
    "shows a solid 2px outline on Tab focus of a %s tab and of the panel, none before",
    async (variant) => {
      const screen = await render(<Account variant={variant} />);
      const profile = screen.getByRole("tab", { name: "Profile" }).element();
      const panel = screen.getByRole("tabpanel").element();
      expect(getComputedStyle(profile).outlineStyle).toBe("none");
      await userEvent.tab();
      expect(document.activeElement).toBe(profile);
      let style = getComputedStyle(profile);
      expect(style.outlineStyle).toBe("solid");
      expect(style.outlineWidth).toBe("2px");
      expect(getComputedStyle(panel).outlineStyle).toBe("none");
      await userEvent.tab();
      expect(document.activeElement).toBe(panel);
      style = getComputedStyle(panel);
      expect(style.outlineStyle).toBe("solid");
      expect(style.outlineWidth).toBe("2px");
    },
  );

  /*
   * Forced colors (Windows High Contrast) replaces author backgrounds with Canvas, so the underline
   * indicator and the raised segmented tab would vanish. Emulated for real via CDP.
   */
  describe("in forced colors", () => {
    afterEach(async () => {
      await emulateForcedColors(false);
    });

    it.each(["horizontal", "vertical"] as const)(
      "paints the %s underline indicator in Highlight",
      async (orientation) => {
        await emulateForcedColors(true);
        expect(matchMedia("(forced-colors: active)").matches).toBe(true);
        const screen = await render(<Account orientation={orientation} />);
        const list = screen.getByRole("tablist").element();
        await expect.poll(() => indicatorOf(list)).not.toBeNull();
        const bg = getComputedStyle(indicatorOf(list) as HTMLElement).backgroundColor;
        expect(bg).toBe(systemColor("Highlight"));
        expect(bg).not.toBe(systemColor("Canvas"));
      },
    );

    it("marks the active segmented tab with Highlight and keeps the focus ring", async () => {
      await emulateForcedColors(true);
      const screen = await render(<Account variant="segmented" />);
      const profile = screen.getByRole("tab", { name: "Profile" }).element();
      const billing = screen.getByRole("tab", { name: "Billing" }).element();
      const highlight = systemColor("Highlight");
      let active = getComputedStyle(profile);
      expect(active.backgroundColor).toBe(highlight);
      expect(active.backgroundColor).not.toBe(systemColor("Canvas"));
      expect(active.color).toBe(systemColor("HighlightText"));
      expect(getComputedStyle(billing).backgroundColor).not.toBe(highlight);
      // No outline until focused, then the focus ring shows 2px outside the Highlight fill.
      expect(active.outlineStyle).toBe("none");
      await userEvent.tab();
      expect(document.activeElement).toBe(profile);
      active = getComputedStyle(profile);
      expect(active.outlineStyle).toBe("solid");
      expect(active.outlineWidth).toBe("2px");
      expect(active.outlineOffset).toBe("2px");
      // Moving selection moves the Highlight.
      await userEvent.keyboard("{ArrowRight}{ArrowRight}{Enter}");
      await expect.poll(() => getComputedStyle(billing).backgroundColor).toBe(highlight);
      expect(getComputedStyle(profile).backgroundColor).not.toBe(highlight);
    });
  });

  it("merges className strings and accepts className state functions", async () => {
    const screen = await render(
      <Tabs defaultValue="a" className="max-w-md">
        <TabsList aria-label="Merge" className="gap-8">
          <TabsTab value="a" className={(s) => (s.active ? "is-on" : "is-off")}>
            A
          </TabsTab>
          <TabsTab value="b" className="px-2">
            B
          </TabsTab>
        </TabsList>
        <TabsPanel value="a" className="pt-6">
          Panel A
        </TabsPanel>
      </Tabs>,
    );
    const list = screen.getByRole("tablist");
    await expect.element(list).toHaveClass("gap-8");
    await expect.element(list).not.toHaveClass("gap-4");
    expect(list.element().closest('[data-slot="tabs"]')?.classList.contains("max-w-md")).toBe(true);
    await expect.element(screen.getByRole("tab", { name: "A" })).toHaveClass("is-on");
    const b = screen.getByRole("tab", { name: "B" });
    await expect.element(b).toHaveClass("px-2");
    await expect.element(b).not.toHaveClass("px-1");
    const panel = screen.getByRole("tabpanel");
    await expect.element(panel).toHaveClass("pt-6");
    await expect.element(panel).not.toHaveClass("pt-4");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    try {
      const screen = await render(
        <div className="flex flex-col gap-8 bg-background p-4 text-foreground">
          <Account />
          <Account variant="segmented" disableNotifications />
          <Account orientation="vertical" />
        </div>,
      );
      await animationsSettled();
      const results = await axe.run(screen.container);
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });
});
