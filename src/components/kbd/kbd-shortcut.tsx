"use client";

import { cn } from "../../lib/cn";
import { useModifierKeyLabel } from "../../lib/use-modifier-key-label";
import { Kbd, type KbdGroupProps, kbdGroupBase } from "./kbd";

export interface KbdShortcutProps extends KbdGroupProps {
  /** The shortcut as `modifier+key` (`"mod+k"`; `mod` is ⌘ on Apple platforms, Ctrl elsewhere). */
  shortcut: string;
  /**
   * Localises a key's English name: the spoken name of a symbol key ("Command" for ⌘, "Shift"
   * for ⇧), or the text of a text key ("Ctrl", "Space"). @default the name unchanged
   */
  keyName?: (name: string) => string;
}

const identity = (name: string) => name;

/**
 * A shortcut labelled for the platform, one `Kbd` per key with no "+" between them: ⌘ K on a Mac,
 * Ctrl K elsewhere (the server and the hydration render say Ctrl). A symbol key shows its glyph to
 * sighted users and its name ("Command") to screen readers and as a `title`, so a standalone
 * shortcut reads "Command K". Inside a control, make it `aria-hidden` and put
 * `aria-keyshortcuts={useModifierKeyLabel().aria(shortcut)}` on the control.
 */
export function KbdShortcut({
  shortcut,
  keyName = identity,
  className,
  ...props
}: KbdShortcutProps) {
  const { keys } = useModifierKeyLabel();
  return (
    <kbd {...props} data-slot="kbd-shortcut" className={cn(kbdGroupBase, className)}>
      {keys(shortcut).map(({ glyph, name }, index) => {
        const label = keyName(name);
        // Keys are positional and the list never reorders.
        const key = `${index}-${glyph}`;
        if (glyph === name) return <Kbd key={key}>{label}</Kbd>;
        return (
          <Kbd key={key} title={label}>
            <span aria-hidden="true" data-slot="kbd-glyph">
              {glyph}
            </span>
            <span className="sr-only">{label}</span>
          </Kbd>
        );
      })}
    </kbd>
  );
}
