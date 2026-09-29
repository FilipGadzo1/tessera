import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
} from "../../../test/emulation";
import { Button } from "../button";
import {
  Collapsible,
  CollapsiblePanel,
  type CollapsiblePanelProps,
  type CollapsibleProps,
  CollapsibleTrigger,
} from "./collapsible";

function Keys({
  panelProps,
  ...rootProps
}: CollapsibleProps & { panelProps?: CollapsiblePanelProps }) {
  return (
    <Collapsible {...rootProps}>
      <CollapsibleTrigger render={<Button variant="outline" />}>Recovery keys</CollapsibleTrigger>
      <CollapsiblePanel {...panelProps}>
        <p id="keys">alien-bean-pasta</p>
      </CollapsiblePanel>
    </Collapsible>
  );
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Waits (polling, no fixed sleep) until nothing in the document is animating. */
async function animationsSettled() {
  await nextFrame();
  await expect.poll(() => document.getAnimations().length, { timeout: 2000 }).toBe(0);
}

/** Records the panel's rendered height every frame; the returned function stops and returns them. */
function recordHeights(getPanel: () => HTMLElement | null) {
  const heights: number[] = [];
  let recording = true;
  const tick = () => {
    if (!recording) return;
    heights.push(getPanel()?.getBoundingClientRect().height ?? 0);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => {
    recording = false;
    return heights;
  };
}

const panelOf = (root: Element) =>
  root.querySelector<HTMLElement>('[data-slot="collapsible-panel"]') as HTMLElement;

afterEach(async () => {
  document.documentElement.classList.remove("dark");
  await resetEmulatedMedia();
});

describe("Collapsible", () => {
  it("sets data-slot on every part", async () => {
    // A plain trigger: composed with Button, Button's own data-slot wins.
    const screen = await render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Recovery keys</CollapsibleTrigger>
        <CollapsiblePanel>Body</CollapsiblePanel>
      </Collapsible>,
    );
    expect(screen.container.querySelector('[data-slot="collapsible"]')).not.toBeNull();
    const trigger = screen.getByRole("button", { name: "Recovery keys" });
    await expect.element(trigger).toHaveAttribute("data-slot", "collapsible-trigger");
    expect(panelOf(screen.container)).not.toBeNull();
  });

  it("opens and closes on click, Enter and Space with aria-expanded and aria-controls", async () => {
    const onOpenChange = vi.fn();
    const screen = await render(<Keys onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole("button", { name: "Recovery keys" });
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    await expect.element(trigger).toHaveAttribute("data-panel-open");
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything());
    expect(trigger.element().getAttribute("aria-controls")).toBe(panelOf(screen.container).id);
    trigger.element().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard(" ");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("does nothing when disabled", async () => {
    const screen = await render(<Keys disabled />);
    const trigger = screen.getByRole("button", { name: "Recovery keys" });
    await trigger.click({ force: true });
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("gives a plain trigger a pointer cursor, not-allowed when disabled, and no other classes", async () => {
    const screen = await render(
      <Collapsible>
        <CollapsibleTrigger>Plain</CollapsibleTrigger>
        <CollapsiblePanel>Body</CollapsiblePanel>
      </Collapsible>,
    );
    const trigger = screen.getByRole("button", { name: "Plain" }).element();
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.className).toBe("cursor-pointer data-disabled:cursor-not-allowed");
    expect(getComputedStyle(trigger).cursor).toBe("pointer");
  });

  it("uses a not-allowed cursor on a disabled trigger", async () => {
    const screen = await render(
      <Collapsible disabled>
        <CollapsibleTrigger>Locked</CollapsibleTrigger>
        <CollapsiblePanel>Body</CollapsiblePanel>
      </Collapsible>,
    );
    const trigger = screen.getByRole("button", { name: "Locked" }).element();
    expect(trigger.hasAttribute("data-disabled")).toBe(true);
    expect(getComputedStyle(trigger).cursor).toBe("not-allowed");
  });

  it("merges className (string and function form) on trigger and panel", async () => {
    const screen = await render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="custom-trigger">T</CollapsibleTrigger>
        <CollapsiblePanel className={(state) => (state.open ? "custom-open" : "custom-closed")}>
          Body
        </CollapsiblePanel>
      </Collapsible>,
    );
    expect(screen.getByRole("button", { name: "T" }).element().className).toContain(
      "custom-trigger",
    );
    const panel = panelOf(screen.container);
    expect(panel.className).toContain("custom-open");
    expect(panel.className).toContain("overflow-clip");
  });

  it("animates the panel height to the content height and back to 0", async () => {
    const screen = await render(<Keys panelProps={{ keepMounted: true }} />);
    const trigger = screen.getByRole("button", { name: "Recovery keys" });
    const panel = panelOf(screen.container);
    expect(panel.getBoundingClientRect().height).toBe(0);

    let stop = recordHeights(() => panel);
    await trigger.click();
    await expect
      .poll(() => panel.style.getPropertyValue("--collapsible-panel-height"), { timeout: 2000 })
      .toBe("auto");
    await animationsSettled();
    const opening = stop();
    const full = panel.getBoundingClientRect().height;
    expect(full).toBeGreaterThan(0);
    expect(getComputedStyle(panel).transitionProperty).toBe("height");
    expect(opening.some((h) => h > 0.5 && h < full - 0.5)).toBe(true);

    stop = recordHeights(() => panel);
    await trigger.click();
    await expect.poll(() => panel.hasAttribute("hidden"), { timeout: 2000 }).toBe(true);
    await animationsSettled();
    const closing = stop();
    expect(closing.some((h) => h > 0.5 && h < full - 0.5)).toBe(true);
    expect(panel.getBoundingClientRect().height).toBe(0);
  });

  it("has no height transition under prefers-reduced-motion: reduce", async () => {
    await emulateReducedMotion(true);
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    const screen = await render(<Keys panelProps={{ keepMounted: true }} />);
    const trigger = screen.getByRole("button", { name: "Recovery keys" });
    const panel = panelOf(screen.container);
    await trigger.click();
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    expect(getComputedStyle(panel).transitionProperty).toBe("none");
    await animationsSettled();
    expect(panel.getBoundingClientRect().height).toBeGreaterThan(0);
    await trigger.click();
    expect(getComputedStyle(panel).transitionProperty).toBe("none");
    await animationsSettled();
    expect(panel.getBoundingClientRect().height).toBe(0);
  });

  it("keeps a closed panel as hidden=until-found with hiddenUntilFound and opens on beforematch", async () => {
    const screen = await render(<Keys panelProps={{ hiddenUntilFound: true }} />);
    const trigger = screen.getByRole("button", { name: "Recovery keys" });
    const panel = panelOf(screen.container);
    expect(panel.getAttribute("hidden")).toBe("until-found");
    expect(panel.querySelector("#keys")?.textContent).toBe("alien-bean-pasta");
    // What find-in-page does when it matches hidden content: the browser fires `beforematch`.
    panel.dispatchEvent(new Event("beforematch", { bubbles: true }));
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => panel.hasAttribute("hidden")).toBe(false);
    await expect.element(screen.getByText("alien-bean-pasta")).toBeVisible();
  });

  it("shows no outline on the trigger until Tab focus, in forced colors too", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(<Keys />);
    const trigger = screen.getByRole("button", { name: "Recovery keys" }).element();
    expect(getComputedStyle(trigger).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger);
    const style = getComputedStyle(trigger);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    const screen = await render(
      <div className="flex flex-col gap-4 bg-background p-4 text-foreground">
        <Keys defaultOpen />
        <Keys disabled />
        <Keys panelProps={{ hiddenUntilFound: true }} />
      </div>,
    );
    await animationsSettled();
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
