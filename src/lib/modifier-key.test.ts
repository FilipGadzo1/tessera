import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ariaKeyShortcuts,
  formatShortcut,
  isApplePlatform,
  isEditable,
  matchesShortcut,
  parseShortcut,
  shortcutKeys,
} from "./modifier-key";

/** A stand-in `Navigator` with only the fields `isApplePlatform` reads. */
function fakeNavigator(platform: string, userAgentPlatform?: string) {
  return {
    platform,
    ...(userAgentPlatform === undefined ? {} : { userAgentData: { platform: userAgentPlatform } }),
  } as unknown as Navigator;
}

function keydown(key: string, init: KeyboardEventInit = {}) {
  return new KeyboardEvent("keydown", { key, ...init });
}

describe("isApplePlatform", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["MacIntel", undefined, true],
    ["iPhone", undefined, true],
    ["iPad", undefined, true],
    ["iPod touch", undefined, true],
    ["Win32", undefined, false],
    ["Linux x86_64", undefined, false],
    // `userAgentData.platform` wins over `navigator.platform` when present.
    ["Win32", "macOS", true],
    ["MacIntel", "Windows", false],
    ["MacIntel", "Linux", false],
  ] as const)("platform %s, userAgentData %s → %s", (platform, userAgentPlatform, expected) => {
    expect(isApplePlatform(fakeNavigator(platform, userAgentPlatform))).toBe(expected);
  });

  it("reads the global navigator by default", () => {
    // Chromium here runs on Windows or Linux.
    expect(isApplePlatform()).toBe(false);
    vi.stubGlobal("navigator", fakeNavigator("MacIntel"));
    expect(isApplePlatform()).toBe(true);
  });

  it("is false with no navigator (the server)", () => {
    vi.stubGlobal("navigator", undefined);
    expect(isApplePlatform()).toBe(false);
  });
});

describe("parseShortcut", () => {
  it.each([
    ["mod+k", { key: "k", mod: true, ctrl: false, meta: false, shift: false, alt: false }],
    ["ctrl+k", { key: "k", mod: false, ctrl: true, meta: false, shift: false, alt: false }],
    ["meta+k", { key: "k", mod: false, ctrl: false, meta: true, shift: false, alt: false }],
    ["cmd+k", { key: "k", mod: false, ctrl: false, meta: true, shift: false, alt: false }],
    ["shift+k", { key: "k", mod: false, ctrl: false, meta: false, shift: true, alt: false }],
    ["alt+k", { key: "k", mod: false, ctrl: false, meta: false, shift: false, alt: true }],
    ["Mod+Shift+P", { key: "p", mod: true, ctrl: false, meta: false, shift: true, alt: false }],
    ["k", { key: "k", mod: false, ctrl: false, meta: false, shift: false, alt: false }],
    // Only today's tokens: `control`, `option` and `command` are not modifiers.
    [
      "control+option+command+k",
      { key: "k", mod: false, ctrl: false, meta: false, shift: false, alt: false },
    ],
  ] as const)("%s", (shortcut, expected) => {
    expect(parseShortcut(shortcut)).toEqual(expected);
  });
});

describe("matchesShortcut", () => {
  it("mod is Ctrl off Apple and ⌘ on Apple", () => {
    const parsed = parseShortcut("mod+k");
    expect(matchesShortcut(keydown("k", { ctrlKey: true }), parsed, false)).toBe(true);
    expect(matchesShortcut(keydown("k", { metaKey: true }), parsed, false)).toBe(false);
    expect(matchesShortcut(keydown("k", { metaKey: true }), parsed, true)).toBe(true);
    expect(matchesShortcut(keydown("k", { ctrlKey: true }), parsed, true)).toBe(false);
  });

  it("defaults to the current platform", () => {
    expect(matchesShortcut(keydown("k", { ctrlKey: true }), parseShortcut("mod+k"))).toBe(true);
  });

  it("requires the exact modifiers", () => {
    const parsed = parseShortcut("mod+shift+p");
    expect(matchesShortcut(keydown("P", { ctrlKey: true, shiftKey: true }), parsed, false)).toBe(
      true,
    );
    expect(matchesShortcut(keydown("p", { ctrlKey: true }), parsed, false)).toBe(false);
    expect(
      matchesShortcut(keydown("P", { ctrlKey: true, shiftKey: true, altKey: true }), parsed, false),
    ).toBe(false);
  });

  it("explicit ctrl and meta do not follow the platform", () => {
    expect(matchesShortcut(keydown("k", { ctrlKey: true }), parseShortcut("ctrl+k"), true)).toBe(
      true,
    );
    expect(matchesShortcut(keydown("k", { metaKey: true }), parseShortcut("cmd+k"), false)).toBe(
      true,
    );
  });

  it("falls back to the physical key when Alt changes the character", () => {
    const event = keydown("˚", { altKey: true, ctrlKey: true, code: "KeyK" });
    expect(matchesShortcut(event, parseShortcut("mod+alt+k"), false)).toBe(true);
  });
});

