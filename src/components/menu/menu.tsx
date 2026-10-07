"use client";

import { useDirection } from "@base-ui/react/direction-provider";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import { CheckIcon, ChevronRightIcon, DotIcon } from "../../lib/icons";
import { mergeClassName } from "../../lib/merge-class-name";
import {
  menuContentClasses,
  menuItemBase,
  popupMotion,
  popupSurface,
} from "../../lib/overlay-classes";
import { useLayeredEscape } from "../../lib/tooltip-escape";
import { createTriggerDirection, usePopupDirection } from "../../lib/trigger-direction";
import { useModifierKeyLabel } from "../../lib/use-modifier-key-label";

/**
 * The menu (placement, ←/→ for submenus, and the portalled popup's own `dir`) follows the
 * trigger's DOM direction.
 */
const { TriggerDirectionProvider, useTriggerDirectionRef } = createTriggerDirection();

const menuContentBase = cn("min-w-(--anchor-width)", menuContentClasses);
/**
 * A submenu's anchor is its trigger item, as wide as the parent menu: sizing to it would make
 * every short submenu as wide as its parent. It gets a fixed floor instead and grows to content.
 */
const menuSubContentBase = "min-w-32";
const menuItemVariantClasses = {
  default: "",
  danger:
    "text-danger data-highlighted:bg-danger-soft data-highlighted:text-danger-soft-foreground",
} as const;
const menuIndicatorItem = "ps-8";
const menuItemIndicatorBase = "absolute start-2 flex size-4 items-center justify-center";
const menuSubTriggerBase = "data-popup-open:bg-accent";
const menuSubTriggerChevron = "ms-auto";
const menuSeparatorBase = "-mx-1 my-1 h-px bg-border forced-colors:bg-[CanvasText]";
const menuGroupLabelBase = "px-2 py-1.5 text-xs font-medium text-muted-foreground";
/** `ps-4` keeps a gap before the hint when the item's text fills the menu's width. */
const menuShortcutBase = "ms-auto ps-4 text-xs text-muted-foreground";

export type MenuProps = BaseMenu.Root.Props;

/**
 * Groups a trigger and its content. Renders no element. Modal by default: outside pointer
 * interaction is blocked while open. Controlled via `open` / `onOpenChange`.
 */
export function Menu({ onOpenChange, ...props }: MenuProps) {
  const handleOpenChange = useLayeredEscape(onOpenChange);
  return (
    <TriggerDirectionProvider>
      <BaseMenu.Root {...props} onOpenChange={handleOpenChange} />
    </TriggerDirectionProvider>
  );
}

export type MenuTriggerProps = BaseMenu.Trigger.Props;

/**
 * Opens the menu on click, Enter, Space or ArrowDown. Renders a `<button>` with no classes;
 * compose a styled trigger with `render={<Button variant="outline" />}`. Its DOM direction is the
 * menu's (placement, and ←/→ for submenus).
 */
export function MenuTrigger({ ref, ...props }: MenuTriggerProps) {
  const triggerRef = useTriggerDirectionRef(ref);
  return <BaseMenu.Trigger {...props} ref={triggerRef} />;
}

type PositionerProps = BaseMenu.Positioner.Props;

interface MenuPositioningProps {
  /** Side of the anchor to place the menu on (flips on collision). */
  side?: PositionerProps["side"];
  /** Alignment against the anchor. */
  align?: PositionerProps["align"];
  /** Distance from the anchor in px. */
  sideOffset?: PositionerProps["sideOffset"];
  /** Offset along the alignment axis in px. */
  alignOffset?: PositionerProps["alignOffset"];
  /** Space kept between the menu and the viewport edges when colliding. */
  collisionPadding?: PositionerProps["collisionPadding"];
  /**
   * Element to portal into (default `document.body`). Pass an element inside a nested theme scope
   * (`data-primary`, `data-surface`, `.dark` on an inner element) so the menu inherits it.
   */
  container?: BaseMenu.Portal.Props["container"];
}

export interface MenuContentProps extends BaseMenu.Popup.Props, MenuPositioningProps {}

interface MenuPopupLayerProps extends MenuContentProps {
  slot: string;
  /** Extra base classes after `menuContentBase` (merged, so they can override it). */
  baseClassName?: string;
}

