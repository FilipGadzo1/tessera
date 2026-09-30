"use client";

/*
 * The segment engine shared by DateField and DateRangeField (spec Phase I §1: "DateRangeField is
 * two DateFields in one group, not a new segment engine"). Internal: not exported from the
 * package index.
 *
 * `useDateSegments` owns one date's segments (the typed digits, the held year, the sync with the
 * value) and renders its spinbuttons and literals; the caller renders the group around them and
 * owns the value, the Field / Form wiring and the paste handling. Focus movement (←/→, the
 * auto-advance, Backspace on an empty segment, the separator key) runs over every segment inside
 * `navigationRef`, so a DateRangeField's two halves form one sequence.
 */
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { isSameDay } from "../../lib/date";
import {
  type DateSegments,
  type DateSegmentType,
  dateToSegments,
  getDateSegmentOrder,
  getLocaleDigits,
  getSegmentLabel,
  getSegmentPlaceholder,
  incrementSegment,
  parseDigit,
  segmentBounds,
  segmentsToDate,
  typeDigit,
} from "../../lib/date-segments";
import { findDefaultButton } from "../../lib/default-button";
import { isRtl } from "../../lib/direction";

/** Translatable segment names and the empty value text. */
export interface DateSegmentLabels {
  /** @default the locale's `Intl.DisplayNames` "day" (English "day" where unsupported) */
  day?: string;
  /** @default the locale's `Intl.DisplayNames` "month" */
  month?: string;
  /** @default the locale's `Intl.DisplayNames` "year" */
  year?: string;
  /** A segment's `aria-valuetext` while it is empty. @default "Empty" */
  empty?: string;
}

/**
 * The text-field look on a group (spec Phase H §2): `textFieldStates` written out for a `<div>`
 * with a `focus-within` ring, as `textFieldGroupBase` (no `outline-color` transition, keyed off
 * `data-invalid` / `data-disabled` / `data-readonly`).
 */
export const dateGroupBase = [
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

export const segmentSelector = "[data-slot=date-field-segment]";

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
export function focusFirstEmpty(root: HTMLElement | null) {
  if (!root || root.hasAttribute("data-disabled")) return;
  const elements = [...root.querySelectorAll<HTMLElement>(segmentSelector)];
  (elements.find((element) => element.hasAttribute("data-placeholder")) ?? elements[0])?.focus();
}

/** Clicking the group's padding or a literal focuses the first empty segment (else the first). */
export function handleGroupMouseDown(event: MouseEvent<HTMLElement>, disabled: boolean) {
  if (disabled || event.defaultPrevented) return;
  if ((event.target as HTMLElement).closest(segmentSelector)) return;
  event.preventDefault();
  focusFirstEmpty(event.currentTarget);
}

export function sameDate(a: Date | null, b: Date | null) {
  return a === b || isSameDay(a, b);
}

/**
 * A FieldLabel has no `for` (the group isn't labelable): clicking it focuses the first empty
 * segment instead, as a native label would focus its control.
 */
export function useLabelFocusesFirstEmpty(
  fieldLabelId: string | undefined,
  rootRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!fieldLabelId) return;
    const root = rootRef.current;
    const label = root?.ownerDocument.getElementById(fieldLabelId);
    if (!label) return;
    const onClick = () => focusFirstEmpty(root);
    label.addEventListener("click", onClick);
    return () => label.removeEventListener("click", onClick);
  }, [fieldLabelId, rootRef]);
}

/**
 * Enter's form submit, after the render that reports a held year (the Form reads the registered
 * value, and the custom validity is set in a layout effect, both before this effect runs).
 * Returns the function that asks for it.
 */
export function useSubmitOnEnter(rootRef: RefObject<HTMLElement | null>): () => void {
  const [submitRequest, setSubmitRequest] = useState(0);
  useEffect(() => {
    if (submitRequest === 0) return;
    const form = rootRef.current?.closest("form");
    if (!form) return;
    // As native implicit submission: through the form's default button (its first submit
    // button, form-associated ones included), and not at all when that button is disabled.
    const defaultButton = findDefaultButton(form);
    if (defaultButton?.disabled) return;
    form.requestSubmit(defaultButton);
  }, [submitRequest, rootRef]);
  return () => setSubmitRequest((count) => count + 1);
}

