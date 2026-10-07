/*
 * TagsInput's class strings (spec Phase K §4). Server-safe: no hooks, no browser APIs.
 */

/**
 * The text-field look on the wrapping row (Combobox chips' look, keyed on TagsInput's own
 * `data-*` state rather than the input's): the 1px `focus-within` ring, hover, invalid, disabled,
 * read-only and motion.
 */
export const tagsInputBase: string[] = [
  "flex w-full min-w-0 flex-wrap items-center gap-1 rounded-md border border-field-border bg-field text-foreground shadow-xs cursor-text",
  "not-data-disabled:not-data-invalid:not-focus-within:hover:border-field-border-hover",
  "outline-none focus-within:outline-1 focus-within:outline-solid focus-within:outline-ring focus-within:border-ring forced-colors:focus-within:outline-[Highlight]",
  "data-invalid:border-danger data-invalid:focus-within:outline-danger forced-colors:data-invalid:focus-within:outline-[Highlight]",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-readonly:bg-muted",
  "transition-[color,background-color,border-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none",
];

/** Minimum height, padding and text size per `size` (the Input heights). */
export const tagsInputSizes = {
  sm: "min-h-8 p-0.5 text-sm",
  md: "min-h-10 p-1 text-sm",
  lg: "min-h-12 p-1.5 text-base",
} as const;

/**
 * A tag chip. The ring goes round the whole chip while its remove button is focused (the Rating
 * item precedent); a read-only chip has no button and adds `pe-1.5`.
 */
export const tagsInputTag =
  "inline-flex h-6 max-w-full items-center gap-1 rounded-md bg-muted ps-1.5 pe-0.5 text-xs text-foreground forced-colors:border forced-colors:border-[CanvasText] outline-none outline-offset-1 outline-ring has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-solid forced-colors:has-[button:focus-visible]:outline-[Highlight]";

/** A chip's remove button (Combobox's chip remove, keyed on the native `disabled`). */
export const tagsInputTagRemove =
  "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none not-disabled:hover:bg-foreground/10 not-disabled:hover:text-foreground disabled:cursor-not-allowed [&_svg]:size-3";

/**
 * The inner input. Its own copy of Combobox's module-local `comboboxChipsInputBase` (not
 * exported from `combobox.tsx`); `sm` takes `h-6`.
 */
export const tagsInputInput =
  "h-7 min-w-16 flex-1 bg-transparent px-1.5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed";
