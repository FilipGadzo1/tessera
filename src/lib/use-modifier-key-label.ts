"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  ariaKeyShortcuts,
  formatShortcut,
  isApplePlatform,
  type ShortcutKey,
  shortcutKeys,
} from "./modifier-key";

export interface ModifierKeyLabel {
  /** Whether the platform is macOS or iOS. Always `false` on the server and while hydrating. */
  apple: boolean;
  /** The `mod` key's label: `"⌘"` on Apple platforms, `"Ctrl"` elsewhere. */
  mod: string;
  /** `formatShortcut` for the platform: `"⌘K"` / `"Ctrl+K"`. */
  format: (shortcut: string) => string;
  /** `shortcutKeys` for the platform: one `{ glyph, name }` per key. */
  keys: (shortcut: string) => ShortcutKey[];
  /** `ariaKeyShortcuts` for the platform: `"Meta+K"` / `"Control+K"`. */
  aria: (shortcut: string) => string;
}

// The platform never changes while the page is open.
const subscribeNever = () => () => {};
const getSnapshot = () => isApplePlatform();
const getServerSnapshot = () => false;

/**
 * Shortcut labels for the current platform. The server snapshot (and the hydration render) is
 * non-Apple, so server HTML says "Ctrl"; React re-renders with the client's platform right after
 * hydration, with no mismatch. A client-rendered app shows ⌘ on a Mac from the first paint.
 */
export function useModifierKeyLabel(): ModifierKeyLabel {
  const apple = useSyncExternalStore(subscribeNever, getSnapshot, getServerSnapshot);
  return useMemo(
    () => ({
      apple,
      mod: apple ? "⌘" : "Ctrl",
      format: (shortcut) => formatShortcut(shortcut, { apple }),
      keys: (shortcut) => shortcutKeys(shortcut, { apple }),
      aria: (shortcut) => ariaKeyShortcuts(shortcut, { apple }),
    }),
    [apple],
  );
}
