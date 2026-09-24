"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { createContext, type Ref, useCallback, useContext, useId, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";
import { popupMotion } from "../../lib/overlay-classes";

const tooltipContentBase =
  "rounded-md bg-neutral px-2 py-1 text-xs text-neutral-foreground shadow-md max-w-xs text-balance";

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

/** Groups a trigger and its content. Renders no element. */
export function Tooltip(props: TooltipProps) {
  const [describedBy, setDescribedBy] = useState<string | undefined>(undefined);
  return (
    <TooltipDescriptionContext.Provider value={{ describedBy, setDescribedBy }}>
      <BaseTooltip.Root {...props} />
    </TooltipDescriptionContext.Provider>
  );
}

export type TooltipTriggerProps = BaseTooltip.Trigger.Props;

/**
 * The element the tooltip describes. Renders a `<button>` with no classes; compose a styled
 * trigger with `render={<Button … />}`. Set `delay` (default 600 ms) and `closeDelay` here.
 */
export function TooltipTrigger(props: TooltipTriggerProps) {
  const describedBy = useContext(TooltipDescriptionContext)?.describedBy;
  const ariaDescribedBy =
    [props["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <BaseTooltip.Trigger
      {...props}
      {...(ariaDescribedBy !== undefined && { "aria-describedby": ariaDescribedBy })}
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
  // Keep the callback stable across renders (an inline caller ref must not re-trigger it).
  const callerRef = useRef(ref);
  callerRef.current = ref;
  const popupRef = useCallback(
    (element: HTMLDivElement | null) => {
      setDescribedBy?.(element ? element.id : undefined);
      assignRef(callerRef.current, element);
    },
    [setDescribedBy],
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

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}
