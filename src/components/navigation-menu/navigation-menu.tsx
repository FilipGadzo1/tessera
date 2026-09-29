"use client";

import { NavigationMenu as BaseNavigationMenu } from "@base-ui/react/navigation-menu";
import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { barTriggerClasses } from "../../lib/bar-classes";
import { cn } from "../../lib/cn";
import { toggleFocusClasses } from "../../lib/focus-classes";
import { ChevronDownIcon } from "../../lib/icons";
import { mergeClassName } from "../../lib/merge-class-name";
import { popupSurface } from "../../lib/overlay-classes";
import { yieldEscapeToTooltip } from "../../lib/tooltip-escape";

/**
 * Set by each NavigationMenu for its parts: whether its list is vertical (a vertical list stacks and
 * points its chevrons sideways) and whether the menu is nested inside another menu's content (its
 * viewport and content then render inline, without the panel's width and padding). A menu that
 * finds a parent context is itself nested.
 */
const MenuContext = createContext<{ vertical: boolean; nested: boolean } | null>(null);

/** True inside a `NavigationMenuContent`: links there use the panel style, not the bar style. */
const InPanelContext = createContext(false);

/** Base UI's `PATIENT_CLICK_THRESHOLD`: a click this soon after a hover-open keeps the panel. */
const PATIENT_CLICK_MS = 500;

/*
 * The positioner follows the active trigger; `before:` bridges the 8px gap so the pointer can
 * travel from the trigger into the panel without leaving the hover area.
 */
const positionerClasses =
  "z-(--z-overlay) h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-200 ease-out data-instant:transition-none motion-reduce:transition-none before:absolute before:content-[''] data-[side=bottom]:before:inset-x-0 data-[side=bottom]:before:-top-2 data-[side=bottom]:before:h-2 data-[side=right]:before:inset-y-0 data-[side=right]:before:-left-2 data-[side=right]:before:w-2";

/**
 * `popupSurface` sized by Base UI's `--popup-width` / `--popup-height`, so switching panels
 * animates the size; opens and closes like `popupMotion` (fade + scale from the trigger).
 */
const popupClasses = cn(
  popupSurface,
  "relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) transition-[opacity,scale,width,height] duration-200 ease-out data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:scale-96 data-ending-style:opacity-0 motion-reduce:transition-none",
);

const viewportClasses = "relative size-full overflow-hidden rounded-[inherit]";

const inlineViewportClasses = "relative overflow-hidden";

/*
 * Content fades and slides 1rem from the side of the newly activated trigger
 * (`data-activation-direction`); the outgoing panel leaves the opposite way. Under reduced motion
 * only the fade remains.
 */
const contentMotion =
  "transition-[opacity,translate] duration-200 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-opacity motion-safe:data-starting-style:data-[activation-direction=left]:-translate-x-4 motion-safe:data-starting-style:data-[activation-direction=right]:translate-x-4 motion-safe:data-ending-style:data-[activation-direction=left]:translate-x-4 motion-safe:data-ending-style:data-[activation-direction=right]:-translate-x-4 motion-safe:data-starting-style:data-[activation-direction=up]:-translate-y-4 motion-safe:data-starting-style:data-[activation-direction=down]:translate-y-4 motion-safe:data-ending-style:data-[activation-direction=up]:translate-y-4 motion-safe:data-ending-style:data-[activation-direction=down]:-translate-y-4";

export interface NavigationMenuProps extends BaseNavigationMenu.Root.Props {
  /**
   * Element to portal the panel into (default `document.body`). Pass an element inside a nested
   * theme scope so the panel inherits it. Ignored on a nested menu, whose panel renders inline.
   */
  container?: BaseNavigationMenu.Portal.Props["container"];
}

