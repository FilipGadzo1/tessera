"use client";

import { Drawer as BaseDrawer } from "@base-ui/react/drawer";
import {
  type ComponentProps,
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { isRtl } from "../../lib/direction";
import { CloseIcon } from "../../lib/icons";
import { mergeClassName } from "../../lib/merge-class-name";
import { useLayeredEscape } from "../../lib/tooltip-escape";
import { Button } from "../button";
import { dialogDescriptionClasses, dialogTitleClasses } from "../dialog/dialog-variants";
import {
  type DrawerVariantProps,
  drawerBackdropClasses,
  drawerDefaults,
  drawerFooterClasses,
  drawerHandleClasses,
  drawerHeaderClasses,
  drawerVariants,
} from "./drawer-variants";

/** The physical edges. */
type PhysicalDrawerSide = NonNullable<DrawerVariantProps["side"]>;

/**
 * `left`, `right`, `top` and `bottom` are physical. `start` and `end` are the inline edges: they
 * resolve by the drawer's writing direction (`start` is the left in LTR and the right in RTL).
 */
export type DrawerSide = PhysicalDrawerSide | "start" | "end";

/** Base UI's swipe-to-dismiss direction for each side: a drawer is swiped back towards its edge. */
const swipeDirections = {
  right: "right",
  left: "left",
  bottom: "down",
  top: "up",
} as const satisfies Record<PhysicalDrawerSide, BaseDrawer.Root.Props["swipeDirection"]>;

/** `start` / `end` as a physical edge, for the resolved direction. */
function resolveSide(side: DrawerSide, rtl: boolean): PhysicalDrawerSide {
  if (side === "start") return rtl ? "right" : "left";
  if (side === "end") return rtl ? "left" : "right";
  return side;
}

export interface DrawerProps extends Omit<BaseDrawer.Root.Props, "swipeDirection"> {
  /**
   * The edge the drawer slides in from; it is swiped back towards it to dismiss. Set on the root
   * because Base UI's swipe direction is a root prop. `start` and `end` follow the writing
   * direction of the panel: the `dir` passed to `DrawerContent`, else the computed direction of its
   * portal `container` (default `<body>`, so a `dir` on the document counts). It is read each time
   * the drawer opens, before the panel mounts, and not again while it is open. Server-rendered
   * markup assumes left-to-right. @default "right"
   */
  side?: DrawerSide;
}

/**
 * The root's resolved (physical) `side`, its `modal` value (Base UI hides the outside but sets no
 * `aria-modal`; Tessera adds it for modal drawers, like Dialog) and the panel's direction report.
 */
const DrawerContext = createContext<{
  side: PhysicalDrawerSide;
  modal: DrawerProps["modal"];
  /** `DrawerContent` sets how the root reads the direction (true = right-to-left). */
  directionSource: { current: () => boolean };
  /** Reads it now. */
  readDirection: () => void;
}>({
  side: drawerDefaults.side,
  modal: true,
  directionSource: { current: () => false },
  readDirection: () => {},
});

/** The element whose direction the portalled panel inherits: its container, else `<body>`. */
function containerElement(container: BaseDrawer.Portal.Props["container"]): Element {
  const resolved = container && "current" in container ? container.current : container;
  if (resolved instanceof ShadowRoot) return resolved.host;
  return resolved ?? document.body;
}

/**
 * Groups a trigger and its content. Renders no element. Modal by default: focus is trapped, page
 * scroll is locked and outside pointer interaction is blocked. Controlled via `open` / `onOpenChange`.
 */
export function Drawer({ side, onOpenChange, ...props }: DrawerProps) {
  // The direction `start` / `end` resolve against, read before the panel mounts: `DrawerContent`
  // registers how to read it (its explicit `dir`, else its portal container's direction), and the
  // root reads it when the drawer is asked to open, so the panel's first render already has the
  // right edge (LTR before any read, and on the server).
  const directionSource = useRef<() => boolean>(() => false);
  const [rtl, setRtl] = useState(false);
  // A read that finds the direction unchanged sets no state. An unchanged `setRtl` still queues an
  // update, and one left pending at another lane is later rebased over the render-time read below,
  // reverting it (a controlled open in RTL came back as LTR on the next render).
  const committedRtl = useRef(rtl);
  useLayoutEffect(() => {
    committedRtl.current = rtl;
  });
  const readDirection = useCallback(() => {
    const next = directionSource.current();
    if (next !== committedRtl.current) setRtl(next);
  }, []);
  const handleOpenChange = useLayeredEscape<Parameters<NonNullable<typeof onOpenChange>>[1]>(
    (nextOpen, eventDetails) => {
      if (nextOpen) readDirection();
      onOpenChange?.(nextOpen, eventDetails);
    },
  );
  // A controlled `open` flipping to true from outside the handler: read in the render that
  // carries it, which is before the panel mounts (the state set here re-renders this component
  // first). Only ever on the client, where `open` changes.
  const [wasOpen, setWasOpen] = useState(props.open ?? false);
  if (props.open !== undefined && props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) {
      const next = directionSource.current();
      if (next !== rtl) setRtl(next);
    }
  }
  // A JS caller can still pass null; treat it like undefined.
  const resolvedSide = resolveSide(side ?? drawerDefaults.side, rtl);
  return (
    <DrawerContext.Provider
      value={{ side: resolvedSide, modal: props.modal ?? true, directionSource, readDirection }}
    >
      <BaseDrawer.Root
        {...props}
        swipeDirection={swipeDirections[resolvedSide]}
        onOpenChange={handleOpenChange}
      />
    </DrawerContext.Provider>
  );
}

