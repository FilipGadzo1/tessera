"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";
import { mergeRefs } from "../../lib/merge-refs";
import { popupMotion } from "../../lib/overlay-classes";
import { registerOpenTooltip } from "../../lib/tooltip-escape";
import { createTriggerDirection } from "../../lib/trigger-direction";

/** The tooltip's placement follows the trigger's DOM direction. */
const { TriggerDirectionProvider, useTriggerDirectionRef } = createTriggerDirection();

/**
 * `--tooltip-border` is transparent in light mode (invisible normally, but painted in a system
 * colour in forced-colors mode, where the background and shadow are dropped and the bubble would
 * lose its edge) and a visible surface-600 in dark mode, where it outlines the raised chip.
 */
const tooltipContentBase =
  "rounded-md border border-tooltip-border bg-tooltip px-2 py-1 text-xs text-tooltip-foreground shadow-md max-w-xs text-balance";

/**
 * Base UI's tooltip is visual-only (no role, no aria-describedby). Tessera adds both: the content
 * reports its id here while its popup element is in the DOM, and the trigger references it.
 */
interface TooltipDescriptionContextValue {
  describedBy: string | undefined;
  setDescribedBy: (id: string | undefined) => void;
}

const TooltipDescriptionContext = createContext<TooltipDescriptionContextValue | null>(null);

export type TooltipProviderProps = BaseTooltip.Provider.Props;

/** Shares `delay` / `closeDelay` across tooltips; adjacent tooltips then open instantly. */
export function TooltipProvider(props: TooltipProviderProps) {
  return <BaseTooltip.Provider {...props} />;
}

export type TooltipProps = BaseTooltip.Root.Props;

/**
 * Groups a trigger and its content. Renders no element.
 *
 * Escape closes an open tooltip first, even inside a Tessera Dialog, AlertDialog, Popover, Menu,
 * MenuSub or Select:
 * the outer overlay stays open until the next Escape. The event is not swallowed; app `keydown`
 * listeners still receive it.
 */
export function Tooltip({ onOpenChange, ...props }: TooltipProps) {
  const [describedBy, setDescribedBy] = useState<string | undefined>(undefined);
  const context = useMemo(() => ({ describedBy, setDescribedBy }), [describedBy]);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(props.defaultOpen ?? false);
  const open = props.open ?? uncontrolledOpen;
  const lastEscapeRef = useRef<Event | null>(null);

  const handleOpenChange = useCallback<NonNullable<TooltipProps["onOpenChange"]>>(
    (nextOpen, eventDetails) => {
      if (!nextOpen && eventDetails.reason === "escape-key") {
        // Let Escape carry on to outer overlays (which yield to the tooltip, see
        // `useLayeredEscape`) and to app listeners. With the tooltip's trigger focused, Base UI
        // handles the same keydown on the trigger and again on `document`: close only once.
        eventDetails.allowPropagation();
        if (eventDetails.event === lastEscapeRef.current) {
          eventDetails.cancel();
          return;
        }
        lastEscapeRef.current = eventDetails.event;
      }
      onOpenChange?.(nextOpen, eventDetails);
      // Track the final state: a caller that cancels the change keeps the tooltip as it was, so
      // it must stay registered (or unregistered) for layered Escape.
      if (eventDetails.isCanceled) return;
      setUncontrolledOpen(nextOpen);
    },
    [onOpenChange],
  );

  // While open, outer Tessera overlays cancel their own Escape close (see `useLayeredEscape`).
  useEffect(() => {
    if (!open || props.disabled) return;
    return registerOpenTooltip();
  }, [open, props.disabled]);

  return (
    <TooltipDescriptionContext.Provider value={context}>
      <TriggerDirectionProvider>
        <BaseTooltip.Root {...props} onOpenChange={handleOpenChange} />
      </TriggerDirectionProvider>
    </TooltipDescriptionContext.Provider>
  );
}

