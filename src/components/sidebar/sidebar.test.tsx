import axe from "axe-core";
import { type ReactNode, useState } from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
  systemColor,
} from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { DotIcon } from "../../lib/icons";
import { DateField } from "../date-field";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  type SidebarMenuButtonProps,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  type SidebarProps,
  SidebarProvider,
  type SidebarProviderProps,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from ".";
import * as stories from "./sidebar.stories";

interface ShellProps {
  provider?: Omit<SidebarProviderProps, "children">;
  sidebar?: Omit<SidebarProps, "children">;
  inset?: ReactNode;
}

function Shell({ provider, sidebar, inset }: ShellProps) {
  return (
    <SidebarProvider {...provider}>
      <Sidebar {...sidebar}>
        <SidebarHeader>Acme Inc.</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupAction aria-label="Add project">
              <DotIcon />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <nav aria-label="Main">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#home" />} isActive tooltip="Home">
                      <DotIcon />
                      <span>Home</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>12</SidebarMenuBadge>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Settings">
                      <DotIcon />
                      <span>Settings</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction aria-label="More settings">
                      <DotIcon />
                    </SidebarMenuAction>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton href="#general" isActive>
                          General
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton href="#billing">Billing</SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator data-testid="separator" />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip="Ada Lovelace">
                <DotIcon />
                <span>Ada Lovelace</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header>
          <SidebarTrigger />
        </header>
        {inset}
        <button type="button">Inset action</button>
      </SidebarInset>
    </SidebarProvider>
  );
}

const aside = () => document.querySelector<HTMLElement>("aside[data-slot=sidebar]");
const inner = () => document.querySelector<HTMLElement>("[data-slot=sidebar-inner]");
const trigger = () => page.getByRole("button", { name: "Toggle sidebar" });
const homeLink = () => page.getByRole("link", { name: "Home" });
const pressShortcut = (modifier: "Control" | "Meta") =>
  userEvent.keyboard(`{${modifier}>}b{/${modifier}}`);

async function axeResults(container: Element) {
  const results = await axe.run(container, { rules: { region: { enabled: false } } });
  return {
    violations: results.violations.map((v) => `${v.id}: ${v.help}`),
    incomplete: results.incomplete.map(
      (v) => `${v.id}: ${v.help} (${v.nodes.map((node) => node.html).join(", ")})`,
    ),
  };
}

beforeEach(async () => {
  // Vitest's iframe defaults to a phone-sized viewport; the desktop sidebar starts at `md`.
  await page.viewport(1280, 800);
});

afterEach(async () => {
  document.documentElement.classList.remove("dark");
  await resetEmulatedMedia();
});

