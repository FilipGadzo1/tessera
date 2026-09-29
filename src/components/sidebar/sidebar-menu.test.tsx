import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, systemColor } from "../../../test/emulation";
import {
  Sidebar,
  SidebarMenu,
  SidebarMenuButton,
  type SidebarMenuButtonProps,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from ".";
import { axeResults, homeLink, Shell, setupSidebarTests, trigger } from "./sidebar.test-fixtures";

setupSidebarTests();

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

  it("keeps a caller's own aria-current when not active", async () => {
    await render(
      <SidebarProvider>
        <Sidebar>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<a href="#s1" />} aria-current="step">
                Step link
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton aria-current="step">Step button</SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton render={<a href="#s2" />} aria-current="step" isActive>
                Active link
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton href="#s3" aria-current="step">
                    Step sub
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton href="#s4" aria-current="step" isActive>
                    Active sub
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </Sidebar>
      </SidebarProvider>,
    );
    const current = (name: string, role: "link" | "button" = "link") =>
      page.getByRole(role, { name }).element().getAttribute("aria-current");
    expect(current("Step link")).toBe("step");
    expect(current("Step button", "button")).toBe("step");
    expect(current("Active link")).toBe("page");
    expect(current("Step sub")).toBe("step");
    expect(current("Active sub")).toBe("page");
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
