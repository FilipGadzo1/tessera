"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import {
  cloneElement,
  createContext,
  isValidElement,
  type Ref,
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
import { popupMotion } from "../../lib/overlay-classes";

/**
 * The transparent border is invisible normally but painted in a system colour in forced-colors
 * mode, where the background and shadow are dropped and the bubble would lose its edge.
 */
const tooltipContentBase =
  "rounded-md border border-transparent bg-neutral px-2 py-1 text-xs text-neutral-foreground shadow-md max-w-xs text-balance";

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
 * Escape closes an open tooltip first, even inside another overlay (a Dialog, Popover or Menu):
 * the outer overlay stays open until the next Escape.
 */
export function Tooltip({ actionsRef, onOpenChange, ...props }: TooltipProps) {
  const [describedBy, setDescribedBy] = useState<string | undefined>(undefined);
  const context = useMemo(() => ({ describedBy, setDescribedBy }), [describedBy]);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(props.defaultOpen ?? false);
  const open = props.open ?? uncontrolledOpen;
  const ownActionsRef = useRef<BaseTooltip.Root.Actions | null>(null);
  const actions = actionsRef ?? ownActionsRef;

  const handleOpenChange = useCallback<NonNullable<TooltipProps["onOpenChange"]>>(
    (nextOpen, eventDetails) => {
      setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen, eventDetails);
    },
    [onOpenChange],
  );

  // Base UI's tooltip is not part of the floating tree that other overlays use to let the
  // innermost one handle Escape, and every overlay listens for Escape on `document`. With the
  // pointer resting on a trigger inside an open Dialog, one Escape would close the tooltip and
  // the dialog together (the dialog's listener was added first). So while the tooltip is open,
  // Escape is caught on `window` in the capture phase, before any `document` listener, and closes
  // only the tooltip. A keydown on the tooltip's own trigger (keyboard focus) is left to Base UI,
  // which already stops it from reaching the outer overlay.
  useEffect(() => {
    if (!open || props.disabled) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
      const target = event.target;
      const onOwnTrigger =
        target instanceof Element &&
        describedBy !== undefined &&
        (target.getAttribute("aria-describedby")?.split(/\s+/).includes(describedBy) ?? false);
      if (onOwnTrigger) return;
      event.stopPropagation();
      actions.current?.close();
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, props.disabled, describedBy, actions]);

  return (
    <TooltipDescriptionContext.Provider value={context}>
      <BaseTooltip.Root {...props} actionsRef={actions} onOpenChange={handleOpenChange} />
    </TooltipDescriptionContext.Provider>
  );
}

export type TooltipTriggerProps = BaseTooltip.Trigger.Props;

/**
 * The element the tooltip describes. Renders a `<button>` with no classes; compose a styled
 * trigger with `render={<Button … />}`. Set `delay` (default 600 ms) and `closeDelay` here.
 */
export function TooltipTrigger({ render, ...props }: TooltipTriggerProps) {
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
