"use client";

import { Drawer as BaseDrawer } from "@base-ui/react/drawer";
import { type ComponentProps, createContext, useContext } from "react";
import { cn } from "../../lib/cn";
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

export type DrawerSide = NonNullable<DrawerVariantProps["side"]>;

/** Base UI's swipe-to-dismiss direction for each side: a drawer is swiped back towards its edge. */
const swipeDirections = {
  right: "right",
  left: "left",
  bottom: "down",
  top: "up",
} as const satisfies Record<DrawerSide, BaseDrawer.Root.Props["swipeDirection"]>;

export interface DrawerProps extends Omit<BaseDrawer.Root.Props, "swipeDirection"> {
  /**
   * The edge the drawer slides in from; it is swiped back towards it to dismiss. Set on the root
   * because Base UI's swipe direction is a root prop. @default "right"
   */
  side?: DrawerSide;
}

/**
 * The root's `side`, and its `modal` value (Base UI hides the outside but sets no `aria-modal`;
 * Tessera adds it for modal drawers, like Dialog).
 */
const DrawerContext = createContext<{ side: DrawerSide; modal: DrawerProps["modal"] }>({
  side: drawerDefaults.side,
  modal: true,
});

/**
 * Groups a trigger and its content. Renders no element. Modal by default: focus is trapped, page
 * scroll is locked and outside pointer interaction is blocked. Controlled via `open` / `onOpenChange`.
 */
export function Drawer({ side, onOpenChange, ...props }: DrawerProps) {
  const handleOpenChange = useLayeredEscape(onOpenChange);
  // A JS caller can still pass null; treat it like undefined.
  const resolvedSide = side ?? drawerDefaults.side;
  return (
    <DrawerContext.Provider value={{ side: resolvedSide, modal: props.modal ?? true }}>
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
  /** Renders a ghost icon Button (named "Close") in the top-right corner. @default true */
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
  const { side, modal } = useContext(DrawerContext);
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
            <span data-slot="drawer-close-button" className="absolute right-4 top-4">
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

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
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
