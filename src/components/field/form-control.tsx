"use client";

import { useRegisterFieldControl } from "@base-ui/react/internals/field-register-control";
/*
 * Form and Field participation for a control without a native input of its own (moved here from
 * `date-form-control.tsx` in Phase J; spec Phase H §3), following Base UI's own Select recipe
 * (`select/root/SelectRoot.js`): a visually hidden real `<input>` (not `type="hidden"`, which is
 * barred from constraint validation) carries the value, `required` and a custom validity, and the
 * control registers with the Field through `useRegisterFieldControl`. Form focuses the registered
 * `controlRef` (the visible control) on an invalid submit; the input forwards any focus it gets
 * there too, as Select's does.
 *
 * Three Base UI internals (exported by the package, not documented) are used, under the same
 * `~1.8.0` pin as the Field wiring: `field-root-context` (validation, dirty / filled / touched),
 * `field-register-control` (the registration) and `form-context` (`clearErrors`, which Select
 * calls so a Form `errors[name]` clears when the value changes).
 */
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useFormContext } from "@base-ui/react/internals/form-context";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/*
 * Copied from `@base-ui/utils/visuallyHidden` (0.4.0), which Base UI's Select uses. That package is
 * only a transitive dependency of `@base-ui/react`, so importing it could fail to resolve in a
 * consumer's install (e.g. pnpm's strict layout).
 */
const visuallyHiddenBase: CSSProperties = {
  clipPath: "inset(50%)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  border: 0,
  padding: 0,
  width: 1,
  height: 1,
  margin: -1,
};
/** For a named input: stays next to its control, so a native validation bubble points there. */
const visuallyHiddenInput: CSSProperties = { ...visuallyHiddenBase, position: "absolute" };
/** For an unnamed input: out of the flow entirely. */
const visuallyHidden: CSSProperties = { ...visuallyHiddenBase, position: "fixed", top: 0, left: 0 };

export interface FormControlOptions {
  /** The value Field `validate` receives (and dirty state compares), e.g. `Date | null`. */
  value: unknown;
  /**
   * The input's value as a string (e.g. `YYYY-MM-DD`, a hex colour), or `""` while there's no
   * complete value (`required` reads it). Changes are detected by this string.
   */
  inputValue: string;
  /** The value `onFormSubmit` reports under the field's name. */
  formValue: unknown;
  /** The input's name for native FormData; unnamed when omitted. */
  name?: string;
  /** The name `onFormSubmit` falls back to when the Field has none. */
  registrationName?: string;
  required?: boolean;
  disabled: boolean;
  readOnly?: boolean;
  /** A custom validity message, `""` when valid. */
  customValidity: string;
  /** The visible control Form's focus-first-invalid focuses (a trigger, a segment, a thumb). */
  controlRef: RefObject<HTMLElement | null>;
  /** The hidden input's `data-slot`, e.g. `"date-form-control"`. */
  slot: string;
}

/**
 * Joins a control to its Field and Form. Returns the hidden input to render, and focus / blur
 * handlers for the visible control's outer boundary (they mark the Field focused / touched and run
 * `validationMode="onBlur"` validation).
 */
