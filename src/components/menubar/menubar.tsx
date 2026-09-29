"use client";

import { Menubar as BaseMenubar } from "@base-ui/react/menubar";
import { toggleFocusClasses } from "../../lib/focus-classes";
import { mergeClassName } from "../../lib/merge-class-name";
import { MenuTrigger, type MenuTriggerProps } from "../menu";

export interface MenubarProps extends BaseMenubar.Props {}

/**
 * An application menu bar (`role="menubar"`, Base UI `Menubar`). Put a `Menu` around each
 * `MenubarTrigger` + `MenuContent` pair; Base UI detects the bar, so `Menu` needs no extra prop.
 * ←/→ move between triggers, and with a menu open they switch to the neighbouring menu; hovering
 * another trigger while one is open switches menus too. Needs an accessible name (`aria-label`).
 */
export function Menubar({ className, ...props }: MenubarProps) {
  return (
    <BaseMenubar
      {...props}
      data-slot="menubar"
      className={mergeClassName(
        "flex items-center gap-1 rounded-lg border border-border bg-background p-1 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
        className,
      )}
    />
  );
}

export interface MenubarTriggerProps extends MenuTriggerProps {}

/** A `MenuTrigger` styled for the bar; painted while its menu is open. */
export function MenubarTrigger({ className, ...props }: MenubarTriggerProps) {
  return (
    <MenuTrigger
      {...props}
      data-slot="menubar-trigger"
      className={mergeClassName(
        `inline-flex h-8 cursor-pointer select-none items-center rounded-md px-3 text-sm font-medium not-data-disabled:not-data-popup-open:hover:bg-muted data-popup-open:bg-muted data-disabled:cursor-default data-disabled:opacity-50 ${toggleFocusClasses} forced-colors:focus-visible:outline-[Highlight] forced-colors:data-popup-open:bg-[Highlight] forced-colors:data-popup-open:text-[HighlightText] forced-colors:data-popup-open:forced-color-adjust-none`,
        className,
      )}
    />
  );
}