export type DrawerTriggerProps = BaseDrawer.Trigger.Props;

/**
 * Opens the drawer on click, Enter or Space. Renders a `<button>` with no classes; compose a
 * styled trigger with `render={<Button variant="outline" />}`.
 */
export function DrawerTrigger(props: DrawerTriggerProps) {
  return <BaseDrawer.Trigger {...props} />;
}

export interface DrawerContentProps extends BaseDrawer.Popup.Props {
  /** Renders a ghost icon Button (named "Close") in the top corner at the inline end. @default true */
  showCloseButton?: boolean;
  /**
   * Element to portal into (default `document.body`). Pass an element inside a nested theme scope
   * (`data-primary`, `data-surface`, `.dark` on an inner element) so the drawer inherits it.
   */
  container?: BaseDrawer.Portal.Props["container"];
}

/**
 * The drawer panel (`role="dialog"`, `aria-modal`) against the root's `side`, over a dimmed
 * backdrop, portalled. On open, focus moves to the panel (change with `initialFocus`); Tab cycles
 * within; on close, focus returns to the trigger. Escape, a backdrop click or swiping it towards
 * its edge closes it. Name it with `DrawerTitle` and describe it with `DrawerDescription`.
 */
export function DrawerContent({
  showCloseButton = true,
  container,
  className,
  children,
  ...props
}: DrawerContentProps) {
  const { side, modal, directionSource, readDirection } = useContext(DrawerContext);
  const { dir } = props;
  // Tells the root how to read the direction. An explicit `dir` wins with no DOM read; otherwise
  // the panel inherits the container's. Read once now too (this runs at mount, before any open),
  // and again by the root each time the drawer opens.
  useLayoutEffect(() => {
    directionSource.current =
      dir === "rtl" || dir === "ltr"
        ? () => dir === "rtl"
        : () => isRtl(containerElement(container));
    readDirection();
  }, [dir, container, directionSource, readDirection]);
  return (
    <BaseDrawer.Portal container={container}>
      <BaseDrawer.Backdrop data-slot="drawer-backdrop" className={drawerBackdropClasses} />
      <BaseDrawer.Viewport data-slot="drawer-viewport">
        <BaseDrawer.Popup
          {...props}
          aria-modal={modal !== false ? true : undefined}
          data-slot="drawer-content"
          data-side={side}
          className={mergeClassName(drawerVariants({ side }), className)}
        >
          {side === "bottom" && (
            <div aria-hidden="true" data-slot="drawer-handle" className={drawerHandleClasses} />
          )}
          {/*
           * Base UI's mouse swipe skips targets inside `Drawer.Content`, so text in the drawer can
           * be selected and controls (e.g. a Slider thumb) dragged without dismissing it; the
           * handle and the popup's own padding stay swipeable, and touch swipes work everywhere.
           * `contents` keeps the children as direct flex items of the popup (gap, `mt-auto`).
           */}
          <BaseDrawer.Content data-slot="drawer-body" className="contents">
            {children}
          </BaseDrawer.Content>
          {showCloseButton && (
            // Button always sets its own `data-slot="button"`, so the slot and the corner position
            // live on this wrapper; the button inside keeps Button's full DOM contract.
            <span data-slot="drawer-close-button" className="absolute end-4 top-4">
              <BaseDrawer.Close
                render={
                  <Button variant="ghost" color="neutral" size="icon-sm" aria-label="Close" />
                }
              >
                <CloseIcon />
              </BaseDrawer.Close>
            </span>
          )}
        </BaseDrawer.Popup>
      </BaseDrawer.Viewport>
    </BaseDrawer.Portal>
  );
}

export type DrawerHeaderProps = ComponentProps<"div">;

/** Stacks the title and description. */
export function DrawerHeader({ className, ...props }: DrawerHeaderProps) {
  return (
    <div {...props} data-slot="drawer-header" className={cn(drawerHeaderClasses, className)} />
  );
}

export type DrawerFooterProps = ComponentProps<"div">;

/** Action row pinned to the bottom: stacked (primary on top) on narrow screens, right-aligned from `sm`. */
export function DrawerFooter({ className, ...props }: DrawerFooterProps) {
  return (
    <div {...props} data-slot="drawer-footer" className={cn(drawerFooterClasses, className)} />
  );
}

export type DrawerTitleProps = BaseDrawer.Title.Props;

/** The drawer's heading (`<h2>`); labels the drawer via `aria-labelledby`. */
export function DrawerTitle({ className, ...props }: DrawerTitleProps) {
  return (
    <BaseDrawer.Title
      {...props}
      data-slot="drawer-title"
      className={mergeClassName(dialogTitleClasses, className)}
    />
  );
}

export type DrawerDescriptionProps = BaseDrawer.Description.Props;

/** Supporting text (`<p>`); describes the drawer via `aria-describedby`. */
export function DrawerDescription({ className, ...props }: DrawerDescriptionProps) {
  return (
    <BaseDrawer.Description
      {...props}
      data-slot="drawer-description"
      className={mergeClassName(dialogDescriptionClasses, className)}
    />
  );
}

export type DrawerCloseProps = BaseDrawer.Close.Props;

/** Closes the drawer. Renders a `<button>` with no classes; compose with `render={<Button />}`. */
export function DrawerClose(props: DrawerCloseProps) {
  return <BaseDrawer.Close {...props} />;
}
