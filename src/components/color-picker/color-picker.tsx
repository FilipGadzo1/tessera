"use client";

/*
 * The inline ColorPicker (spec Phase J §2). The area and the hue / alpha channels are hand-built
 * sliders sharing one pointer engine (`useSurfaceDrag`): Base UI's Slider registers with an
 * enclosing Field, and only one element per picker may (scope ruling). For the same reason the text
 * field is a native `<input>` styled with `inputVariants` (Tessera's `Input` is a Field control),
 * and the format chooser and swatches are Base UI ToggleGroups (which do not register). The root
 * alone joins a Field and Form, through the internal `ColorPickerFormControl` child, unless
 * `ColorPickerHostContext` says otherwise (the popover's inner picker).
 */
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useLabelableContext, useLabelableId } from "@base-ui/react/internals/labelable-provider";
import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import {
  type ComponentProps,
  createContext,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import {
  type ColorFormat,
  compositeOver,
  formatColor,
  formatHex,
  type HSVA,
  hsvToRgb,
  parseColor,
  type RGBA,
  readableForeground,
  rgbToHsv,
} from "../../lib/color";
import { CheckIcon, PipetteIcon } from "../../lib/icons";
import { mergeClassName, mergeStyle } from "../../lib/merge-class-name";
import { claimEscape } from "../../lib/tooltip-escape";
import { useControllableState } from "../../lib/use-controllable-state";
import { useElementDirection } from "../../lib/use-element-direction";
import { useMergedRefs } from "../../lib/use-merged-refs";
import { Button, type ButtonProps } from "../button";
import { useFocusScope, useFormControl } from "../field/form-control";
import { inputVariants } from "../input/input-variants";
import { ToggleGroup, ToggleGroupItem, type ToggleGroupProps } from "../toggle";
import {
  checkerboardClasses,
  colorAreaClasses,
  colorAreaThumbClasses,
  colorPickerClasses,
  colorSliderThumbClasses,
  colorSliderTrackClasses,
  colorSwatchClasses,
  noSecondFade,
} from "./color-picker-classes";

/** A swatch: a colour string (named by its hex), or a colour with its accessible name. */
export type ColorSwatchOption = string | { value: string; label: string };

const black: RGBA = { r: 0, g: 0, b: 0, a: 1 };
const white: RGBA = { r: 255, g: 255, b: 255, a: 1 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The picker's value for an HSVA state: lowercase hex, 8 digits only with `alpha` and a < 1. */
function hexOf(hsva: HSVA, alpha: boolean) {
  return formatHex(hsvToRgb(hsva), { alpha: alpha ? "auto" : "never" });
}

/** HSVA for a parsed colour; a grey (saturation 0) keeps `previousHue`, which its hex cannot carry. */
function toHsva(rgba: RGBA, alpha: boolean, previousHue?: number): HSVA {
  const hsva = rgbToHsv(rgba);
  return {
    ...hsva,
    h: hsva.s === 0 && previousHue !== undefined ? previousHue : hsva.h,
    a: alpha ? hsva.a : 1,
  };
}

const sameHsva = (a: HSVA, b: HSVA) => a.h === b.h && a.s === b.s && a.v === b.v && a.a === b.a;

/**
 * Where an enclosing component hosts the picker. `ColorPickerPopover` sets `joinsForm: false` for
 * the picker in its popup: the trigger is then the Field and Form control, so the inner picker
 * renders no hidden input and takes no Field labelling or focus scope. Internal, not exported from
 * the package.
 */
export const ColorPickerHostContext = createContext<{ joinsForm: boolean }>({ joinsForm: true });

interface ColorPickerContextValue {
  hsva: HSVA;
  /** The current value. */
  hex: string;
  alpha: boolean;
  disabled: boolean;
  format: ColorFormat;
  setFormat: (format: ColorFormat) => void;
  swatches: ColorSwatchOption[] | undefined;
  /** Moves to `next`, reporting it (`onValueChange`) and, with `commit`, committing it. */
  update: (next: HSVA, commit: boolean) => void;
  /** Sets and commits a colour from the input, a swatch or the eyedropper (a grey keeps the hue). */
  commitColor: (rgba: RGBA) => void;
  /** Commits the current value (the end of a drag). */
  commit: () => void;
  /** The area thumb: what Form focuses on an invalid submit. */
  areaThumbRef: RefObject<HTMLDivElement | null>;
}

const ColorPickerContext = createContext<ColorPickerContextValue | null>(null);

function useColorPicker(part: string) {
  const context = useContext(ColorPickerContext);
  if (!context) throw new Error(`${part} must be used inside a ColorPicker.`);
  return context;
}

export interface ColorPickerProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "children"> {
  /** The colour, controlled: `#rrggbb`, or `#rrggbbaa` with `alpha` (any format `parseColor` reads). */
  value?: string;
  /** The initial colour. @default "#000000" */
  defaultValue?: string;
  /** Called with the lowercase hex on every change, also during a drag. */
  onValueChange?: (hex: string) => void;
  /** Called with the hex when a change is committed: pointer up, a key, the input, a swatch, the eyedropper. */
  onValueCommitted?: (hex: string) => void;
  /** Shows the alpha slider and keeps alpha; without it the value is always 6-digit hex. */
  alpha?: boolean;
  /** Preset colours shown under the default composition. */
  swatches?: ColorSwatchOption[];
  /** The text field's format, controlled. */
  format?: ColorFormat;
  /** @default "hex" */
  defaultFormat?: ColorFormat;
  onFormatChange?: (format: ColorFormat) => void;
  /** Disables every part (a disabled `Field` does too). */
  disabled?: boolean;
  /** Submits the hex through a visually hidden input; in a Field, `onFormSubmit` uses the Field's name. */
  name?: string;
  /** The `id` of a `<form>` elsewhere in the document for the hidden input. */
  form?: string;
  /** The parts to render instead of the default composition; each reads the picker's state. */
  children?: ReactNode;
}

/**
 * A colour picker: a saturation/brightness area, a hue slider, an optional alpha slider, a text
 * field with a format toggle, an eyedropper (where the browser has one) and optional swatches.
 * The value is always a valid lowercase hex string. A `div role="group"`, named by `aria-label`
 * (default "Color picker") or a surrounding `Field`'s label.
 */
export function ColorPicker({
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
  children,
  ref,
  className,
  ...props
}: ColorPickerProps) {
  const host = useContext(ColorPickerHostContext);
  const field = useFieldRootContext();
  const { labelId, getDescriptionProps } = useLabelableContext();
  const disabled = !!disabledProp || field.state.disabled;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRootRef = useMergedRefs(rootRef, ref);
  const areaThumbRef = useRef<HTMLDivElement | null>(null);
  const direction = useElementDirection(rootRef);

  const [state, setState] = useState<HSVA>(() =>
    toHsva(parseColor(value ?? defaultValue) ?? black, alpha),
  );
  // A controlled value that formats to the hex the state already has keeps the state (the hue
  // survives a grey); any other value replaces it, keeping the hue for a grey. Unparsable: ignored.
  // The replacement is adopted into the state during render (React's "adjust state when a prop
  // changes"), so the hue a later grey keeps is the one on screen, not the last internal change's.
  // It cannot loop: the adopted state derives the same HSVA again (its hue is the state's own for a
  // grey, the value's otherwise), so the second render sets nothing. Nothing is reported back.
  const parsedValue = value === undefined ? null : parseColor(value);
  let hsva = alpha ? state : { ...state, a: 1 };
  if (
    parsedValue &&
    formatHex(parsedValue, { alpha: alpha ? "auto" : "never" }) !== hexOf(hsva, alpha)
  ) {
    const adopted = toHsva(parsedValue, alpha, state.h);
    if (!sameHsva(adopted, state)) setState(adopted);
    hsva = adopted;
  }
  const hex = hexOf(hsva, alpha);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && value !== undefined && !parseColor(value)) {
      console.warn(`ColorPicker: ignoring the unparsable value "${value}".`);
    }
  }, [value]);

  // The last state reported, for a commit after a drag and for callbacks that resolve later.
  const latest = useRef({ hsva, hex });
  latest.current = { hsva, hex };

  const update = (next: HSVA, commit: boolean) => {
    const nextHsva = alpha ? next : { ...next, a: 1 };
    const nextHex = hexOf(nextHsva, alpha);
    const changed = nextHex !== latest.current.hex;
    latest.current = { hsva: nextHsva, hex: nextHex };
    setState(nextHsva);
    if (changed) onValueChange?.(nextHex);
    if (commit) onValueCommitted?.(nextHex);
  };

  const [format, setFormat] = useControllableState(formatProp, defaultFormat, onFormatChange);

  const context: ColorPickerContextValue = {
    hsva,
    hex,
    alpha,
    disabled,
    format,
    setFormat,
    swatches,
    update,
    commitColor: (rgba) => update(toHsva(rgba, alpha, latest.current.hsva.h), true),
    commit: () => onValueCommitted?.(latest.current.hex),
    areaThumbRef,
  };

  const joins = host.joinsForm;
  const ariaLabelledBy =
    props["aria-labelledby"] ?? (joins && !props["aria-label"] ? labelId : undefined);
  const ariaLabel = props["aria-label"] ?? (ariaLabelledBy ? undefined : "Color picker");
  const ariaDescribedBy = joins
    ? getDescriptionProps({ "aria-describedby": props["aria-describedby"] })["aria-describedby"]
    : props["aria-describedby"];

  return (
    <ColorPickerContext.Provider value={context}>
      <DirectionProvider direction={direction}>
        {/* biome-ignore lint/a11y/useSemanticElements: a <fieldset> brings UA borders and padding and names itself from a <legend>, not a Field label (as DateField). */}
        <div
          {...props}
          ref={setRootRef}
          role="group"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          data-slot="color-picker"
          data-disabled={disabled ? "" : undefined}
          className={cn(colorPickerClasses, className)}
        >
          {children ?? <DefaultComposition alpha={alpha} swatches={!!swatches} />}
        </div>
      </DirectionProvider>
      {joins && (
        <ColorPickerFormControl
          hex={hex}
          name={name}
          form={form}
          disabled={disabled}
          controlRef={areaThumbRef}
          rootRef={rootRef}
        />
      )}
    </ColorPickerContext.Provider>
  );
}

