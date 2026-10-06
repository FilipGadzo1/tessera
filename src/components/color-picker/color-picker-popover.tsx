"use client";

/*
 * ColorPickerPopover (spec Phase J §2): an outline Button showing the colour, opening the inline
 * ColorPicker in a Popover. The popover owns the value and is the one Field / Form control (the
 * trigger registers, carries the hidden input and is what Form focuses); the picker in the popup is
 * told through `ColorPickerHostContext` not to join, so a Field and Form see one control.
 */
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useLabelableContext, useLabelableId } from "@base-ui/react/internals/labelable-provider";
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { formatHex, parseColor } from "../../lib/color";
import { mergeClassName } from "../../lib/merge-class-name";
import { useControllableState } from "../../lib/use-controllable-state";
import { useMergedRefs } from "../../lib/use-merged-refs";
import { Button } from "../button";
import { useFocusScope, useFormControl } from "../field/form-control";
import {
  Popover,
  PopoverContent,
  type PopoverContentProps,
  PopoverTitle,
  PopoverTrigger,
} from "../popover";
import { ColorPicker, ColorPickerHostContext, type ColorPickerProps } from "./color-picker";
import {
  checkerboardClasses,
  colorPickerPopupClasses,
  colorPickerTriggerClasses,
  colorPickerTriggerSwatchClasses,
} from "./color-picker-classes";

/** The picker in the popup: the trigger is the Field and Form control, so it does not join. */
const inPopover = { joinsForm: false };

type PickerProps = Pick<
  ColorPickerProps,
  | "value"
  | "defaultValue"
  | "onValueChange"
  | "onValueCommitted"
  | "alpha"
  | "swatches"
  | "format"
  | "defaultFormat"
  | "onFormatChange"
  | "disabled"
  | "name"
  | "form"
>;

export interface ColorPickerPopoverProps
  extends PickerProps,
    Omit<
      ComponentProps<"button">,
      keyof PickerProps | "children" | "type" | "title" | "color" | "aria-label"
    > {
  /** The trigger's accessible name. @default (hex) => `Choose color: ${hex}` */
  triggerLabel?: (hex: string) => string;
  /** The popup's visually hidden title (its accessible name). @default "Color picker" */
  title?: string;
  /** The popup's side of the trigger. @default "bottom" */
  side?: PopoverContentProps["side"];
  /** The popup's alignment against the trigger. @default "start" */
  align?: PopoverContentProps["align"];
  /** Classes for the popup. */
  contentClassName?: string;
  /** The picker's parts in the popup; by default the inline picker's default composition. */
  children?: ReactNode;
}

/** The hex a colour string reports in this picker, or `null` when it cannot be read. */
function toHex(input: string | undefined, alpha: boolean) {
  const rgba = input === undefined ? null : parseColor(input);
  return rgba ? formatHex(rgba, { alpha: alpha ? "auto" : "never" }) : null;
}

const defaultTriggerLabel = (hex: string) => `Choose color: ${hex}`;

/**
 * A button showing the colour (a swatch and its hex) that opens a `ColorPicker` in a popover.
 * Its name is `triggerLabel(hex)`, "Choose color: #1d4ed8", after a Field label when there is one.
 * Focus moves to the area thumb on open and back to the trigger on close; an Escape the picker's
 * text field takes (reverting an edit) leaves the popover open. In a `Field` and `Form` it is one
 * control: `name` (and `form`) submit the hex, `onFormSubmit` reports it under the Field's name,
 * and an invalid submit focuses the trigger.
 */
