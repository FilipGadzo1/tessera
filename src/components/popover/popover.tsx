"use client";

import { Popover as BasePopover } from "@base-ui/react/popover";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";
import { popupMotion, popupSurface } from "../../lib/overlay-classes";
import { useLayeredEscape } from "../../lib/tooltip-escape";

const popoverContentBase = "w-72 p-4 flex flex-col gap-2";
const popoverTitleBase = "text-base font-semibold leading-snug";
const popoverDescriptionBase = "text-sm text-muted-foreground";

export type PopoverProps = BasePopover.Root.Props;

/** Groups a trigger and its content. Renders no element. Controlled via `open` / `onOpenChange`. */
export function Popover({ onOpenChange, ...props }: PopoverProps) {
  const handleOpenChange = useLayeredEscape(onOpenChange);
  return <BasePopover.Root {...props} onOpenChange={handleOpenChange} />;
}

export type PopoverTriggerProps = BasePopover.Trigger.Props;

/**
 * Toggles the popover on click, Enter or Space. Renders a `<button>` with no classes; compose a
 * styled trigger with `render={<Button variant="outline" />}`.
 */
export function PopoverTrigger(props: PopoverTriggerProps) {
  return <BasePopover.Trigger {...props} />;
}

type PositionerProps = BasePopover.Positioner.Props;

export interface PopoverContentProps extends BasePopover.Popup.Props {
  /** Side of the trigger to place the popover on (flips on collision). @default "bottom" */
  side?: PositionerProps["side"];
  /** Alignment against the trigger. @default "center" */
  align?: PositionerProps["align"];
  /** Distance from the trigger in px. @default 6 */
  sideOffset?: PositionerProps["sideOffset"];
  /** Offset along the alignment axis in px. @default 0 */
  alignOffset?: PositionerProps["alignOffset"];
  /** Space kept between the popover and the viewport edges when colliding. */
  collisionPadding?: PositionerProps["collisionPadding"];
  /**
   * Element to portal into (default `document.body`). Pass an element inside a nested theme scope
   * (`data-primary`, `data-surface`, `.dark` on an inner element) so the popover inherits it.
   */
  container?: BasePopover.Portal.Props["container"];
  /** The popup's `data-slot`; a component built on PopoverContent names its own part. @default "popover-content" */
  "data-slot"?: string;
}

/**
 * The popover panel (`role="dialog"`): portalled, positioned against the trigger, on the popover
 * surface. On open, focus moves to its first tabbable element (or the panel itself); on close it
 * returns to the trigger. Name it with `PopoverTitle` and describe it with `PopoverDescription`.
 */
export function PopoverContent({
  side = "bottom",
  align = "center",
  sideOffset = 6,
  alignOffset,
  collisionPadding,
  container,
  className,
  "data-slot": dataSlot = "popover-content",
  ...props
}: PopoverContentProps) {
  return (
    <BasePopover.Portal container={container}>
      <BasePopover.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        className="z-(--z-overlay)"
      >
        <BasePopover.Popup
          {...props}
          data-slot={dataSlot}
          className={mergeClassName(cn(popupMotion, popupSurface, popoverContentBase), className)}
        />
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

export type PopoverTitleProps = BasePopover.Title.Props;

/** The popover's heading (`<h2>`); labels the dialog via `aria-labelledby`. */
export function PopoverTitle({ className, ...props }: PopoverTitleProps) {
  return (
    <BasePopover.Title
      {...props}
      data-slot="popover-title"
      className={mergeClassName(popoverTitleBase, className)}
    />
  );
}

export type PopoverDescriptionProps = BasePopover.Description.Props;

/** Supporting text (`<p>`); describes the dialog via `aria-describedby`. */
export function PopoverDescription({ className, ...props }: PopoverDescriptionProps) {
  return (
    <BasePopover.Description
      {...props}
      data-slot="popover-description"
      className={mergeClassName(popoverDescriptionBase, className)}
    />
  );
}

export type PopoverCloseProps = BasePopover.Close.Props;

/** Closes the popover. Renders a `<button>` with no classes; compose with `render={<Button />}`. */
export function PopoverClose(props: PopoverCloseProps) {
  return <BasePopover.Close {...props} />;
}
