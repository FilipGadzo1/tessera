import axe from "axe-core";
import type { ReactElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { render } from "vitest-browser-react";
import { emulateForcedColors, systemColor } from "../../../test/emulation";
import { restorePlatform, stubMac, stubWindows } from "../../../test/platform";
import { contrastRatio, type RGBA } from "../../lib/color";
import { Kbd, KbdGroup } from "./kbd";
import * as stories from "./kbd.stories";
import { KbdShortcut } from "./kbd-shortcut";

afterEach(() => {
  restorePlatform();
});

/** Resolves any CSS colour (oklch and color-mix included) to sRGB bytes and alpha via a canvas. */
function rgba(color: string): RGBA {
  const ctx = document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
}

function StoryView({ story }: { story: { args?: object; render?: unknown } }) {
  const Render = story.render as (args: object) => ReactElement;
  return <Render {...story.args} />;
}

const shortcutKbds = (root: ParentNode = document) =>
  Array.from(root.querySelectorAll<HTMLElement>("kbd[data-slot=kbd-shortcut] > kbd"));

describe("Kbd", () => {
  it("renders a kbd with data-slot and merges className and props", async () => {
    const screen = await render(
      <Kbd id="k1" className="px-2">
        Esc
      </Kbd>,
    );
    const kbd = screen.getByText("Esc").element() as HTMLElement;
    expect(kbd.tagName).toBe("KBD");
    expect(kbd.dataset.slot).toBe("kbd");
    expect(kbd.id).toBe("k1");
    expect(kbd.classList).toContain("px-2");
    expect(kbd.classList).not.toContain("px-1");
    expect(kbd.classList).toContain("border-foreground/20");
  });

  it("KbdGroup nests kbd elements in a kbd", async () => {
    const screen = await render(
      <KbdGroup data-testid="group">
        <Kbd>Ctrl</Kbd>
        <Kbd>B</Kbd>
      </KbdGroup>,
    );
    const group = screen.getByTestId("group").element() as HTMLElement;
    expect(group.tagName).toBe("KBD");
    expect(group.dataset.slot).toBe("kbd-group");
    expect(Array.from(group.children).map((child) => child.tagName)).toEqual(["KBD", "KBD"]);
  });

  it.each(["light", "dark"] as const)(
    "the keycap border stands out from its background in the %s theme (≥ 1.4:1)",
    async (theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      onTestFinished(() => {
        document.documentElement.classList.remove("dark");
      });
      const screen = await render(<Kbd>K</Kbd>);
      const style = getComputedStyle(screen.getByText("K").element());
      // Computed colours are oklch() / color-mix() strings, which parseColor rejects: resolve them
      // to sRGB bytes (and alpha) through a canvas first.
      const border = rgba(style.borderTopColor);
      const background = rgba(style.backgroundColor);
      expect(background.a).toBe(1);
      expect(contrastRatio(border, background)).toBeGreaterThanOrEqual(1.4);
    },
  );

  it("has a CanvasText border in forced colors", async () => {
    const screen = await render(<Kbd>K</Kbd>);
    await emulateForcedColors(true);
    const kbd = screen.getByText("K").element() as HTMLElement;
    await expect.poll(() => getComputedStyle(kbd).borderTopColor).toBe(systemColor("CanvasText"));
    expect(getComputedStyle(kbd).borderTopStyle).toBe("solid");
  });
});

describe("KbdShortcut", () => {
  it("shows Ctrl and K as separate keys off Apple, with no plus", async () => {
    stubWindows();
    const screen = await render(<KbdShortcut shortcut="mod+k" />);
    const root = screen.container.querySelector("[data-slot=kbd-shortcut]") as HTMLElement;
    expect(root.tagName).toBe("KBD");
    const keys = shortcutKbds();
    expect(keys.map((key) => key.textContent)).toEqual(["Ctrl", "K"]);
    for (const key of keys) {
      expect(key.dataset.slot).toBe("kbd");
      expect(key.hasAttribute("title")).toBe(false);
    }
    expect(root.textContent).not.toContain("+");
  });

  it("separates the keys in the text (not 'CtrlK'), with no visible change", async () => {
    stubWindows();
    const screen = await render(<KbdShortcut shortcut="mod+shift+k" />);
    const root = screen.container.querySelector("[data-slot=kbd-shortcut]") as HTMLElement;
    expect(root.textContent).toMatch(/^Ctrl\sShift\sK$/);
    // The separator takes no space: keys sit exactly one flex gap apart.
    const [ctrl, shift] = shortcutKbds() as [HTMLElement, HTMLElement];
    const gap = shift.getBoundingClientRect().left - ctrl.getBoundingClientRect().right;
    expect(gap).toBeCloseTo(Number.parseFloat(getComputedStyle(root).columnGap), 3);
  });

  it("shows ⌘ with an sr-only name and title on Apple", async () => {
    stubMac();
    const screen = await render(<KbdShortcut shortcut="mod+k" />);
    const [command, k] = shortcutKbds();
    expect(command?.querySelector("[data-slot=kbd-glyph]")?.textContent).toBe("⌘");
    expect(command?.querySelector("[data-slot=kbd-glyph]")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(command?.querySelector(".sr-only")?.textContent).toBe("Command");
    expect(command?.title).toBe("Command");
    expect(k?.textContent).toBe("K");
    expect(screen.container.textContent).not.toContain("+");
  });

  it("keyName localises the spoken names", async () => {
    stubMac();
    const names: Record<string, string> = { Command: "Befehl", Shift: "Umschalt" };
    await render(<KbdShortcut shortcut="mod+shift+k" keyName={(name) => names[name] ?? name} />);
    const [shift, command, k] = shortcutKbds();
    expect(shift?.querySelector(".sr-only")?.textContent).toBe("Umschalt");
    expect(shift?.title).toBe("Umschalt");
    expect(command?.querySelector(".sr-only")?.textContent).toBe("Befehl");
    expect(command?.title).toBe("Befehl");
    expect(k?.textContent).toBe("K");
  });

  it("keyName localises text keys off Apple", async () => {
    stubWindows();
    await render(
      <KbdShortcut shortcut="mod+k" keyName={(name) => (name === "Ctrl" ? "Strg" : name)} />,
    );
    expect(shortcutKbds().map((key) => key.textContent)).toEqual(["Strg", "K"]);
  });

  it("reads left to right in an RTL page (Ctrl S, not S Ctrl), as does a KbdGroup", async () => {
    stubWindows();
    const screen = await render(
      <div dir="rtl">
        <KbdShortcut shortcut="mod+s" />
        <KbdGroup data-testid="group">
          <Kbd>Ctrl</Kbd>
          <Kbd>B</Kbd>
        </KbdGroup>
      </div>,
    );
    const [ctrl, s] = shortcutKbds() as [HTMLElement, HTMLElement];
    expect(ctrl.textContent).toBe("Ctrl");
    expect(ctrl.getBoundingClientRect().right).toBeLessThan(s.getBoundingClientRect().left);
    const root = screen.container.querySelector("[data-slot=kbd-shortcut]") as HTMLElement;
    expect(getComputedStyle(root).direction).toBe("ltr");
    const [groupCtrl, b] = Array.from(
      screen.getByTestId("group").element().children,
    ) as HTMLElement[];
    expect((groupCtrl as HTMLElement).getBoundingClientRect().right).toBeLessThan(
      (b as HTMLElement).getBoundingClientRect().left,
    );
  });

  it("a consumer's dir wins over the LTR default", async () => {
    stubWindows();
    const screen = await render(<KbdShortcut shortcut="mod+s" dir="rtl" />);
    const root = screen.container.querySelector("[data-slot=kbd-shortcut]") as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
  });

  it("takes no children (the keys come from shortcut)", () => {
    // @ts-expect-error `children` is not a KbdShortcut prop.
    const element = <KbdShortcut shortcut="mod+k">X</KbdShortcut>;
    expect(element.props.shortcut).toBe("mod+k");
  });

  it("passes props through and merges className", async () => {
    const screen = await render(<KbdShortcut shortcut="mod+k" aria-hidden className="ms-2" />);
    const root = screen.container.querySelector("[data-slot=kbd-shortcut]") as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.classList).toContain("ms-2");
    expect(root.classList).toContain("gap-1");
  });

  it("server HTML says Ctrl; hydration shows ⌘ with no recoverable error", async () => {
    stubMac();
    const html = renderToString(<KbdShortcut shortcut="mod+k" />);
    expect(html).toContain("Ctrl");
    expect(html).not.toContain("⌘");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const root = hydrateRoot(container, <KbdShortcut shortcut="mod+k" />, { onRecoverableError });
    try {
      await expect
        .poll(() => container.querySelector("[data-slot=kbd-glyph]")?.textContent)
        .toBe("⌘");
      expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      root.unmount();
      container.remove();
    }
  });
});

describe("Kbd stories", () => {
  const all = () => (
    <>
      <StoryView story={stories.Basic} />
      <StoryView story={stories.Group} />
      <StoryView story={stories.Shortcut} />
      <StoryView story={stories.InAButton} />
    </>
  );

  it.each([
    ["light", false],
    ["dark", false],
    ["light", true],
    ["dark", true],
  ] as const)("has no axe violations in the %s theme (macOS stub: %s)", async (theme, mac) => {
    if (mac) stubMac();
    else stubWindows();
    const screen = await render(
      <div
        className={
          theme === "dark"
            ? "dark bg-background p-4 text-foreground"
            : "bg-background p-4 text-foreground"
        }
      >
        {all()}
      </div>,
    );
    if (mac) {
      await expect
        .poll(() => screen.container.querySelector("[data-slot=kbd-glyph]")?.textContent)
        .toBe("⌘");
    }
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    /*
     * axe cannot rate the contrast of a symbol-only glyph (⌘, ⇧, ↵): it reports "Element content
     * contains only non-text characters" as needs review. Exactly those entries are allowed; the
     * glyphs' contrast is checked below against a text key that axe does rate.
     */
    const glyphs = Array.from(
      screen.container.querySelectorAll<HTMLElement>("[data-slot=kbd-glyph]"),
    );
    const unexpected = results.incomplete.flatMap((result) =>
      result.nodes
        .filter(
          (node) =>
            !(
              result.id === "color-contrast" &&
              glyphs.some((glyph) => glyph.matches(String(node.target.at(-1)))) &&
              node.any.some((check) => check.data?.messageKey === "nonBmp")
            ),
        )
        .map((node) => `${result.id}: ${node.target}`),
    );
    expect(unexpected).toEqual([]);
    expect(glyphs.length > 0).toBe(mac);
    const textKey = Array.from(
      screen.container.querySelectorAll<HTMLElement>("[data-slot=kbd]"),
    ).find((key) => key.textContent === "K") as HTMLElement;
    for (const glyph of glyphs) {
      const kbd = glyph.closest("[data-slot=kbd]") as HTMLElement;
      expect(getComputedStyle(glyph).color).toBe(getComputedStyle(textKey).color);
      expect(getComputedStyle(kbd).backgroundColor).toBe(getComputedStyle(textKey).backgroundColor);
    }
  });

  it("In a Button: the hint is aria-hidden and the button carries aria-keyshortcuts", async () => {
    stubWindows();
    const screen = await render(<StoryView story={stories.InAButton} />);
    const button = screen.getByRole("button").element() as HTMLElement;
    expect(button.getAttribute("aria-keyshortcuts")).toBe("Control+K");
    expect(button.querySelector("[data-slot=kbd-shortcut]")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    await expect.element(screen.getByRole("button")).not.toHaveAccessibleName(/Ctrl/);
  });

  it("In a Button under the macOS stub: Meta+K", async () => {
    stubMac();
    const screen = await render(<StoryView story={stories.InAButton} />);
    await expect.element(screen.getByRole("button")).toHaveAttribute("aria-keyshortcuts", "Meta+K");
  });
});