export function useFormControl({
  value,
  inputValue,
  formValue,
  name,
  registrationName,
  required,
  disabled,
  readOnly,
  customValidity,
  controlRef,
  slot,
}: FormControlOptions): {
  input: ReactNode;
  onFocus: () => void;
  onBlur: () => void;
} {
  const { clearErrors } = useFormContext();
  const field = useFieldRootContext();
  const { validation, setDirty, setFilled, setTouched, setFocused, validationMode } = field;
  // Unlike SelectRoot (which registers its labelable id), the registration id is our own: DateField
  // registers a `null` labelable id (its group isn't labelable), and the registry needs a non-null
  // key.
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const formValueRef = useRef(formValue);
  formValueRef.current = formValue;
  const getFormValue = useCallback(() => formValueRef.current, []);
  // As SelectRoot, the registration carries the control's own `name` prop; Base UI reports the
  // value under the Field's name first. (The callers keep the input's native name as
  // `name ?? Field name`, the prop winning, as the pickers did before; SelectRoot lets the
  // Field's name win there.)
  useRegisterFieldControl(controlRef, id, value, getFormValue, !disabled, registrationName);

  // Before the change handling below: validation reads the input's validity synchronously.
  useLayoutEffect(() => {
    inputRef.current?.setCustomValidity(customValidity);
  }, [customValidity]);

  useLayoutEffect(() => {
    setFilled(inputValue !== "");
  }, [inputValue, setFilled]);

  // Select's `useValueChanged` handling, keyed by the string form (a new Date for the same day is
  // no change): clear the Form's server error, update dirty, and let the Field validate. Dirty
  // compares with the first rendered string (SelectRoot compares `validityData.initialValue` with
  // its item equality); a `Date` baseline would need a day comparison for the same answer.
  const initialValueRef = useRef(inputValue);
  const previousValueRef = useRef(inputValue);
  useLayoutEffect(() => {
    if (previousValueRef.current === inputValue) return;
    previousValueRef.current = inputValue;
    clearErrors(field.name);
    setDirty(inputValue !== initialValueRef.current);
    validation.change(value);
  });

  // onBlur validation runs after the render that follows the blur, not inside the blur handler:
  // a DateField commits a year still being typed in that same blur, and validating then would
  // read the old value and the old custom validity.
  const [blurCount, setBlurCount] = useState(0);
  const validatedBlurRef = useRef(0);
  useLayoutEffect(() => {
    if (blurCount === validatedBlurRef.current) return;
    validatedBlurRef.current = blurCount;
    validation.commit(value);
  });

  const setRef = useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element;
      validation.inputRef.current = element;
    },
    [validation.inputRef],
  );

  const input = (
    <input
      {...validation.getValidationProps(disabled, {
        onFocus() {
          // Form (or a native validation bubble) focused the input: move to the visible control.
          controlRef.current?.focus({ focusVisible: true } as FocusOptions);
        },
      })}
      ref={setRef}
      name={name}
      value={inputValue}
      // The value only changes through the visible control (no autofill support).
      onChange={() => {}}
      disabled={disabled}
      required={required}
      readOnly={readOnly}
      style={name ? visuallyHiddenInput : visuallyHidden}
      tabIndex={-1}
      aria-hidden
      data-slot={slot}
    />
  );

  return {
    input,
    onFocus: () => setFocused(true),
    onBlur: () => {
      setTouched(true);
      setFocused(false);
      if (validationMode === "onBlur") setBlurCount((count) => count + 1);
    },
  };
}

/** The attribute Base UI's `FocusGuard` carries (`utils/FocusGuard.js`). */
const focusGuardAttribute = "data-base-ui-focus-guard";

function isFocusGuard(node: EventTarget | null) {
  return node instanceof Element && node.hasAttribute(focusGuardAttribute);
}

/**
 * Tracks focus entering and leaving a control made of several elements, for the Field's focused /
 * touched state and `onBlur` validation (the one blur rule of the hidden-input controls). `scope()`
 * lists them; the first is the main one (the trigger, or the field with its icon button), a later
 * one the popup. Watched on the document, since the popup is portalled.
 *
 * - Focus entering any of them from outside is a focus; moving between them is neither.
 * - Focus landing outside all of them is a blur.
 * - Focus in transit is not decided until it lands: passing through one of Base UI's focus guards
 *   (a non-modal popup renders them outside the popup element; Shift+Tab from its first tabbable
 *   lands on one, which sends focus back to the trigger), or dropping to nowhere from the popup
 *   (an outside click or Escape closes it and Base UI returns focus to the trigger). It is a blur
 *   only if it then lands outside, e.g. Tab from the popup's last tabbable, which the other guard
 *   sends on past the trigger. Focus dropping to nowhere from the main element (a click on the
 *   page background) is a blur at once, as for a native input.
 */
export function useFocusScope(
  scope: () => (Element | null | undefined)[],
  onFocus: () => void,
  onBlur: () => void,
) {
  const latestRef = useRef({ scope, onFocus, onBlur });
  latestRef.current = { scope, onFocus, onBlur };
  useEffect(() => {
    let inside = false;
    const elements = () => latestRef.current.scope();
    const within = (node: EventTarget | null) =>
      node instanceof Node && elements().some((element) => !!element && element.contains(node));
    const leave = () => {
      inside = false;
      latestRef.current.onBlur();
    };
    const onFocusIn = (event: globalThis.FocusEvent) => {
      if (within(event.target)) {
        if (inside) return;
        inside = true;
        latestRef.current.onFocus();
      } else if (inside && !isFocusGuard(event.target)) {
        leave();
      }
    };
    const onFocusOut = (event: globalThis.FocusEvent) => {
      if (!inside || !within(event.target)) return;
      const next = event.relatedTarget;
      if (within(next) || isFocusGuard(next)) return;
      if (next === null && !elements()[0]?.contains(event.target as Node)) return;
      leave();
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
}
