import { type ReactNode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateReducedMotion } from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { DateField } from "../date-field";
import { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from ".";
import * as stories from "./sidebar.stories";
import {
  aside,
  homeLink,
  inner,
  pressShortcut,
  rail,
  Shell,
  type ShellProps,
  setupSidebarTests,
  trigger,
} from "./sidebar.test-fixtures";

setupSidebarTests();

describe("SidebarProvider", () => {
  it("renders the wrapper with the width variables and an aside landmark named Sidebar", async () => {
    await render(<Shell />);
    const wrapper = document.querySelector<HTMLElement>("[data-slot=sidebar-wrapper]");
    expect(wrapper).not.toBeNull();
    const style = getComputedStyle(wrapper as HTMLElement);
    expect(style.getPropertyValue("--sidebar-width").trim()).toBe("16rem");
    expect(style.getPropertyValue("--sidebar-width-icon").trim()).toBe("3rem");
    expect(style.display).toBe("flex");
    await expect.element(page.getByRole("complementary", { name: "Sidebar" })).toBeVisible();
    await expect.element(page.getByRole("main")).toBeVisible();
    expect(aside()?.getAttribute("data-state")).toBe("expanded");
    expect(aside()?.getBoundingClientRect().width).toBe(256);
  });

  it("is uncontrolled by default: the trigger collapses and expands, with aria-expanded and aria-controls", async () => {
    await render(<Shell />);
    const button = trigger().element();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe(aside()?.id);
    expect(aside()?.id).toBeTruthy();
    await userEvent.click(trigger());
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("collapsed");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(trigger());
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("expanded");
  });

  it("starts collapsed with defaultOpen={false}", async () => {
    await render(<Shell provider={{ defaultOpen: false }} />);
    expect(aside()?.getAttribute("data-state")).toBe("collapsed");
    expect(trigger().element().getAttribute("aria-expanded")).toBe("false");
  });

  it("is controlled with open / onOpenChange", async () => {
    const onOpenChange = vi.fn();
    const fixed = await render(<Shell provider={{ open: true, onOpenChange }} />);
    await userEvent.click(trigger());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // The parent did not update `open`: it stays expanded.
    expect(aside()?.getAttribute("data-state")).toBe("expanded");
    await fixed.unmount();

    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <output data-testid="state">{String(open)}</output>
          <Shell provider={{ open, onOpenChange: setOpen }} />
        </>
      );
    }
    const screen = await render(<Controlled />);
    const asides = () => screen.container.querySelector<HTMLElement>("aside[data-slot=sidebar]");
    expect(asides()?.getAttribute("data-state")).toBe("collapsed");
    await userEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    await expect.element(screen.getByTestId("state")).toHaveTextContent("true");
    expect(asides()?.getAttribute("data-state")).toBe("expanded");
  });

  it("useSidebar returns the state and actions, and throws outside a provider", async () => {
    let api: ReturnType<typeof useSidebar> | undefined;
    function Probe() {
      api = useSidebar();
      return null;
    }
    await render(
      <SidebarProvider>
        <Probe />
      </SidebarProvider>,
    );
    expect(api).toMatchObject({
      state: "expanded",
      open: true,
      openMobile: false,
      isMobile: false,
    });
    expect(Object.keys(api ?? {}).sort()).toEqual([
      "isMobile",
      "open",
      "openMobile",
      "setOpen",
      "setOpenMobile",
      "state",
      "toggleSidebar",
    ]);

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(render(<Probe />)).rejects.toThrow(/SidebarProvider/);
    error.mockRestore();
  });
});