/**
 * Site navigation (`<nav>`; give it an `aria-label`). Write `NavigationMenuList` >
 * `NavigationMenuItem` > `NavigationMenuTrigger` + `NavigationMenuContent` (or a
 * `NavigationMenuLink`); the menu renders the popup itself, and each item's content shows in it.
 * A `NavigationMenu` inside a `NavigationMenuContent` is an inline submenu: its content renders
 * in the panel, beside its list when `orientation="vertical"` (a two-column grid) or below it
 * when horizontal, with no extra width or padding (give it a `defaultValue` so a sub-panel shows
 * at once).
 * Escape closes the open panel (a Tessera Tooltip inside closes first) and focus returns to its
 * trigger.
 */
export function NavigationMenu({
  onValueChange,
  container,
  className,
  children,
  ...props
}: NavigationMenuProps) {
  const nested = useContext(MenuContext) != null;
  const vertical = props.orientation === "vertical";
  const menuContext = useMemo(() => ({ vertical, nested }), [vertical, nested]);
  const hoverOpenedAt = useRef(0);
  const handleValueChange = useCallback<NonNullable<NavigationMenuProps["onValueChange"]>>(
    (value, eventDetails) => {
      if (yieldEscapeToTooltip(value != null, eventDetails)) return;
      if (value != null && eventDetails.reason === "trigger-hover") {
        hoverOpenedAt.current = eventDetails.event.timeStamp;
      } else if (
        value == null &&
        eventDetails.reason === "trigger-press" &&
        eventDetails.event.timeStamp - hoverOpenedAt.current < PATIENT_CLICK_MS
      ) {
        // Base UI keeps a panel open when it is clicked just after hover opened it ("patient
        // click"), but not when hover *switched* to it from another panel: moving to a sibling
        // trigger and clicking it would close the menu. Apply the same rule to the switch.
        eventDetails.cancel();
        return;
      }
      onValueChange?.(value, eventDetails);
    },
    [onValueChange],
  );
  return (
    <BaseNavigationMenu.Root
      {...props}
      onValueChange={handleValueChange}
      data-slot="navigation-menu"
      className={mergeClassName(
        cn(
          "relative",
          nested &&
            (vertical ? "grid grid-cols-[auto_minmax(0,1fr)] gap-2" : "flex flex-col gap-2"),
        ),
        className,
      )}
    >
      <MenuContext.Provider value={menuContext}>{children}</MenuContext.Provider>
      {nested ? (
        <BaseNavigationMenu.Viewport
          data-slot="navigation-menu-viewport"
          className={inlineViewportClasses}
        />
      ) : (
        <BaseNavigationMenu.Portal container={container}>
          <BaseNavigationMenu.Positioner
            side={vertical ? "right" : "bottom"}
            sideOffset={8}
            collisionPadding={16}
            data-slot="navigation-menu-positioner"
            className={positionerClasses}
          >
            <BaseNavigationMenu.Popup data-slot="navigation-menu-popup" className={popupClasses}>
              <BaseNavigationMenu.Viewport
                data-slot="navigation-menu-viewport"
                className={viewportClasses}
              />
            </BaseNavigationMenu.Popup>
          </BaseNavigationMenu.Positioner>
        </BaseNavigationMenu.Portal>
      )}
    </BaseNavigationMenu.Root>
  );
}

export interface NavigationMenuListProps extends BaseNavigationMenu.List.Props {}

/** The row of items (`<ul>`); a column when the menu's `orientation` is vertical. */
export function NavigationMenuList({ className, ...props }: NavigationMenuListProps) {
  const vertical = useContext(MenuContext)?.vertical;
  return (
    <BaseNavigationMenu.List
      {...props}
      data-slot="navigation-menu-list"
      className={mergeClassName(
        cn("flex items-center gap-1", vertical && "flex-col items-stretch"),
        className,
      )}
    />
  );
}

export interface NavigationMenuItemProps extends BaseNavigationMenu.Item.Props {}