function DefaultComposition({ alpha, swatches }: { alpha: boolean; swatches: boolean }) {
  return (
    <>
      <ColorArea />
      <ColorHueSlider />
      {alpha && <ColorAlphaSlider />}
      <div data-slot="color-picker-row" className="flex flex-wrap items-center gap-2">
        <ColorInput className="min-w-32 flex-1" />
        <ColorFormatToggle />
        <ColorEyeDropper />
      </div>
      {swatches && <ColorSwatches />}
    </>
  );
}

/**
 * The root's Field and Form wiring, rendered only when the picker joins (so no hook is
 * conditional): the hidden input carrying the hex, the Field registration (the area thumb is the
 * control Form focuses), a `null` labelable id (the group is named by `aria-labelledby`, so the
 * FieldLabel points at no control) and the root as the Field's blur boundary.
 */
function ColorPickerFormControl({
  hex,
  name,
  form,
  disabled,
  controlRef,
  rootRef,
}: {
  hex: string;
  name: string | undefined;
  form: string | undefined;
  disabled: boolean;
  controlRef: RefObject<HTMLElement | null>;
  rootRef: RefObject<HTMLElement | null>;
}) {
  const field = useFieldRootContext();
  useLabelableId({ id: null });
  const formControl = useFormControl({
    value: hex,
    inputValue: hex,
    formValue: hex,
    name: name ?? field.name,
    form,
    registrationName: name,
    disabled,
    customValidity: "",
    controlRef,
    slot: "color-picker-form-control",
  });
  useFocusScope(() => [rootRef.current], formControl.onFocus, formControl.onBlur);
  return formControl.input;
}