describe("keyboard shortcut", () => {
  it.each(["Control", "Meta"] as const)("%s+B toggles the sidebar", async (modifier) => {
    await render(<Shell />);
    await pressShortcut(modifier);
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("collapsed");
    await pressShortcut(modifier);
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("expanded");
  });

  it("is ignored while typing in an input, a textarea or a contenteditable DateField segment", async () => {
    await render(
      <Shell
        inset={
          <>
            <input aria-label="Search" />
            <textarea aria-label="Notes" />
            <div contentEditable suppressContentEditableWarning data-testid="editor">
              text
            </div>
            <DateField aria-label="Due date" locale="en-US" />
          </>
        }
      />,
    );
    const targets = [
      page.getByRole("textbox", { name: "Search" }),
      page.getByRole("textbox", { name: "Notes" }),
      page.getByTestId("editor"),
      page.getByRole("spinbutton", { name: /month/i }),
    ];
    for (const target of targets) {
      await userEvent.click(target);
      await pressShortcut("Control");
      expect(aside()?.getAttribute("data-state")).toBe("expanded");
    }
    // Sanity: from a non-editable element it still toggles.
    await userEvent.click(page.getByRole("button", { name: "Inset action" }));
    await pressShortcut("Control");
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("collapsed");
  });

  it("is off with shortcut={false}", async () => {
    await render(<Shell provider={{ shortcut: false }} />);
    await userEvent.click(page.getByRole("button", { name: "Inset action" }));
    await pressShortcut("Control");
    await pressShortcut("Meta");
    expect(aside()?.getAttribute("data-state")).toBe("expanded");
  });
});

describe("collapsible icon", () => {
  it("shrinks the content to --sidebar-width-icon, hides labels and keeps accessible names", async () => {
    await render(<Shell provider={{ defaultOpen: false }} sidebar={{ collapsible: "icon" }} />);
    expect(aside()?.getAttribute("data-collapsible")).toBe("icon");
    await expect.poll(() => inner()?.clientWidth).toBe(48);
    // Group labels, badges, actions and sub lists are display:none in icon mode.
    for (const slot of [
      "sidebar-group-label",
      "sidebar-group-action",
      "sidebar-menu-badge",
      "sidebar-menu-action",
      "sidebar-menu-sub",
    ]) {
      const part = document.querySelector<HTMLElement>(`[data-slot=${slot}]`) as HTMLElement;
      expect(getComputedStyle(part).display, slot).toBe("none");
    }
    // The label text is visually hidden (sr-only) but still names the link.
    const label = homeLink().element().querySelector("span") as HTMLElement;
    expect(getComputedStyle(label).position).toBe("absolute");
    expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    await expect.element(homeLink()).toHaveAccessibleName("Home");
    const box = homeLink().element().getBoundingClientRect();
    expect([box.width, box.height]).toEqual([32, 32]);
  });

  it("each variant's content is --sidebar-width-icon wide", async () => {
    for (const variant of ["sidebar", "floating", "inset"] as const) {
      const screen = await render(
        <Shell provider={{ defaultOpen: false }} sidebar={{ collapsible: "icon", variant }} />,
      );
      await expect.poll(() => inner()?.clientWidth).toBe(48);
      await screen.unmount();
    }
  });

  it("shows the tooltip on hover and on keyboard focus, to the right", async () => {
    await render(<Shell provider={{ defaultOpen: false }} sidebar={{ collapsible: "icon" }} />);
    await userEvent.hover(page.getByRole("button", { name: "Settings" }));
    const tooltip = page.getByRole("tooltip", { name: "Settings" });
    await expect.element(tooltip).toBeVisible();
    const tooltipBox = tooltip.element().getBoundingClientRect();
    const buttonBox = page
      .getByRole("button", { name: "Settings" })
      .element()
      .getBoundingClientRect();
    expect(tooltipBox.left).toBeGreaterThanOrEqual(buttonBox.right);
    await userEvent.unhover(page.getByRole("button", { name: "Settings" }));
    await expect.element(tooltip).not.toBeInTheDocument();

    await userEvent.tab();
    expect(document.activeElement).toBe(homeLink().element());
    await expect.element(page.getByRole("tooltip", { name: "Home" })).toBeVisible();
  });

  it("shows no tooltip while expanded", async () => {
    await render(<Shell sidebar={{ collapsible: "icon" }} />);
    expect(homeLink().element().hasAttribute("data-trigger-disabled")).toBe(true);
    await userEvent.click(trigger());
    await expect.poll(() => homeLink().element().hasAttribute("data-trigger-disabled")).toBe(false);
  });

  it("puts the tooltip on the left of a right-side sidebar", async () => {
    await render(
      <Shell provider={{ defaultOpen: false }} sidebar={{ collapsible: "icon", side: "right" }} />,
    );
    const button = page.getByRole("button", { name: "Settings" });
    await userEvent.hover(button);
    const tooltip = page.getByRole("tooltip", { name: "Settings" });
    await expect.element(tooltip).toBeVisible();
    expect(tooltip.element().getBoundingClientRect().right).toBeLessThanOrEqual(
      button.element().getBoundingClientRect().left,
    );
    // The right sidebar sits after the inset.
    const main = page.getByRole("main").element().getBoundingClientRect();
    expect((aside() as HTMLElement).getBoundingClientRect().left).toBeGreaterThanOrEqual(
      main.right,
    );
  });
});