/** One entry (`<li>`): a trigger with its content, or a link. `value` names it for control. */
export function NavigationMenuItem(props: NavigationMenuItemProps) {
  return <BaseNavigationMenu.Item {...props} data-slot="navigation-menu-item" />;
}

export interface NavigationMenuTriggerProps extends BaseNavigationMenu.Trigger.Props {}

/**
 * Opens its item's content on click, Enter, Space, ArrowDown or hover (after the root's
 * `delay`). Styled like `MenubarTrigger`, with a chevron that turns while open (in a vertical
 * list it points towards the content instead, and the trigger fills the column).
 */
export function NavigationMenuTrigger({
  className,
  children,
  ...props
}: NavigationMenuTriggerProps) {
  const vertical = useContext(MenuContext)?.vertical;
  return (
    <BaseNavigationMenu.Trigger
      {...props}
      data-slot="navigation-menu-trigger"
      className={mergeClassName(
        cn(
          barTriggerClasses,
          "gap-1",
          vertical && "w-full justify-between",
        ),
        className,
      )}
    >
      {children}
      <BaseNavigationMenu.Icon
        data-slot="navigation-menu-icon"
        className={cn(
          "flex transition-transform duration-200 ease-out motion-reduce:transition-none",
          vertical ? "-rotate-90" : "data-popup-open:rotate-180",
        )}
      >
        <ChevronDownIcon className="size-4" />
      </BaseNavigationMenu.Icon>
    </BaseNavigationMenu.Trigger>
  );
}

export interface NavigationMenuContentProps extends BaseNavigationMenu.Content.Props {}

/**
 * The panel for its item; rendered into the menu's shared popup while the item is open. Slides
 * in from the side of the trigger it was reached from. In a nested menu it has no width or
 * padding of its own (the outer panel provides them).
 */
export function NavigationMenuContent({ className, ...props }: NavigationMenuContentProps) {
  const nested = useContext(MenuContext)?.nested;
  return (
    <InPanelContext.Provider value={true}>
      <BaseNavigationMenu.Content
        {...props}
        data-slot="navigation-menu-content"
        className={mergeClassName(
          cn(nested ? "w-full" : "w-full p-4 sm:w-[36rem]", contentMotion),
          className,
        )}
      />
    </InPanelContext.Provider>
  );
}

/** A link inside a panel: a padded card row. */
const panelLinkClasses = `block rounded-md p-3 text-sm not-data-disabled:hover:bg-muted data-active:font-medium data-active:text-foreground forced-colors:data-active:underline forced-colors:data-active:underline-offset-4 ${toggleFocusClasses} forced-colors:focus-visible:outline-[Highlight]`;

/**
 * A link directly in the bar: sized and weighted like `NavigationMenuTrigger`. The active page is
 * underlined (a non-colour marker, so it does not read as an open trigger's `bg-muted`, and it
 * holds in forced colors too).
 */
const barLinkClasses = `${barTriggerClasses} data-active:underline data-active:decoration-2 data-active:underline-offset-[6px] forced-colors:data-active:underline`;

export interface NavigationMenuLinkProps extends BaseNavigationMenu.Link.Props {}

/**
 * A real `<a>`. Directly in the list it looks like a trigger; inside a `NavigationMenuContent` it
 * is a padded row. `active` marks the current page (`aria-current="page"`): underlined in the bar;
 * medium weight in a panel (underlined in forced colors). For client-side routing pass the
 * router's link as `render`, e.g. `render={<NextLink href="/orders" />}`. `closeOnClick` closes
 * the menu on click.
 */
export function NavigationMenuLink({ className, ...props }: NavigationMenuLinkProps) {
  const inPanel = useContext(InPanelContext);
  const vertical = useContext(MenuContext)?.vertical;
  return (
    <BaseNavigationMenu.Link
      {...props}
      data-slot="navigation-menu-link"
      className={mergeClassName(
        inPanel ? panelLinkClasses : cn(barLinkClasses, vertical && "w-full"),
        className,
      )}
    />
  );
}