export type TooltipTriggerProps = BaseTooltip.Trigger.Props;

/**
 * The element the tooltip describes. Renders a `<button>` with no classes; compose a styled
 * trigger with `render={<Button … />}`. Set `delay` (default 600 ms) and `closeDelay` here.
 */
export function TooltipTrigger({ render, ref, ...props }: TooltipTriggerProps) {
  const triggerRef = useTriggerDirectionRef(ref);
  const describedBy = useContext(TooltipDescriptionContext)?.describedBy;
  // An element `render` (e.g. `<Button aria-describedby="hint" />`) wins over the trigger's own
  // props when Base UI merges them, so read its aria-describedby too and write the merged list back.
  // A function-form `render` is not merged here; Base UI's own prop merging applies to it.
  const renderElement = isValidElement<{ "aria-describedby"?: string }>(render) ? render : null;
  const ids = [renderElement?.props["aria-describedby"], props["aria-describedby"], describedBy]
    .flatMap((value) => value?.split(/\s+/) ?? [])
    .filter(Boolean);
  const ariaDescribedBy = [...new Set(ids)].join(" ") || undefined;
  return (
    <BaseTooltip.Trigger
      {...props}
      ref={triggerRef}
      {...(ariaDescribedBy !== undefined && { "aria-describedby": ariaDescribedBy })}
      render={
        renderElement && ariaDescribedBy !== undefined
          ? cloneElement(renderElement, { "aria-describedby": ariaDescribedBy })
          : render
      }
    />
  );
}

type PositionerProps = BaseTooltip.Positioner.Props;

export interface TooltipContentProps extends BaseTooltip.Popup.Props {
  /** Side of the trigger to place the tooltip on (flips on collision). @default "top" */
  side?: PositionerProps["side"];
  /** Alignment against the trigger. @default "center" */
  align?: PositionerProps["align"];
  /** Distance from the trigger in px. @default 6 */
  sideOffset?: PositionerProps["sideOffset"];
  /** Offset along the alignment axis in px. @default 0 */
  alignOffset?: PositionerProps["alignOffset"];
  /** Space kept between the tooltip and the viewport edges when colliding. */
  collisionPadding?: PositionerProps["collisionPadding"];
  /**
   * Element to portal into (default `document.body`). Pass an element inside a nested theme scope
   * (`data-primary`, `data-surface`, `.dark` on an inner element) so the tooltip inherits it.
   */
  container?: BaseTooltip.Portal.Props["container"];
}

/** The tooltip bubble: portalled, positioned against the trigger, inverted neutral colours. */
export function TooltipContent({
  side = "top",
  align,
  sideOffset = 6,
  alignOffset,
  collisionPadding,
  container,
  className,
  ref,
  ...props
}: TooltipContentProps) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const setDescribedBy = useContext(TooltipDescriptionContext)?.setDescribedBy;
  // Keep the callback stable across renders (an inline caller ref must not re-trigger it). The
  // latest caller ref is stored in an insertion effect, not during render: insertion effects run
  // before refs attach, so a popup mounting in the same commit still reaches the newest ref.
  const callerRef = useRef(ref);
  useInsertionEffect(() => {
    callerRef.current = ref;
  });
  const describeRef = useCallback(
    (element: HTMLDivElement | null) => {
      setDescribedBy?.(element ? element.id : undefined);
    },
    [setDescribedBy],
  );
  const popupRef = useCallback(
    (element: HTMLDivElement | null) => mergeRefs(describeRef, callerRef.current)(element),
    [describeRef],
  );
  return (
    <BaseTooltip.Portal container={container}>
      <BaseTooltip.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        className="z-(--z-tooltip)"
      >
        <BaseTooltip.Popup
          {...props}
          ref={popupRef}
          id={id}
          role="tooltip"
          data-slot="tooltip-content"
          className={mergeClassName(cn(popupMotion, tooltipContentBase), className)}
        />
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}