describe("isEditable", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  function make(html: string) {
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.append(host);
    return host.firstElementChild as HTMLElement;
  }

  it.each([
    ['<input type="text">', true],
    ["<input>", true],
    ['<input type="search">', true],
    ['<input type="email">', true],
    ['<input type="number">', true],
    ['<input type="date">', true],
    ["<textarea></textarea>", true],
    ["<select></select>", true],
    ['<div contenteditable="true"></div>', true],
    ['<div role="textbox" tabindex="0"></div>', true],
    ['<div role="combobox" tabindex="0"></div>', true],
    ['<input type="button">', false],
    ['<input type="checkbox">', false],
    ['<input type="color">', false],
    ['<input type="file">', false],
    ['<input type="hidden">', false],
    ['<input type="image">', false],
    ['<input type="radio">', false],
    ['<input type="range">', false],
    ['<input type="reset">', false],
    ['<input type="submit">', false],
    ["<button>Go</button>", false],
    ['<div tabindex="0"></div>', false],
  ] as const)("%s → %s", (html, expected) => {
    expect(isEditable(make(html))).toBe(expected);
  });

  it("is false for null and non-elements", () => {
    expect(isEditable(null)).toBe(false);
    expect(isEditable(document)).toBe(false);
    expect(isEditable(window)).toBe(false);
  });
});

