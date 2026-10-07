/*
 * Keyboard shortcuts as `modifier+key` strings (`"mod+k"`, `"mod+shift+p"`): parsing, matching a
 * keydown, and the platform's labels for showing them. Server-safe (no hooks); the React hook that
 * binds the labels to the platform is `useModifierKeyLabel` (`use-modifier-key-label.ts`).
 *
 * Modifier tokens (case-insensitive): `mod` (⌘ on Apple platforms, Ctrl elsewhere), `ctrl`,
 * `meta` / `cmd`, `shift`, `alt`. The last token is the key.
 */

/** A shortcut split into its key and modifiers (`parseShortcut`). */
export interface ParsedShortcut {
  /** The key, lower-cased (`"k"`, `"enter"`). */
  key: string;
  /** ⌘ on Apple platforms, Ctrl elsewhere. */
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

/** Splits a `modifier+key` shortcut (`"mod+shift+p"`) into its key and modifiers. */
export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts.pop() ?? "";
  const has = (name: string) => parts.includes(name);
  return {
    key,
    mod: has("mod"),
    ctrl: has("ctrl"),
    meta: has("meta") || has("cmd"),
    shift: has("shift"),
    alt: has("alt"),
  };
}

/**
 * Whether the platform is macOS or iOS (where `mod` is ⌘): `userAgentData.platform`, else
 * `navigator.platform`. `false` with no `navigator` (the server).
 */
export function isApplePlatform(
  nav: Navigator | undefined = typeof navigator === "undefined" ? undefined : navigator,
): boolean {
  if (!nav) return false;
  // `||`, not `??`: some Chromium contexts report an empty `userAgentData.platform`.
  const platform =
    (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    nav.platform;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Whether a keydown is exactly the shortcut (no extra modifiers). `mod` follows `apple`. */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ParsedShortcut,
  apple = isApplePlatform(),
): boolean {
  const ctrl = shortcut.ctrl || (shortcut.mod && !apple);
  const meta = shortcut.meta || (shortcut.mod && apple);
  if (event.ctrlKey !== ctrl || event.metaKey !== meta) return false;
  if (event.shiftKey !== shortcut.shift || event.altKey !== shortcut.alt) return false;
  // Chrome's autofill dispatches a `keydown` with no `key`.
  if (typeof event.key !== "string") return false;
  const key = event.key.toLowerCase();
  // With Alt (Option) held, `key` can be another character; fall back to the physical key.
  return key === shortcut.key || event.code.toLowerCase() === `key${shortcut.key}`;
}

const nonTextInputTypes = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Whether the target takes typing: a text input, textarea, select, contenteditable, or an ARIA textbox / combobox. */
export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target.matches("[role=textbox], [role=combobox]")) return true;
  return target instanceof HTMLInputElement && !nonTextInputTypes.has(target.type);
}

/** One key of a shortcut as shown: its `glyph`, and the English `name` a screen reader speaks. */
export interface ShortcutKey {
  glyph: string;
  /** The spoken name of a symbol glyph ("Command" for ⌘); equal to `glyph` for a text glyph. */
  name: string;
}

export interface ShortcutPlatformOptions {
  /** Whether to label for an Apple platform (`isApplePlatform()`). */
  apple: boolean;
}

const arrowKeys: Record<string, ShortcutKey & { aria: string }> = {
  up: { glyph: "↑", name: "Up arrow", aria: "ArrowUp" },
  down: { glyph: "↓", name: "Down arrow", aria: "ArrowDown" },
  left: { glyph: "←", name: "Left arrow", aria: "ArrowLeft" },
  right: { glyph: "→", name: "Right arrow", aria: "ArrowRight" },
};

/** The named keys: Apple glyph and name, the other platforms' label, and the `aria-keyshortcuts` value. */
const namedKeys: Record<string, { apple: ShortcutKey; other: string; aria: string }> = {
  enter: { apple: { glyph: "↵", name: "Enter" }, other: "Enter", aria: "Enter" },
  escape: { apple: { glyph: "Esc", name: "Esc" }, other: "Esc", aria: "Escape" },
  backspace: { apple: { glyph: "⌫", name: "Backspace" }, other: "Backspace", aria: "Backspace" },
  delete: { apple: { glyph: "⌦", name: "Delete" }, other: "Del", aria: "Delete" },
  tab: { apple: { glyph: "⇥", name: "Tab" }, other: "Tab", aria: "Tab" },
  space: { apple: { glyph: "Space", name: "Space" }, other: "Space", aria: "Space" },
};

