import { type ComponentProps, forwardRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateMedia,
  resetEmulatedMedia,
  systemColor,
} from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  type NavigationMenuProps,
  NavigationMenuTrigger,
} from "./navigation-menu";

function SiteHeader(props: Partial<NavigationMenuProps>) {
  return (
    <div className="p-16">
      <NavigationMenu aria-label="Main" delay={0} closeDelay={0} {...props}>
        <NavigationMenuList>
          <NavigationMenuItem value="products">
            <NavigationMenuTrigger>Products</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid grid-cols-2 gap-1">
                <li>
                  <NavigationMenuLink href="#analytics">Analytics</NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink href="#billing" active>
                    Billing
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem value="company">
            <NavigationMenuTrigger>Company</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink href="#about">About us</NavigationMenuLink>
              <NavigationMenuLink href="#careers">Careers</NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink href="#pricing">Pricing</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}

const trigger = (name: string) => page.getByRole("button", { name, exact: true });
const link = (name: string) => page.getByRole("link", { name, exact: true });
const popup = () => document.querySelector<HTMLElement>("[data-slot=navigation-menu-popup]");
const content = () => document.querySelector<HTMLElement>("[data-slot=navigation-menu-content]");

async function openByClick(name: string) {
  await userEvent.click(trigger(name));
  await expect.poll(() => popup()).not.toBeNull();
  const element = popup() as HTMLElement;
  await waitForPopupSettled(element);
  return element;
}

afterEach(async () => {
  await resetEmulatedMedia();
  document.documentElement.classList.remove("dark");
  if (window.location.hash) history.replaceState(null, "", window.location.pathname);
});

describe("NavigationMenu", () => {
  it("renders a labelled nav with a list of items; content opens in a portalled popup", async () => {
    const screen = await render(<SiteHeader />);
    await expect.element(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect.element(trigger("Products")).toHaveAttribute("aria-expanded", "false");
    expect(popup()).toBeNull();
    const element = await openByClick("Products");
    expect(screen.container.contains(element)).toBe(false);
    expect(document.body.contains(element)).toBe(true);
    await expect.element(trigger("Products")).toHaveAttribute("aria-expanded", "true");
    await expect.element(link("Analytics")).toBeVisible();
    expect(element.querySelector("[data-slot=navigation-menu-viewport]")).not.toBeNull();
    const positioner = element.parentElement as HTMLElement;
    expect(getComputedStyle(positioner).zIndex).toBe("50");
  });

  it("sets data-slot on every part and merges className", async () => {
    await render(
      <NavigationMenu aria-label="Main" className="custom-root">
        <NavigationMenuList className="custom-list">
          <NavigationMenuItem className="custom-item">
            <NavigationMenuTrigger className="custom-trigger">Docs</NavigationMenuTrigger>
            <NavigationMenuContent className="custom-content">
              <NavigationMenuLink href="#a" className="custom-link">
                Guide
              </NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    );
    const root = page.getByRole("navigation", { name: "Main" }).element();
    expect(root.getAttribute("data-slot")).toBe("navigation-menu");
    expect(root.classList.contains("custom-root")).toBe(true);
    expect(root.classList.contains("relative")).toBe(true);
    const list = root.querySelector("ul") as HTMLElement;
    expect(list.getAttribute("data-slot")).toBe("navigation-menu-list");
    expect(list.classList.contains("custom-list")).toBe(true);
    expect(list.classList.contains("flex")).toBe(true);
    const item = root.querySelector("li") as HTMLElement;
    expect(item.getAttribute("data-slot")).toBe("navigation-menu-item");
    expect(item.classList.contains("custom-item")).toBe(true);
    const docs = trigger("Docs").element();
    expect(docs.getAttribute("data-slot")).toBe("navigation-menu-trigger");
    expect(docs.classList.contains("custom-trigger")).toBe(true);
    expect(docs.classList.contains("h-8")).toBe(true);
    expect(docs.querySelector("[data-slot=navigation-menu-icon] svg")).not.toBeNull();

    await openByClick("Docs");
    const panel = content() as HTMLElement;
    expect(panel.classList.contains("custom-content")).toBe(true);
    expect(panel.classList.contains("p-4")).toBe(true);
    const guide = link("Guide").element();
    expect(guide.getAttribute("data-slot")).toBe("navigation-menu-link");
    expect(guide.classList.contains("custom-link")).toBe(true);
    expect(guide.classList.contains("rounded-md")).toBe(true);
    expect(popup()?.classList.contains("rounded-lg")).toBe(true);
    expect(
      document.querySelector("[data-slot=navigation-menu-positioner]")?.contains(popup()),
    ).toBe(true);
  });

  it("supports function-form className on the parts", async () => {
    await render(
      <NavigationMenu aria-label="Main" className={() => "fn-root"}>
        <NavigationMenuList className={() => "fn-list"}>
          <NavigationMenuItem>
            <NavigationMenuTrigger className={(state) => (state.open ? "fn-open" : "fn-closed")}>
              Docs
            </NavigationMenuTrigger>
            <NavigationMenuContent className={(state) => (state.open ? "fn-content" : "")}>
              <NavigationMenuLink
                href="#a"
                active
                className={(state) => (state.active ? "fn-active" : "")}
              >
                Guide
              </NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    );
    const root = page.getByRole("navigation", { name: "Main" }).element();
    expect(root.classList.contains("fn-root")).toBe(true);
    expect(root.classList.contains("relative")).toBe(true);
    expect(root.querySelector("ul")?.classList.contains("fn-list")).toBe(true);
    expect(trigger("Docs").element().classList.contains("fn-closed")).toBe(true);
    await openByClick("Docs");
    expect(trigger("Docs").element().classList.contains("fn-open")).toBe(true);
    expect(content()?.classList.contains("fn-content")).toBe(true);
    expect(link("Guide").element().classList.contains("fn-active")).toBe(true);
  });

  it("Tab moves between the top-level triggers and links", async () => {
    await render(
      <div>
        <button type="button">before</button>
        <SiteHeader />
        <button type="button">after</button>
      </div>,
    );
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger("Products").element());
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger("Company").element());
    await userEvent.tab();
    expect(document.activeElement).toBe(link("Pricing").element());
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "after" }).element());
    expect(popup()).toBeNull();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
    ["ArrowDown", "{ArrowDown}"],
  ])("opens with %s; Tab then moves focus into the content", async (_name, key) => {
    await render(<SiteHeader />);
    (trigger("Products").element() as HTMLElement).focus();
    await userEvent.keyboard(key);
    await expect.poll(() => popup()).not.toBeNull();
    await expect.element(trigger("Products")).toHaveAttribute("aria-expanded", "true");
    await userEvent.tab();
    await expect.poll(() => document.activeElement).toBe(link("Analytics").element());
    await userEvent.tab();
    expect(document.activeElement).toBe(link("Billing").element());
  });

  it("Escape closes the content and returns focus to the trigger", async () => {
    const onValueChange = vi.fn();
    await render(<SiteHeader onValueChange={onValueChange} />);
    (trigger("Products").element() as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    await expect.poll(() => document.activeElement).toBe(link("Analytics").element());
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => popup()).toBeNull();
    await expect.poll(() => document.activeElement).toBe(trigger("Products").element());
    expect(onValueChange).toHaveBeenLastCalledWith(
      null,
      expect.objectContaining({ reason: "escape-key" }),
    );
  });

  it("switches panels when another trigger is clicked; a later click on it closes", async () => {
    const onValueChange = vi.fn();
    await render(<SiteHeader onValueChange={onValueChange} />);
    await openByClick("Products");
    // The pointer passes over Company first, so hover switches to it just before the click; the
    // click must not then close the panel it just switched to (patient click, as Base UI does
    // for a hover-open from closed).
    await userEvent.click(trigger("Company"));
    await expect.element(link("About us")).toBeVisible();
    await expect.element(trigger("Company")).toHaveAttribute("aria-expanded", "true");
    await expect.element(trigger("Products")).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => content()?.getAttribute("data-activation-direction")).toBe("right");
    expect(onValueChange.mock.calls.filter(([value]) => value === null)).toHaveLength(0);

    await new Promise((resolve) => setTimeout(resolve, 600));
    await userEvent.click(trigger("Company"));
    await expect.poll(() => popup()).toBeNull();
    expect(onValueChange).toHaveBeenLastCalledWith(
      null,
      expect.objectContaining({ reason: "trigger-press" }),
    );
  });

  it("opens on hover after the delay", async () => {
    await render(<SiteHeader delay={150} />);
    await userEvent.hover(trigger("Company"));
    // Not before the delay has elapsed…
    expect(popup()).toBeNull();
    // …but once it has.
    await expect.poll(() => popup(), { timeout: 2000 }).not.toBeNull();
    await expect.element(link("Careers")).toBeVisible();
  });

  it("links are real anchors and navigate", async () => {
    await render(<SiteHeader />);
    const pricing = link("Pricing").element() as HTMLAnchorElement;
    expect(pricing.tagName).toBe("A");
    expect(pricing.getAttribute("href")).toBe("#pricing");
    await userEvent.click(pricing);
    await expect.poll(() => window.location.hash).toBe("#pricing");

    await openByClick("Products");
    await userEvent.click(link("Analytics"));
    await expect.poll(() => window.location.hash).toBe("#analytics");
  });

  it("active sets aria-current=page and the active style", async () => {
    await render(<SiteHeader />);
    await openByClick("Products");
    const billing = link("Billing").element();
    const analytics = link("Analytics").element();
    expect(billing.getAttribute("aria-current")).toBe("page");
    expect(billing.hasAttribute("data-active")).toBe(true);
    expect(analytics.hasAttribute("aria-current")).toBe(false);
    expect(getComputedStyle(billing).fontWeight).toBe("500");
    expect(getComputedStyle(analytics).fontWeight).toBe("400");
  });

  it("renders a router link through render, keeping the link styles", async () => {
    const RouterLink = forwardRef<HTMLAnchorElement, ComponentProps<"a"> & { to: string }>(
      function RouterLink({ to, ...props }, ref) {
        return <a ref={ref} href={to} data-router="" {...props} />;
      },
    );
    await render(
      <NavigationMenu aria-label="Main">
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink render={<RouterLink to="/orders" />} active>
              Orders
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    );
    const orders = link("Orders").element();
    expect(orders.hasAttribute("data-router")).toBe(true);
    expect(orders.getAttribute("href")).toBe("/orders");
    expect(orders.getAttribute("aria-current")).toBe("page");
    expect(orders.getAttribute("data-slot")).toBe("navigation-menu-link");
    expect(orders.classList.contains("rounded-md")).toBe(true);
  });

  it("a nested NavigationMenu renders an inline submenu inside the panel", async () => {
    await render(
      <div className="p-16">
        <NavigationMenu aria-label="Main" delay={0} closeDelay={0}>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Solutions</NavigationMenuTrigger>
              <NavigationMenuContent>
                <NavigationMenu defaultValue="teams" orientation="vertical">
                  <NavigationMenuList>
                    <NavigationMenuItem value="teams">
                      <NavigationMenuTrigger>Teams</NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <NavigationMenuLink href="#planning">Planning</NavigationMenuLink>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                    <NavigationMenuItem value="enterprise">
                      <NavigationMenuTrigger>Enterprise</NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <NavigationMenuLink href="#security">Security</NavigationMenuLink>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenu>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>,
    );
    const element = await openByClick("Solutions");
    // One popup only: the nested menu renders its viewport inline, inside the panel.
    expect(document.querySelectorAll("[data-slot=navigation-menu-popup]")).toHaveLength(1);
    const viewports = element.querySelectorAll("[data-slot=navigation-menu-viewport]");
    expect(viewports).toHaveLength(2);
    await expect.element(link("Planning")).toBeVisible();
    // The vertical sub-list stacks, and its chevrons point towards the content.
    const subList = trigger("Teams").element().closest("ul") as HTMLElement;
    expect(getComputedStyle(subList).flexDirection).toBe("column");
    const subIcon = trigger("Teams").element().querySelector("[data-slot=navigation-menu-icon]");
    expect(getComputedStyle(subIcon as Element).rotate).toBe("-90deg");
    await userEvent.click(trigger("Enterprise"));
    await expect.element(link("Security")).toBeVisible();
    await expect.element(trigger("Enterprise")).toHaveAttribute("aria-expanded", "true");
    expect(popup()).not.toBeNull();
  });

  describe("with a Tooltip open on a trigger", () => {
    const appKeys: string[] = [];
    const appListener = (event: KeyboardEvent) => {
      if (event.key === "Escape") appKeys.push(event.key);
    };
    beforeEach(() => {
      appKeys.length = 0;
      document.addEventListener("keydown", appListener);
    });
    afterEach(() => {
      document.removeEventListener("keydown", appListener);
    });

    it("the first Escape closes only the tooltip, the second the menu", async () => {
      const onValueChange = vi.fn();
      await render(
        <div className="p-16">
          <NavigationMenu aria-label="Main" onValueChange={onValueChange}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Products</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <Tooltip>
                    <TooltipTrigger
                      delay={0}
                      closeDelay={0}
                      render={<NavigationMenuLink href="#analytics" />}
                    >
                      Analytics
                    </TooltipTrigger>
                    <TooltipContent>Dashboards and reports</TooltipContent>
                  </Tooltip>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>,
      );
      await openByClick("Products");
      await userEvent.hover(link("Analytics"));
      await expect.element(page.getByRole("tooltip")).toBeVisible();
      await waitForPopupSettled(
        document.querySelector("[data-slot=tooltip-content]") as HTMLElement,
      );
      onValueChange.mockClear();

      await userEvent.keyboard("{Escape}");
      await expect.poll(() => document.querySelector("[data-slot=tooltip-content]")).toBeNull();
      expect(popup()).not.toBeNull();
      expect(appKeys).toEqual(["Escape"]);
      expect(onValueChange).not.toHaveBeenCalled();

      await userEvent.keyboard("{Escape}");
      await expect.poll(() => popup()).toBeNull();
      expect(onValueChange).toHaveBeenLastCalledWith(
        null,
        expect.objectContaining({ reason: "escape-key" }),
      );
    });
  });

  it("uses a pointer cursor on triggers", async () => {
    await render(<SiteHeader />);
    expect(getComputedStyle(trigger("Products").element()).cursor).toBe("pointer");
  });

  it("rotates the chevron while open, without a transition under reduced motion", async () => {
    await render(<SiteHeader />);
    const icon = trigger("Products")
      .element()
      .querySelector("[data-slot=navigation-menu-icon]") as HTMLElement;
    expect(getComputedStyle(icon).transitionProperty).toContain("transform");
    await openByClick("Products");
    await expect.poll(() => icon.hasAttribute("data-popup-open")).toBe(true);
    await expect.poll(() => getComputedStyle(icon).rotate).toBe("180deg");
    await emulateMedia([{ name: "prefers-reduced-motion", value: "reduce" }]);
    expect(getComputedStyle(icon).transitionProperty).toBe("none");
  });

  it("popup sizes from Base UI's --popup-width / --popup-height with a size transition", async () => {
    await render(<SiteHeader />);
    const element = await openByClick("Products");
    const style = getComputedStyle(element);
    expect(style.transitionProperty).toContain("width");
    expect(style.transitionProperty).toContain("height");
    await userEvent.click(trigger("Company"));
    await expect.element(link("About us")).toBeVisible();
    await expect.poll(() => element.style.getPropertyValue("--popup-width")).not.toBe("");
  });

  it("content slides from the activation side and only fades under reduced motion", async () => {
    await render(<SiteHeader />);
    await openByClick("Products");
    const panel = content() as HTMLElement;
    expect(getComputedStyle(panel).transitionProperty).toContain("translate");
    await emulateMedia([{ name: "prefers-reduced-motion", value: "reduce" }]);
    expect(getComputedStyle(panel).transitionProperty).toBe("opacity");
  });

  it("shows a visible 2px solid focus ring on Tab-focus of triggers and links", async () => {
    await render(<SiteHeader />);
    await userEvent.tab();
    const products = trigger("Products").element();
    expect(document.activeElement).toBe(products);
    expect(getComputedStyle(products).outlineStyle).toBe("solid");
    expect(getComputedStyle(products).outlineWidth).toBe("2px");
    await userEvent.tab();
    await userEvent.tab();
    const pricing = link("Pricing").element();
    expect(document.activeElement).toBe(pricing);
    expect(getComputedStyle(pricing).outlineStyle).toBe("solid");
    expect(getComputedStyle(pricing).outlineWidth).toBe("2px");
  });

  it("forced colors: no outline until focused, a Highlight ring; open trigger and active link legible", async () => {
    await emulateForcedColors(true);
    await render(<SiteHeader />);
    const products = trigger("Products").element();
    expect(getComputedStyle(products).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(products);
    expect(getComputedStyle(products).outlineStyle).toBe("solid");
    expect(getComputedStyle(products).outlineColor).toBe(systemColor("Highlight"));

    await userEvent.keyboard("{Enter}");
    await expect.poll(() => popup()).not.toBeNull();
    await waitForPopupSettled(popup() as HTMLElement);
    await expect
      .poll(() => getComputedStyle(products).backgroundColor)
      .toBe(systemColor("Highlight"));
    expect(getComputedStyle(products).color).toBe(systemColor("HighlightText"));
    expect(getComputedStyle(products).forcedColorAdjust).toBe("none");

    const billing = link("Billing").element();
    expect(getComputedStyle(billing).textDecorationLine).toBe("underline");
    expect(getComputedStyle(link("Analytics").element()).textDecorationLine).toBe("none");
  });

  describe.each(["light", "dark"] as const)("axe (%s)", (theme) => {
    it("has no violations closed", async () => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="bg-background">
          <SiteHeader />
        </div>,
      );
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    });

    it("has no violations with a panel open", async () => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="bg-background">
          <SiteHeader />
        </div>,
      );
      await openByClick("Products");
      await waitForPopupSettled(content() as HTMLElement);
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    });
  });
});
