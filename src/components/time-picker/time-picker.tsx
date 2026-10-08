"use client";

/*
 * TimePicker (spec Phase K §3): a TimeField plus a clock icon button in the editable pickers'
 * shell (`../date-picker/editable-shell.tsx`), opening one listbox of time slots. The TimeField is
 * the one Field / Form control; the popover adds none.
 */
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { resolveLocale } from "../../lib/date";
import { getLocaleDirection } from "../../lib/direction";
import { CheckIcon, ClockIcon } from "../../lib/icons";
import { menuItemBase } from "../../lib/overlay-classes";
import {
  compareTime,
  formatTime,
  formatTimeValue,
  getTimeSlots,
  parseTime,
  type TimeGranularity,
  timeToSeconds,
} from "../../lib/time";
import { useControllableState } from "../../lib/use-controllable-state";
import { EditableShell, type PickerOwnProps } from "../date-picker/editable-shell";
import { TimeField, type TimeFieldLabels, type TimeFieldProps } from "../time-field/time-field";

/** Translatable strings: TimeField's, plus the icon button's, the popup's and the list's names. */
export interface TimePickerLabels extends TimeFieldLabels {
  /** The clock icon button's accessible name. @default "Choose time" */
  open?: string;
  /** The popup dialog's accessible name. @default "Choose a time" */
  dialog?: string;
  /** The slot listbox's accessible name. @default "Times" */
  list?: string;
  /** The status shown when the constraints leave no slot. @default "No times available" */
  noTimes?: string;
}

export interface TimePickerProps
  extends Omit<TimeFieldProps, "focusScope" | "labels">,
    Pick<PickerOwnProps, "open" | "defaultOpen" | "onOpenChange" | "container"> {
  /** Minutes between the list's slots, from `min` (default midnight) to `max`. @default 30 */
  slotStep?: number;
  /** Translated strings. */
  labels?: TimePickerLabels;
}

const listBase = "max-h-[min(var(--available-height),16rem)] min-w-36 overflow-y-auto p-1";
const optionBase = cn(menuItemBase, "ps-8 tabular-nums data-selected:font-medium");
const indicatorBase = "absolute start-2 flex size-4 items-center justify-center";
const emptyBase = "px-3 py-2 text-sm text-muted-foreground";
const PAGE = 5;

/**
 * The option focused on open: the selected slot, else the first slot after the value, else (the
 * value is later than every slot) the last slot, else (no value) the first.
 */
function initialIndex(slots: string[], value: string | null): number {
  if (value === null) return 0;
  const selected = slots.findIndex((slot) => compareTime(slot, value) === 0);
  if (selected !== -1) return selected;
  const after = slots.findIndex((slot) => compareTime(slot, value) > 0);
  return after !== -1 ? after : slots.length - 1;
}

interface TimePickerListProps {
  slots: string[];
  /** The value at the picker's granularity, `null` for none. */
  value: string | null;
  locale: string;
  hourCycle?: 12 | 24;
  /** The slots' granularity: their text shows seconds when they carry them. */
  granularity: TimeGranularity;
  labels?: TimePickerLabels;
  onPick: (slot: string) => void;
}

/**
 * The popup's slot list: an APG listbox with a roving Tab stop (`tabIndex` 0 on the focused
 * option). ↑/↓ move (no wrap), Home/End jump, PageUp/PageDown move five, Enter or Space picks;
 * hovering an option focuses it, a click picks it.
 */
