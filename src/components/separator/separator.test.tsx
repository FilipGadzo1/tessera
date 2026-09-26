import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia, systemColor } from "../../../test/emulation";
import { Separator } from "./separator";

afterEach(async () => {
  await resetEmulatedMedia();
});

describe("Separator", () => {
  it("is decorative and horizontal by default", async () => {
    const screen = await render(<Separator data-testid="sep" />);
    const sep = screen.getByTestId("sep").element();
    expect(sep.tagName).toBe("DIV");
    expect(sep.getAttribute("role")).toBe("none");
    expect(sep.hasAttribute("aria-orientation")).toBe(false);
    expect(sep.getAttribute("data-slot")).toBe("separator");
    expect(sep.getAttribute("data-orientation")).toBe("horizontal");
    for (const cls of ["shrink-0", "bg-border", "h-px", "w-full"]) {
      expect(sep.classList).toContain(cls);
    }
    expect(sep.getBoundingClientRect().height).toBe(1);
  });

  it.each([
    ["horizontal", true, "none", null, ["h-px", "w-full"]],
    ["vertical", true, "none", null, ["w-px", "self-stretch"]],
    ["horizontal", false, "separator", "horizontal", ["h-px", "w-full"]],
    ["vertical", false, "separator", "vertical", ["w-px", "self-stretch"]],
  ] as const)(
    "orientation=%s decorative=%s renders role=%s aria-orientation=%s",
    async (orientation, decorative, role, ariaOrientation, classes) => {
      const screen = await render(
        <Separator data-testid="sep" orientation={orientation} decorative={decorative} />,
      );
      const sep = screen.getByTestId("sep").element();
      expect(sep.getAttribute("role")).toBe(role);
      expect(sep.getAttribute("aria-orientation")).toBe(ariaOrientation);
      expect(sep.getAttribute("data-orientation")).toBe(orientation);
      for (const cls of classes) expect(sep.classList).toContain(cls);
    },
  );

  it("stretches vertically inside a flex row", async () => {
    const screen = await render(
      <div className="flex h-10 items-center gap-2">
        <span>A</span>
        <Separator data-testid="sep" orientation="vertical" />
        <span>B</span>
      </div>,
    );
    const rect = screen.getByTestId("sep").element().getBoundingClientRect();
    expect(rect.width).toBe(1);
    expect(rect.height).toBe(40);
  });

  it("uses the border color token and follows .dark", async () => {
    const screen = await render(
      <div>
        <Separator data-testid="sep" />
        <div data-testid="ref" className="bg-border" />
      </div>,
    );
    const sep = screen.getByTestId("sep").element();
    const ref = screen.getByTestId("ref").element();
    const light = getComputedStyle(ref).backgroundColor;
    expect(getComputedStyle(sep).backgroundColor).toBe(light);
    document.documentElement.classList.add("dark");
    try {
      const dark = getComputedStyle(ref).backgroundColor;
      expect(dark).not.toBe(light);
      expect(getComputedStyle(sep).backgroundColor).toBe(dark);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });

  it("passes through props and merges className", async () => {
    const screen = await render(
      <Separator data-testid="sep" id="s1" className="my-4 bg-primary" />,
    );
    const sep = screen.getByTestId("sep").element();
    expect(sep.id).toBe("s1");
    expect(sep.classList).toContain("my-4");
    expect(sep.classList).toContain("bg-primary");
    expect(sep.classList).not.toContain("bg-border");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div
        className={
          theme === "dark"
            ? "dark bg-background p-4 text-foreground"
            : "bg-background p-4 text-foreground"
        }
      >
        <p>Account</p>
        <Separator />
        <p>Billing</p>
        <Separator decorative={false} />
        <div className="flex h-6 items-center gap-2">
          <span>Docs</span>
          <Separator orientation="vertical" decorative={false} />
          <span>Blog</span>
        </div>
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("stays visible in forced colors", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(<Separator data-testid="sep" />);
    const sep = screen.getByTestId("sep").element();
    const style = getComputedStyle(sep);
    expect(style.backgroundColor).toBe(systemColor("CanvasText"));
    expect(style.backgroundColor).not.toBe(systemColor("Canvas"));
  });
});
