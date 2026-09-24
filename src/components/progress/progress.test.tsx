import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Progress, ProgressLabel, ProgressValue } from "./progress";

const indicatorOf = (bar: Element) =>
  bar.querySelector('[data-slot="progress-indicator"]') as HTMLElement;
const trackOf = (bar: Element) => bar.querySelector('[data-slot="progress-track"]') as HTMLElement;

/** Resolves a CSS colour keyword (e.g. a system colour) to its computed rgb() string. */
function resolveColor(color: string) {
  const probe = document.createElement("div");
  probe.style.color = color;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

/**
 * Real media emulation through the Chrome DevTools Protocol (vitest/browser `cdp()`), so the
 * `motion-reduce:` / `forced-colors:` variants actually match. Reset after every test.
 */
const emulateMedia = (features: { name: string; value: string }[]) =>
  cdp().send("Emulation.setEmulatedMedia", { features });

afterEach(async () => {
  await emulateMedia([]);
});

describe("Progress", () => {
  it("renders a determinate progressbar with value, min and max", async () => {
    const screen = await render(<Progress value={40} aria-label="Upload" />);
    const bar = screen.getByRole("progressbar", { name: "Upload" });
    await expect.element(bar).toHaveAttribute("aria-valuenow", "40");
    await expect.element(bar).toHaveAttribute("aria-valuemin", "0");
    await expect.element(bar).toHaveAttribute("aria-valuemax", "100");
    await expect.element(bar).toHaveAttribute("data-slot", "progress");
    await expect.element(bar).toHaveAttribute("data-progressing");
    const track = trackOf(bar.element());
    const indicator = indicatorOf(bar.element());
    for (const cls of ["relative", "w-full", "overflow-hidden", "rounded-full", "bg-muted"]) {
      expect(track.classList).toContain(cls);
    }
    for (const cls of ["h-full", "rounded-full", "bg-tone", "transition-[width]"]) {
      expect(indicator.classList).toContain(cls);
    }
    expect(indicator.classList).not.toContain("w-1/3");
    expect(indicator.style.width).toBe("40%");
    await expect
      .poll(() => indicator.getBoundingClientRect().width / track.getBoundingClientRect().width)
      .toBeCloseTo(0.4, 2);
  });

  it("maps the value through min and max", async () => {
    const screen = await render(<Progress value={5} min={0} max={20} aria-label="Steps" />);
    const bar = screen.getByRole("progressbar", { name: "Steps" });
    await expect.element(bar).toHaveAttribute("aria-valuenow", "5");
    await expect.element(bar).toHaveAttribute("aria-valuemax", "20");
    expect(indicatorOf(bar.element()).style.width).toBe("25%");
  });

  it("marks completion", async () => {
    const screen = await render(<Progress value={100} aria-label="Done" />);
    await expect.element(screen.getByRole("progressbar")).toHaveAttribute("data-complete");
  });

  it("is indeterminate when value is null", async () => {
    const screen = await render(<Progress value={null} aria-label="Loading" />);
    const bar = screen.getByRole("progressbar", { name: "Loading" });
    await expect.element(bar).not.toHaveAttribute("aria-valuenow");
    await expect.element(bar).toHaveAttribute("data-indeterminate");
    const indicator = indicatorOf(bar.element());
    expect(indicator.classList).toContain("w-1/3");
    expect(indicator.classList).toContain("animate-[tsr-indeterminate_1.2s_ease-in-out_infinite]");
    expect(indicator.classList).toContain("motion-reduce:animate-none");
    expect(getComputedStyle(indicator).animationName).toBe("tsr-indeterminate");
    const keyframes = [...document.styleSheets].flatMap((sheet) =>
      [...sheet.cssRules].filter(
        (rule) => rule instanceof CSSKeyframesRule && rule.name === "tsr-indeterminate",
      ),
    );
    expect(keyframes.length).toBeGreaterThan(0);
  });

  it("is named by its ProgressLabel and shows the formatted value", async () => {
    const screen = await render(
      <Progress value={50}>
        <ProgressLabel>Uploading</ProgressLabel>
        <ProgressValue />
      </Progress>,
    );
    const bar = screen.getByRole("progressbar", { name: "Uploading" });
    await expect.element(bar).toBeInTheDocument();
    const label = screen.getByText("Uploading");
    await expect.element(label).toHaveAttribute("data-slot", "progress-label");
    expect(bar.element().getAttribute("aria-labelledby")).toBe(label.element().id);
    await expect.element(screen.getByText("50%")).toHaveAttribute("data-slot", "progress-value");
  });

  it("formats the value with `format`", async () => {
    const screen = await render(
      <Progress value={3} max={10} format={{ style: "unit", unit: "gigabyte" }} locale="en-US">
        <ProgressLabel>Storage</ProgressLabel>
        <ProgressValue />
      </Progress>,
    );
    await expect.element(screen.getByText("3 GB")).toBeInTheDocument();
  });

  it("defaults to the primary tone and applies other tones", async () => {
    const screen = await render(
      <div>
        <Progress value={50} aria-label="Default" />
        <Progress value={50} aria-label="Success" color="success" />
        <div data-testid="primary" className="bg-primary" />
        <div data-testid="success" className="bg-success" />
      </div>,
    );
    const def = screen.getByRole("progressbar", { name: "Default" });
    const success = screen.getByRole("progressbar", { name: "Success" });
    await expect.element(def).toHaveAttribute("data-color", "primary");
    await expect.element(def).toHaveClass("tone-primary");
    await expect.element(success).toHaveAttribute("data-color", "success");
    await expect.element(success).toHaveClass("tone-success");
    const bg = (testId: string) =>
      getComputedStyle(screen.getByTestId(testId).element()).backgroundColor;
    expect(bg("primary")).not.toBe(bg("success"));
    expect(getComputedStyle(indicatorOf(def.element())).backgroundColor).toBe(bg("primary"));
    expect(getComputedStyle(indicatorOf(success.element())).backgroundColor).toBe(bg("success"));
  });

  it.each([
    ["sm", "h-1.5", 6],
    ["md", "h-2", 8],
    ["lg", "h-3", 12],
  ] as const)("applies the %s size", async (size, cls, px) => {
    const screen = await render(<Progress value={30} size={size} aria-label="Bar" />);
    const bar = screen.getByRole("progressbar");
    await expect.element(bar).toHaveAttribute("data-size", size);
    const track = trackOf(bar.element());
    expect(track.classList).toContain(cls);
    expect(track.getBoundingClientRect().height).toBe(px);
    expect(indicatorOf(bar.element()).getBoundingClientRect().height).toBe(px);
  });

  it("defaults to the md size and merges className", async () => {
    const screen = await render(<Progress value={30} aria-label="Bar" className="max-w-40" />);
    const bar = screen.getByRole("progressbar");
    await expect.element(bar).toHaveAttribute("data-size", "md");
    await expect.element(bar).toHaveClass("max-w-40");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Progress value={64} color="success">
          <ProgressLabel>Storage used</ProgressLabel>
          <ProgressValue />
        </Progress>
        <Progress value={null} aria-label="Loading" />
        <Progress value={20} size="lg" color="danger" aria-label="Quota" />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("shows the indeterminate bar full-width and dimmed, not frozen at a value, under reduced motion", async () => {
    await emulateMedia([{ name: "prefers-reduced-motion", value: "reduce" }]);
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    const screen = await render(<Progress value={null} aria-label="Loading" />);
    const bar = screen.getByRole("progressbar", { name: "Loading" }).element();
    const indicator = indicatorOf(bar);
    const style = getComputedStyle(indicator);
    expect(style.animationName).toBe("none");
    expect(indicator.getBoundingClientRect().width).toBe(
      trackOf(bar).getBoundingClientRect().width,
    );
    expect(style.opacity).toBe("0.5");
  });

  it("keeps a determinate bar at full opacity and its value width under reduced motion", async () => {
    await emulateMedia([{ name: "prefers-reduced-motion", value: "reduce" }]);
    const screen = await render(<Progress value={40} aria-label="Upload" />);
    const bar = screen.getByRole("progressbar", { name: "Upload" }).element();
    const indicator = indicatorOf(bar);
    expect(getComputedStyle(indicator).opacity).toBe("1");
    expect(
      indicator.getBoundingClientRect().width / trackOf(bar).getBoundingClientRect().width,
    ).toBeCloseTo(0.4, 2);
  });

  it("keeps the track and indicator visible in forced colors", async () => {
    await emulateMedia([{ name: "forced-colors", value: "active" }]);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(<Progress value={40} aria-label="Upload" />);
    const bar = screen.getByRole("progressbar", { name: "Upload" }).element();
    const canvas = resolveColor("Canvas");
    const indicator = getComputedStyle(indicatorOf(bar));
    expect(indicator.backgroundColor).toBe(resolveColor("Highlight"));
    expect(indicator.backgroundColor).not.toBe(canvas);
    const track = getComputedStyle(trackOf(bar));
    expect(track.outlineStyle).toBe("solid");
    expect(track.outlineWidth).toBe("1px");
    expect(track.outlineColor).toBe(resolveColor("CanvasText"));
    expect(track.outlineColor).not.toBe(canvas);
  });
});