/** The key token as typed (the parser lower-cases it), and its lower-cased form. */
function keyToken(shortcut: string) {
  const typed = shortcut.split("+").pop() ?? "";
  return { typed, lower: typed.toLowerCase() };
}

function arrowOf(lower: string) {
  return arrowKeys[lower.startsWith("arrow") ? lower.slice("arrow".length) : lower];
}

function keyLabel(shortcut: string, apple: boolean): ShortcutKey {
  const { typed, lower } = keyToken(shortcut);
  const arrow = arrowOf(lower);
  if (arrow) return { glyph: arrow.glyph, name: arrow.name };
  const named = namedKeys[lower];
  if (named) return apple ? named.apple : { glyph: named.other, name: named.other };
  const glyph = /^[a-z]$/i.test(typed) ? typed.toUpperCase() : typed;
  return { glyph, name: glyph };
}

/** Which modifiers a shortcut holds on the platform (`mod` resolved to ctrl or meta). */
function modifiersOf(shortcut: string, apple: boolean) {
  const parsed = parseShortcut(shortcut);
  return {
    ctrl: parsed.ctrl || (parsed.mod && !apple),
    alt: parsed.alt,
    shift: parsed.shift,
    meta: parsed.meta || (parsed.mod && apple),
  };
}

/**
 * The keys of a shortcut as shown on the platform, one entry per key (for a `KbdGroup`). Apple:
 * modifier symbols in Apple's order ⌃ ⌥ ⇧ ⌘, then the key (`"mod+shift+k"` → ⇧ ⌘ K). Elsewhere:
 * Ctrl, Alt, Shift, Meta, then the key (Ctrl Shift K). A letter key is upper-cased.
 */
export function shortcutKeys(shortcut: string, { apple }: ShortcutPlatformOptions): ShortcutKey[] {
  const { ctrl, alt, shift, meta } = modifiersOf(shortcut, apple);
  const keys: ShortcutKey[] = [];
  if (apple) {
    if (ctrl) keys.push({ glyph: "⌃", name: "Control" });
    if (alt) keys.push({ glyph: "⌥", name: "Option" });
    if (shift) keys.push({ glyph: "⇧", name: "Shift" });
    if (meta) keys.push({ glyph: "⌘", name: "Command" });
  } else {
    if (ctrl) keys.push({ glyph: "Ctrl", name: "Ctrl" });
    if (alt) keys.push({ glyph: "Alt", name: "Alt" });
    if (shift) keys.push({ glyph: "Shift", name: "Shift" });
    if (meta) keys.push({ glyph: "Meta", name: "Meta" });
  }
  keys.push(keyLabel(shortcut, apple));
  return keys;
}

/** The shortcut as one string of glyphs: `"⇧⌘K"` on Apple platforms, `"Ctrl+Shift+K"` elsewhere. */
export function formatShortcut(shortcut: string, options: ShortcutPlatformOptions): string {
  return shortcutKeys(shortcut, options)
    .map((key) => key.glyph)
    .join(options.apple ? "" : "+");
}

/**
 * The `aria-keyshortcuts` value of the platform's real binding: `"mod+s"` → `"Meta+S"` on Apple
 * platforms and `"Control+S"` elsewhere (`mod` follows the platform, as `matchesShortcut` does).
 */
export function ariaKeyShortcuts(shortcut: string, { apple }: ShortcutPlatformOptions): string {
  const { ctrl, alt, shift, meta } = modifiersOf(shortcut, apple);
  const parts: string[] = [];
  if (ctrl) parts.push("Control");
  if (alt) parts.push("Alt");
  if (shift) parts.push("Shift");
  if (meta) parts.push("Meta");
  const { typed, lower } = keyToken(shortcut);
  const key =
    arrowOf(lower)?.aria ??
    namedKeys[lower]?.aria ??
    (/^[a-z]$/i.test(typed) ? typed.toUpperCase() : typed);
  parts.push(key);
  return parts.join("+");
}
