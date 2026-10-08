"use client";

/*
 * TagsInput (spec Phase K §4): a native `<input>` (the Field control and the one Tab stop) in a
 * wrapping row of tag chips. Tessera's own variant of Base UI Combobox chips: ← from the input
 * focuses the last chip's remove button (roving, `tabIndex={-1}`), where Base UI focuses the chip
 * itself, so the focused element has a role and a name. Form and Field go through the shared
 * hidden-input control (`../field/form-control.tsx`, nameless) plus one `<input type="hidden">`
 * per tag (Base UI Select's `multiple` recipe).
 */
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useLabelableContext, useLabelableId } from "@base-ui/react/internals/labelable-provider";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type ComponentProps,
  type KeyboardEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { CloseIcon } from "../../lib/icons";
import { claimEscape } from "../../lib/tooltip-escape";
import { useControllableState } from "../../lib/use-controllable-state";
import { useElementDirection } from "../../lib/use-element-direction";
import { useMergedRefs } from "../../lib/use-merged-refs";
import { useStatusMessage } from "../../lib/use-status-message";
import { useFocusScope, useFormControl } from "../field/form-control";
import { isForeignKey } from "../field/segments";
import {
  tagsInputBase,
  tagsInputInput,
  tagsInputSizes,
  tagsInputTag,
  tagsInputTagRemove,
} from "./tags-input-classes";

/** Why an entry was not added. */
export type TagRejectionReason = "duplicate" | "max" | "invalid";

/** An entry `onTagRejected` reports: the trimmed text, the reason and the announced message. */
export interface TagRejection {
  tag: string;
  reason: TagRejectionReason;
  message: string;
}

export interface TagsInputProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "children"> {
  /** The tags, controlled. */
  value?: string[];
  /** The initial tags. @default [] */
  defaultValue?: string[];
  /** Called with the new tags after an add or a removal. */
  onValueChange?: (tags: string[]) => void;
  /** The input's text, controlled. */
  inputValue?: string;
  /** The input's initial text. @default "" */
  defaultInputValue?: string;
  /** Called with the input's text as it changes (and with `""` once a tag is added). */
  onInputValueChange?: (text: string) => void;
  /** Keys that commit the text as a tag; Enter always does. @default [","] */
  delimiters?: string[];
  /** The most tags; an add past it is rejected (`"max"`). @default Infinity */
  max?: number;
  /** Accepts a tag equal to an existing one (compared case-insensitively). @default false */
  allowDuplicates?: boolean;
  /** Checks a trimmed entry against the current tags: an error message, or `null` to accept. */
  validate?: (tag: string, tags: readonly string[]) => string | null;
  /** Commits the text when the input loses focus. @default false */
  addOnBlur?: boolean;
  /** Called for each rejected entry. */
  onTagRejected?: (rejection: TagRejection) => void;
  /** Disables the input and the remove buttons (a disabled `Field` does too). */
  disabled?: boolean;
  /** Shows the tags without remove buttons and makes the input read-only. */
  readOnly?: boolean;
  /** Requires at least one tag to submit (marks the input `aria-required`). */
  required?: boolean;
  /**
   * Submits one FormData entry per tag under this name, else the Field's; in a `Form`,
   * `onFormSubmit` reports the `string[]` under the Field's name (else this one).
   */
  name?: string;
  /** The `id` of a `<form>` elsewhere in the document to submit with. */
  form?: string;
  /** Minimum height, padding and text size, as Input. @default "md" */
  size?: keyof typeof tagsInputSizes;
  /** The input's placeholder. */
  placeholder?: string;
  /**
   * Props for the inner `<input>`. Name it here (`aria-label`, default "Add a tag") when there is
   * no Field label.
   */
  inputProps?: ComponentProps<"input">;
  /** The list's name when there is no Field label. @default "Tags" */
  listLabel?: string;
  /** A remove button's name. @default (tag) => `Remove ${tag}` */
  removeLabel?: (tag: string) => string;
  /** Announced after an add. @default (tag) => `${tag} added` */
  addedLabel?: (tag: string) => string;
  /** Announced after a removal. @default (tag) => `${tag} removed` */
  removedLabel?: (tag: string) => string;
  /**
   * A rejection's message (announced and reported). `details.message` is `validate`'s message for
   * `"invalid"`. @default duplicate `${tag} is already added`, max `You can add up to ${max} tags`,
   * invalid the `validate` message
   */
  rejectionLabel?: (
    reason: TagRejectionReason,
    tag: string,
    details: { max: number; message: string | null },
  ) => string;
}

