"use client";

import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";
import { useLayeredEscape } from "../../lib/tooltip-escape";
import {
  type DialogVariantProps,
  dialogBackdropClasses,
  dialogDefaults,
  dialogDescriptionClasses,
  dialogFooterClasses,
  dialogHeaderClasses,
  dialogTitleClasses,
  dialogVariants,
} from "../dialog/dialog-variants";

export type AlertDialogProps = BaseAlertDialog.Root.Props;

/**
 * Groups a trigger and its content for a confirmation that needs a decision. Renders no element.
 * Always modal; a backdrop click does not close it (Escape does). Controlled via `open` /
 * `onOpenChange`.
 */
export function AlertDialog({ onOpenChange, ...props }: AlertDialogProps) {
  const handleOpenChange = useLayeredEscape(onOpenChange);
  return <BaseAlertDialog.Root {...props} onOpenChange={handleOpenChange} />;
}

export type AlertDialogTriggerProps = BaseAlertDialog.Trigger.Props;

/**
 * Opens the alert dialog on click, Enter or Space. Renders a `<button>` with no classes; compose
 * a styled trigger with `render={<Button variant="outline" color="danger" />}`.
 */
export function AlertDialogTrigger(props: AlertDialogTriggerProps) {
  return <BaseAlertDialog.Trigger {...props} />;
}

export interface AlertDialogContentProps extends BaseAlertDialog.Popup.Props {
  /**
   * Maximum width: sm `max-w-sm`, md `max-w-lg`, lg `max-w-2xl`. @default "md"
   * (`null` is excluded: cva would read it as "no size" and leave the popup uncapped.)
   */
  size?: NonNullable<DialogVariantProps["size"]>;
  /**
   * Element to portal into (default `document.body`). Pass an element inside a nested theme scope
   * (`data-primary`, `data-surface`, `.dark` on an inner element) so the dialog inherits it.
   */
  container?: BaseAlertDialog.Portal.Props["container"];
}

/**
 * The alert dialog (`role="alertdialog"`, `aria-modal`): a backdrop plus a centred popup, styled
 * like `DialogContent` but with no close button: put the choices in `AlertDialogFooter` (cancel
 * via `AlertDialogClose`). Focus moves to the first tabbable element and is trapped; on close it
 * returns to the trigger.
 */
export function AlertDialogContent({
  size,
  container,
  className,
  ...props
}: AlertDialogContentProps) {
  // A JS caller can still pass null; treat it like undefined.
  const resolvedSize = size ?? dialogDefaults.size;
  return (
    <BaseAlertDialog.Portal container={container}>
      <BaseAlertDialog.Backdrop
        data-slot="alert-dialog-backdrop"
        className={dialogBackdropClasses}
      />
      <BaseAlertDialog.Popup
        {...props}
        aria-modal
        data-slot="alert-dialog-content"
        data-size={resolvedSize}
        className={mergeClassName(dialogVariants({ size: resolvedSize }), className)}
      />
    </BaseAlertDialog.Portal>
  );
}

export type AlertDialogHeaderProps = ComponentProps<"div">;

/** Stacks the title and description. */
export function AlertDialogHeader({ className, ...props }: AlertDialogHeaderProps) {
  return (
    <div
      {...props}
      data-slot="alert-dialog-header"
      className={cn(dialogHeaderClasses, className)}
    />
  );
}

export type AlertDialogFooterProps = ComponentProps<"div">;

/** Action row: stacked (primary on top) on narrow screens, right-aligned from `sm`. */
export function AlertDialogFooter({ className, ...props }: AlertDialogFooterProps) {
  return (
    <div
      {...props}
      data-slot="alert-dialog-footer"
      className={cn(dialogFooterClasses, className)}
    />
  );
}

export type AlertDialogTitleProps = BaseAlertDialog.Title.Props;

/** The alert dialog's heading (`<h2>`); labels it via `aria-labelledby`. */
export function AlertDialogTitle({ className, ...props }: AlertDialogTitleProps) {
  return (
    <BaseAlertDialog.Title
      {...props}
      data-slot="alert-dialog-title"
      className={mergeClassName(dialogTitleClasses, className)}
    />
  );
}

export type AlertDialogDescriptionProps = BaseAlertDialog.Description.Props;

/** Supporting text (`<p>`); describes the alert dialog via `aria-describedby`. */
export function AlertDialogDescription({ className, ...props }: AlertDialogDescriptionProps) {
  return (
    <BaseAlertDialog.Description
      {...props}
      data-slot="alert-dialog-description"
      className={mergeClassName(dialogDescriptionClasses, className)}
    />
  );
}

export type AlertDialogCloseProps = BaseAlertDialog.Close.Props;

/**
 * Closes the alert dialog (the cancel choice). Renders a `<button>` with no classes; compose with
 * `render={<Button variant="outline" color="neutral" />}`.
 */
export function AlertDialogClose(props: AlertDialogCloseProps) {
  return <BaseAlertDialog.Close {...props} />;
}