describe("collapsible offcanvas", () => {
  it("collapses to zero width and is inert: Tab skips it", async () => {
    await render(<Shell provider={{ defaultOpen: false }} />);
    const sidebar = aside() as HTMLElement;
    expect(sidebar.getAttribute("data-collapsible")).toBe("offcanvas");
    expect(sidebar.inert).toBe(true);
    await expect.poll(() => sidebar.getBoundingClientRect().width).toBe(0);
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger().element());
    await userEvent.tab();
    expect(document.activeElement).toBe(
      page.getByRole("button", { name: "Inset action" }).element(),
    );
    await userEvent.click(trigger());
    await expect.poll(() => sidebar.inert).toBe(false);
  });
});

describe("collapsible none", () => {
  it("never collapses: the trigger and the shortcut do nothing, and it stays expanded", async () => {
    const onOpenChange = vi.fn();
    await render(<Shell provider={{ onOpenChange }} sidebar={{ collapsible: "none" }} />);
    const button = trigger().element();
    await userEvent.click(trigger());
    await pressShortcut("Control");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(aside()?.getAttribute("data-state")).toBe("expanded");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe(aside()?.id);
    expect(aside()?.hasAttribute("data-collapsible")).toBe(false);
    expect(aside()?.inert).toBe(false);
    expect(aside()?.getBoundingClientRect().width).toBe(256);
    // Nothing to toggle: no rail.
    expect(rail()).toBeNull();
  });

  it("stays a static aside at mobile widths (no Drawer)", async () => {
    await page.viewport(390, 800);
    await render(<Shell sidebar={{ collapsible: "none" }} />);
    await userEvent.click(trigger());
    expect(aside()).not.toBeNull();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(trigger().element().getAttribute("aria-expanded")).toBe("true");
  });
});

describe("static state is per Sidebar", () => {
  function Probe() {
    const { state, open } = useSidebar();
    return <output data-testid="probe">{`${state}:${open}`}</output>;
  }
  function Two({
    defaultOpen,
    fixed = true,
    collapsible = true,
  }: {
    defaultOpen?: boolean;
    fixed?: boolean;
    collapsible?: boolean;
  }) {
    return (
      <SidebarProvider defaultOpen={defaultOpen}>
        {fixed && (
          <Sidebar collapsible="none" aria-label="Fixed">
            <p>fixed</p>
          </Sidebar>
        )}
        {collapsible && (
          <Sidebar side="right" aria-label="Panel">
            <p>panel</p>
          </Sidebar>
        )}
        <SidebarInset>
          <SidebarTrigger />
          <Probe />
        </SidebarInset>
      </SidebarProvider>
    );
  }
  const probe = () => page.getByTestId("probe");
  const panel = () =>
    document.querySelector<HTMLElement>("aside[aria-label=Panel]") as HTMLElement | null;

  it("a static Sidebar does not stop the trigger from toggling a collapsible one", async () => {
    await render(<Two />);
    await expect.element(probe()).toHaveTextContent("expanded:true");
    await userEvent.click(trigger());
    await expect.element(probe()).toHaveTextContent("collapsed:false");
    await expect.poll(() => panel()?.getAttribute("data-state")).toBe("collapsed");
    expect(document.querySelector("aside[aria-label=Fixed]")?.getAttribute("data-state")).toBe(
      "expanded",
    );
    await pressShortcut("Control");
    await expect.element(probe()).toHaveTextContent("expanded:true");
  });

  it("the collapsible Sidebar leaving does not un-static the remaining one", async () => {
    const screen = await render(<Two />);
    await screen.rerender(<Two collapsible={false} />);
    expect(panel()).toBeNull();
    await userEvent.click(trigger());
    await expect.element(probe()).toHaveTextContent("expanded:true");
    await pressShortcut("Control");
    await expect.element(probe()).toHaveTextContent("expanded:true");
  });

  it("state is expanded when the only Sidebar is collapsible=none, even with the provider closed", async () => {
    const screen = await render(<Two defaultOpen={false} collapsible={false} />);
    await expect.element(probe()).toHaveTextContent("expanded:false");
    await screen.rerender(<Two defaultOpen={false} />);
    // Mixed setup: the provider's own state decides.
    await expect.element(probe()).toHaveTextContent("collapsed:false");
    await screen.rerender(<Two defaultOpen={false} fixed={false} collapsible={false} />);
    // No Sidebar at all: the provider's own state.
    await expect.element(probe()).toHaveTextContent("collapsed:false");
  });
});

