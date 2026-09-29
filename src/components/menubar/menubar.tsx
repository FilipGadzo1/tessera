"use client";

import { Menubar as BaseMenubar } from "@base-ui/react/menubar";
import { barTriggerClasses } from "../../lib/bar-classes";
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
      className={mergeClassName(barTriggerClasses, className)}
    />
  );
}
