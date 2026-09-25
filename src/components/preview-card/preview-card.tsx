"use client";

import { PreviewCard as BasePreviewCard } from "@base-ui/react/preview-card";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";
import { popupMotion, popupSurface } from "../../lib/overlay-classes";
import { useLayeredEscape } from "../../lib/tooltip-escape";

const previewCardContentBase = "w-72 p-4 text-sm";

export type PreviewCardProps = BasePreviewCard.Root.Props;

/**
 * Groups a trigger and its content. Renders no element. Base UI owns the open/close delays
 * (`delay` / `closeDelay` on the trigger). Controlled via `open` / `onOpenChange`.
 *
 * Escape closes an open preview card, unless a Tessera Tooltip nested inside it is open: the
 * tooltip's own Escape handling closes it first, and the card closes on the next Escape (see
 * `useLayeredEscape`).
 */
export function PreviewCard({ onOpenChange, ...props }: PreviewCardProps) {
  const handleOpenChange = useLayeredEscape(onOpenChange);
  return <BasePreviewCard.Root {...props} onOpenChange={handleOpenChange} />;
}

export type PreviewCardTriggerProps = BasePreviewCard.Trigger.Props;

/**
 * The link the card previews. Renders an `<a>` with no classes; style it as a caller would style
 * any link, or compose a styled trigger with `render`. Opens on hover after `delay` (default
 * 600ms) and on keyboard focus; closes after `closeDelay` (default 300ms) on unhover, or
 * immediately on blur / Escape.
 */
export function PreviewCardTrigger(props: PreviewCardTriggerProps) {
  return <BasePreviewCard.Trigger {...props} />;
}

type PositionerProps = BasePreviewCard.Positioner.Props;

export interface PreviewCardContentProps extends BasePreviewCard.Popup.Props {
  /** Side of the trigger to place the card on (flips on collision). @default "bottom" */
  side?: PositionerProps["side"];
  /** Alignment against the trigger. @default "center" */
  align?: PositionerProps["align"];
  /** Distance from the trigger in px. @default 8 */
  sideOffset?: PositionerProps["sideOffset"];
  /** Offset along the alignment axis in px. @default 0 */
  alignOffset?: PositionerProps["alignOffset"];
  /** Space kept between the card and the viewport edges when colliding. */
  collisionPadding?: PositionerProps["collisionPadding"];
  /**
   * Element to portal into (default `document.body`). Pass an element inside a nested theme scope
   * (`data-primary`, `data-surface`, `.dark` on an inner element) so the card inherits it.
   */
  container?: BasePreviewCard.Portal.Props["container"];
}

/**
 * The preview card panel: portalled, positioned against the trigger, on the popover surface. No
 * arrow (Tooltip has none either).
 */
export function PreviewCardContent({
  side = "bottom",
  align = "center",
  sideOffset = 8,
  alignOffset,
  collisionPadding,
  container,
  className,
  ...props
}: PreviewCardContentProps) {
  return (
    <BasePreviewCard.Portal container={container}>
      <BasePreviewCard.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        className="z-(--z-overlay)"
      >
        <BasePreviewCard.Popup
          {...props}
          data-slot="preview-card-content"
          className={mergeClassName(
            cn(popupMotion, popupSurface, previewCardContentBase),
            className,
          )}
        />
      </BasePreviewCard.Positioner>
    </BasePreviewCard.Portal>
  );
}
