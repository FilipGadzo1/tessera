"use client";

/*
 * TimeField's segment engine (spec Phase K §2). Internal: not exported from the package index.
 *
 * `useTimeSegments` owns one time's segments (the typed digits, the sync with the value) and
 * renders its spinbuttons and literals inside the segment row; the caller renders the group around
 * them and owns the value, the Field / Form wiring and the paste handling. The type-agnostic
 * plumbing (classes, focus, submit-on-Enter, IME text) is shared with the date controls in
 * `../field/segments.tsx`.
 *
 * The segment row takes the locale's script direction and the clock run (the first to the last
 * numeric segment) is always LTR (spec scope ruling), so ←/→ move by geometry, never by `dir`.
 * Digits auto-advance in DOM order.
 */
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { getLocaleDigits, parseDigit } from "../../lib/date-segments";
import { getLocaleDirection } from "../../lib/direction";
import type { HourCycle, TimeGranularity } from "../../lib/time";
import {
  dayPeriodFromKey,
  getDayPeriodLabels,
  getTimeSegmentLabel,
  getTimeSegmentOrder,
  hasDayPeriod,
  stepTimeSegment,
  type TimeSegmentPart,
  type TimeSegments,
  type TimeSegmentType,
  timeSegmentBounds,
  timeSegmentPlaceholder,
  timeSegmentSteps,
  timeSegmentsToValue,
  timeValueToSegments,
  typeTimeDigit,
} from "../../lib/time-segments";
import {
  isForeignKey,
  preventedSegmentKeys,
  segmentBase,
  segmentLiteralBase,
  useSegmentTextInput,
} from "../field/segments";

/** Translatable segment names and the empty value text. */
export interface TimeSegmentLabels {
  /** @default the locale's `Intl.DisplayNames` "hour" (English "hour" where unsupported) */
  hour?: string;
  /** @default the locale's `Intl.DisplayNames` "minute" */
  minute?: string;
  /** @default the locale's `Intl.DisplayNames` "second" */
  second?: string;
  /** @default the locale's `Intl.DisplayNames` "dayPeriod" (English "AM/PM") */
  dayPeriod?: string;
  /** A segment's `aria-valuetext` while it is empty. @default "Empty" */
  empty?: string;
}

export const timeSegmentSelector = "[data-slot=time-field-segment]";

const numericTypes = new Set<TimeSegmentType>(["hour", "minute", "second"]);

export interface TimeSegmentsOptions {
  /** The prefix of the segments' ids (`${id}-hour`, …). */
  id: string;
  /** The time shown, at the field's granularity; a different incoming value resets the segments. */
  value: string | null;
  /**
   * Called with the value once every needed segment is set, and with `null` when the user clears
   * a segment of a complete time (never for partial input, nor for the value already shown).
   */
  onChange: (value: string | null) => void;
  locale: string;
  hourCycle: HourCycle;
  granularity: TimeGranularity;
  /** The native `step` in seconds; the arrows land on its grid counted from `min`. */
  step: number;
  min?: string;
  labels?: TimeSegmentLabels;
  disabled: boolean;
  readOnly: boolean;
  required?: boolean;
  invalid: boolean;
  /** What names the field, appended to each segment's own name in `aria-labelledby`. */
  labelSource?: string;
  /** The element the typing / IME listeners go on, and whose segments focus moves across. */
  containerRef: RefObject<HTMLElement | null>;
  /** Enter (not read-only). */
  onEnter: () => void;
}

export interface TimeSegmentsControl {
  /** The segment row (spinbuttons and literals), to render inside the group. */
  segments: ReactNode;
  /** Some segments typed but no complete time. */
  partial: boolean;
  /** Shows `value` in every segment and reports it as a typed change would. */
  fill: (value: string) => void;
}

/**
 * One time's segments (React Aria's date-field pattern): digits type with auto-advance, ↑/↓ step
 * on the `step` grid with wrap, PageUp / PageDown step further, Home / End jump to the bounds,
 * Backspace / Delete clear, ←/→ move to the visual neighbour, the literal separator advances,
 * `a` / `p` set the day period, Enter asks to submit, and an IME composition is ignored until it
 * commits.
 */