export interface DateSegmentsOptions {
  /** The prefix of the segments' ids (`${id}-month`, …). */
  id: string;
  /** The date shown; a different incoming value resets the segments. */
  value: Date | null;
  /**
   * Called with the date once all segments form a valid day, and with `null` when the user clears
   * a segment of a complete date (never for partial input, nor for the value already shown).
   */
  onChange: (date: Date | null) => void;
  /** The resolved locale (`resolveLocale`). */
  locale: string | undefined;
  labels?: DateSegmentLabels;
  disabled: boolean;
  readOnly: boolean;
  required?: boolean;
  invalid: boolean;
  /** What names the field, appended to each segment's own name in `aria-labelledby`. */
  labelSource?: string;
  /** The element the typing / IME listeners go on (it contains these segments). */
  containerRef: RefObject<HTMLElement | null>;
  /** The element whose segments, in DOM order, focus moves across. */
  navigationRef: RefObject<HTMLElement | null>;
  /** Enter (not read-only), after a held year is reported. */
  onEnter: () => void;
  /**
   * Pull the first segment back by its padding, so its text starts where Input's does.
   * @default true
   */
  alignFirst?: boolean;
}

export interface DateSegmentsControl {
  /** The spinbuttons and literals, to render inside the group. */
  segments: ReactNode;
  /** Some segments typed but no complete date. */
  partial: boolean;
  /**
   * Shows `date` in every segment. `report` (default) calls `onChange` as a typed change would;
   * otherwise it only shows it (the caller reports it).
   */
  fill: (date: Date, report?: boolean) => void;
}

/**
 * One date's segments (React Aria's date-field pattern): digits type with auto-advance, ↑/↓ step
 * with wrap, PageUp / PageDown step further, Home / End jump to the bounds, Backspace / Delete
 * clear, ←/→ (flipped in RTL) move, the literal separator advances, Enter asks to submit, and an
 * IME composition is ignored until it commits.
 */
