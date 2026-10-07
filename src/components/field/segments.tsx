"use client";

/*
 * The type-agnostic plumbing of a segmented field (spec Phase K §1.4), shared by the date controls
 * (`../date-field/date-segments-control.tsx`) and TimeField: the group and segment classes, focus
 * on the first empty segment, the label click, submit-on-Enter, the foreign-key filter and the
 * IME / `beforeinput` text input. Each engine owns its segments' values and keys and passes its
 * own segment `selector`. Internal: not exported from the package index.
 */
import {
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { findDefaultButton } from "../../lib/default-button";

/**
 * The text-field look on a group (spec Phase H §2): `textFieldStates` written out for a `<div>`
 * with a `focus-within` ring, as `textFieldGroupBase` (no `outline-color` transition, keyed off
 * `data-invalid` / `data-disabled` / `data-readonly`).
 */
export const segmentGroupBase = [
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

export const segmentBase = [
  // `not-focus:` on the placeholder colour: Tailwind emits `data-*` variants after `focus:`, so a
  // plain `data-placeholder:text-muted-foreground` would win over the focused text colour and
  // paint muted text on the primary fill.
  "rounded-sm px-0.5 caret-transparent outline-none focus:bg-primary focus:text-primary-foreground data-placeholder:not-focus:text-muted-foreground",
  "forced-colors:focus:bg-[Highlight] forced-colors:focus:text-[HighlightText] forced-colors:focus:forced-color-adjust-none",
];

export const segmentLiteralBase = "text-muted-foreground";

/** Keys a focused segment always swallows: edits, and the stepping keys that would scroll. */
export const preventedSegmentKeys = new Set([
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

/**
 * Focuses `root`'s first empty segment (matching `selector`), else its first. Reads the DOM only,
 * so the label's native click listener never sees stale state.
 */
export function focusFirstEmpty(root: HTMLElement | null, selector: string) {
  if (!root || root.hasAttribute("data-disabled")) return;
  const elements = [...root.querySelectorAll<HTMLElement>(selector)];
  (elements.find((element) => element.hasAttribute("data-placeholder")) ?? elements[0])?.focus();
}

/** Clicking the group's padding or a literal focuses the first empty segment (else the first). */
export function handleGroupMouseDown(
  event: MouseEvent<HTMLElement>,
  disabled: boolean,
  selector: string,
) {
  if (disabled || event.defaultPrevented) return;
  if ((event.target as HTMLElement).closest(selector)) return;
  event.preventDefault();
  focusFirstEmpty(event.currentTarget, selector);
}

/**
 * A FieldLabel has no `for` (the group isn't labelable): clicking it focuses the first empty
 * segment instead, as a native label would focus its control.
 */
export function useLabelFocusesFirstEmpty(
  fieldLabelId: string | undefined,
  rootRef: RefObject<HTMLElement | null>,
  selector: string,
) {
  useEffect(() => {
    if (!fieldLabelId) return;
    const root = rootRef.current;
    const label = root?.ownerDocument.getElementById(fieldLabelId);
    if (!label) return;
    const onClick = () => focusFirstEmpty(root, selector);
    label.addEventListener("click", onClick);
    return () => label.removeEventListener("click", onClick);
  }, [fieldLabelId, rootRef, selector]);
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

/**
 * A key the segment must leave alone: one with a modifier, or one that belongs to an IME
 * composition (Chrome: `isComposing`; Safari reports the Enter that commits it as keyCode 229,
 * after `compositionend`). That is the IME's, not ours: above all, that Enter must not submit the
 * form. The committed text arrives through `compositionend` (`useSegmentTextInput`).
 */
export function isForeignKey(event: KeyboardEvent<HTMLElement>): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey) return true;
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

export interface SegmentTextInputOptions {
  /** The element the `beforeinput` / composition listeners go on (it contains the segments). */
  containerRef: RefObject<HTMLElement | null>;
  /** Matches a segment element. */
  selector: string;
  /** Whether text may edit the segments (neither disabled nor read-only). */
  editable: boolean;
  /** Types `char` (the text's first character) into the segment `target`. */
  onText: (target: HTMLElement, char: string) => void;
  /** A delete input (a mobile keyboard's backspace) on the segment `target`. */
  onClear: (target: HTMLElement) => void;
}

/**
 * Text that reaches the segments without a usable keydown: mobile keyboards ("Unidentified"
 * keydowns, the text in `beforeinput`) and IME compositions. Neither may edit the DOM React
 * renders; the text is handed to `onText` one character at a time instead.
 */
export function useSegmentTextInput({
  containerRef,
  selector,
  editable,
  onText,
  onClear,
}: SegmentTextInputOptions) {
  /** Types the first character of `data` into `target` (a digit, or a separator). */
  const typeText = (target: HTMLElement, data: string) => {
    // One character per event in practice; the first one wins (focus may move after it).
    const char = [...data][0];
    if (char === undefined) return;
    onText(target, char);
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
      const target = (event.target as HTMLElement).closest<HTMLElement>(selector);
      if (!editable || !target) return;
      if (event.inputType.startsWith("delete")) {
        onClear(target);
        return;
      }
      typeText(target, event.data ?? "");
    },
    compositionstart: (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(selector);
      const node = target?.firstChild ?? null;
      compositionRef.current = { node, text: node?.nodeValue ?? null };
    },
    compositionend: (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(selector);
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
}