describe("shortcutKeys", () => {
  it("Apple: modifier symbols in ⌃ ⌥ ⇧ ⌘ order, with spoken names", () => {
    expect(shortcutKeys("mod+shift+k", { apple: true })).toEqual([
      { glyph: "⇧", name: "Shift" },
      { glyph: "⌘", name: "Command" },
      { glyph: "K", name: "K" },
    ]);
    expect(shortcutKeys("cmd+shift+alt+ctrl+k", { apple: true })).toEqual([
      { glyph: "⌃", name: "Control" },
      { glyph: "⌥", name: "Option" },
      { glyph: "⇧", name: "Shift" },
      { glyph: "⌘", name: "Command" },
      { glyph: "K", name: "K" },
    ]);
    expect(shortcutKeys("meta+k", { apple: true }).map((key) => key.glyph)).toEqual(["⌘", "K"]);
  });

  it("elsewhere: Ctrl, Alt, Shift, Meta, then the key (glyph and name equal)", () => {
    expect(shortcutKeys("mod+shift+k", { apple: false })).toEqual([
      { glyph: "Ctrl", name: "Ctrl" },
      { glyph: "Shift", name: "Shift" },
      { glyph: "K", name: "K" },
    ]);
    expect(shortcutKeys("meta+shift+alt+ctrl+k", { apple: false })).toEqual([
      { glyph: "Ctrl", name: "Ctrl" },
      { glyph: "Alt", name: "Alt" },
      { glyph: "Shift", name: "Shift" },
      { glyph: "Meta", name: "Meta" },
      { glyph: "K", name: "K" },
    ]);
  });

  it("mod with an explicit ctrl or meta shows the modifier once", () => {
    expect(shortcutKeys("mod+ctrl+k", { apple: false }).map((key) => key.glyph)).toEqual([
      "Ctrl",
      "K",
    ]);
    expect(shortcutKeys("mod+cmd+k", { apple: true }).map((key) => key.glyph)).toEqual(["⌘", "K"]);
  });

  it.each([
    ["enter", { glyph: "↵", name: "Enter" }, { glyph: "Enter", name: "Enter" }],
    ["escape", { glyph: "Esc", name: "Esc" }, { glyph: "Esc", name: "Esc" }],
    ["backspace", { glyph: "⌫", name: "Backspace" }, { glyph: "Backspace", name: "Backspace" }],
    ["delete", { glyph: "⌦", name: "Delete" }, { glyph: "Del", name: "Del" }],
    ["tab", { glyph: "⇥", name: "Tab" }, { glyph: "Tab", name: "Tab" }],
    ["space", { glyph: "Space", name: "Space" }, { glyph: "Space", name: "Space" }],
    ["arrowup", { glyph: "↑", name: "Up arrow" }, { glyph: "↑", name: "Up arrow" }],
    ["up", { glyph: "↑", name: "Up arrow" }, { glyph: "↑", name: "Up arrow" }],
    ["arrowdown", { glyph: "↓", name: "Down arrow" }, { glyph: "↓", name: "Down arrow" }],
    ["down", { glyph: "↓", name: "Down arrow" }, { glyph: "↓", name: "Down arrow" }],
    ["arrowleft", { glyph: "←", name: "Left arrow" }, { glyph: "←", name: "Left arrow" }],
    ["left", { glyph: "←", name: "Left arrow" }, { glyph: "←", name: "Left arrow" }],
    ["arrowright", { glyph: "→", name: "Right arrow" }, { glyph: "→", name: "Right arrow" }],
    ["right", { glyph: "→", name: "Right arrow" }, { glyph: "→", name: "Right arrow" }],
    ["b", { glyph: "B", name: "B" }, { glyph: "B", name: "B" }],
    ["F2", { glyph: "F2", name: "F2" }, { glyph: "F2", name: "F2" }],
    ["/", { glyph: "/", name: "/" }, { glyph: "/", name: "/" }],
    ["1", { glyph: "1", name: "1" }, { glyph: "1", name: "1" }],
  ] as const)("key %s", (key, apple, other) => {
    expect(shortcutKeys(key, { apple: true })).toEqual([apple]);
    expect(shortcutKeys(key, { apple: false })).toEqual([other]);
  });
});

describe("formatShortcut", () => {
  it.each([
    ["mod+shift+k", "⇧⌘K", "Ctrl+Shift+K"],
    ["mod+b", "⌘B", "Ctrl+B"],
    ["mod+enter", "⌘↵", "Ctrl+Enter"],
    ["shift+mod+z", "⇧⌘Z", "Ctrl+Shift+Z"],
    ["F2", "F2", "F2"],
  ] as const)("%s → %s / %s", (shortcut, apple, other) => {
    expect(formatShortcut(shortcut, { apple: true })).toBe(apple);
    expect(formatShortcut(shortcut, { apple: false })).toBe(other);
  });
});

describe("ariaKeyShortcuts", () => {
  it.each([
    ["mod+s", "Meta+S", "Control+S"],
    ["mod+shift+k", "Shift+Meta+K", "Control+Shift+K"],
    ["ctrl+alt+k", "Control+Alt+K", "Control+Alt+K"],
    ["cmd+k", "Meta+K", "Meta+K"],
    ["mod+enter", "Meta+Enter", "Control+Enter"],
    ["escape", "Escape", "Escape"],
    ["delete", "Delete", "Delete"],
    ["space", "Space", "Space"],
    ["up", "ArrowUp", "ArrowUp"],
    ["arrowleft", "ArrowLeft", "ArrowLeft"],
    ["F2", "F2", "F2"],
  ] as const)("%s → %s / %s", (shortcut, apple, other) => {
    expect(ariaKeyShortcuts(shortcut, { apple: true })).toBe(apple);
    expect(ariaKeyShortcuts(shortcut, { apple: false })).toBe(other);
  });
});
