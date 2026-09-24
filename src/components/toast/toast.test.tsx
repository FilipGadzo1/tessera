import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay } from "../../../test/overlay";
import { createToaster, Toaster, type ToasterProps, useToast } from "./toast";

type Api = ReturnType<typeof useToast>;

/** Renders a Toaster and hands back the `useToast()` API of a component inside it. */
async function renderToaster(props: ToasterProps = {}, extra?: ReactNode) {
  let api: Api | undefined;
  function Capture() {
    api = useToast();
    return null;
  }
  const screen = await render(
    <Toaster {...props}>
      <Capture />
      {extra}
    </Toaster>,
  );
  await expect.poll(() => api).toBeDefined();
  return { screen, toast: () => api as Api };
}

const viewport = () => document.body.querySelector<HTMLElement>('[data-slot="toaster"]');
const toasts = () => [...document.body.querySelectorAll<HTMLElement>('[data-slot="toast"]')];
const toastWith = (text: string) =>
  toasts().find((toast) => toast.textContent?.includes(text)) ?? null;
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Waits (polling, no fixed sleep) until nothing in the document is animating. */
async function animationsSettled() {
  await nextFrame();
  await expect.poll(() => document.getAnimations().length, { timeout: 3000 }).toBe(0);
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("Toast", () => {
  it("shows an added toast in a polite live region, with data-slot on every part", async () => {
    const { toast } = await renderToaster();
    toast().add({
      title: "Changes saved",
      description: "Your profile is up to date.",
      actionProps: { children: "Undo" },
    });
    await expect.poll(() => toastWith("Changes saved")).not.toBeNull();
    const region = viewport() as HTMLElement;
    expect(region.getAttribute("role")).toBe("region");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-label")).toBe("Notifications");
    const root = toastWith("Changes saved") as HTMLElement;
    expect(root.parentElement).toBe(region);
    for (const slot of [
      "toast-content",
      "toast-title",
      "toast-description",
      "toast-action",
      "toast-close",
    ]) {
      expect(root.querySelector(`[data-slot="${slot}"]`), slot).not.toBeNull();
    }
    expect(root.querySelector('[data-slot="toast-title"]')?.textContent).toBe("Changes saved");
    expect(root.querySelector('[data-slot="toast-description"]')?.textContent).toBe(
      "Your profile is up to date.",
    );
    // The toast is labelled and described by its title and description.
    expect(root.getAttribute("aria-labelledby")).toBe(
      root.querySelector('[data-slot="toast-title"]')?.id,
    );
    expect(root.getAttribute("aria-describedby")).toBe(
      root.querySelector('[data-slot="toast-description"]')?.id,
    );
  });

  it("dismisses the toast with its Close button", async () => {
    const { toast } = await renderToaster();
    toast().add({ title: "Invite sent", timeout: 0 });
    await expect.poll(() => toastWith("Invite sent")).not.toBeNull();
    // Base UI hides the Close button from assistive tech until the stack is expanded (hover or
    // keyboard focus) or the button itself has focus; hovering to click expands it.
    const close = (toastWith("Invite sent") as HTMLElement).querySelector(
      '[data-slot="toast-close"] button',
    ) as HTMLElement;
    expect(close.getAttribute("aria-hidden")).toBe("true");
    await userEvent.hover(page.elementLocator(close));
    await expect.poll(() => close.getAttribute("aria-hidden")).toBe("false");
    expect(close.getAttribute("aria-label")).toBe("Close");
    await userEvent.click(page.elementLocator(close));
    await expect.poll(() => toastWith("Invite sent")).toBeNull();
  });

  it("auto-dismisses after its timeout, and timeout 0 keeps it", async () => {
    const { toast } = await renderToaster();
    // The pointer must not rest on the viewport: hovering pauses the timers.
    toast().add({ title: "Sticky", timeout: 0 });
    toast().add({ title: "Brief", timeout: 200 });
    await expect.poll(() => toastWith("Brief")).not.toBeNull();
    await expect.poll(() => toastWith("Brief"), { timeout: 3000 }).toBeNull();
    // By now 200ms have passed several times over: the timeout-0 toast is still there.
    expect(toastWith("Sticky")).not.toBeNull();
  });

  it("uses the Toaster's timeout as the default", async () => {
    const { toast } = await renderToaster({ timeout: 200 });
    toast().add({ title: "Default timeout" });
    await expect.poll(() => toastWith("Default timeout")).not.toBeNull();
    await expect.poll(() => toastWith("Default timeout"), { timeout: 3000 }).toBeNull();
  });

  it("fires the action's onClick, rendered as an outline neutral small Button", async () => {
    const onClick = vi.fn();
    const { toast } = await renderToaster();
    toast().add({
      title: "Message archived",
      timeout: 0,
      actionProps: { children: "Undo", onClick },
    });
    await expect.poll(() => toastWith("Message archived")).not.toBeNull();
    const action = (toastWith("Message archived") as HTMLElement).querySelector(
      '[data-slot="toast-action"] button',
    ) as HTMLElement;
    expect(action.dataset.variant).toBe("outline");
    expect(action.dataset.color).toBe("neutral");
    expect(action.dataset.size).toBe("sm");
    expect(action.textContent).toBe("Undo");
    await userEvent.click(page.elementLocator(action));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the Close button as a ghost neutral icon-xs Button", async () => {
    const { toast } = await renderToaster();
    toast().add({ title: "Hello", timeout: 0 });
    await expect.poll(() => toastWith("Hello")).not.toBeNull();
    const close = (toastWith("Hello") as HTMLElement).querySelector(
      '[data-slot="toast-close"] button',
    ) as HTMLElement;
    expect(close.getAttribute("aria-label")).toBe("Close");
    expect(close.dataset.variant).toBe("ghost");
    expect(close.dataset.color).toBe("neutral");
    expect(close.dataset.size).toBe("icon-xs");
  });

  it("marks toasts beyond the limit data-limited (oldest first)", async () => {
    const { toast } = await renderToaster({ limit: 2 });
    for (const title of ["First", "Second", "Third"]) toast().add({ title, timeout: 0 });
    await expect.poll(() => toasts().length).toBe(3);
    await expect.poll(() => toastWith("First")?.hasAttribute("data-limited")).toBe(true);
    expect(toastWith("Second")?.hasAttribute("data-limited")).toBe(false);
    expect(toastWith("Third")?.hasAttribute("data-limited")).toBe(false);
    // A limited toast is inert, so its buttons can't be reached.
    expect(toastWith("First")?.hasAttribute("inert")).toBe(true);
  });

  describe("type", () => {
    it.each([
      ["success", "tone-success"],
      ["warning", "tone-warning"],
      ["danger", "tone-danger"],
      ["info", "tone-info"],
      // Base UI's `promise()` marks a rejected promise's toast `error`.
      ["error", "tone-danger"],
    ])("%s sets the %s tone, a left accent and a tone-coloured icon", async (type, tone) => {
      const { screen, toast } = await renderToaster(
        {},
        <span data-testid="ref" className={`${tone} border-l-4 border-l-tone text-tone-ink`} />,
      );
      toast().add({ title: `A ${type} toast`, type, timeout: 0 });
      await expect.poll(() => toastWith(`A ${type} toast`)).not.toBeNull();
      const root = toastWith(`A ${type} toast`) as HTMLElement;
      expect(root.dataset.type).toBe(type);
      expect(root.classList.contains(tone)).toBe(true);
      expect(root.classList.contains("border-l-4")).toBe(true);
      const icon = root.querySelector('[data-slot="toast-icon"]') as SVGElement;
      expect(icon).not.toBeNull();
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      // The icon uses the tone's ink, the accent its line colour (a reference in the same tone).
      const ref = screen.getByTestId("ref").element();
      expect(getComputedStyle(icon).color).toBe(getComputedStyle(ref).color);
      expect(getComputedStyle(root).borderLeftColor).toBe(getComputedStyle(ref).borderLeftColor);
      expect(getComputedStyle(root).borderLeftWidth).toBe("4px");
    });

    it("default has no accent and no icon", async () => {
      const { toast } = await renderToaster();
      toast().add({ title: "Plain", timeout: 0 });
      await expect.poll(() => toastWith("Plain")).not.toBeNull();
      const root = toastWith("Plain") as HTMLElement;
      expect(root.classList.contains("border-l-4")).toBe(false);
      expect(getComputedStyle(root).borderLeftWidth).toBe("1px");
      expect(root.querySelector('[data-slot="toast-icon"]')).toBeNull();
    });

    it("promise() shows a spinner while loading, then the success type", async () => {
      const { toast } = await renderToaster();
      let resolve: (value: string) => void = () => {};
      const pending = new Promise<string>((r) => {
        resolve = r;
      });
      toast().promise(pending, {
        loading: { title: "Uploading…", timeout: 0 },
        success: (name) => ({ title: `${name} uploaded`, timeout: 0 }),
        error: "Upload failed",
      });
      await expect.poll(() => toastWith("Uploading…")).not.toBeNull();
      const loading = toastWith("Uploading…") as HTMLElement;
      expect(loading.dataset.type).toBe("loading");
      const spinner = loading.querySelector('[data-slot="toast-icon"]') as SVGElement;
      expect(spinner.classList.contains("animate-spin")).toBe(true);
      expect(loading.classList.contains("border-l-4")).toBe(false);
      resolve("report.pdf");
      await expect.poll(() => toastWith("report.pdf uploaded")?.dataset.type).toBe("success");
      expect(toastWith("report.pdf uploaded")?.classList.contains("tone-success")).toBe(true);
    });
  });

  /*
   * Base UI announces `priority: "high"` toasts urgently: a visually hidden `role="alert"` copy of
   * the title and description, while the toast itself becomes a `role="alertdialog"` hidden from
   * the accessibility tree until focused (so it is not read twice). Base UI never raises the
   * priority by itself; Tessera's `useToast()` / `createToaster()` default a toast with an action
   * to `"high"`, since the user may need to act before it disappears.
   */
  describe("priority", () => {
    const alerts = () =>
      [...document.body.querySelectorAll('[role="alert"]')].map((alert) => alert.textContent);

    it("gives a toast with an action high-priority semantics", async () => {
      const { toast } = await renderToaster();
      toast().add({ title: "Connection lost", timeout: 0, actionProps: { children: "Retry" } });
      await expect.poll(() => toastWith("Connection lost")).not.toBeNull();
      const root = toastWith("Connection lost") as HTMLElement;
      expect(root.getAttribute("role")).toBe("alertdialog");
      expect(root.getAttribute("aria-hidden")).toBe("true");
      expect(alerts()).toEqual(["Connection lost"]);
    });

    it("drops aria-hidden on a high-priority toast once keyboard focus enters it", async () => {
      const { toast } = await renderToaster();
      toast().add({ title: "Connection lost", timeout: 0, actionProps: { children: "Retry" } });
      await expect.poll(() => toastWith("Connection lost")).not.toBeNull();
      const root = toastWith("Connection lost") as HTMLElement;
      expect(root.getAttribute("aria-hidden")).toBe("true");
      await userEvent.keyboard("{F6}");
      await userEvent.tab();
      await expect.poll(() => document.activeElement).toBe(root);
      await expect.poll(() => root.hasAttribute("aria-hidden")).toBe(false);
      // Focused, the duplicate alert is gone and the toast itself is read.
      expect(alerts()).toEqual([]);
    });

    it("leaves a toast without an action at low priority", async () => {
      const { toast } = await renderToaster();
      toast().add({ title: "Saved", timeout: 0 });
      await expect.poll(() => toastWith("Saved")).not.toBeNull();
      expect(toastWith("Saved")?.getAttribute("role")).toBe("dialog");
      expect(toastWith("Saved")?.hasAttribute("aria-hidden")).toBe(false);
      expect(alerts()).toEqual([]);
    });

    it("keeps an explicit priority", async () => {
      const { toast } = await renderToaster();
      toast().add({
        title: "Low with action",
        timeout: 0,
        priority: "low",
        actionProps: { children: "View" },
      });
      await expect.poll(() => toastWith("Low with action")).not.toBeNull();
      expect(toastWith("Low with action")?.getAttribute("role")).toBe("dialog");
      expect(alerts()).toEqual([]);
    });
  });

  it("createToaster() adds, updates and closes toasts from outside React", async () => {
    const toaster = createToaster();
    await render(<Toaster toastManager={toaster} />);
    await expect.poll(() => viewport()).not.toBeNull();
    // Plain calls, not from a component or an event handler.
    const id = toaster.add({ title: "Build started", timeout: 0 });
    await expect.poll(() => toastWith("Build started")).not.toBeNull();
    toaster.update(id, { title: "Build finished", type: "success" });
    await expect.poll(() => toastWith("Build finished")?.dataset.type).toBe("success");
    toaster.add({ title: "Deploy failed", timeout: 0, actionProps: { children: "Logs" } });
    await expect.poll(() => toastWith("Deploy failed")?.getAttribute("role")).toBe("alertdialog");
    toaster.close(id);
    await expect.poll(() => toastWith("Build finished")).toBeNull();
  });

  it("stacks above overlays and tooltips on --z-toast (70)", async () => {
    const { toast } = await renderToaster();
    toast().add({ title: "Layer", timeout: 0 });
    await expect.poll(() => viewport()).not.toBeNull();
    const style = getComputedStyle(viewport() as HTMLElement);
    expect(style.position).toBe("fixed");
    expect(style.zIndex).toBe("70");
  });

  describe("position", () => {
    it.each([
      ["bottom-right", "bottom", "right"],
      ["top-right", "top", "right"],
      ["bottom-center", "bottom", "center"],
      ["top-center", "top", "center"],
    ] as const)("%s places the viewport and its toasts there", async (position, edge, align) => {
      const { toast } = await renderToaster({ position });
      toast().add({ title: `At ${position}`, timeout: 0 });
      await expect.poll(() => toastWith(`At ${position}`)).not.toBeNull();
      await animationsSettled();
      const region = viewport() as HTMLElement;
      expect(region.dataset.position).toBe(position);
      const box = (toastWith(`At ${position}`) as HTMLElement).getBoundingClientRect();
      const { innerWidth, innerHeight } = window;
      if (edge === "bottom") expect(Math.round(innerHeight - box.bottom)).toBe(16);
      else expect(Math.round(box.top)).toBe(16);
      if (align === "right") expect(Math.round(innerWidth - box.right)).toBe(16);
      else expect(Math.abs(box.left + box.width / 2 - innerWidth / 2)).toBeLessThanOrEqual(1);
    });
  });

  describe("stacking", () => {
    it("peeks older toasts behind the front one, and spreads them out on hover", async () => {
      const { toast } = await renderToaster();
      for (const title of ["Oldest", "Middle", "Newest"]) {
        toast().add({ title, description: "Details for this toast.", timeout: 0 });
      }
      await expect.poll(() => toasts().length).toBe(3);
      await animationsSettled();
      const box = (title: string) => (toastWith(title) as HTMLElement).getBoundingClientRect();
      const content = (title: string) =>
        (toastWith(title) as HTMLElement).querySelector(
          '[data-slot="toast-content"]',
        ) as HTMLElement;
      // Collapsed: each older toast peeks out a little above the one in front, content hidden.
      expect(box("Middle").top).toBeLessThan(box("Newest").top);
      expect(box("Newest").top - box("Middle").top).toBeLessThan(20);
      expect(box("Oldest").top).toBeLessThan(box("Middle").top);
      expect(content("Middle").hasAttribute("data-behind")).toBe(true);
      expect(getComputedStyle(content("Middle")).opacity).toBe("0");
      expect(getComputedStyle(content("Newest")).opacity).toBe("1");
      // Hover expands the stack: no overlaps, a gap between toasts, all content visible.
      await userEvent.hover(page.getByText("Newest"));
      await expect.poll(() => toastWith("Newest")?.hasAttribute("data-expanded")).toBe(true);
      await animationsSettled();
      expect(box("Middle").bottom).toBeLessThanOrEqual(box("Newest").top - 8);
      expect(box("Oldest").bottom).toBeLessThanOrEqual(box("Middle").top - 8);
      expect(getComputedStyle(content("Middle")).opacity).toBe("1");
      await userEvent.unhover(page.getByText("Newest"));
    });
  });

  it("shows a solid 2px outline when a toast gets keyboard focus (F6, then Tab)", async () => {
    const { toast } = await renderToaster();
    toast().add({ title: "Focus me", timeout: 0 });
    await expect.poll(() => toastWith("Focus me")).not.toBeNull();
    const root = toastWith("Focus me") as HTMLElement;
    expect(getComputedStyle(root).outlineStyle).toBe("none");
    await userEvent.keyboard("{F6}");
    await expect.poll(() => document.activeElement).toBe(viewport());
    await userEvent.tab();
    await expect.poll(() => document.activeElement).toBe(root);
    const style = getComputedStyle(root);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it("merges className onto the viewport", async () => {
    const { toast } = await renderToaster({ className: "max-w-md" });
    toast().add({ title: "Wide", timeout: 0 });
    await expect.poll(() => viewport()).not.toBeNull();
    const region = viewport() as HTMLElement;
    expect(region.classList.contains("max-w-md")).toBe(true);
    expect(region.classList.contains("max-w-sm")).toBe(false);
    expect(region.classList.contains("fixed")).toBe(true);
  });

  /*
   * Real media emulation through the Chrome DevTools Protocol: the toast's `data-*`-keyed
   * transforms must not outrank the reduced-motion reset of its transition.
   */
  describe("under prefers-reduced-motion: reduce", () => {
    const emulate = (value: "reduce" | "") =>
      cdp().send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value }],
      });
    afterEach(async () => {
      await emulate("");
    });

    it("has no toast or content transition", async () => {
      await emulate("reduce");
      expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
      const { toast } = await renderToaster();
      toast().add({ title: "Still", timeout: 0 });
      toast().add({ title: "Front", timeout: 0 });
      await expect.poll(() => toasts().length).toBe(2);
      for (const root of toasts()) {
        expect(getComputedStyle(root).transitionProperty).toBe("none");
        const content = root.querySelector('[data-slot="toast-content"]') as HTMLElement;
        expect(getComputedStyle(content).transitionProperty).toBe("none");
      }
    });
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    try {
      const { toast } = await renderToaster({ limit: 10 });
      toast().add({ title: "Plain notice", description: "Nothing to worry about.", timeout: 0 });
      for (const type of ["success", "warning", "danger", "info"]) {
        toast().add({
          title: `A ${type} toast`,
          description: "With a description.",
          type,
          timeout: 0,
        });
      }
      toast().add({
        title: "Message archived",
        description: "It moved to the archive.",
        timeout: 0,
        actionProps: { children: "Undo" },
      });
      await expect.poll(() => toasts().length).toBe(6);
      // Expanded, so every toast is fully visible and measured at rest.
      await userEvent.hover(page.elementLocator(toastWith("Message archived") as HTMLElement));
      await expect.poll(() => viewport()?.hasAttribute("data-expanded")).toBe(true);
      await animationsSettled();
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      // Base UI keeps a high-priority toast `aria-hidden` (its visually hidden `role="alert"` copy
      // is what gets announced) yet focusable, and lifts `aria-hidden` as soon as keyboard focus
      // enters the viewport ("drops aria-hidden … keyboard focus" above). axe can't see that, so it
      // flags `aria-hidden-focus` for review on exactly those toasts; everything else must be clean.
      const highPriority = [...document.body.querySelectorAll('[data-slot="toast"]')].filter(
        (toast) => toast.getAttribute("role") === "alertdialog",
      );
      expect(highPriority).toHaveLength(1);
      expect(incomplete).toEqual(['aria-hidden-focus: div[role="alertdialog"]']);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });
});