function MenuPopupLayer({
  slot,
  baseClassName,
  side,
  align,
  sideOffset,
  alignOffset,
  collisionPadding,
  container,
  className,
  ...props
}: MenuPopupLayerProps) {
  // The root trigger's direction (a `MenuSub` shares its `Menu`'s or `ContextMenu`'s).
  const direction = usePopupDirection();
  return (
    <BaseMenu.Portal container={container}>
      <BaseMenu.Positioner
        dir={direction}
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        className="z-(--z-overlay)"
      >
        <BaseMenu.Popup
          {...props}
          data-slot={slot}
          className={mergeClassName(
            cn(popupMotion, popupSurface, menuContentBase, baseClassName),
            className,
          )}
        />
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

/**
 * The menu panel (`role="menu"`): portalled, positioned below the trigger (`side` "bottom",
 * `align` "start", `sideOffset` 6 by default), on the popover surface, scrolling when taller than
 * the viewport. The arrow keys move the highlight, typing jumps to a matching item, Escape closes
 * and focus returns to the trigger.
 */
export function MenuContent({
  side = "bottom",
  align = "start",
  sideOffset = 6,
  ...props
}: MenuContentProps) {
  return (
    <MenuPopupLayer
      slot="menu-content"
      side={side}
      align={align}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

export interface MenuItemProps extends BaseMenu.Item.Props {
  /** `danger` paints a destructive action in the danger colour. @default "default" */
  variant?: keyof typeof menuItemVariantClasses;
}

/**
 * An action (`role="menuitem"`). Clicking it or pressing Enter fires `onClick` and closes the menu
 * (keep it open with `closeOnClick={false}`). A `disabled` item stays reachable by the arrow keys,
 * as the WAI-ARIA menu pattern recommends, but cannot be activated.
 */
export function MenuItem({ variant = "default", className, ...props }: MenuItemProps) {
  return (
    <BaseMenu.Item
      {...props}
      data-slot="menu-item"
      className={mergeClassName(cn(menuItemBase, menuItemVariantClasses[variant]), className)}
    />
  );
}

export type MenuCheckboxItemProps = BaseMenu.CheckboxItem.Props;

/**
 * A toggle (`role="menuitemcheckbox"`, `aria-checked`) with a check mark in the leading slot.
 * The menu stays open on toggle. Controlled via `checked` / `onCheckedChange`.
 */
export function MenuCheckboxItem({ className, children, ...props }: MenuCheckboxItemProps) {
  return (
    <BaseMenu.CheckboxItem
      {...props}
      data-slot="menu-checkbox-item"
      className={mergeClassName(cn(menuItemBase, menuIndicatorItem), className)}
    >
      <BaseMenu.CheckboxItemIndicator
        data-slot="menu-item-indicator"
        className={menuItemIndicatorBase}
      >
        <CheckIcon />
      </BaseMenu.CheckboxItemIndicator>
      {children}
    </BaseMenu.CheckboxItem>
  );
}

export type MenuRadioGroupProps = BaseMenu.RadioGroup.Props;

/** Groups radio items; one can be selected. Controlled via `value` / `onValueChange`. */
export function MenuRadioGroup(props: MenuRadioGroupProps) {
  return <BaseMenu.RadioGroup {...props} data-slot="menu-radio-group" />;
}

export type MenuRadioItemProps = BaseMenu.RadioItem.Props;

/**
 * One choice in a `MenuRadioGroup` (`role="menuitemradio"`, `aria-checked`) with a dot in the
 * leading slot. The menu stays open on select.
 */
export function MenuRadioItem({ className, children, ...props }: MenuRadioItemProps) {
  return (
    <BaseMenu.RadioItem
      {...props}
      data-slot="menu-radio-item"
      className={mergeClassName(cn(menuItemBase, menuIndicatorItem), className)}
    >
      <BaseMenu.RadioItemIndicator
        data-slot="menu-item-indicator"
        className={menuItemIndicatorBase}
      >
        <DotIcon />
      </BaseMenu.RadioItemIndicator>
      {children}
    </BaseMenu.RadioItem>
  );
}

export type MenuGroupProps = BaseMenu.Group.Props;

/** Groups related items (`role="group"`); name it with a `MenuGroupLabel`. */
export function MenuGroup(props: MenuGroupProps) {
  return <BaseMenu.Group {...props} data-slot="menu-group" />;
}

export type MenuGroupLabelProps = BaseMenu.GroupLabel.Props;

/** A small muted heading that labels its `MenuGroup` (via `aria-labelledby`). */
export function MenuGroupLabel({ className, ...props }: MenuGroupLabelProps) {
  return (
    <BaseMenu.GroupLabel
      {...props}
      data-slot="menu-group-label"
      className={mergeClassName(menuGroupLabelBase, className)}
    />
  );
}

export type MenuSeparatorProps = BaseMenu.Separator.Props;

/** A hairline between groups of items (`role="separator"`). */
export function MenuSeparator({ className, ...props }: MenuSeparatorProps) {
  return (
    <BaseMenu.Separator
      {...props}
      data-slot="menu-separator"
      className={mergeClassName(menuSeparatorBase, className)}
    />
  );
}

export type MenuSubProps = BaseMenu.SubmenuRoot.Props;

/**
 * Groups a `MenuSubTrigger` and its `MenuSubContent`. Renders no element. It takes the direction
 * of its `Menu` (the root trigger's), not of the portalled popup it sits in.
 */
export function MenuSub({ onOpenChange, ...props }: MenuSubProps) {
  const handleOpenChange = useLayeredEscape(onOpenChange);
  return <BaseMenu.SubmenuRoot {...props} onOpenChange={handleOpenChange} />;
}

export type MenuSubTriggerProps = BaseMenu.SubmenuTrigger.Props;

/**
 * An item that opens a submenu (`aria-haspopup="menu"`), with a trailing chevron. Opens on hover,
 * click, Enter, Space or ArrowRight; ArrowLeft in the submenu closes it. Stays painted while its
 * submenu is open.
 */
export function MenuSubTrigger({ className, children, ...props }: MenuSubTriggerProps) {
  // Base UI's direction decides the side the submenu opens on (`inline-end`), so the chevron reads
  // it too and points there; an `rtl:` class would also match an RTL page above an LTR menu.
  const direction = useDirection();
  return (
    <BaseMenu.SubmenuTrigger
      {...props}
      data-slot="menu-sub-trigger"
      className={mergeClassName(cn(menuItemBase, menuSubTriggerBase), className)}
    >
      {children}
      <ChevronRightIcon
        className={cn(menuSubTriggerChevron, direction === "rtl" && "rotate-180")}
      />
    </BaseMenu.SubmenuTrigger>
  );
}

export type MenuSubContentProps = MenuContentProps;

/**
 * The submenu panel (`role="menu"`), styled like `MenuContent`. Placed beside its trigger
 * (Base UI's submenu defaults: `side` "inline-end", `align` "start"), with `sideOffset` 0 and
 * `alignOffset` -5 so its first item lines up with the trigger item (1px border + 4px padding).
 * Its minimum width is `min-w-32` rather than the anchor (trigger item) width, so a short submenu
 * stays narrower than its parent.
 */
export function MenuSubContent({
  sideOffset = 0,
  alignOffset = -5,
  ...props
}: MenuSubContentProps) {
  return (
    <MenuPopupLayer
      slot="menu-sub-content"
      baseClassName={menuSubContentBase}
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      {...props}
    />
  );
}

export interface MenuShortcutProps extends ComponentProps<"span"> {
  /**
   * A `modifier+key` shortcut (`"mod+e"`) shown for the platform when there are no `children`:
   * "⌘E" on Apple platforms, "Ctrl+E" elsewhere (and in server HTML).
   */
  shortcut?: string;
}

/**
 * A keyboard hint at the end of an item (plain `<span>`, no behaviour): `<MenuShortcut shortcut="mod+e" />`
 * ("⌘E" on a Mac, "Ctrl+E" elsewhere) or literal text, `<MenuShortcut>F2</MenuShortcut>`.
 * It is always `aria-hidden` so the hint stays out of the item's accessible name ("Rename…", not
 * "Rename…F2"). When the app really handles the key, expose it on the item instead:
 * `<MenuItem aria-keyshortcuts="F2">Rename…<MenuShortcut>F2</MenuShortcut></MenuItem>`.
 */
export function MenuShortcut({ shortcut, className, children, ...props }: MenuShortcutProps) {
  const { format } = useModifierKeyLabel();
  return (
    <span
      {...props}
      aria-hidden="true"
      data-slot="menu-shortcut"
      className={cn(menuShortcutBase, className)}
    >
      {children ?? (shortcut === undefined ? null : format(shortcut))}
    </span>
  );
}