describe("mobile", () => {
  beforeEach(async () => {
    await page.viewport(390, 800);
  });

  it("the trigger opens a Drawer named Sidebar; Escape closes it and returns focus", async () => {
    await render(<Shell />);
    expect(aside()).toBeNull();
    const button = trigger().element() as HTMLElement;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    // The closed Drawer does not exist: no aria-controls pointing at nothing.
    expect(button.hasAttribute("aria-controls")).toBe(false);
    await userEvent.click(trigger());
    const drawer = page.getByRole("dialog", { name: "Sidebar" });
    await expect.element(drawer).toBeVisible();
    const popup = drawer.element() as HTMLElement;
    await waitForPopupSettled(popup);
    await expect.poll(() => popup.contains(document.activeElement)).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe(popup.id);
    await expect.element(homeLink()).toBeVisible();
    // Opens from the left by default, 18rem wide.
    expect(popup.getBoundingClientRect().left).toBe(0);
    expect(popup.getBoundingClientRect().width).toBe(288);
    await userEvent.keyboard("{Escape}");
    await expect.element(drawer).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.hasAttribute("aria-controls")).toBe(false);
  });

  it("uses the sidebar's side, a custom label, and the shortcut opens it", async () => {
    await render(
      <Shell sidebar={{ side: "right", "aria-label": "Navigation", title: "Main navigation" }} />,
    );
    await userEvent.click(page.getByRole("button", { name: "Inset action" }));
    await pressShortcut("Control");
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect.element(drawer).toBeVisible();
    const popup = drawer.element() as HTMLElement;
    await waitForPopupSettled(popup);
    expect(Math.round(popup.getBoundingClientRect().right)).toBe(390);
    // Rest props reach the drawer's sidebar wrapper; there is no rail on mobile.
    const wrapper = popup.querySelector<HTMLElement>("[data-slot=sidebar]");
    expect(wrapper?.getAttribute("title")).toBe("Main navigation");
    expect(rail()).toBeNull();
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations open in the %s theme",
    async (theme) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(<Shell />);
      await userEvent.click(trigger());
      const popup = page.getByRole("dialog", { name: "Sidebar" }).element() as HTMLElement;
      await waitForPopupSettled(popup);
      expect(await auditOpenOverlay()).toEqual({ violations: [], incomplete: [] });
    },
  );
});

