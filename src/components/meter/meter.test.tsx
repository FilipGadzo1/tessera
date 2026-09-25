import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
  systemColor,
} from "../../../test/emulation";
import { Meter, MeterLabel, MeterValue } from "./meter";

const indicatorOf = (meter: Element) =>
  meter.querySelector('[data-slot="meter-indicator"]') as HTMLElement;
const trackOf = (meter: Element) => meter.querySelector('[data-slot="meter-track"]') as HTMLElement;

afterEach(async () => {
  await resetEmulatedMedia();
});

describe("Meter", () => {
  it("renders a meter with value, min and max", async () => {
    const screen = await render(<Meter value={40} aria-label="Disk usage" />);
    const meter = screen.getByRole("meter", { name: "Disk usage" });
    await expect.element(meter).toHaveAttribute("aria-valuenow", "40");
    await expect.element(meter).toHaveAttribute("aria-valuemin", "0");
    await expect.element(meter).toHaveAttribute("aria-valuemax", "100");
    await expect.element(meter).toHaveAttribute("aria-valuetext");
    await expect.element(meter).toHaveAttribute("data-slot", "meter");
    const track = trackOf(meter.element());
    const indicator = indicatorOf(meter.element());
    for (const cls of ["relative", "w-full", "overflow-hidden", "rounded-full", "bg-muted"]) {
      expect(track.classList).toContain(cls);
    }
    for (const cls of ["h-full", "rounded-full", "bg-tone", "transition-[width]"]) {
      expect(indicator.classList).toContain(cls);
    }
    expect(indicator.style.width).toBe("40%");
    await expect
      .poll(() => indicator.getBoundingClientRect().width / track.getBoundingClientRect().width)
      .toBeCloseTo(0.4, 2);
  });

  it("maps the value through min and max", async () => {
    const screen = await render(<Meter value={5} min={0} max={20} aria-label="Steps" />);
    const meter = screen.getByRole("meter", { name: "Steps" });
    await expect.element(meter).toHaveAttribute("aria-valuenow", "5");
    await expect.element(meter).toHaveAttribute("aria-valuemax", "20");
    expect(indicatorOf(meter.element()).style.width).toBe("25%");
  });

  it("is named by its MeterLabel and shows the formatted value", async () => {
    const screen = await render(
      <Meter value={50}>
        <MeterLabel>Password strength</MeterLabel>
        <MeterValue />
      </Meter>,
    );
    const meter = screen.getByRole("meter", { name: "Password strength" });
    await expect.element(meter).toBeInTheDocument();
    const label = screen.getByText("Password strength");
    await expect.element(label).toHaveAttribute("data-slot", "meter-label");
    expect(meter.element().getAttribute("aria-labelledby")).toBe(label.element().id);
    await expect.element(screen.getByText("50%")).toHaveAttribute("data-slot", "meter-value");
  });

  it("formats the value and valuetext with `format`", async () => {
    const screen = await render(
      <Meter value={1240} max={2000} format={{ style: "unit", unit: "byte" }} locale="en-US">
        <MeterLabel>Characters</MeterLabel>
        <MeterValue />
      </Meter>,
    );
    const meter = screen.getByRole("meter");
    await expect.element(screen.getByText("1,240 byte")).toBeInTheDocument();
    await expect.element(meter).toHaveAttribute("aria-valuetext", "1,240 byte");
  });

  it("defaults to the primary tone and applies other tones", async () => {
    const screen = await render(
      <div>
        <Meter value={50} aria-label="Default" />
        <Meter value={50} aria-label="Success" color="success" />
        <div data-testid="primary" className="bg-primary" />
        <div data-testid="success" className="bg-success" />
      </div>,
    );
    const def = screen.getByRole("meter", { name: "Default" });
    const success = screen.getByRole("meter", { name: "Success" });
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
    const screen = await render(<Meter value={30} size={size} aria-label="Bar" />);
    const meter = screen.getByRole("meter");
    await expect.element(meter).toHaveAttribute("data-size", size);
    const track = trackOf(meter.element());
    expect(track.classList).toContain(cls);
    expect(track.getBoundingClientRect().height).toBe(px);
    expect(indicatorOf(meter.element()).getBoundingClientRect().height).toBe(px);
  });

  it("defaults to the md size and merges className", async () => {
    const screen = await render(<Meter value={30} aria-label="Bar" className="max-w-40" />);
    const meter = screen.getByRole("meter");
    await expect.element(meter).toHaveAttribute("data-size", "md");
    await expect.element(meter).toHaveClass("max-w-40");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Meter value={64} color="success">
          <MeterLabel>Disk used</MeterLabel>
          <MeterValue />
        </Meter>
        <Meter value={20} size="lg" color="danger" aria-label="Quota" />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("has no transition under reduced motion", async () => {
    await emulateReducedMotion(true);
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    const screen = await render(<Meter value={40} aria-label="Usage" />);
    const meter = screen.getByRole("meter", { name: "Usage" }).element();
    const indicator = indicatorOf(meter);
    expect(indicator.classList).toContain("motion-reduce:transition-none");
    expect(getComputedStyle(indicator).transitionProperty).toBe("none");
  });

  it("keeps the track and indicator visible in forced colors", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(<Meter value={40} aria-label="Usage" />);
    const meter = screen.getByRole("meter", { name: "Usage" }).element();
    const canvas = systemColor("Canvas");
    const indicator = getComputedStyle(indicatorOf(meter));
    expect(indicator.backgroundColor).toBe(systemColor("Highlight"));
    expect(indicator.backgroundColor).not.toBe(canvas);
    const track = getComputedStyle(trackOf(meter));
    expect(track.outlineStyle).toBe("solid");
    expect(track.outlineWidth).toBe("1px");
    expect(track.outlineColor).toBe(systemColor("CanvasText"));
    expect(track.outlineColor).not.toBe(canvas);
  });
});
