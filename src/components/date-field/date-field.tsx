"use client";

/*
 * Field wiring goes through the same two Base UI internals DatePicker uses (see date-picker.tsx):
 * the Field root context (disabled / invalid state) and the labelable context (the label's id and
 * the description ids). The group isn't a labelable element, so — like Base UI's CheckboxGroup —
 * it registers a `null` control id (the FieldLabel then omits `for`) and takes its name from
 * `aria-labelledby` instead. Form and Field validation go through the shared date form control
 * (`../date-picker/date-form-control.tsx`).
 */
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useLabelableContext, useLabelableId } from "@base-ui/react/internals/labelable-provider";
import {
  type ComponentProps,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { isSameDay, resolveLocale, toISODate } from "../../lib/date";
import {
  type DateSegments,
  type DateSegmentType,
  dateToSegments,
  getDateSegmentOrder,
  getLocaleDigits,
  getSegmentLabel,
  getSegmentPlaceholder,
  incrementSegment,
  parseDateString,
  parseDigit,
  segmentBounds,
  segmentsToDate,
  typeDigit,
} from "../../lib/date-segments";
import { useControllableState } from "../../lib/use-controllable-state";
import {
  type DateValidationLabels,
  dateValidationMessage,
  useDateFormControl,
  useFocusScope,
} from "../date-picker/date-form-control";
import { textFieldSizes } from "../input/input-variants";

/**
 * Translatable strings for the segments' accessible names, the empty value text and the
 * validation messages.
 */
export interface DateFieldLabels extends DateValidationLabels {
  /** The validation message while only some segments are filled. @default "Enter a complete date." */
  incomplete?: string;
  /** @default the locale's `Intl.DisplayNames` "day" (English "day" where unsupported) */
  day?: string;
  /** @default the locale's `Intl.DisplayNames` "month" */
  month?: string;
  /** @default the locale's `Intl.DisplayNames` "year" */
  year?: string;
  /** A segment's `aria-valuetext` while it is empty. @default "Empty" */
  empty?: string;
}

export interface DateFieldProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "children"> {
  /** The date, controlled (`null` for none). */
  value?: Date | null;
  /** The initial date. @default null */
  defaultValue?: Date | null;
  /**
   * Called with the date once all segments form a valid day, and with `null` when the user
   * clears a segment of a complete date. Partial input never calls it.
   */
  onValueChange?: (value: Date | null) => void;
  /** The earliest valid day; an earlier date is shown as invalid. */
  min?: Date | null;
  /** The latest valid day; a later date is shown as invalid. */
  max?: Date | null;
  /** Marks individual days invalid (returns `true` for a disallowed day). */
  isDateDisabled?: (date: Date) => boolean;
  /**
   * BCP 47 locale for the segment order, digits, names and placeholders.
   * @default the document's `lang`, else the browser's
   *
   * Pass it explicitly when server-rendering: the default reads `document.documentElement.lang`
   * on the client only, which can disagree with the server and cause a hydration mismatch.
   */
  locale?: string;
  /** Disables every segment (a disabled `Field` does too). */
  disabled?: boolean;
  /** Keeps the segments focusable but ignores edits. */
  readOnly?: boolean;
  /** Requires a complete date to submit (marks the segments `aria-required`). */
  required?: boolean;
  /**
   * Submits the value as `YYYY-MM-DD` (empty when unset) through a visually hidden input; in a
   * `Field` and `Form`, `onFormSubmit` reports it under the Field's name (else this one).
   */
  name?: string;
  /** Height, padding and text size, as Input and Select. @default "md" */
  size?: keyof typeof textFieldSizes;
  /** Translated segment names, empty text and validation messages. */
  labels?: DateFieldLabels;
  /**
   * @internal For `DatePicker editable`. The elements that together form the control (the field
   * plus its icon button and popup): the Field's focused / touched state and `onBlur` validation
   * follow focus entering and leaving them as a whole, not the segments' group alone. The first
   * is the main element (the field and its button), a later one the popup (see `useFocusScope`).
   */
  focusScope?: () => (Element | null)[];
}

/**
 * The text-field look on a group (spec Phase H §2): `textFieldStates` written out for a `<div>`
 * with a `focus-within` ring, as `textFieldGroupBase` (no `outline-color` transition, keyed off
 * `data-invalid` / `data-disabled` / `data-readonly`).
 */
const rootBase = [
  "inline-flex w-full min-w-0 items-center gap-0.5 rounded-md border border-field-border bg-field text-foreground shadow-xs tabular-nums cursor-text",
  "not-data-disabled:not-data-invalid:not-focus-within:hover:border-field-border-hover",
  "outline-none focus-within:outline-1 focus-within:outline-solid focus-within:outline-ring focus-within:border-ring forced-colors:focus-within:outline-[Highlight]",
  // The forced-colors Highlight ring restated for the invalid state (as `textFieldGroupBase`):
  // `data-invalid:focus-within:` is more specific than `forced-colors:focus-within:`, so without
  // it the danger outline (forced to CanvasText) would win, unlike Input's `:focus` ring, which
  // stays Highlight.
  "data-invalid:border-danger data-invalid:focus-within:outline-danger forced-colors:data-invalid:focus-within:outline-[Highlight]",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-readonly:bg-muted",
  "transition-[color,background-color,border-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none",
];

const segmentBase = [
  // `not-focus:` on the placeholder colour: Tailwind emits `data-*` variants after `focus:`, so a
  // plain `data-placeholder:text-muted-foreground` would win over the focused text colour and
  // paint muted text on the primary fill.
  "rounded-sm px-0.5 caret-transparent outline-none focus:bg-primary focus:text-primary-foreground data-placeholder:not-focus:text-muted-foreground",
  "forced-colors:focus:bg-[Highlight] forced-colors:focus:text-[HighlightText] forced-colors:focus:forced-color-adjust-none",
];

const literalBase = "text-muted-foreground";

/** PageUp / PageDown steps (spec §2): month by 1, day by a week, year by a decade. */
const pageStep: Record<DateSegmentType, number> = { month: 1, day: 7, year: 10 };

const segmentSelector = "[data-slot=date-field-segment]";

/** Keys a focused segment always swallows: edits, and the stepping keys that would scroll. */
const preventedKeys = new Set([
  "Enter",
  "Backspace",
  "Delete",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

/** `day` clamped to the month's length once the month and year are both known (Jan 31 → Feb 28). */
function clampSegmentDay(segments: DateSegments): DateSegments {
  if (segments.day === null) return segments;
  const { max } = segmentBounds("day", segments);
  return segments.day > max ? { ...segments, day: max } : segments;
}

/**
 * Focuses `root`'s first empty segment, else its first. Reads the DOM only, so the label's native
 * click listener never sees stale state.
 */
function focusFirstEmpty(root: HTMLElement | null) {
  if (!root || root.hasAttribute("data-disabled")) return;
  const elements = [...root.querySelectorAll<HTMLElement>(segmentSelector)];
  (elements.find((element) => element.hasAttribute("data-placeholder")) ?? elements[0])?.focus();
}

function sameValue(a: Date | null, b: Date | null) {
  return a === b || isSameDay(a, b);
}

/**
 * A typed, segmented date input (React Aria's date-field pattern): a `group` of `spinbutton`
 * segments in the locale's order. Digits type with auto-advance, ↑/↓ step with wrap, PageUp /
 * PageDown step further, Home / End jump to the bounds, Backspace / Delete clear, ←/→ (flipped
 * in RTL) and Tab move between segments, the literal separator advances, and pasting a date in
 * the locale's format or ISO fills every segment. Name it with a `Field` label, `aria-labelledby`
 * or `aria-label`.
 */
export function DateField({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  min,
  max,
  isDateDisabled,
  locale: localeProp,
  disabled: disabledProp,
  readOnly = false,
  required,
  name,
  size,
  labels,
  focusScope,
  ref,
  id: idProp,
  className,
  // Moved to the segments (the spinbuttons are what is invalid), not left on the group.
  "aria-invalid": ariaInvalid,
  ...props
}: DateFieldProps) {
  const field = useFieldRootContext();
  const { labelId: fieldLabelId, getDescriptionProps } = useLabelableContext();
  // The group is named by `aria-labelledby`, so the FieldLabel must not point `for` at it.
  useLabelableId({ id: null });
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRootRef = useCallback(
    (element: HTMLDivElement | null) => {
      rootRef.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    [ref],
  );

  const locale = resolveLocale(localeProp);
  const intl = useMemo(
    () => ({
      order: getDateSegmentOrder(locale),
      digits: getLocaleDigits(locale),
      number: new Intl.NumberFormat(locale, { useGrouping: false }),
      twoDigits: new Intl.NumberFormat(locale, { useGrouping: false, minimumIntegerDigits: 2 }),
      monthName: new Intl.DateTimeFormat(locale, { month: "long", calendar: "gregory" }),
      label: (type: DateSegmentType) => getSegmentLabel(type, locale),
      placeholder: (type: DateSegmentType) => getSegmentPlaceholder(type, locale),
    }),
    [locale],
  );
  const segmentTypes = intl.order
    .filter((part) => part.type !== "literal")
    .map((part) => part.type as DateSegmentType);
  const literalKeys = new Set(
    intl.order
      .flatMap((part) => (part.type === "literal" ? [...part.value] : []))
      // Not whitespace or bidi marks (ar-EG's slash carries a right-to-left mark, category Cf).
      .filter((char) => !/[\s\p{Cf}]/u.test(char)),
  );

  const [value, setValue] = useControllableState(valueProp, defaultValue);
  const [segments, setSegments] = useState(() => dateToSegments(value));
  // The value the segments last showed: a different incoming value (a controlled change, or a
  // parent refusing the user's change) resets them; the same value keeps partial input.
  const [synced, setSynced] = useState(value);
  if (!sameValue(value, synced)) {
    setSynced(value);
    setSegments(dateToSegments(value));
  }
  // Digits typed into the focused segment so far (the next digit appends to them).
  const [entry, setEntry] = useState<{ type: DateSegmentType; buffer: string } | null>(null);
  // Whether the shown segments hold a year still being typed, not yet reported (nor used to clamp
  // the day: "2" on the way to "2024" would clamp Feb 29 to 28). State for rendering, plus a ref
  // for the blur that can fire synchronously inside the same handler.
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);
  /** A segment's range; a held year counts as unknown, so the day isn't bounded by year "2". */
  const boundsOf = (type: DateSegmentType) =>
    segmentBounds(type, held ? { ...segments, year: null } : segments);

  const disabled = !!disabledProp || field.state.disabled;
  const editable = !disabled && !readOnly;
  const rangeMessage = dateValidationMessage(value, { min, max, isDateDisabled }, labels, locale);
  const outOfRange = rangeMessage !== "";
  const invalid =
    field.state.valid === false || outOfRange || ariaInvalid === true || ariaInvalid === "true";
  // Some segments typed but no complete date: invalid at validation time (not shown before).
  const partial =
    value === null && (segments.month !== null || segments.day !== null || segments.year !== null);

  // Form focuses the first segment of an invalid field.
  const firstSegmentRef = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return rootRef.current?.querySelector<HTMLElement>(segmentSelector) ?? null;
      },
    }),
    [],
  );
  const formControl = useDateFormControl({
    value,
    inputValue: value ? toISODate(value) : "",
    formValue: value ? toISODate(value) : "",
    name: name ?? field.name,
    registrationName: name,
    required,
    disabled,
    readOnly,
    customValidity: partial ? (labels?.incomplete ?? "Enter a complete date.") : rangeMessage,
    controlRef: firstSegmentRef,
  });

  // The boundary is the group, or the `focusScope` (the editable DatePicker's field, button and
  // popup), under the date controls' one blur rule.
  useFocusScope(() => focusScope?.() ?? [rootRef.current], formControl.onFocus, formControl.onBlur);

  const ariaLabelledBy =
    props["aria-labelledby"] ?? (props["aria-label"] ? undefined : fieldLabelId);
  // What names the field, for each segment's `aria-labelledby`: the labelling ids, or the group
  // itself when it is named by `aria-label`.
  const segmentLabelSource = ariaLabelledBy ?? (props["aria-label"] ? id : undefined);
  const { "aria-describedby": ariaDescribedBy } = getDescriptionProps({
    "aria-describedby": props["aria-describedby"],
  });

  const emit = (date: Date | null) => {
    setSynced(date);
    setValue(date);
    onValueChange?.(date);
  };

  /** Shows `next`; reports its date (or `null`) unless `hold` (a year still being typed). */
  const commit = (next: DateSegments, hold = false) => {
    heldRef.current = hold;
    setHeld(hold);
    if (hold) {
      setSegments(next);
      return;
    }
    const clamped = clampSegmentDay(next);
    setSegments(clamped);
    const date = segmentsToDate(clamped);
    if (date) {
      if (!sameValue(date, value)) emit(date);
    } else if (value !== null) {
      emit(null);
    }
  };

  const segmentElements = () => [
    ...(rootRef.current?.querySelectorAll<HTMLElement>(segmentSelector) ?? []),
  ];
  const focusSegment = (index: number) => {
    const elements = segmentElements();
    elements[Math.max(0, Math.min(index, elements.length - 1))]?.focus();
  };
  const typeInto = (type: DateSegmentType, index: number, digit: number) => {
    const { max: bound } = boundsOf(type);
    const typed = typeDigit(entry?.type === type ? entry.buffer : "", digit, type, bound);
    // A year is reported once its four digits are in (or on blur): "2", "20", "202" on the way to
    // "2026" are valid years, but reporting each would jump a linked calendar through the ages.
    commit({ ...segments, [type]: typed.value }, type === "year" && !typed.advance);
    if (typed.advance && index < segmentTypes.length - 1) {
      setEntry(null);
      focusSegment(index + 1);
    } else {
      setEntry({ type, buffer: typed.buffer });
    }
  };

  const clear = (type: DateSegmentType) => {
    setEntry(null);
    commit({ ...segments, [type]: null });
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    type: DateSegmentType,
    index: number,
  ) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const { key } = event;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
      const forward = (key === "ArrowRight") !== rtl;
      focusSegment(index + (forward ? 1 : -1));
      return;
    }
    if (key === "Tab") return;
    // Everything else is handled here or ignored: never let the browser edit the segment's text,
    // and never let the stepping keys scroll the page (read-only included).
    if (key.length === 1 || preventedKeys.has(key)) event.preventDefault();
    if (!editable) return;

    const current = segments[type];
    const bounds = boundsOf(type);
    const set = (next: number) => {
      setEntry(null);
      commit({ ...segments, [type]: next });
    };
    switch (key) {
      case "ArrowUp":
        return set(incrementSegment(current, type, 1, bounds));
      case "ArrowDown":
        return set(incrementSegment(current, type, -1, bounds));
      case "PageUp":
        return set(incrementSegment(current, type, pageStep[type], bounds));
      case "PageDown":
        return set(incrementSegment(current, type, -pageStep[type], bounds));
      case "Home":
        return set(bounds.min);
      case "End":
        return set(bounds.max);
      case "Backspace":
        if (current === null && !(entry?.type === type && entry.buffer)) focusSegment(index - 1);
        else clear(type);
        return;
      case "Delete":
        return clear(type);
    }
    const digit = parseDigit(key, intl.digits);
    if (digit !== null) typeInto(type, index, digit);
    else if (literalKeys.has(key)) focusSegment(index + 1);
  };

  // Mobile keyboards send "Unidentified" keydowns and deliver the text through `beforeinput`
  // instead; handle that too, and never let it edit the DOM React renders.
  const beforeInputRef = useRef<(event: InputEvent) => void>(() => {});
  beforeInputRef.current = (event: InputEvent) => {
    event.preventDefault();
    const target = (event.target as HTMLElement).closest<HTMLElement>(segmentSelector);
    if (!editable || !target) return;
    const type = target.dataset.type as DateSegmentType;
    const index = segmentTypes.indexOf(type);
    if (event.inputType.startsWith("delete")) {
      clear(type);
      return;
    }
    const data = event.data ?? "";
    // One character per event in practice; the first one wins (focus may move after it).
    const char = [...data][0];
    if (char === undefined) return;
    const digit = parseDigit(char, intl.digits);
    if (digit !== null) typeInto(type, index, digit);
    else if (literalKeys.has(char)) focusSegment(index + 1);
  };
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const listener = (event: InputEvent) => beforeInputRef.current(event);
    element.addEventListener("beforeinput", listener);
    return () => element.removeEventListener("beforeinput", listener);
  }, []);

  // A FieldLabel has no `for` (the group isn't labelable): clicking it focuses the first empty
  // segment instead, as a native label would focus its control.
  useEffect(() => {
    if (!fieldLabelId) return;
    const root = rootRef.current;
    const label = root?.ownerDocument.getElementById(fieldLabelId);
    if (!label) return;
    const onClick = () => focusFirstEmpty(root);
    label.addEventListener("click", onClick);
    return () => label.removeEventListener("click", onClick);
  }, [fieldLabelId]);

  /** Zeros typed into an empty segment so far ("0", "00"), in the locale's digits; "" otherwise. */
  const typedZeros = (type: DateSegmentType): string => {
    const buffer = entry?.type === type && segments[type] === null ? entry.buffer : "";
    return buffer.replace(/\d/g, (char) => intl.digits[Number(char)] as string);
  };

  const display = (type: DateSegmentType): string => {
    const segmentValue = segments[type];
    if (segmentValue === null) return typedZeros(type) || intl.placeholder(type);
    return type === "year" ? intl.number.format(segmentValue) : intl.twoDigits.format(segmentValue);
  };

  const valueText = (type: DateSegmentType): string => {
    const segmentValue = segments[type];
    // A leading "0" keeps the value empty (as React Aria) but is on screen, so it's announced.
    if (segmentValue === null) return typedZeros(type) || (labels?.empty ?? "Empty");
    if (type === "month") return intl.monthName.format(new Date(2000, segmentValue - 1, 1));
    return intl.number.format(segmentValue);
  };

  let segmentIndex = 0;
  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: React Aria's pattern is a div group; a <fieldset> brings UA borders, padding and min-width, and names itself from a <legend>, not the Field label. */}
      <div
        {...props}
        ref={setRootRef}
        id={id}
        role="group"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        data-slot="date-field"
        data-size={size ?? "md"}
        data-invalid={invalid ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        data-readonly={readOnly ? "" : undefined}
        className={cn(rootBase, textFieldSizes[size ?? "md"], className)}
        onMouseDown={(event) => {
          props.onMouseDown?.(event);
          if (disabled || event.defaultPrevented) return;
          if ((event.target as HTMLElement).closest(segmentSelector)) return;
          // Clicking the padding or a literal focuses the first empty segment (else the first).
          event.preventDefault();
          focusFirstEmpty(rootRef.current);
        }}
        onPaste={(event) => {
          props.onPaste?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          if (!editable) return;
          const date = parseDateString(event.clipboardData.getData("text"), locale);
          if (!date) return;
          setEntry(null);
          commit(dateToSegments(date));
        }}
      >
        {intl.order.map((part, partIndex) => {
          if (part.type === "literal") {
            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: the pattern is static per locale
                key={`literal-${partIndex}`}
                aria-hidden="true"
                data-slot="date-field-literal"
                className={literalBase}
              >
                {part.value}
              </span>
            );
          }
          const { type } = part;
          const index = segmentIndex++;
          const segmentValue = segments[type];
          const bounds = boundsOf(type);
          const segmentId = `${id}-${type}`;
          const empty = segmentValue === null && !(entry?.type === type && entry.buffer);
          return (
            <span
              key={type}
              role="spinbutton"
              data-slot="date-field-segment"
              data-type={type}
              data-placeholder={empty ? "" : undefined}
              id={segmentId}
              // No tabindex at all when disabled: -1 would still take focus from a click.
              tabIndex={disabled ? undefined : 0}
              contentEditable={editable}
              suppressContentEditableWarning
              inputMode="numeric"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label={labels?.[type] ?? intl.label(type)}
              // "month, Due date" (as React Aria): the segment's own name, then the field's.
              aria-labelledby={
                segmentLabelSource ? `${segmentId} ${segmentLabelSource}` : undefined
              }
              aria-valuenow={segmentValue ?? undefined}
              aria-valuemin={bounds.min}
              aria-valuemax={bounds.max}
              aria-valuetext={valueText(type)}
              aria-readonly={readOnly || undefined}
              aria-disabled={disabled || undefined}
              aria-invalid={invalid || undefined}
              aria-required={required || undefined}
              // The first segment's `px-0.5` would push its text 2px past Input's text start;
              // the negative margin pulls it back (logical, so RTL follows).
              className={cn(segmentBase, index === 0 && "-ms-0.5")}
              onFocus={(event) => {
                setEntry(null);
                // Collapse the selection into the segment (as React Aria's useDateSegment): Chrome
                // on Android then fires input events, and no native ::selection highlight shows.
                event.currentTarget.ownerDocument.defaultView
                  ?.getSelection()
                  ?.collapse(event.currentTarget, 0);
              }}
              onBlur={() => {
                // Reports a year held while it was being typed.
                if (heldRef.current) commit(segments);
              }}
              onKeyDown={(event) => handleKeyDown(event, type, index)}
            >
              {display(type)}
            </span>
          );
        })}
      </div>
      {formControl.input}
    </>
  );
}