describe("rail", () => {
  it("is hidden from AT, out of the Tab order, and toggles on click", async () => {
    await render(<Shell sidebar={{ collapsible: "icon" }} />);
    const element = rail() as HTMLElement;
    expect(element.getAttribute("aria-hidden")).toBe("true");
    expect(element.tabIndex).toBe(-1);
    await userEvent.click(element);
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("collapsed");
    await userEvent.click(element);
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("expanded");
  });

  it("lives outside the aside, just past its inner edge, on either side", async () => {
    for (const side of ["left", "right"] as const) {
      const screen = await render(<Shell sidebar={{ side }} />);
      const element = rail() as HTMLElement;
      const sidebar = aside() as HTMLElement;
      expect(sidebar.contains(element)).toBe(false);
      const railBox = element.getBoundingClientRect();
      const asideBox = sidebar.getBoundingClientRect();
      if (side === "left") expect(railBox.left).toBe(asideBox.right);
      else expect(railBox.right).toBe(asideBox.left);
      await screen.unmount();
    }
  });

  it("reopens a collapsed off-canvas sidebar", async () => {
    await render(<Shell provider={{ defaultOpen: false }} />);
    await expect.poll(() => aside()?.getBoundingClientRect().width).toBe(0);
    expect(aside()?.inert).toBe(true);
    await userEvent.click(rail() as HTMLElement);
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("expanded");
    expect(aside()?.inert).toBe(false);
  });

  it.each([
    ["expanded", true],
    ["icon", false],
  ] as const)("does not cover the menu buttons' end (%s)", async (_mode, open) => {
    await render(<Shell provider={{ defaultOpen: open }} sidebar={{ collapsible: "icon" }} />);
    await expect.poll(() => inner()?.clientWidth).toBe(open ? 255 : 48);
    const button = page.getByRole("button", { name: "Ada Lovelace" }).element();
    const box = button.getBoundingClientRect();
    const hit = document.elementFromPoint(box.right - 1, box.top + box.height / 2);
    expect(hit && button.contains(hit)).toBe(true);
  });

  it("does not cover the content's scrollbar area", async () => {
    await render(<Shell />);
    const content = document.querySelector<HTMLElement>(
      "[data-slot=sidebar-content]",
    ) as HTMLElement;
    const box = content.getBoundingClientRect();
    const hit = document.elementFromPoint(box.right - 1, box.bottom - 4);
    expect(hit && content.contains(hit)).toBe(true);
  });
});

