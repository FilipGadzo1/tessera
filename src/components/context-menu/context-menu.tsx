"use client";

import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";
import { menuContentClasses, popupMotion, popupSurface } from "../../lib/overlay-classes";
import { useLayeredEscape } from "../../lib/tooltip-escape";
import { createTriggerDirection } from "../../lib/trigger-direction";

/** The menu (placement, ←/→ for submenus) follows the trigger area's DOM direction. */
const { TriggerDirectionProvider, useTriggerDirectionRef } = createTriggerDirection();

/**
 * The trigger has no single anchor item (the whole area opens the menu), so a fixed floor replaces
 * `MenuContent`'s `min-w-(--anchor-width)` (see spec ruling).
 */
const contextMenuContentBase = cn("min-w-32", menuContentClasses);

export type ContextMenuProps = BaseContextMenu.Root.Props;

/**
 * Groups a trigger area and its content. Renders no element. Controlled via `open` /
 * `onOpenChange`.
 */
export function ContextMenu({ onOpenChange, ...props }: ContextMenuProps) {
  const handleOpenChange = useLayeredEscape(onOpenChange);
  return (
    <TriggerDirectionProvider>
      <BaseContextMenu.Root {...props} onOpenChange={handleOpenChange} />
    </TriggerDirectionProvider>
  );
}

export type ContextMenuTriggerProps = BaseContextMenu.Trigger.Props;

/**
 * The area that opens the menu on right-click or long-press. Renders a `<div>` with no default
 * styling except `data-slot` and, while open, `data-popup-open` (a hook for the caller to style
 * it, e.g. a highlighted drop-zone). Base UI 1.8 has no keyboard opening for it (checked the
 * source: only `onContextMenu` / `onTouchStart` / `onTouchMove` are wired) — *Amended in Task 3*.
 */
export function ContextMenuTrigger({ ref, ...props }: ContextMenuTriggerProps) {
  const triggerRef = useTriggerDirectionRef(ref);
  return <BaseContextMenu.Trigger {...props} ref={triggerRef} data-slot="context-menu-trigger" />;
}

type PositionerProps = BaseContextMenu.Positioner.Props;

export interface ContextMenuContentProps extends BaseContextMenu.Popup.Props {
  /**
   * Element to portal into (default `document.body`). Pass an element inside a nested theme scope
   * (`data-primary`, `data-surface`, `.dark` on an inner element) so the menu inherits it.
   */
  container?: BaseContextMenu.Portal.Props["container"];
  /** Space kept between the menu and the viewport edges when colliding. */
  collisionPadding?: PositionerProps["collisionPadding"];
}

/**
 * The context menu panel (`role="menu"`, reusing Base UI's `Menu` popup): portalled and
 * positioned at the pointer (right-click) or long-press point. Its items are the Tessera `Menu`
 * parts — `MenuItem`, `MenuCheckboxItem`, `MenuRadioGroup`/`MenuRadioItem`, `MenuGroup`/
 * `MenuGroupLabel`, `MenuSeparator`, `MenuSub*` and `MenuShortcut` — unchanged (Base UI's
 * `ContextMenu.*` re-exports the same `Menu` item parts). It doesn't size to an anchor width
 * (`min-w-32` instead): the anchor is the whole trigger area, not one item.
 */
export function ContextMenuContent({
  collisionPadding,
  container,
  className,
  ...props
}: ContextMenuContentProps) {
  return (
    <BaseContextMenu.Portal container={container}>
      <BaseContextMenu.Positioner
        // Base UI's root-context-menu defaults (sideOffset -5, alignOffset 2) leave a gap meant
        // for an arrow this menu doesn't have; zero both so the popup's top-left sits at the
        // pointer, per spec.
        sideOffset={0}
        alignOffset={0}
        collisionPadding={collisionPadding}
        className="z-(--z-overlay)"
      >
        <BaseContextMenu.Popup
          {...props}
          data-slot="context-menu-content"
          className={mergeClassName(
            cn(popupMotion, popupSurface, contextMenuContentBase),
            className,
          )}
        />
      </BaseContextMenu.Positioner>
    </BaseContextMenu.Portal>
  );
}