export function useDateSegments({
  id,
  value,
  onChange,
  locale,
  labels,
  disabled,
  readOnly,
  required,
  invalid,
  labelSource,
  containerRef,
  navigationRef,
  onEnter,
  alignFirst = true,
}: DateSegmentsOptions): DateSegmentsControl {
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
  const literalKeys = new Set(
    intl.order
      .flatMap((part) => (part.type === "literal" ? [...part.value] : []))
      // Not whitespace or bidi marks (ar-EG's slash carries a right-to-left mark, category Cf).
      .filter((char) => !/[\s\p{Cf}]/u.test(char)),
  );

  const [segments, setSegments] = useState(() => dateToSegments(value));
  // The value the segments last showed: a different incoming value (a controlled change, or a
  // parent refusing the user's change) resets them; the same value keeps partial input.
  const [synced, setSynced] = useState(value);
  if (!sameDate(value, synced)) {
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

  const editable = !disabled && !readOnly;
  // Some segments typed but no complete date: invalid at validation time (not shown before).
  const partial =
    value === null && (segments.month !== null || segments.day !== null || segments.year !== null);

  const emit = (date: Date | null) => {
    setSynced(date);
    onChange(date);
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
      if (!sameDate(date, value)) emit(date);
    } else if (value !== null) {
      emit(null);
    }
  };

  const fill = (date: Date, report = true) => {
    setEntry(null);
    if (report) {
      commit(dateToSegments(date));
      return;
    }
    heldRef.current = false;
    setHeld(false);
    setSegments(dateToSegments(date));
    setSynced(date);
  };

  const segmentElements = () => [
    ...(navigationRef.current?.querySelectorAll<HTMLElement>(segmentSelector) ?? []),
  ];
  /** Focuses the segment `delta` away from `from`, clamped to the first / last. */
  const moveFocus = (from: HTMLElement, delta: number) => {
    const elements = segmentElements();
    const index = elements.indexOf(from) + delta;
    elements[Math.max(0, Math.min(index, elements.length - 1))]?.focus();
  };
  const typeInto = (target: HTMLElement, type: DateSegmentType, digit: number) => {
    const { max: bound } = boundsOf(type);
    const typed = typeDigit(entry?.type === type ? entry.buffer : "", digit, type, bound);
    // A year is reported once its four digits are in (or on blur): "2", "20", "202" on the way to
    // "2026" are valid years, but reporting each would jump a linked calendar through the ages.
    commit({ ...segments, [type]: typed.value }, type === "year" && !typed.advance);
    const elements = segmentElements();
    const next = elements[elements.indexOf(target) + 1];
    if (typed.advance && next) {
      setEntry(null);
      next.focus();
    } else {
      setEntry({ type, buffer: typed.buffer });
    }
  };

  const clear = (type: DateSegmentType) => {
    setEntry(null);
    commit({ ...segments, [type]: null });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, type: DateSegmentType) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    // A key that belongs to an IME composition (Chrome: `isComposing`; Safari reports the Enter
    // that commits it as keyCode 229, after `compositionend`) is the IME's, not ours: above all,
    // that Enter must not submit the form. The committed text arrives through `compositionend`.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    const { key } = event;
    const target = event.currentTarget;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      const rtl = isRtl(target);
      const forward = (key === "ArrowRight") !== rtl;
      moveFocus(target, forward ? 1 : -1);
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
        if (current === null && !(entry?.type === type && entry.buffer)) moveFocus(target, -1);
        else clear(type);
        return;
      case "Delete":
        return clear(type);
      case "Enter":
        // Submits the enclosing form, as Enter in a text input does (read-only returned above).
        // A year still being typed is reported first; the submit waits for that render.
        if (heldRef.current) commit(segments);
        onEnter();
        return;
    }
    const digit = parseDigit(key, intl.digits);
    if (digit !== null) typeInto(target, type, digit);
    else if (literalKeys.has(key)) moveFocus(target, 1);
  };

  /** Types the first character of `data` into `target`'s segment (a digit, or a separator). */
  const typeText = (target: HTMLElement, data: string) => {
    const type = target.dataset.type as DateSegmentType;
    // One character per event in practice; the first one wins (focus may move after it).
    const char = [...data][0];
    if (char === undefined) return;
    const digit = parseDigit(char, intl.digits);
    if (digit !== null) typeInto(target, type, digit);
    else if (literalKeys.has(char)) moveFocus(target, 1);
  };
  // An IME composition (e.g. full-width digits from a Japanese IME) edits the DOM through
  // `beforeinput` events that cannot be cancelled. As React Aria's date segments do, they are
  // ignored while composing; on `compositionend` the segment's text is put back to what React
  // rendered (React owns that text node), then the committed text is typed.
  const compositionRef = useRef<{ node: Node | null; text: string | null } | null>(null);
  const nativeHandlersRef = useRef({
    beforeinput: (_event: InputEvent) => {},
    compositionstart: (_event: CompositionEvent) => {},
    compositionend: (_event: CompositionEvent) => {},
  });
  nativeHandlersRef.current = {
    // Mobile keyboards send "Unidentified" keydowns and deliver the text through `beforeinput`
    // instead; handle that too, and never let it edit the DOM React renders.
    beforeinput: (event) => {
      if (event.isComposing || event.inputType.includes("Composition")) return;
      event.preventDefault();
      const target = (event.target as HTMLElement).closest<HTMLElement>(segmentSelector);
      if (!editable || !target) return;
      if (event.inputType.startsWith("delete")) {
        clear(target.dataset.type as DateSegmentType);
        return;
      }
      typeText(target, event.data ?? "");
    },
    compositionstart: (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(segmentSelector);
      const node = target?.firstChild ?? null;
      compositionRef.current = { node, text: node?.nodeValue ?? null };
    },
    compositionend: (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(segmentSelector);
      const saved = compositionRef.current;
      compositionRef.current = null;
      if (!target) return;
      if (saved?.node) {
        saved.node.nodeValue = saved.text;
        target.replaceChildren(saved.node);
      }
      if (editable) typeText(target, event.data);
    },
  };
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onBeforeInput = (event: InputEvent) => nativeHandlersRef.current.beforeinput(event);
    const onStart = (event: CompositionEvent) => nativeHandlersRef.current.compositionstart(event);
    const onEnd = (event: CompositionEvent) => nativeHandlersRef.current.compositionend(event);
    element.addEventListener("beforeinput", onBeforeInput);
    element.addEventListener("compositionstart", onStart);
    element.addEventListener("compositionend", onEnd);
    return () => {
      element.removeEventListener("beforeinput", onBeforeInput);
      element.removeEventListener("compositionstart", onStart);
      element.removeEventListener("compositionend", onEnd);
    };
  }, [containerRef]);

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
  const rendered = intl.order.map((part, partIndex) => {
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
        aria-labelledby={labelSource ? `${segmentId} ${labelSource}` : undefined}
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
        className={cn(segmentBase, alignFirst && index === 0 && "-ms-0.5")}
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
        onKeyDown={(event) => handleKeyDown(event, type)}
      >
        {display(type)}
      </span>
    );
  });

  return { segments: rendered, partial, fill };
}