afterAll(async () => {
  await page.viewport(414, 896);
});

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
    expect(typeof api?.setOpen).toBe("function");
    expect(typeof api?.setOpenMobile).toBe("function");
    expect(typeof api?.toggleSidebar).toBe("function");

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

  it("collapsible='none' never collapses", async () => {
    await render(<Shell sidebar={{ collapsible: "none" }} />);
    await pressShortcut("Control");
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("collapsed");
    expect(aside()?.hasAttribute("data-collapsible")).toBe(false);
    expect(aside()?.inert).toBe(false);
    expect(aside()?.getBoundingClientRect().width).toBe(256);
    // Nothing to toggle: no rail.
    expect(document.querySelector("[data-slot=sidebar-rail]")).toBeNull();
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
    // Rest props reach the drawer's sidebar wrapper; the rail is not rendered there.
    const wrapper = popup.querySelector<HTMLElement>("[data-slot=sidebar]");
    expect(wrapper?.getAttribute("title")).toBe("Main navigation");
    expect(popup.querySelector("[data-slot=sidebar-rail]")).toBeNull();
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

describe("menu", () => {
  it("isActive sets aria-current=page on a link and data-active on a button", async () => {
    await render(
      <SidebarProvider>
        <Sidebar>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<a href="#a" />} isActive>
                Link
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive>Button</SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton render={<a href="#b" />}>Other</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </Sidebar>
      </SidebarProvider>,
    );
    const link = page.getByRole("link", { name: "Link" }).element();
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(link.hasAttribute("data-active")).toBe(true);
    expect(link.getAttribute("data-slot")).toBe("sidebar-menu-button");
    const button = page.getByRole("button", { name: "Button" }).element();
    expect(button.hasAttribute("aria-current")).toBe(false);
    expect(button.hasAttribute("data-active")).toBe(true);
    expect(button.getAttribute("type")).toBe("button");
    const other = page.getByRole("link", { name: "Other" }).element();
    expect(other.hasAttribute("aria-current")).toBe(false);
    expect(other.hasAttribute("data-active")).toBe(false);
    const style = getComputedStyle(link);
    expect(style.fontWeight).toBe("500");
    expect(style.backgroundColor).not.toBe(getComputedStyle(other).backgroundColor);
  });

  it("sizes are h-8 / h-9 / h-12", async () => {
    const sizes: NonNullable<SidebarMenuButtonProps["size"]>[] = ["sm", "md", "lg"];
    await render(
      <SidebarProvider>
        <Sidebar>
          <SidebarMenu>
            {sizes.map((size) => (
              <SidebarMenuItem key={size}>
                <SidebarMenuButton size={size}>{size}</SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </Sidebar>
      </SidebarProvider>,
    );
    const heights = sizes.map(
      (size) => page.getByRole("button", { name: size }).element().getBoundingClientRect().height,
    );
    expect(heights).toEqual([32, 36, 48]);
  });

  it("renders sub lists as nested ul/li with an indent guide", async () => {
    await render(<Shell />);
    const sub = document.querySelector<HTMLElement>("[data-slot=sidebar-menu-sub]");
    expect(sub?.tagName).toBe("UL");
    expect(sub?.parentElement?.getAttribute("data-slot")).toBe("sidebar-menu-item");
    expect(sub?.parentElement?.tagName).toBe("LI");
    expect(sub?.querySelectorAll("li[data-slot=sidebar-menu-sub-item]").length).toBe(2);
    const style = getComputedStyle(sub as HTMLElement);
    expect(style.borderInlineStartWidth).toBe("1px");
    const general = page.getByRole("link", { name: "General" }).element();
    expect(general.getAttribute("aria-current")).toBe("page");
    expect(general.getAttribute("data-slot")).toBe("sidebar-menu-sub-button");
    expect(page.getByRole("link", { name: "Billing" }).element().hasAttribute("aria-current")).toBe(
      false,
    );
    expect(page.getByRole("navigation", { name: "Main" }).getByRole("list").all().length).toBe(2);
  });

  it("renders a skeleton hidden from assistive technology", async () => {
    await render(
      <SidebarProvider>
        <Sidebar>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuSkeleton data-testid="skeleton" showIcon />
            </SidebarMenuItem>
          </SidebarMenu>
        </Sidebar>
      </SidebarProvider>,
    );
    const skeleton = page.getByTestId("skeleton").element();
    expect(skeleton.getAttribute("data-slot")).toBe("sidebar-menu-skeleton");
    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton.querySelectorAll("[data-slot=skeleton]").length).toBe(2);
  });
});

describe("rail", () => {
  it("is hidden from AT, out of the Tab order, and toggles on click", async () => {
    await render(<Shell sidebar={{ collapsible: "icon" }} />);
    const rail = document.querySelector<HTMLElement>("[data-slot=sidebar-rail]") as HTMLElement;
    expect(rail.getAttribute("aria-hidden")).toBe("true");
    expect(rail.tabIndex).toBe(-1);
    await userEvent.click(rail);
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("collapsed");
    await userEvent.click(rail);
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("expanded");
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

describe("focus", () => {
  it("menu buttons show an inset 2px ring on keyboard focus", async () => {
    await render(<Shell />);
    await userEvent.tab();
    const action = page.getByRole("button", { name: "Add project" }).element();
    expect(document.activeElement).toBe(action);
    expect(getComputedStyle(action).outlineStyle).toBe("solid");
    await userEvent.tab();
    const link = homeLink().element();
    expect(document.activeElement).toBe(link);
    const style = getComputedStyle(link);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
    expect(style.outlineOffset).toBe("-2px");
  });

  it("forced colors: active item Highlight/HighlightText with forced-color-adjust none; rings until focus", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    await render(<Shell />);
    const link = homeLink().element();
    const settings = page.getByRole("button", { name: "Settings" }).element();
    let style = getComputedStyle(link);
    expect(style.backgroundColor).toBe(systemColor("Highlight"));
    expect(style.color).toBe(systemColor("HighlightText"));
    expect(style.forcedColorAdjust).toBe("none");
    expect(getComputedStyle(settings).forcedColorAdjust).toBe("auto");
    expect(style.outlineStyle).toBe("none");
    // Focused active item: the ring sits inside the Highlight fill, so it is HighlightText.
    await userEvent.tab(); // the group action
    await userEvent.tab();
    expect(document.activeElement).toBe(link);
    style = getComputedStyle(link);
    expect(style.outlineStyle).toBe("solid");
    // outline-color transitions (150ms): wait for it to settle.
    await expect.poll(() => getComputedStyle(link).outlineColor).toBe(systemColor("HighlightText"));
    // An ordinary item: a Highlight ring.
    await userEvent.tab();
    expect(document.activeElement).toBe(settings);
    expect(getComputedStyle(settings).outlineStyle).toBe("solid");
    await expect.poll(() => getComputedStyle(settings).outlineColor).toBe(systemColor("Highlight"));
    // The separator stays visible.
    expect(getComputedStyle(page.getByTestId("separator").element()).backgroundColor).toBe(
      systemColor("CanvasText"),
    );
  });

  it("forced colors: the trigger's focus ring is Highlight", async () => {
    await emulateForcedColors(true);
    await render(<Shell provider={{ defaultOpen: false }} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger().element());
    await expect
      .poll(() => getComputedStyle(trigger().element()).outlineColor)
      .toBe(systemColor("Highlight"));
  });
});

describe("axe", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const mode of ["expanded", "icon"] as const) {
      it(`has no violations ${mode} in the ${theme} theme`, async () => {
        if (theme === "dark") document.documentElement.classList.add("dark");
        const screen = await render(
          <Shell
            provider={{ defaultOpen: mode === "expanded" }}
            sidebar={{ collapsible: "icon" }}
          />,
        );
        expect(await axeResults(screen.container)).toEqual({ violations: [], incomplete: [] });
      });
    }
  }
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
});