type PointerHandlers = Pick<
  ComponentProps<"div">,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture"
>;

/**
 * The pointer engine the area and the channels share. A primary-button press moves the thumb
 * there, focuses it (the press's default is prevented, so no text is selected and focus is not
 * moved elsewhere) and captures the pointer; moves update; up / cancel / lost capture end the drag
 * and commit once. `onMove` gets the pointer's position in the surface, 0–1 on each axis, clamped.
 */
function useSurfaceDrag(
  disabled: boolean,
  thumbRef: RefObject<HTMLElement | null>,
  onMove: (x: number, y: number) => void,
  onEnd: () => void,
  props: PointerHandlers,
) {
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onMove(
      clamp((event.clientX - rect.left) / rect.width, 0, 1),
      clamp((event.clientY - rect.top) / rect.height, 0, 1),
    );
  };
  const end = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    onEnd();
  };
  const handlers: Required<PointerHandlers> = {
    onPointerDown(event) {
      props.onPointerDown?.(event);
      if (disabled || event.button !== 0 || event.defaultPrevented) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      draggingRef.current = true;
      setDragging(true);
      thumbRef.current?.focus({ preventScroll: true });
      move(event);
    },
    onPointerMove(event) {
      props.onPointerMove?.(event);
      if (draggingRef.current) move(event);
    },
    onPointerUp(event) {
      props.onPointerUp?.(event);
      end();
    },
    onPointerCancel(event) {
      props.onPointerCancel?.(event);
      end();
    },
    onLostPointerCapture(event) {
      props.onLostPointerCapture?.(event);
      end();
    },
  };
  return { dragging, handlers };
}

