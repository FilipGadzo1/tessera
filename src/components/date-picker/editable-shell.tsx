"use client";

/*
 * The editable pickers' shell (moved out of `date-picker.tsx` in Phase K so TimePicker shares it):
 * a typed field plus an icon button inside its border that opens a popover anchored to the whole
 * field. The field is the one Field / Form control; the popover adds none.
 */
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { type ComponentProps, type ReactNode, useRef } from "react";
import { cn } from "../../lib/cn";
import { useControllableState } from "../../lib/use-controllable-state";
import { buttonVariants } from "../button/button-variants";
import type { textFieldSizes } from "../input/input-variants";
import { Popover, PopoverContent, type PopoverContentProps, PopoverTrigger } from "../popover";
import type { SelectTriggerVariantProps } from "../select";

/** Trigger and popup props of every picker that are not native element props. */
export interface PickerOwnProps {
  /** Disables the trigger (a disabled `Field` does too). */
  disabled?: boolean;
  /** Requires a value to submit (DateRangePicker: both dates). */
  required?: boolean;
  /** Trigger height, padding and text size, as Select and Input. @default "md" */
  size?: SelectTriggerVariantProps["size"];
  /** Whether the calendar is open, controlled. */
  open?: boolean;
  /** Whether the calendar is initially open. @default false */
  defaultOpen?: boolean;
  /** Called when the calendar opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Element to portal the popup into (default `document.body`), e.g. inside a nested theme scope. */
  container?: PopoverContentProps["container"];
}

/** The native props of an `editable` picker: those of the field's group element. */
export type EditableElementProps = Omit<
  ComponentProps<"div">,
  "value" | "defaultValue" | "onChange" | "children"
> & {
  /** Keeps the segments focusable but ignores edits, and disables the icon button. */
  readOnly?: boolean;
};

/** What the editable shell hands its field: the native props plus the shell's wiring. */
export type EditableFieldProps = EditableElementProps & {
  /** The field, its icon button and the popup: one boundary for the Field's focus / blur. */
  focusScope: () => (Element | null)[];
  /** Includes a disabled Field. */
  disabled: boolean;
  required?: boolean;
  size?: keyof typeof textFieldSizes;
  className: string;
};

const contentBase = "p-0 w-auto";

interface EditableShellProps extends EditableElementProps, PickerOwnProps {
  /** The `data-slot` prefix: `${slotPrefix}-editable` / `-trigger` / `-content` / `-icon`. */
  slotPrefix: "date-picker" | "time-picker";
  /** The icon button's icon, carrying `data-slot={`${slotPrefix}-icon`}`. */
  icon: ReactNode;
  /** The icon button's accessible name. */
  openLabel: string;
  /** The popup's accessible name. */
  dialogLabel: string;
  /**
   * The element focused when the popup opens, given the popup element (`true`: Base UI's default,
   * its first tabbable element).
   */
  initialFocus: (popup: HTMLElement | null) => HTMLElement | true;
  /** The popup's collision avoidance (PopoverContent's); TimePicker's list keeps to its axis. */
  collisionAvoidance?: PopoverContentProps["collisionAvoidance"];
  /** Renders the field (a DateField, DateRangeField or TimeField) with the props it is handed. */
  renderField: (props: EditableFieldProps) => ReactNode;
  /** Renders the popup's content: `close` closes the popup (focus returns to the icon button). */
  renderCalendar: (close: () => void, open: boolean) => ReactNode;
  /**
   * The field never shrinks below its content (DateRangeField's `min-w-max`): the anchor grows
   * with it, so the icon button stays inside the field's border.
   */
  growToContent?: boolean;
}

/**
 * The `editable` pickers' shell: a typed field plus an icon button inside its border. The field is
 * the one Field / Form control (it registers, validates and renders the hidden input), so the
 * popover adds none. The popup anchors to the whole field; focus returns to the icon button (the
 * popover's trigger) after a pick or Escape.
 */
export function EditableShell({
  slotPrefix,
  icon,
  openLabel,
  dialogLabel,
  initialFocus,
  collisionAvoidance,
  renderField,
  renderCalendar,
  growToContent = false,
  disabled,
  readOnly,
  required,
  size,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  container,
  className,
  ...props
}: EditableShellProps) {
  const field = useFieldRootContext();
  const anchorRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [open, setControllableOpen] = useControllableState(openProp, defaultOpen, onOpenChange);
  const setOpen = (next: boolean) => {
    if (next === open) return;
    setControllableOpen(next);
  };
  const isDisabled = !!disabled || field.state.disabled;
  // The field, its icon button and the popup are one control for the Field's focus / blur.
  const focusScope = () => [anchorRef.current, popupRef.current];

  return (
    <Popover open={open} onOpenChange={(next) => setOpen(next)}>
      <div
        ref={anchorRef}
        data-slot={`${slotPrefix}-editable`}
        className={cn("relative w-full", growToContent && "min-w-max")}
      >
        {renderField({
          ...props,
          focusScope,
          readOnly,
          disabled: isDisabled,
          required,
          size: size ?? undefined,
          className: cn("pe-10", className),
        })}
        <PopoverTrigger
          type="button"
          disabled={isDisabled || readOnly}
          aria-label={openLabel}
          data-slot={`${slotPrefix}-trigger`}
          className={buttonVariants({
            variant: "ghost",
            color: "neutral",
            size: size === "sm" ? "icon-xs" : "icon-sm",
            // The ring hugs the button (no offset): with the offset it overlaps the field's border.
            className: "absolute inset-y-0 end-1 my-auto outline-offset-0",
          })}
        >
          {icon}
        </PopoverTrigger>
      </div>
      <PopoverContent
        ref={popupRef}
        anchor={anchorRef}
        collisionAvoidance={collisionAvoidance}
        container={container}
        align="start"
        sideOffset={6}
        aria-label={dialogLabel}
        data-slot={`${slotPrefix}-content`}
        className={contentBase}
        initialFocus={() => initialFocus(popupRef.current)}
      >
        {renderCalendar(() => setOpen(false), open)}
      </PopoverContent>
    </Popover>
  );
}
