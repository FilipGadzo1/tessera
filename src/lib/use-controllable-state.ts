import { useState } from "react";

/**
 * The controlled/uncontrolled value pattern shared by Calendar's `value`, RangeCalendar's
 * `value`, PickerShell's `open` and the date pickers' `value` (Phase F final review M7 — these
 * were hand-rolled separately at each site).
 *
 * `value` controls the state when it is not `undefined` (an explicit `null` is a valid controlled
 * value, e.g. `<Calendar value={null} />`); otherwise the hook owns its own state, seeded once
 * from `defaultValue`. `onChange` — when given — is called on every `set`, controlled or not
 * (callers that need to skip a no-op change, e.g. a `setOpen` that must not re-fire
 * `onOpenChange` for the value it already has, dedupe before calling `set` themselves; see
 * `PickerShell` in date-picker.tsx).
 */
export function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void,
): readonly [T, (next: T) => void] {
  const [internal, setInternal] = useState(defaultValue);
  const controlled = value !== undefined;
  const set = (next: T) => {
    if (!controlled) setInternal(next);
    onChange?.(next);
  };
  return [controlled ? (value as T) : internal, set] as const;
}