/** The keyboard step of a channel: the next value, or `null` for a key the channel ignores. */
function channelStep(
  event: KeyboardEvent,
  value: number,
  max: number,
  page: number,
): number | null {
  const current = Math.round(value);
  const step = event.shiftKey ? 10 : 1;
  switch (event.key) {
    case "ArrowLeft":
    case "ArrowDown":
      return clamp(current - step, 0, max);
    case "ArrowRight":
    case "ArrowUp":
      return clamp(current + step, 0, max);
    case "PageUp":
      return clamp(current + page, 0, max);
    case "PageDown":
      return clamp(current - page, 0, max);
    case "Home":
      return 0;
    case "End":
      return max;
    default:
      return null;
  }
}

export interface ColorAreaProps extends Omit<ComponentProps<"div">, "children"> {
  /** The thumb's `aria-valuetext`. @default (s, v) => `Saturation ${s}%, Brightness ${v}%` */
  getValueText?: (saturation: number, brightness: number) => string;
  /** The thumb's name. @default "Saturation and brightness" */
  "aria-label"?: string;
}

/**
 * The 2D saturation (x) / brightness (y) plane for the current hue. Its thumb is one focusable
 * `role="slider"` (React Aria's ColorArea approach): ←/→ saturation, ↑/↓ brightness (Shift ×10),
 * PageUp/PageDown brightness ±10, Home/End saturation 0/100. Physical, so `dir="ltr"` in RTL too.
 */