describe("RTL (`side` follows the writing direction: left is the start)", () => {
  const Rtl = (props: ShellProps) => (
    <div dir="rtl">
      <Shell {...props} />
    </div>
  );
  const main = () => document.querySelector<HTMLElement>("main") as HTMLElement;

  it("the column sits at the start (right) for side=left, at the end (left) for side=right; the rail lies just outside its inner edge", async () => {
    for (const side of ["left", "right"] as const) {
      const screen = await render(<Rtl sidebar={{ side }} />);
      const asideBox = (aside() as HTMLElement).getBoundingClientRect();
      const railBox = (rail() as HTMLElement).getBoundingClientRect();
      const mainBox = main().getBoundingClientRect();
      if (side === "left") {
        expect(asideBox.left, side).toBeGreaterThanOrEqual(mainBox.right);
        expect(railBox.right, side).toBe(asideBox.left);
      } else {
        expect(asideBox.right, side).toBeLessThanOrEqual(mainBox.left);
        expect(railBox.left, side).toBe(asideBox.right);
      }
      await screen.unmount();
    }
  });

  it.each([
    ["expanded", true],
    ["icon", false],
  ] as const)("the rail does not cover the menu buttons' inner end (%s)", async (_mode, open) => {
    await render(<Rtl provider={{ defaultOpen: open }} sidebar={{ collapsible: "icon" }} />);
    await expect.poll(() => inner()?.clientWidth).toBe(open ? 255 : 48);
    const button = page.getByRole("button", { name: "Ada Lovelace" }).element();
    const box = button.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + 1, box.top + box.height / 2);
    expect(hit && button.contains(hit)).toBe(true);
  });

  it("the rail does not cover the content's scrollbar area (the inner edge, left in RTL)", async () => {
    await render(<Rtl />);
    const content = document.querySelector<HTMLElement>(
      "[data-slot=sidebar-content]",
    ) as HTMLElement;
    const box = content.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + 1, box.bottom - 4);
    expect(hit && content.contains(hit)).toBe(true);
  });

  it("clicking the rail toggles; collapsed off-canvas the panel slides out past the outer (right) edge", async () => {
    await render(<Rtl />);
    await userEvent.click(rail() as HTMLElement);
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("collapsed");
    await expect.poll(() => aside()?.getBoundingClientRect().width).toBe(0);
    const container = inner()?.parentElement as HTMLElement;
    await expect
      .poll(() => container.getBoundingClientRect().left)
      .toBeGreaterThanOrEqual((aside() as HTMLElement).getBoundingClientRect().right);
    await userEvent.click(rail() as HTMLElement);
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("expanded");
  });

  it("icon-mode tooltips open away from the column (to the left of a side=left column)", async () => {
    await render(<Rtl provider={{ defaultOpen: false }} sidebar={{ collapsible: "icon" }} />);
    const button = page.getByRole("button", { name: "Settings" });
    await userEvent.hover(button);
    const tooltip = page.getByRole("tooltip", { name: "Settings" });
    await expect.element(tooltip).toBeVisible();
    expect(tooltip.element().getBoundingClientRect().right).toBeLessThanOrEqual(
      button.element().getBoundingClientRect().left,
    );
  });

  describe("mobile", () => {
    beforeEach(async () => {
      await page.viewport(390, 800);
    });

    it.each([
      ["left", "right"],
      ["right", "left"],
    ] as const)("side=%s opens the Drawer from the column's own side (%s)", async (side, edge) => {
      await render(<Rtl sidebar={{ side }} />);
      await userEvent.click(trigger());
      const drawer = page.getByRole("dialog", { name: "Sidebar" });
      await expect.element(drawer).toBeVisible();
      const popup = drawer.element() as HTMLElement;
      await waitForPopupSettled(popup);
      const box = popup.getBoundingClientRect();
      if (edge === "right") expect(Math.round(box.right)).toBe(390);
      else expect(Math.round(box.left)).toBe(0);
    });

    it("with the whole document RTL, the header clears the Drawer's close button (at the inline end, physically left)", async () => {
      document.documentElement.dir = "rtl";
      try {
        await render(<Shell />);
        await userEvent.click(trigger());
        const drawer = page.getByRole("dialog", { name: "Sidebar" });
        await expect.element(drawer).toBeVisible();
        const popup = drawer.element() as HTMLElement;
        await waitForPopupSettled(popup);
        expect(Math.round(popup.getBoundingClientRect().right)).toBe(390);
        const header = popup.querySelector("[data-slot=sidebar-header]") as HTMLElement;
        const close = popup.querySelector("[data-slot=drawer-close-button]") as HTMLElement;
        const content =
          header.getBoundingClientRect().left + parseFloat(getComputedStyle(header).paddingLeft);
        expect(content).toBeGreaterThanOrEqual(close.getBoundingClientRect().right);
      } finally {
        document.documentElement.removeAttribute("dir");
      }
    });
  });
});

describe("motion", () => {
  it("transitions the width, and not under reduced motion", async () => {
    await render(<Shell />);
    expect(getComputedStyle(aside() as HTMLElement).transitionProperty).toBe("width");
    expect(getComputedStyle(aside() as HTMLElement).transitionDuration).toBe("0.2s");
    await emulateReducedMotion(true);
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    expect(getComputedStyle(aside() as HTMLElement).transitionProperty).toBe("none");
    expect(getComputedStyle(inner()?.parentElement as HTMLElement).transitionProperty).toBe("none");
  });
});

describe("stories", () => {
  for (const [name, story] of Object.entries(stories)) {
    if (name === "default" || typeof story !== "object" || !("render" in story)) continue;
    it(`${name} renders an aside and a main`, async () => {
      const Story = story.render as () => ReactNode;
      await render(<Story />);
      await expect.element(page.getByRole("main")).toBeInTheDocument();
      expect(aside()).not.toBeNull();
    });
  }

  it("only the Default story keeps the shortcut", async () => {
    for (const [name, story] of Object.entries(stories)) {
      if (name === "default" || typeof story !== "object" || !("render" in story)) continue;
      const Story = story.render as () => ReactNode;
      const screen = await render(<Story />);
      const before = aside()?.getAttribute("data-state");
      await userEvent.click(screen.getByRole("heading", { name: "Dashboard" }));
      await pressShortcut("Control");
      if (name === "Default") {
        await expect.poll(() => aside()?.getAttribute("data-state")).not.toBe(before);
      } else {
        expect(aside()?.getAttribute("data-state"), name).toBe(before);
      }
      await screen.unmount();
    }
  });
});
