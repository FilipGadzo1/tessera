import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
  systemColor,
} from "../../../test/emulation";
import { Skeleton } from "./skeleton";

afterEach(async () => {
  await resetEmulatedMedia();
});

describe("Skeleton", () => {
  it("is hidden from assistive technology and pulses", async () => {
    const screen = await render(<Skeleton data-testid="sk" />);
    const el = screen.getByTestId("sk").element();
    expect(el.tagName).toBe("DIV");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.getAttribute("data-slot")).toBe("skeleton");
    for (const cls of ["animate-pulse", "rounded-md", "bg-muted"]) {
      expect(el.classList).toContain(cls);
    }
  });

  it("is shaped and merges className", async () => {
    const screen = await render(<Skeleton data-testid="sk" className="size-12 rounded-full" />);
    const el = screen.getByTestId("sk").element();
    expect(el.classList).toContain("size-12");
    expect(el.classList).toContain("rounded-full");
    expect(el.classList).toContain("animate-pulse");
  });

  it("passes through props", async () => {
    const screen = await render(<Skeleton data-testid="sk" id="loading-row" />);
    expect(screen.getByTestId("sk").element().id).toBe("loading-row");
  });

  it("stops the pulse animation under reduced motion", async () => {
    await emulateReducedMotion(true);
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    const screen = await render(<Skeleton data-testid="sk" />);
    expect(getComputedStyle(screen.getByTestId("sk").element()).animationName).toBe("none");
  });

  it("animates under normal motion", async () => {
    const screen = await render(<Skeleton data-testid="sk" />);
    expect(getComputedStyle(screen.getByTestId("sk").element()).animationName).not.toBe("none");
  });

  it("uses a visible background in forced colors", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(<Skeleton data-testid="sk" />);
    const bg = getComputedStyle(screen.getByTestId("sk").element()).backgroundColor;
    expect(bg).toBe(systemColor("GrayText"));
    expect(bg).not.toBe(systemColor("Canvas"));
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-2 size-12 rounded-full" />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