export function ColorPickerPopover({
  value,
  defaultValue = "#000000",
  onValueChange,
  onValueCommitted,
  alpha = false,
  swatches,
  format: formatProp,
  defaultFormat = "hex",
  onFormatChange,
  disabled: disabledProp,
  name,
  form,
  triggerLabel = defaultTriggerLabel,
  title = "Color picker",
  side,
  align = "start",
  contentClassName,
  children,
  id: idProp,
  ref,
  className,
  ...props
}: ColorPickerPopoverProps) {
  const field = useFieldRootContext();
  const { labelId, getDescriptionProps } = useLabelableContext();
  const id = useLabelableId({ id: idProp });
  const disabled = !!disabledProp || field.state.disabled;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const setTriggerRef = useMergedRefs(triggerRef, ref);
  const popupRef = useRef<HTMLDivElement | null>(null);

  // The value as the picker reports it. A controlled value is adopted into the state when it can
  // be read, so an unparsable one (ignored, with a warning) leaves the last readable colour.
  const [stored, setStored] = useState(() => toHex(value ?? defaultValue, alpha) ?? "#000000");
  const controlledHex = value === undefined ? null : toHex(value, alpha);
  if (controlledHex !== null && controlledHex !== stored) setStored(controlledHex);
  const hex = controlledHex ?? toHex(stored, alpha) ?? stored;

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && value !== undefined && !parseColor(value)) {
      console.warn(`ColorPickerPopover: ignoring the unparsable value "${value}".`);
    }
  }, [value]);

  // Owned here, so the popup's picker (mounted only while open) keeps the format across openings.
  const [format, setFormat] = useControllableState(formatProp, defaultFormat, onFormatChange);

  const formControl = useFormControl({
    value: hex,
    inputValue: hex,
    formValue: hex,
    name: name ?? field.name,
    form,
    registrationName: name,
    disabled,
    customValidity: "",
    controlRef: triggerRef,
    slot: "color-picker-form-control",
  });
  // The trigger and the popup are one control for the Field's focus / blur.
  useFocusScope(
    () => [triggerRef.current, popupRef.current],
    formControl.onFocus,
    formControl.onBlur,
  );

  // The Field label, then the trigger's own name: "Primary color Choose color: #1d4ed8".
  const labelSource = props["aria-labelledby"] ?? labelId;
  const { "aria-describedby": ariaDescribedBy } = getDescriptionProps({
    "aria-describedby": props["aria-describedby"],
  });
  const translucent = alpha && hex.length === 9;

  return (
    <Popover>
      <PopoverTrigger
        {...props}
        ref={setTriggerRef}
        id={id}
        disabled={disabled}
        aria-label={triggerLabel(hex)}
        aria-labelledby={labelSource ? `${labelSource} ${id}` : undefined}
        aria-describedby={ariaDescribedBy}
        render={
          <Button
            variant="outline"
            color="neutral"
            // Button sets its own `data-slot`; the render element's props win over it.
            render={<button type="button" data-slot="color-picker-trigger" />}
          />
        }
        className={mergeClassName(colorPickerTriggerClasses, className)}
      >
        <span
          aria-hidden="true"
          data-slot="color-picker-trigger-swatch"
          className={cn(colorPickerTriggerSwatchClasses, translucent && checkerboardClasses)}
          style={translucent ? undefined : { backgroundColor: hex }}
        >
          {translucent && (
            <span className="absolute inset-0 rounded-[inherit]" style={{ backgroundColor: hex }} />
          )}
        </span>
        <span data-slot="color-picker-value">{hex}</span>
      </PopoverTrigger>
      {formControl.input}
      <PopoverContent
        ref={popupRef}
        side={side}
        align={align}
        data-slot="color-picker-popover"
        className={cn(colorPickerPopupClasses, contentClassName)}
        initialFocus={() =>
          popupRef.current?.querySelector<HTMLElement>("[data-slot=color-area-thumb]") ?? true
        }
      >
        <PopoverTitle className="sr-only">{title}</PopoverTitle>
        <ColorPickerHostContext.Provider value={inPopover}>
          <ColorPicker
            value={hex}
            onValueChange={(next) => {
              if (value === undefined) setStored(next);
              onValueChange?.(next);
            }}
            onValueCommitted={onValueCommitted}
            alpha={alpha}
            swatches={swatches}
            format={format}
            onFormatChange={setFormat}
            disabled={disabled}
          >
            {children}
          </ColorPicker>
        </ColorPickerHostContext.Provider>
      </PopoverContent>
    </Popover>
  );
}