export function useTimeSegments({
  id,
  value,
  onChange,
  locale,
  hourCycle,
  granularity,
  step,
  min,
  labels,
  disabled,
  readOnly,
  required,
  invalid,
  labelSource,
  containerRef,
  onEnter,
}: TimeSegmentsOptions): TimeSegmentsControl {
  const intl = useMemo(
    () => ({
      order: getTimeSegmentOrder(locale, { hourCycle, granularity }),
      direction: getLocaleDirection(locale),
      digits: getLocaleDigits(locale),
      periods: getDayPeriodLabels(locale, hourCycle),
      number: new Intl.NumberFormat(locale, { useGrouping: false }),
      twoDigits: new Intl.NumberFormat(locale, { useGrouping: false, minimumIntegerDigits: 2 }),
    }),
    [locale, hourCycle, granularity],
  );
  const steps = useMemo(() => timeSegmentSteps(step, min), [step, min]);
  const literalKeys = new Set(
    intl.order
      .flatMap((part) => (part.type === "literal" ? [...part.value] : []))
      // Not whitespace or bidi marks.
      .filter((char) => !/[\s\p{Cf}]/u.test(char)),
  );

  const [segments, setSegments] = useState(() => timeValueToSegments(value, hourCycle));
  // The value (and cycle) the segments last showed: a different incoming value (a controlled
  // change, or a parent refusing the user's change) resets them; the same one keeps partial input.
  const [synced, setSynced] = useState({ value, hourCycle });
  if (synced.value !== value || synced.hourCycle !== hourCycle) {
    setSynced({ value, hourCycle });
    setSegments(timeValueToSegments(value, hourCycle));
  }
  // Digits typed into the focused segment so far (the next digit appends to them).
  const [entry, setEntry] = useState<{ type: TimeSegmentType; buffer: string } | null>(null);
  // Whether the shown segments hold a number still waiting for its next digit (minute "4" on the
  // way to "45"), not yet reported: as DateField's held year, it is reported once the segment
  // advances, or on blur or Enter, so "9" "3" "0" reports 09:30 once, not 09:03 first. A ref for
  // the blur that fires synchronously inside the same handler.
  const heldRef = useRef(false);

  const editable = !disabled && !readOnly;
  const usedTypes = intl.order.flatMap((part) => (part.type === "literal" ? [] : [part.type]));
  const partial = value === null && usedTypes.some((type) => segments[type] !== null);

  /** Shows `next`; reports its value (or `null` once a complete time is broken) unless `hold`. */
  const commit = (next: TimeSegments, hold = false) => {
    heldRef.current = hold;
    setSegments(next);
    if (hold) return;
    const nextValue = timeSegmentsToValue(next, hourCycle, granularity);
    if (nextValue !== null) {
      if (nextValue !== value) emitChange(nextValue);
    } else if (value !== null) {
      emitChange(null);
    }
  };
  const emitChange = (nextValue: string | null) => {
    setSynced({ value: nextValue, hourCycle });
    onChange(nextValue);
  };

  /** `segments` with `type` set; setting the hour fills an empty day period with AM. */
  const withSegment = (type: TimeSegmentType, next: number | null): TimeSegments => {
    const updated = { ...segments, [type]: next } as TimeSegments;
    if (type === "hour" && next !== null && hasDayPeriod(hourCycle) && updated.dayPeriod === null) {
      updated.dayPeriod = 0;
    }
    return updated;
  };

  const fill = (time: string) => {
    setEntry(null);
    commit(timeValueToSegments(time, hourCycle));
  };

  const segmentElements = () => [
    ...(containerRef.current?.querySelectorAll<HTMLElement>(timeSegmentSelector) ?? []),
  ];
  /** Focuses the segment `delta` away from `from` in DOM order, clamped to the first / last. */
  const moveFocus = (from: HTMLElement, delta: number) => {
    const elements = segmentElements();
    const index = elements.indexOf(from) + delta;
    elements[Math.max(0, Math.min(index, elements.length - 1))]?.focus();
  };
  /** Focuses the visually neighbouring segment (by geometry, read on the key press). */
  const moveVisually = (from: HTMLElement, delta: number) => {
    const elements = segmentElements()
      .map((element) => ({ element, left: element.getBoundingClientRect().left }))
      .sort((a, b) => a.left - b.left)
      .map(({ element }) => element);
    const index = elements.indexOf(from) + delta;
    elements[Math.max(0, Math.min(index, elements.length - 1))]?.focus();
  };

  const typeInto = (target: HTMLElement, type: TimeSegmentType, digit: number) => {
    if (type === "dayPeriod") return;
    const typed = typeTimeDigit(
      entry?.type === type ? entry.buffer : "",
      digit,
      timeSegmentBounds(type, hourCycle),
    );
    commit(withSegment(type, typed.value), !typed.advance);
    const elements = segmentElements();
    const next = elements[elements.indexOf(target) + 1];
    if (typed.advance && next) {
      setEntry(null);
      next.focus();
    } else {
      setEntry({ type, buffer: typed.buffer });
    }
  };

  const clear = (type: TimeSegmentType) => {
    setEntry(null);
    commit({ ...segments, [type]: null });
  };

  /** The text a typed character stands for: a digit, a day-period letter or a separator. */
  const typeChar = (target: HTMLElement, type: TimeSegmentType, char: string) => {
    const digit = parseDigit(char, intl.digits);
    if (digit !== null) {
      typeInto(target, type, digit);
      return;
    }
    if (type === "dayPeriod") {
      const period = dayPeriodFromKey(char, intl.periods);
      if (period !== null) {
        setEntry(null);
        commit({ ...segments, dayPeriod: period });
        return;
      }
    }
    if (literalKeys.has(char)) moveFocus(target, 1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, type: TimeSegmentType) => {
    // A modifier key, or a key of an IME composition (its text arrives through
    // `useSegmentTextInput`), is not the segment's.
    if (isForeignKey(event)) return;
    const { key } = event;
    const target = event.currentTarget;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      moveVisually(target, key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (key === "Tab") return;
    // Everything else is handled here or ignored: never let the browser edit the segment's text,
    // and never let the stepping keys scroll the page (read-only included).
    if (key.length === 1 || preventedSegmentKeys.has(key)) event.preventDefault();
    if (!editable) return;

    const current = segments[type];
    const bounds = timeSegmentBounds(type, hourCycle);
    const set = (next: number) => {
      setEntry(null);
      commit(withSegment(type, next));
    };
    const stepBy = (delta: number) => {
      if (type === "dayPeriod") return set(current === null ? (delta > 0 ? 0 : 1) : 1 - current);
      const { step: size, offset } = steps[type];
      return set(stepTimeSegment(current, delta, bounds, size, offset));
    };
    const page = type === "hour" ? 2 : Math.max(15, type === "dayPeriod" ? 1 : steps[type].step);
    switch (key) {
      case "ArrowUp":
        return stepBy(1);
      case "ArrowDown":
        return stepBy(-1);
      case "PageUp":
        return stepBy(page);
      case "PageDown":
        return stepBy(-page);
      // The first / last value of the segment's step grid (from an empty segment, as ↑ / ↓ do).
      case "Home":
        if (type === "dayPeriod") return set(bounds.min);
        return set(stepTimeSegment(null, 1, bounds, steps[type].step, steps[type].offset));
      case "End":
        if (type === "dayPeriod") return set(bounds.max);
        return set(stepTimeSegment(null, -1, bounds, steps[type].step, steps[type].offset));
      case "Backspace":
        if (current === null && !(entry?.type === type && entry.buffer)) moveFocus(target, -1);
        else clear(type);
        return;
      case "Delete":
        return clear(type);
      case "Enter":
        // Submits the enclosing form, as Enter in a text input does (read-only returned above).
        // A number still waiting for a digit is reported first; the submit waits for that render.
        if (heldRef.current) commit(segments);
        onEnter();
        return;
    }
    if (key.length === 1 || [...key].length === 1) typeChar(target, type, key);
  };

  // Mobile `beforeinput` text and IME compositions: a digit types, a separator advances.
  useSegmentTextInput({
    containerRef,
    selector: timeSegmentSelector,
    editable,
    onText: (target, char) => typeChar(target, target.dataset.type as TimeSegmentType, char),
    onClear: (target) => clear(target.dataset.type as TimeSegmentType),
  });

  /** Zeros typed into an empty segment so far ("0" of an `h12` hour), in the locale's digits. */
  const typedZeros = (type: TimeSegmentType): string => {
    const buffer = entry?.type === type && segments[type] === null ? entry.buffer : "";
    return buffer.replace(/\d/g, (char) => intl.digits[Number(char)] as string);
  };

  const display = (type: TimeSegmentType): string => {
    const segmentValue = segments[type];
    if (segmentValue === null) return typedZeros(type) || timeSegmentPlaceholder;
    if (type === "dayPeriod") return intl.periods[segmentValue] as string;
    return intl.twoDigits.format(segmentValue);
  };

  const valueText = (type: TimeSegmentType): string => {
    const segmentValue = segments[type];
    if (segmentValue === null) return typedZeros(type) || (labels?.empty ?? "Empty");
    if (type === "dayPeriod") return intl.periods[segmentValue] as string;
    return intl.number.format(segmentValue);
  };

  const renderPart = (part: TimeSegmentPart, partIndex: number) => {
    if (part.type === "literal") {
      return (
        <span
          key={`literal-${partIndex}`}
          aria-hidden="true"
          data-slot="time-field-literal"
          className={segmentLiteralBase}
        >
          {part.value}
        </span>
      );
    }
    const { type } = part;
    const segmentValue = segments[type];
    const bounds = timeSegmentBounds(type, hourCycle);
    const segmentId = `${id}-${type}`;
    const empty = segmentValue === null && !(entry?.type === type && entry.buffer);
    // The row's first segment pulls back its padding so its text starts where Input's does (in
    // an LTR row; an RTL locale's row starts with the LTR clock run, which this cannot align).
    const isFirstInRow = partIndex === 0 && intl.direction === "ltr";
    return (
      <span
        key={type}
        role="spinbutton"
        data-slot="time-field-segment"
        data-type={type}
        data-placeholder={empty ? "" : undefined}
        id={segmentId}
        // No tabindex at all when disabled: -1 would still take focus from a click.
        tabIndex={disabled ? undefined : 0}
        contentEditable={editable}
        suppressContentEditableWarning
        inputMode={type === "dayPeriod" ? "text" : "numeric"}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={labels?.[type] ?? getTimeSegmentLabel(type, locale)}
        // "hour, Start time" (as React Aria): the segment's own name, then the field's.
        aria-labelledby={labelSource ? `${segmentId} ${labelSource}` : undefined}
        aria-valuenow={segmentValue ?? undefined}
        aria-valuemin={bounds.min}
        aria-valuemax={bounds.max}
        aria-valuetext={valueText(type)}
        aria-readonly={readOnly || undefined}
        aria-disabled={disabled || undefined}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        className={cn(segmentBase, isFirstInRow && "-ms-0.5")}
        onFocus={(event) => {
          setEntry(null);
          // Collapse the selection into the segment (as React Aria's useDateSegment): Chrome
          // on Android then fires input events, and no native ::selection highlight shows.
          event.currentTarget.ownerDocument.defaultView
            ?.getSelection()
            ?.collapse(event.currentTarget, 0);
        }}
        onBlur={() => {
          // Reports a number held while it waited for its next digit.
          if (heldRef.current) commit(segments);
        }}
        onKeyDown={(event) => handleKeyDown(event, type)}
      >
        {display(type)}
      </span>
    );
  };

  // The clock run: from the first to the last numeric segment, literals between them included.
  const numericIndexes = intl.order.flatMap((part, index) =>
    part.type !== "literal" && numericTypes.has(part.type) ? [index] : [],
  );
  const first = numericIndexes[0] ?? 0;
  const last = numericIndexes[numericIndexes.length - 1] ?? -1;
  const rendered = (
    <span
      data-slot="time-field-segments"
      dir={intl.direction}
      className="inline-flex items-center gap-0.5"
    >
      {intl.order.slice(0, first).map((part, index) => renderPart(part, index))}
      <span data-slot="time-field-clock" dir="ltr" className="inline-flex items-center gap-0.5">
        {intl.order.slice(first, last + 1).map((part, index) => renderPart(part, first + index))}
      </span>
      {intl.order.slice(last + 1).map((part, index) => renderPart(part, last + 1 + index))}
    </span>
  );

  return { segments: rendered, partial, fill };
}