export function ColorArea({
  getValueText = (s, v) => `Saturation ${s}%, Brightness ${v}%`,
  "aria-label": ariaLabel = "Saturation and brightness",
  className,
  style,
  ...props
}: ColorAreaProps) {
  const picker = useColorPicker("ColorArea");
  const { hsva, disabled, areaThumbRef } = picker;
  const { dragging, handlers } = useSurfaceDrag(
    disabled,
    areaThumbRef,
    (x, y) => picker.update({ ...picker.hsva, s: x * 100, v: (1 - y) * 100 }, false),
    picker.commit,
    props,
  );
  const s = Math.round(hsva.s);
  const v = Math.round(hsva.v);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = event.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [s - step, v],
      ArrowRight: [s + step, v],
      ArrowUp: [s, v + step],
      ArrowDown: [s, v - step],
      PageUp: [s, v + 10],
      PageDown: [s, v - 10],
      Home: [0, v],
      End: [100, v],
    };
    const next = moves[event.key];
    if (!next) return;
    event.preventDefault();
    picker.update({ ...hsva, s: clamp(next[0], 0, 100), v: clamp(next[1], 0, 100) }, true);
  };
  return (
    <div
      {...props}
      {...handlers}
      dir="ltr"
      data-slot="color-area"
      data-dragging={dragging ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      className={cn(colorAreaClasses, className)}
      style={{
        backgroundImage: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsva.h} 100% 50%))`,
        ...style,
      }}
    >
      <div
        ref={areaThumbRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-roledescription="2D slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={s}
        aria-valuetext={getValueText(s, v)}
        aria-disabled={disabled || undefined}
        data-slot="color-area-thumb"
        className={colorAreaThumbClasses}
        style={{
          left: `${hsva.s}%`,
          top: `${100 - hsva.v}%`,
          backgroundColor: hexOf({ ...hsva, a: 1 }, false),
        }}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

interface ChannelSliderProps extends Omit<ComponentProps<"div">, "children"> {
  /** The thumb's `aria-valuetext`, given the rounded value. */
  getValueText?: (value: number) => string;
  /** The thumb's name. */
  "aria-label"?: string;
}

/** The track + thumb both channels render. */
function ChannelSlider({
  channel,
  value,
  max,
  page,
  onValue,
  getValueText,
  ariaLabel,
  trackBackground,
  thumbFill,
  className,
  style,
  ...props
}: Omit<ChannelSliderProps, "getValueText" | "aria-label"> & {
  channel: "hue" | "alpha";
  value: number;
  max: number;
  page: number;
  onValue: (value: number, commit: boolean) => void;
  getValueText: (value: number) => string;
  ariaLabel: string;
  trackBackground: ReactNode;
  thumbFill: ReactNode;
}) {
  const picker = useColorPicker(channel === "hue" ? "ColorHueSlider" : "ColorAlphaSlider");
  const { disabled } = picker;
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const { dragging, handlers } = useSurfaceDrag(
    disabled,
    thumbRef,
    (x) => onValue(x * max, false),
    picker.commit,
    props,
  );
  const rounded = Math.round(value);
  return (
    <div
      {...props}
      {...handlers}
      dir="ltr"
      data-slot={channel === "hue" ? "color-hue-slider" : "color-alpha-slider"}
      data-dragging={dragging ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      className={cn(colorSliderTrackClasses, channel === "alpha" && checkerboardClasses, className)}
      style={style}
    >
      {trackBackground}
      <div
        ref={thumbRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={rounded}
        aria-valuetext={getValueText(rounded)}
        aria-disabled={disabled || undefined}
        data-slot="color-slider-thumb"
        className={cn(colorSliderThumbClasses, channel === "alpha" && checkerboardClasses)}
        style={{ left: `${(value / max) * 100}%` }}
        onKeyDown={(event) => {
          if (disabled) return;
          const next = channelStep(event, value, max, page);
          if (next === null) return;
          event.preventDefault();
          onValue(next, true);
        }}
      >
        {thumbFill}
      </div>
    </div>
  );
}

export interface ColorHueSliderProps extends ChannelSliderProps {}

/**
 * The hue channel, 0–360 (360 is red again): ←/↓ −1, →/↑ +1, Shift ±10, PageUp/PageDown ±15,
 * Home/End 0/360. Physical, so `dir="ltr"` in RTL too.
 */
export function ColorHueSlider({
  getValueText = (hue) => `${hue}°`,
  "aria-label": ariaLabel = "Hue",
  ...props
}: ColorHueSliderProps) {
  const picker = useColorPicker("ColorHueSlider");
  const { hsva } = picker;
  return (
    <ChannelSlider
      {...props}
      channel="hue"
      value={hsva.h}
      max={360}
      page={15}
      onValue={(h, commit) => picker.update({ ...picker.hsva, h }, commit)}
      getValueText={getValueText}
      ariaLabel={ariaLabel}
      style={{
        backgroundImage:
          "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
        ...props.style,
      }}
      trackBackground={null}
      thumbFill={
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: `hsl(${hsva.h} 100% 50%)` }}
        />
      }
    />
  );
}

export interface ColorAlphaSliderProps extends ChannelSliderProps {}

/**
 * The alpha channel, 0–100%, over a checkerboard: ←/↓ −1, →/↑ +1, Shift and PageUp/PageDown ±10,
 * Home/End 0/100. Render it only in a picker with `alpha` (without it the alpha is always 1).
 */
export function ColorAlphaSlider({
  getValueText = (alpha) => `${alpha}%`,
  "aria-label": ariaLabel = "Alpha",
  ...props
}: ColorAlphaSliderProps) {
  const picker = useColorPicker("ColorAlphaSlider");
  const { hsva } = picker;
  const opaque = hexOf({ ...hsva, a: 1 }, false);
  return (
    <ChannelSlider
      {...props}
      channel="alpha"
      value={hsva.a * 100}
      max={100}
      page={10}
      onValue={(a, commit) => picker.update({ ...picker.hsva, a: a / 100 }, commit)}
      getValueText={getValueText}
      ariaLabel={ariaLabel}
      trackBackground={
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{ backgroundImage: `linear-gradient(to right, transparent, ${opaque})` }}
        />
      }
      thumbFill={
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: hexOf(hsva, true) }}
        />
      }
    />
  );
}

export interface ColorInputProps
  extends Omit<ComponentProps<"input">, "value" | "defaultValue" | "type"> {
  /** Pins the shown format; by default the picker's (`ColorFormatToggle`). */
  format?: ColorFormat;
  /** @default "Color value" */
  "aria-label"?: string;
}

/**
 * The colour as text (a native input, so it never registers with a Field). Typing does not change
 * the value: Enter or blur commits a parsable colour in any format and shows it in the display
 * format; an unparsable text is `aria-invalid` while focused and reverts on blur; Escape reverts
 * (and claims the Escape when there was an edit, so an enclosing overlay closes on the next one).
 * Enter with nothing typed is left alone, so it submits an enclosing form as usual.
 */
export function ColorInput({
  format: formatProp,
  "aria-label": ariaLabel = "Color value",
  className,
  disabled,
  onChange,
  onBlur,
  onKeyDown,
  ...props
}: ColorInputProps) {
  const picker = useColorPicker("ColorInput");
  const display = formatColor(hsvToRgb(picker.hsva), formatProp ?? picker.format);
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseColor(draft) === null;
  const commit = () => {
    if (draft === null) return;
    const rgba = parseColor(draft);
    if (!rgba) return;
    setDraft(null);
    picker.commitColor(rgba);
  };
  return (
    <input
      // A colour value is LTR data ("#ffffff", not "ffffff#"); `rtl:text-right` keeps the text at
      // the inline start of an RTL page.
      dir="ltr"
      {...props}
      type="text"
      value={draft ?? display}
      disabled={picker.disabled || disabled}
      spellCheck={false}
      autoComplete="off"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      data-slot="color-input"
      className={inputVariants({
        size: "sm",
        className: cn("font-mono rtl:text-right", picker.disabled && noSecondFade.input, className),
      })}
      onChange={(event) => {
        onChange?.(event);
        setDraft(event.target.value);
      }}
      onBlur={(event) => {
        onBlur?.(event);
        commit();
        setDraft(null);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || draft === null) return;
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          if (draft !== display) claimEscape(event.nativeEvent);
          setDraft(null);
        }
      }}
    />
  );
}

const formats: ColorFormat[] = ["hex", "rgb", "hsl"];

const defaultFormatLabel = (format: ColorFormat) => format.toUpperCase();

export interface ColorFormatToggleProps
  extends Omit<
    ToggleGroupProps,
    "value" | "defaultValue" | "onValueChange" | "multiple" | "children"
  > {
  /** Each item's text and name. @default hex → "HEX", rgb → "RGB", hsl → "HSL" */
  formatLabel?: (format: ColorFormat) => string;
  /** @default "Color format" */
  "aria-label"?: string;
}

/** Chooses the text field's format: a single, never-empty, outline ToggleGroup (HEX / RGB / HSL). */
export function ColorFormatToggle({
  formatLabel = defaultFormatLabel,
  "aria-label": ariaLabel = "Color format",
  ...props
}: ColorFormatToggleProps) {
  const picker = useColorPicker("ColorFormatToggle");
  return (
    <ToggleGroup
      {...props}
      // Tessera's ToggleGroup sets its own `data-slot`; the render element's props win over it.
      render={<div data-slot="color-format-toggle" />}
      variant="outline"
      size="sm"
      aria-label={ariaLabel}
      value={[picker.format]}
      onValueChange={(values) => {
        const next = values[0] as ColorFormat | undefined;
        if (next) picker.setFormat(next);
      }}
      disabled={picker.disabled || props.disabled}
    >
      {formats.map((format) => (
        <ToggleGroupItem
          key={format}
          value={format}
          className={picker.disabled ? noSecondFade.toggle : undefined}
        >
          {formatLabel(format)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

type EyeDropperConstructor = new () => { open: () => Promise<{ sRGBHex: string }> };

function eyeDropper(): EyeDropperConstructor | undefined {
  // `typeof`, not `"EyeDropper" in window`: a stubbed-out `EyeDropper = undefined` still has the key.
  const api = (window as { EyeDropper?: unknown }).EyeDropper;
  return typeof api === "function" ? (api as EyeDropperConstructor) : undefined;
}

export interface ColorEyeDropperProps
  extends Omit<ButtonProps, "variant" | "color" | "size" | "children"> {
  /** @default "Pick a color from the screen" */
  "aria-label"?: string;
}

/**
 * Picks a colour from the screen with the browser's EyeDropper API (an outline icon button). It
 * renders nothing where the API is missing, decided after mount, so the server HTML and the first
 * client render agree. While picking it is `aria-disabled` but keeps focus (so an enclosing Field is
 * not blurred mid-pick) and ignores clicks, with muted text rather than a fade. Escape in the
 * browser's picker (`AbortError`) changes nothing; any other rejection (`NotAllowedError`, …) is
 * swallowed with a dev-only warning; a pick that settles after unmount is dropped.
 */
export function ColorEyeDropper({
  "aria-label": ariaLabel = "Pick a color from the screen",
  onClick,
  disabled,
  className,
  ...props
}: ColorEyeDropperProps) {
  const picker = useColorPicker("ColorEyeDropper");
  const [supported, setSupported] = useState(false);
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    setSupported(eyeDropper() !== undefined);
    return () => {
      mounted.current = false;
    };
  }, []);
  if (!supported) return null;
  const pick = async () => {
    const EyeDropper = eyeDropper();
    if (!EyeDropper || pickingRef.current) return;
    pickingRef.current = true;
    setPicking(true);
    try {
      const { sRGBHex } = await new EyeDropper().open();
      const rgba = parseColor(sRGBHex);
      if (rgba && mounted.current) picker.commitColor(rgba);
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      if (!aborted && process.env.NODE_ENV !== "production") {
        console.warn("ColorEyeDropper: the EyeDropper could not pick a colour.", error);
      }
    } finally {
      pickingRef.current = false;
      if (mounted.current) setPicking(false);
    }
  };
  return (
    <Button
      {...props}
      // Button sets its own `data-slot`; the render element's props win over it.
      render={<button type="button" data-slot="color-eye-dropper" />}
      variant="outline"
      color="neutral"
      size="icon-sm"
      aria-label={ariaLabel}
      disabled={picker.disabled || picking || disabled}
      focusableWhenDisabled={picking && !picker.disabled && !disabled}
      className={mergeClassName(
        cn(
          picker.disabled && noSecondFade.button,
          picking && `${noSecondFade.button} text-muted-foreground forced-colors:text-[GrayText]`,
        ),
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !pickingRef.current) void pick();
      }}
    >
      <PipetteIcon />
    </Button>
  );
}

export interface ColorSwatchesProps
  extends Omit<
    BaseToggleGroup.Props<string>,
    "value" | "defaultValue" | "onValueChange" | "multiple"
  > {
  /** The swatches to render when there are no `children`. @default the picker's `swatches` */
  swatches?: ColorSwatchOption[];
  /** @default "Swatches" */
  "aria-label"?: string;
}

/**
 * Preset colours: a single ToggleGroup (arrow keys move, one Tab stop, ←/→ follow the page
 * direction). Pressing a swatch sets and commits its colour; the swatch equal to the value is
 * pressed, and pressing it again does nothing. `children` (`ColorSwatch`es) replace `swatches`.
 */
export function ColorSwatches({
  swatches,
  children,
  "aria-label": ariaLabel = "Swatches",
  className,
  ...props
}: ColorSwatchesProps) {
  const picker = useColorPicker("ColorSwatches");
  const options = swatches ?? picker.swatches ?? [];
  return (
    <BaseToggleGroup
      {...props}
      aria-label={ariaLabel}
      value={[picker.hex]}
      onValueChange={(values) => {
        const rgba = values[0] === undefined ? null : parseColor(values[0]);
        if (rgba) picker.commitColor(rgba);
      }}
      disabled={picker.disabled || props.disabled}
      data-slot="color-swatches"
      className={mergeClassName("flex flex-wrap gap-1.5", className)}
    >
      {children ??
        options.map((option) =>
          typeof option === "string" ? (
            <ColorSwatch key={option} value={option} />
          ) : (
            <ColorSwatch key={option.value} value={option.value} label={option.label} />
          ),
        )}
    </BaseToggleGroup>
  );
}

export interface ColorSwatchProps extends Omit<BaseToggle.Props, "value" | "children"> {
  /** The colour (any format `parseColor` reads). */
  value: string;
  /** The accessible name. @default the colour's hex */
  label?: string;
}

/**
 * One swatch (a Base UI Toggle in `ColorSwatches`). Pressed when its colour equals the value
 * (compared as the picker's hex), and then marked with a check in black or white, whichever
 * contrasts more, so the selection is never shown by colour alone.
 */
export function ColorSwatch({ value, label, className, style, ...props }: ColorSwatchProps) {
  const picker = useColorPicker("ColorSwatch");
  const rgba = parseColor(value);
  // Keyed by the string only: `rgba` is a new object every render.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && !parseColor(value)) {
      console.warn(`ColorSwatch: skipping the unparsable colour "${value}".`);
    }
  }, [value]);
  // A swatch that could never set a colour is left out rather than shown doing nothing.
  if (!rgba) return null;
  const hex = formatHex(rgba, { alpha: picker.alpha ? "auto" : "never" });
  const translucent = picker.alpha && rgba.a < 1;
  const pressed = hex === picker.hex;
  return (
    <BaseToggle
      {...props}
      value={hex}
      aria-label={label ?? hex}
      data-slot="color-swatch"
      className={mergeClassName(
        cn(colorSwatchClasses, translucent && checkerboardClasses),
        className,
      )}
      style={mergeStyle(translucent ? undefined : { backgroundColor: hex }, style)}
    >
      {translucent && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-[inherit]"
          style={{ backgroundColor: hex }}
        />
      )}
      {pressed && (
        <CheckIcon
          className="absolute inset-0 m-auto size-4"
          style={{ color: readableForeground(compositeOver(rgba, white)) }}
        />
      )}
    </BaseToggle>
  );
}