function TimePickerList({
  slots,
  value,
  locale,
  hourCycle,
  granularity,
  labels,
  onPick,
}: TimePickerListProps) {
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(() => initialIndex(slots, value));
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const current = Math.max(0, Math.min(active, slots.length - 1));
  const textDirection = getLocaleDirection(locale);

  const optionAt = (index: number) =>
    listRef.current?.querySelectorAll<HTMLElement>("[role=option]")[index];

  // The option focused on open is scrolled into view, nearest (the popup's own initial focus would
  // centre it).
  // biome-ignore lint/correctness/useExhaustiveDependencies: on mount only.
  useEffect(() => {
    optionAt(current)?.scrollIntoView({ block: "nearest" });
  }, []);

  if (slots.length === 0) {
    return (
      <div role="status" data-slot="time-picker-empty" className={emptyBase}>
        {labels?.noTimes ?? "No times available"}
      </div>
    );
  }

  const move = (index: number) => {
    const next = Math.max(0, Math.min(index, slots.length - 1));
    const element = optionAt(next);
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number, slot: string) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const targets: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: slots.length - 1,
      PageDown: index + PAGE,
      PageUp: index - PAGE,
    };
    const target = targets[event.key];
    if (target !== undefined) {
      event.preventDefault();
      move(target);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPick(slot);
    }
  };

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={labels?.list ?? "Times"}
      data-slot="time-picker-list"
      className={listBase}
    >
      {slots.map((slot, index) => {
        const selected = value !== null && compareTime(slot, value) === 0;
        return (
          <div
            key={slot}
            id={`${listId}-${slot}`}
            role="option"
            aria-selected={selected}
            data-slot="time-picker-option"
            data-value={slot}
            data-selected={selected ? "" : undefined}
            data-highlighted={highlighted === index ? "" : undefined}
            tabIndex={index === current ? 0 : -1}
            className={optionBase}
            onFocus={() => {
              setActive(index);
              setHighlighted(index);
            }}
            onBlur={() => setHighlighted((previous) => (previous === index ? null : previous))}
            onPointerMove={(event) => {
              // Hover moves the focus, as Base UI menus move their highlight.
              if (document.activeElement !== event.currentTarget) {
                event.currentTarget.focus({ preventScroll: true });
              }
            }}
            onClick={() => onPick(slot)}
            onKeyDown={(event) => onKeyDown(event, index, slot)}
          >
            <span aria-hidden data-slot="time-picker-option-indicator" className={indicatorBase}>
              {selected && <CheckIcon />}
            </span>
            {/* The locale's direction, as TimeField's row: in an RTL page an en-US "9:30 AM"
                starts with a digit, so without it the bidi algorithm shows "AM 9:30". */}
            <span dir={textDirection}>{formatTime(slot, locale, { hourCycle, granularity })}</span>
          </div>
        );
      })}
    </div>
  );
}

/** `value` at `granularity`, or `null` when it does not parse. */
function normalizeTime(value: string | null, granularity: TimeGranularity): string | null {
  const parts = value === null ? null : parseTime(value);
  return parts ? formatTimeValue(parts, granularity) : null;
}

/**
 * A `TimeField` with a clock icon button inside its border that opens a list of time slots
 * (every `slotStep` minutes between `min` and `max`, on the `step` grid). Typing is the main
 * path; the list picks a common time. Opening focuses the selected slot (else the nearest one);
 * Enter, Space or a click picks it, closes the popup and returns focus to the icon button. Name it
 * with a `Field` label, `aria-labelledby` or `aria-label`.
 */
export function TimePicker({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  granularity = "minute",
  hourCycle,
  min,
  max,
  step,
  locale,
  name,
  form,
  labels,
  slotStep = 30,
  ...props
}: TimePickerProps) {
  const [value, setValue] = useControllableState(valueProp, defaultValue);
  const resolvedLocale =
    resolveLocale(locale) ?? new Intl.DateTimeFormat().resolvedOptions().locale;
  // No overnight ranges: the field warns and ignores `max`; the list follows it.
  const overnight = min !== undefined && max !== undefined && compareTime(min, max) > 0;
  // The slots carry seconds only when `min` puts them off the whole minute (every slot then shares
  // its seconds); the grid is the field's effective step.
  const slotGranularity: TimeGranularity =
    granularity === "second" && ((min === undefined ? null : timeToSeconds(min)) ?? 0) % 60 !== 0
      ? "second"
      : "minute";
  const slots = getTimeSlots({
    slotStep,
    min,
    max: overnight ? undefined : max,
    step: step ?? (granularity === "second" ? 1 : 60),
    granularity: slotGranularity,
  });

  const pick = (next: string | null) => {
    setValue(next);
    onValueChange?.(next);
  };

  return (
    <EditableShell
      {...props}
      slotPrefix="time-picker"
      icon={<ClockIcon data-slot="time-picker-icon" />}
      openLabel={labels?.open ?? "Choose time"}
      dialogLabel={labels?.dialog ?? "Choose a time"}
      // A scrollable list shrinks to the room above or below; it never moves beside the field.
      collisionAvoidance={{ fallbackAxisSide: "none" }}
      initialFocus={(popup) =>
        popup?.querySelector<HTMLElement>('[data-slot="time-picker-option"][tabindex="0"]') ?? true
      }
      renderField={(fieldProps) => (
        <TimeField
          {...fieldProps}
          value={value}
          onValueChange={pick}
          granularity={granularity}
          hourCycle={hourCycle}
          min={min}
          max={max}
          step={step}
          locale={locale}
          name={name}
          form={form}
          labels={labels}
        />
      )}
      renderCalendar={(close) => (
        <TimePickerList
          slots={slots}
          value={normalizeTime(value, granularity)}
          locale={resolvedLocale}
          hourCycle={hourCycle}
          granularity={slotGranularity}
          labels={labels}
          onPick={(slot) => {
            pick(normalizeTime(slot, granularity));
            close();
          }}
        />
      )}
    />
  );
}
