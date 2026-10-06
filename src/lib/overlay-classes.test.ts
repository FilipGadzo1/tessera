import { describe, expect, it } from "vitest";
import {
  backdropMotion,
  dialogMotion,
  menuItemBase,
  popupMotion,
  popupSurface,
} from "./overlay-classes";

describe("overlay classes (spec §2–§3)", () => {
  it("popupMotion is the anchored popup motion string", () => {
    expect(popupMotion).toBe(
      "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out data-starting-style:opacity-0 data-starting-style:scale-96 data-ending-style:opacity-0 data-ending-style:scale-96 motion-reduce:transition-none",
    );
  });

  it("dialogMotion is popupMotion without the transform origin", () => {
    expect(dialogMotion).toBe(
      "transition-[opacity,scale] duration-150 ease-out data-starting-style:opacity-0 data-starting-style:scale-96 data-ending-style:opacity-0 data-ending-style:scale-96 motion-reduce:transition-none",
    );
    expect(dialogMotion).not.toContain("origin-");
  });

  it("backdropMotion fades opacity only", () => {
    expect(backdropMotion).toBe(
      "transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none",
    );
  });

  it("popupSurface is the Popover/Menu surface base", () => {
    expect(popupSurface).toBe(
      "rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-hidden forced-colors:outline-none",
    );
  });

  it("menuItemBase is the menu item string with the forced-colors focus outline", () => {
    expect(menuItemBase).toBe(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 data-highlighted:outline-2 data-highlighted:outline-solid data-highlighted:outline-transparent data-highlighted:-outline-offset-2",
    );
  });
});
