"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { type ComponentProps, createContext, useContext } from "react";
import { cn } from "../../lib/cn";
import { CloseIcon } from "../../lib/icons";
import { mergeClassName } from "../../lib/merge-class-name";
import { useLayeredEscape } from "../../lib/tooltip-escape";
import { Button } from "../button";
import {
  type DialogVariantProps,
  dialogBackdropClasses,
  dialogDefaults,
  dialogDescriptionClasses,
  dialogFooterClasses,
  dialogHeaderClasses,
  dialogTitleClasses,
  dialogVariants,
} from "./dialog-variants";

export type DialogProps = BaseDialog.Root.Props;

/**
 * Base UI conveys modality by hiding everything outside the popup (`aria-hidden`) but sets no
 * `aria-modal`; Tessera adds it for modal dialogs (`modal` true or "trap-focus", the cases where
 * Base UI hides the outside), so the content needs the root's `modal` value.
 */
const DialogModalContext = createContext<DialogProps["modal"]>(true);

/**
 * Groups a trigger and its content. Renders no element. Modal by default: focus is trapped, page
 * scroll is locked and outside pointer interaction is blocked. Controlled via `open` / `onOpenChange`.
 */
export function Dialog({ onOpenChange, ...props }: DialogProps) {
  const handleOpenChange = useLayeredEscape(onOpenChange);
  return (
    <DialogModalContext.Provider value={props.modal ?? true}>
      <BaseDialog.Root {...props} onOpenChange={handleOpenChange} />
    </DialogModalContext.Provider>
  );
}

export type DialogTriggerProps = BaseDialog.Trigger.Props;

/**
 * Opens the dialog on click, Enter or Space. Renders a `<button>` with no classes; compose a
 * styled trigger with `render={<Button variant="outline" />}`.
 */
export function DialogTrigger(props: DialogTriggerProps) {
  return <BaseDialog.Trigger {...props} />;
}

export interface DialogContentProps extends BaseDialog.Popup.Props {
  /**
   * Maximum width: sm `max-w-sm`, md `max-w-lg`, lg `max-w-2xl`. @default "md"
   * (`null` is excluded: cva would read it as "no size" and leave the popup uncapped.)
   */
  size?: NonNullable<DialogVariantProps["size"]>;
  /** Renders a ghost icon Button (named "Close") in the top-right corner. @default true */
  showCloseButton?: boolean;
  /**
   * Element to portal into (default `document.body`). Pass an element inside a nested theme scope
   * (`data-primary`, `data-surface`, `.dark` on an inner element) so the dialog inherits it.
   */
  container?: BaseDialog.Portal.Props["container"];
}

/**
 * The dialog (`role="dialog"`, `aria-modal`): a backdrop plus a centred popup, portalled. On open,
 * focus moves to the first tabbable element (change with `initialFocus`); Tab cycles within; on
 * close, focus returns to the trigger. Escape and a backdrop click close it. Long content scrolls
 * inside the popup. Name it with `DialogTitle` and describe it with `DialogDescription`.
 */
export function DialogContent({
  size,
  showCloseButton = true,
  container,
  className,
  children,
  ...props
}: DialogContentProps) {
  const modal = useContext(DialogModalContext);
  // A JS caller can still pass null; treat it like undefined.
  const resolvedSize = size ?? dialogDefaults.size;
  return (
    <BaseDialog.Portal container={container}>
      <BaseDialog.Backdrop data-slot="dialog-backdrop" className={dialogBackdropClasses} />
      <BaseDialog.Popup
        {...props}
        aria-modal={modal !== false ? true : undefined}
        data-slot="dialog-content"
        data-size={resolvedSize}
        className={mergeClassName(dialogVariants({ size: resolvedSize }), className)}
      >
        {children}
        {showCloseButton && (
          // Button always sets its own `data-slot="button"`, so the slot and the corner position
          // live on this wrapper; the button inside keeps Button's full DOM contract.
          <span data-slot="dialog-close-button" className="absolute right-4 top-4">
            <BaseDialog.Close
              render={<Button variant="ghost" color="neutral" size="icon-sm" aria-label="Close" />}
            >
              <CloseIcon />
            </BaseDialog.Close>
          </span>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export type DialogHeaderProps = ComponentProps<"div">;

/** Stacks the title and description. */
export function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return (
    <div {...props} data-slot="dialog-header" className={cn(dialogHeaderClasses, className)} />
  );
}

export type DialogFooterProps = ComponentProps<"div">;

/** Action row: stacked (primary on top) on narrow screens, right-aligned from `sm`. */
export function DialogFooter({ className, ...props }: DialogFooterProps) {
  return (
    <div {...props} data-slot="dialog-footer" className={cn(dialogFooterClasses, className)} />
  );
}

export type DialogTitleProps = BaseDialog.Title.Props;

/** The dialog's heading (`<h2>`); labels the dialog via `aria-labelledby`. */
export function DialogTitle({ className, ...props }: DialogTitleProps) {
  return (
    <BaseDialog.Title
      {...props}
      data-slot="dialog-title"
      className={mergeClassName(dialogTitleClasses, className)}
    />
  );
}

export type DialogDescriptionProps = BaseDialog.Description.Props;

/** Supporting text (`<p>`); describes the dialog via `aria-describedby`. */
export function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return (
    <BaseDialog.Description
      {...props}
      data-slot="dialog-description"
      className={mergeClassName(dialogDescriptionClasses, className)}
    />
  );
}

export type DialogCloseProps = BaseDialog.Close.Props;

/** Closes the dialog. Renders a `<button>` with no classes; compose with `render={<Button />}`. */
export function DialogClose(props: DialogCloseProps) {
  return <BaseDialog.Close {...props} />;
}
