"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Menubar as BaseMenubar } from "@base-ui/react/menubar";
import { useRef } from "react";
import { barTriggerClasses } from "../../lib/bar-classes";
import { mergeClassName } from "../../lib/merge-class-name";
import { useElementDirection } from "../../lib/use-element-direction";
import { useMergedRefs } from "../../lib/use-merged-refs";
import { MenuTrigger, type MenuTriggerProps } from "../menu";

export interface MenubarProps extends BaseMenubar.Props {}

/**
 * An application menu bar (`role="menubar"`, Base UI `Menubar`). Put a `Menu` around each
 * `MenubarTrigger` + `MenuContent` pair; Base UI detects the bar, so `Menu` needs no extra prop.
 * ←/→ move between triggers, and with a menu open they switch to the neighbouring menu; hovering
 * another trigger while one is open switches menus too. Needs an accessible name (`aria-label`).
 */
export function Menubar({ className, ref, ...props }: MenubarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRootRef = useMergedRefs(rootRef, ref);
  const direction = useElementDirection(rootRef);
  return (
    <DirectionProvider direction={direction}>
      <BaseMenubar
        {...props}
        ref={setRootRef}
        data-slot="menubar"
        className={mergeClassName(
          "flex items-center gap-1 rounded-lg border border-border bg-background p-1 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
          className,
        )}
      />
    </DirectionProvider>
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