const emptyTags: string[] = [];
const defaultDelimiters = [","];
const removeSelector = "[data-slot=tags-input-tag-remove]";

function defaultRejectionMessage(
  reason: TagRejectionReason,
  tag: string,
  max: number,
  message: string | null,
) {
  if (reason === "duplicate") return `${tag} is already added`;
  if (reason === "max") return `You can add up to ${max} tags`;
  return message ?? "";
}

function sameTags(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((tag, index) => tag === b[index]);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A text input that turns entries into tags: Enter or a delimiter commits the text (trimmed;
 * duplicates, `max` and `validate` reject it with a message), pasting a list adds each piece,
 * Backspace in the empty input removes the last tag, and ← (→ in RTL) at the start of the input
 * moves to the tags' remove buttons, where the arrows, Home and End move and Backspace, Delete,
 * Enter or Space remove. Each add, removal and rejection is announced. Name it with a `Field`
 * label or `inputProps["aria-label"]`.
 */
export function TagsInput({
  value: valueProp,
  defaultValue = emptyTags,
  onValueChange,
  inputValue: inputValueProp,
  defaultInputValue = "",
  onInputValueChange,
  delimiters = defaultDelimiters,
  max = Number.POSITIVE_INFINITY,
  allowDuplicates = false,
  validate,
  addOnBlur = false,
  onTagRejected,
  disabled: disabledProp,
  readOnly = false,
  required,
  name,
  form,
  size = "md",
  placeholder,
  inputProps,
  listLabel = "Tags",
  removeLabel = (tag) => `Remove ${tag}`,
  addedLabel = (tag) => `${tag} added`,
  removedLabel = (tag) => `${tag} removed`,
  rejectionLabel,
  ref,
  className,
  ...props
}: TagsInputProps) {
  const field = useFieldRootContext();
  const { labelId: fieldLabelId, getDescriptionProps } = useLabelableContext();
  // The input is the labelable control: the FieldLabel's `for` points at it.
  const inputId = useLabelableId({ id: inputProps?.id });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRootRef = useMergedRefs(rootRef, ref);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setInputRef = useMergedRefs(inputRef, inputProps?.ref);
  const direction = useElementDirection(rootRef);

  const [tags, setTags] = useControllableState(valueProp, defaultValue, onValueChange);
  const [text, setText] = useControllableState(
    inputValueProp,
    defaultInputValue,
    onInputValueChange,
  );
  const [message, announce] = useStatusMessage();
  // The text of the last rejected entry: the field is invalid while the input still holds it.
  const [rejectedText, setRejectedText] = useState<string | null>(null);

  const disabled = !!disabledProp || field.state.disabled;
  const editable = !disabled && !readOnly;
  const invalid =
    field.state.valid === false ||
    (rejectedText !== null && rejectedText === text) ||
    inputProps?.["aria-invalid"] === true ||
    inputProps?.["aria-invalid"] === "true";

  // What to do once a change arrives as the new `tags` (clear the input, move focus). It is settled
  // by the change's own render (each change also announces, so that render always happens): a
  // controlled parent that refused it still has the old tags there, so the typed text and the
  // focus stay and nothing is left to run on a later, unrelated change of `value`.
  const afterChange = useRef<{ previous: readonly string[]; run: () => void } | null>(null);
  useLayoutEffect(() => {
    const pending = afterChange.current;
    if (!pending) return;
    afterChange.current = null;
    if (!sameTags(pending.previous, tags)) pending.run();
  });
  const change = (next: string[], run: () => void = () => {}) => {
    afterChange.current = { previous: tags, run };
    setTags(next);
  };

  const check = (tag: string, current: readonly string[]): TagRejection | null => {
    let reason: TagRejectionReason | null = null;
    let detail: string | null = null;
    if (current.length >= max) {
      reason = "max";
    } else if (
      !allowDuplicates &&
      current.some((other) => other.toLocaleLowerCase() === tag.toLocaleLowerCase())
    ) {
      reason = "duplicate";
    } else {
      detail = validate?.(tag, current) ?? null;
      if (detail) reason = "invalid";
    }
    if (!reason) return null;
    const message =
      rejectionLabel?.(reason, tag, { max, message: detail }) ??
      defaultRejectionMessage(reason, tag, max, detail);
    return { tag, reason, message };
  };

  const focusRemove = (index: number) => {
    rootRef.current?.querySelectorAll<HTMLElement>(removeSelector)[index]?.focus();
  };
  const focusInputAtStart = () => {
    const input = inputRef.current;
    input?.focus();
    input?.setSelectionRange(0, 0);
  };

  /** Enter, a delimiter key or a blur: the whole text is one entry. */
  const commit = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    const rejection = check(tag, tags);
    if (rejection) {
      setRejectedText(raw);
      onTagRejected?.(rejection);
      announce(rejection.message);
      return;
    }
    change([...tags, tag], () => setText(""));
    announce(addedLabel(tag));
  };

  /**
   * A paste or a mobile edit holding several entries: each piece is checked in order (`max`
   * counted as they go), the rejected ones stay in the input joined by ", " (before `rest`, the
   * text after the last delimiter), and one announcement sums it up.
   */
  const commitMany = (pieces: string[], rest: string) => {
    let next = tags;
    const added: string[] = [];
    const rejected: string[] = [];
    let firstRejection: string | null = null;
    for (const piece of pieces) {
      const tag = piece.trim();
      if (!tag) continue;
      const rejection = check(tag, next);
      if (rejection) {
        onTagRejected?.(rejection);
        rejected.push(tag);
        firstRejection ??= rejection.message;
      } else {
        next = [...next, tag];
        added.push(tag);
      }
    }
    const remaining = [...rejected, rest].filter((part) => part !== "").join(", ");
    const showRemaining = () => {
      setText(remaining);
      if (rejected.length > 0) setRejectedText(remaining);
    };
    if (added.length > 0) change(next, showRemaining);
    else showRemaining();
    const summary = [
      added.length === 1 ? addedLabel(added[0] as string) : null,
      added.length > 1 ? `${added.length} tags added` : null,
      firstRejection,
    ].filter((part) => part !== null);
    if (summary.length > 0) announce(summary.join(". "));
  };

  const splitter = new RegExp(
    [...delimiters, "\r\n", "\n", "\r"]
      .filter((delimiter) => delimiter !== "")
      .map(escapeRegExp)
      .join("|"),
  );

  // A keyboard removal moves focus off a remove button that is about to unmount (Chromium reports a
  // focused element's removal as a `focusout` to nowhere, which the Field would take for a blur). A
  // controlled parent that refuses the removal keeps the tag: focus goes back to its button.
  const [removals, setRemovals] = useState(0);
  const pendingRemoval = useRef<{ previous: readonly string[]; button: HTMLElement } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per removal, after its render.
  useLayoutEffect(() => {
    const pending = pendingRemoval.current;
    if (!pending) return;
    pendingRemoval.current = null;
    if (sameTags(pending.previous, tags) && pending.button.isConnected) pending.button.focus();
  }, [removals]);

  const removeAt = (index: number, refocus: boolean) => {
    const tag = tags[index];
    if (tag === undefined) return;
    const next = tags.filter((_, i) => i !== index);
    const button = document.activeElement;
    if (refocus && button instanceof HTMLElement && button.matches(removeSelector)) {
      // Tags keyed by text unmount the removed tag's button; tags keyed by index unmount the last.
      const buttons = [...(rootRef.current?.querySelectorAll<HTMLElement>(removeSelector) ?? [])];
      const unmounts = allowDuplicates ? index === tags.length - 1 : true;
      if (unmounts) (buttons[index + 1] ?? buttons[index - 1] ?? inputRef.current)?.focus();
      pendingRemoval.current = { previous: tags, button };
      setRemovals((count) => count + 1);
    }
    change(next, () => {
      if (!refocus) return;
      if (next.length === 0) inputRef.current?.focus();
      else focusRemove(Math.min(index, next.length - 1));
    });
    announce(removedLabel(tag));
  };

  const previousKey = direction === "rtl" ? "ArrowRight" : "ArrowLeft";
  const nextKey = direction === "rtl" ? "ArrowLeft" : "ArrowRight";

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    inputProps?.onKeyDown?.(event);
    if (event.defaultPrevented || isForeignKey(event)) return;
    const input = event.currentTarget;
    const caretAtStart = input.selectionStart === 0 && input.selectionEnd === 0;
    if (event.key === "Enter" || delimiters.includes(event.key)) {
      if (!editable) return;
      // Enter in an empty input is the native implicit submission.
      if (event.key === "Enter" && text.trim() === "") return;
      event.preventDefault();
      commit(text);
    } else if (event.key === "Backspace") {
      if (!editable || text !== "" || !caretAtStart || tags.length === 0) return;
      event.preventDefault();
      removeAt(tags.length - 1, false);
    } else if (event.key === previousKey) {
      if (!editable || !caretAtStart || tags.length === 0) return;
      event.preventDefault();
      focusRemove(tags.length - 1);
    } else if (event.key === "Escape") {
      if (!editable || text === "") return;
      setText("");
      claimEscape(event.nativeEvent);
    }
  };

  const onRemoveKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (isForeignKey(event)) return;
    const last = tags.length - 1;
    switch (event.key) {
      case previousKey:
        focusRemove(Math.max(0, index - 1));
        break;
      case nextKey:
        if (index >= last) focusInputAtStart();
        else focusRemove(index + 1);
        break;
      case "Home":
        focusRemove(0);
        break;
      case "End":
        focusRemove(last);
        break;
      case "Backspace":
      case "Delete":
      case "Enter":
      case " ":
        removeAt(index, true);
        break;
      case "Escape":
        // Consumed here: an enclosing Tessera overlay closes on the next Escape.
        claimEscape(event.nativeEvent);
        inputRef.current?.focus();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    inputProps?.onPaste?.(event);
    if (event.defaultPrevented || !editable) return;
    const pasted = event.clipboardData.getData("text");
    // Text without a delimiter or a newline pastes natively.
    if (!splitter.test(pasted)) return;
    event.preventDefault();
    const input = event.currentTarget;
    const before = text.slice(0, input.selectionStart ?? text.length);
    const after = text.slice(input.selectionEnd ?? text.length);
    commitMany((before + pasted + after).split(splitter), "");
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    inputProps?.onChange?.(event);
    if (!editable) return;
    const next = event.target.value;
    // A delimiter typed without an identifiable keydown (mobile keyboards send "Unidentified"):
    // commit each piece before the last delimiter and keep the rest.
    let start = -1;
    let end = -1;
    for (const delimiter of delimiters) {
      if (delimiter === "") continue;
      const index = next.lastIndexOf(delimiter);
      if (index !== -1 && index + delimiter.length > end) {
        start = index;
        end = index + delimiter.length;
      }
    }
    if (end === -1) {
      setText(next);
      return;
    }
    commitMany(next.slice(0, start).split(splitter), next.slice(end));
  };

  const formControl = useFormControl({
    slot: "tags-input-form-control",
    value: tags,
    inputValue: tags.join("\n"),
    formValue: tags,
    registrationName: name,
    form,
    required,
    disabled,
    readOnly,
    customValidity: "",
    controlRef: inputRef,
  });
  // The input and the remove buttons are one control for the Field's focus / blur.
  useFocusScope(() => [rootRef.current], formControl.onFocus, formControl.onBlur);

  const { "aria-describedby": ariaDescribedBy } = getDescriptionProps({
    "aria-describedby": inputProps?.["aria-describedby"],
  });
  const ariaLabel =
    inputProps?.["aria-label"] ??
    (fieldLabelId || inputProps?.["aria-labelledby"] ? undefined : "Add a tag");
  const nativeName = name ?? field.name;

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the mouse down only moves focus from the padding to the input, which handles the keys. */}
      <div
        {...props}
        ref={setRootRef}
        data-slot="tags-input"
        data-size={size}
        data-disabled={disabled ? "" : undefined}
        data-readonly={readOnly ? "" : undefined}
        data-invalid={invalid ? "" : undefined}
        className={cn(tagsInputBase, tagsInputSizes[size], className)}
        onMouseDown={(event) => {
          props.onMouseDown?.(event);
          if (event.defaultPrevented || disabled) return;
          const target = event.target as Element;
          if (target === inputRef.current || target.closest(removeSelector)) return;
          // The padding or a tag's text: keep the caret in the input.
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        {tags.length > 0 && (
          <ul
            // biome-ignore lint/a11y/noRedundantRoles: Safari drops the list role of a `display: contents` list.
            role="list"
            data-slot="tags-input-list"
            aria-labelledby={fieldLabelId}
            aria-label={fieldLabelId ? undefined : listLabel}
            // The disabled look fades the chips' text (an inactive control, exempt from WCAG
            // contrast); the state is stated so assistive technology and audits know it.
            aria-disabled={disabled ? true : undefined}
            className="contents"
          >
            {tags.map((tag, index) => (
              <li
                // Equal tags would collide as keys, so they are keyed by position.
                key={allowDuplicates ? `${index}` : tag}
                data-slot="tags-input-tag"
                className={cn(tagsInputTag, readOnly && "pe-1.5")}
              >
                <span data-slot="tags-input-tag-text" className="truncate">
                  {tag}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={disabled}
                    aria-label={removeLabel(tag)}
                    data-slot="tags-input-tag-remove"
                    className={tagsInputTagRemove}
                    onClick={() => {
                      // A pointer user is not navigating the tags: back to the input.
                      inputRef.current?.focus();
                      removeAt(index, false);
                    }}
                    onKeyDown={(event) => onRemoveKeyDown(event, index)}
                  >
                    <CloseIcon />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <input
          {...inputProps}
          ref={setInputRef}
          id={inputId}
          value={text}
          placeholder={placeholder ?? inputProps?.placeholder}
          disabled={disabled}
          readOnly={readOnly}
          enterKeyHint="enter"
          autoComplete="off"
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={invalid ? true : undefined}
          // Native `required` sits on the validation input, so the attribute states it here.
          aria-required={required ? true : undefined}
          data-slot="tags-input-input"
          className={cn(tagsInputInput, size === "sm" && "h-6", inputProps?.className)}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
          onPaste={onPaste}
          onBlur={(event) => {
            inputProps?.onBlur?.(event);
            if (addOnBlur && editable && text.trim() !== "") commit(text);
          }}
        />
        <span role="status" data-slot="tags-input-status" className="sr-only">
          {message}
        </span>
      </div>
      {formControl.input}
      {nativeName &&
        tags.map((tag, index) => (
          <input
            key={allowDuplicates ? `${index}` : tag}
            type="hidden"
            name={nativeName}
            form={form}
            value={tag}
            disabled={disabled}
          />
        ))}
    </>
  );
}
