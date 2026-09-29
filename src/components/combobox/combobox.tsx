"use client";

import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { createContext, type Ref, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "../../lib/cn";
import { CheckIcon, ChevronDownIcon } from "../../lib/icons";
import { mergeClassName } from "../../lib/merge-class-name";
import { menuItemBase, popupMotion, popupSurface } from "../../lib/overlay-classes";
import { useLayeredEscape } from "../../lib/tooltip-escape";
import {
  type ComboboxInputGroupVariantProps,
  comboboxButtonBase,
  comboboxChipsBase,
  comboboxContentBase,
  comboboxDefaults,
  comboboxEmptyBase,
  comboboxGroupLabelBase,
  comboboxInputBase,
  comboboxInputGroupVariants,
  comboboxListBase,
  comboboxSeparatorBase,
  comboboxStatusBase,
} from "./combobox-variants";

const comboboxChipsInputBase =
  "h-7 min-w-16 flex-1 bg-transparent px-1.5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed";
const comboboxItemBase = "pl-8 data-selected:font-medium";
const comboboxItemIndicatorBase = "absolute left-2 flex size-4 items-center justify-center";
const comboboxChipBase =
  "inline-flex h-6 items-center gap-1 rounded-md bg-muted px-1.5 text-xs text-foreground outline-none outline-offset-1 outline-ring focus-visible:outline-2 focus-visible:outline-solid forced-colors:focus-visible:outline-[Highlight] data-disabled:opacity-50";
const comboboxChipRemoveBase =
  "-me-0.5 flex size-4 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none not-data-disabled:hover:bg-foreground/10 not-data-disabled:hover:text-foreground disabled:cursor-not-allowed aria-disabled:cursor-not-allowed [&_svg]:size-3";

/*
 * `Combobox.Chips` holds no input group, so Base UI anchors the popup to the (narrow) `<input>`
 * inside it. `ComboboxChips` registers its element here and `ComboboxContent` anchors to it
 * instead, so the list is as wide as the chips field. `ComboboxInput` also reads whether it sits in
 * chips, to render a bare input rather than its own text-field group.
 */
interface ChipsAnchor {
  element: HTMLElement | null;
  setElement: (element: HTMLElement | null) => void;
}
const ChipsAnchorContext = createContext<ChipsAnchor | null>(null);
const InsideChipsContext = createContext(false);

/**
 * Base UI Combobox.Root props: `items` (the list to filter — strings, `{ value, label }` objects,
 * or groups `{ value, items }`), `value` / `defaultValue` + `onValueChange`, `multiple`,
 * `itemToStringLabel` / `itemToStringValue` for other object shapes, `filter` (`null` for async
 * results you filter yourself), `inputValue` / `onInputValueChange`, `name`, `required`,
 * `disabled`, `readOnly`, `open` / `onOpenChange`, `autoHighlight`, `openOnInputClick`, `limit`.
 */
export type ComboboxProps<
  Value,
  Multiple extends boolean | undefined = false,
  Item = Value,
> = BaseCombobox.Root.Props<Value, Multiple, Item>;

/**
 * Groups the input and the list, owns the value (submitted through a hidden input when `name` is
 * set) and filters `items` as the user types. Renders no element.
 */
export function Combobox<Value, Multiple extends boolean | undefined = false, Item = Value>({
  onOpenChange,
  ...props
}: ComboboxProps<Value, Multiple, Item>) {
  const handleOpenChange = useLayeredEscape(onOpenChange);
  const [chipsElement, setChipsElement] = useState<HTMLElement | null>(null);
  const anchor = useMemo(
    () => ({ element: chipsElement, setElement: setChipsElement }),
    [chipsElement],
  );
  return (
    <ChipsAnchorContext.Provider value={anchor}>
      <BaseCombobox.Root {...props} onOpenChange={handleOpenChange} />
    </ChipsAnchorContext.Provider>
  );
}

export interface ComboboxInputProps
  extends Omit<BaseCombobox.Input.Props, "size">,
    ComboboxInputGroupVariantProps {
  /** Show the chevron `ComboboxTrigger` at the end of the field. @default true */
  showTrigger?: boolean;
  /** Show a `ComboboxClear` button while a value is selected. @default false */
  showClear?: boolean;
  /** Classes for the text-field group around the input (`className` goes to the `<input>`). */
  groupClassName?: BaseCombobox.InputGroup.Props["className"];
}

/**
 * The text input (`role="combobox"`) inside an Input-looking group (`size` `sm` | `md` | `lg`),
 * with an optional trailing clear button and chevron trigger. Typing opens and filters the list;
 * ArrowDown / ArrowUp move the highlight, Enter selects. Inside a `Field`, the `FieldLabel` names
 * it and an invalid Field gives the group the danger border. Inside `ComboboxChips` it renders the
 * bare input only (the chips container is the field there; `size` / `showTrigger` / `showClear` /
 * `groupClassName` are ignored).
 */
export function ComboboxInput({
  size,
  showTrigger = true,
  showClear = false,
  groupClassName,
  className,
  ...props
}: ComboboxInputProps) {
  const insideChips = useContext(InsideChipsContext);
  if (insideChips) {
    return (
      <BaseCombobox.Input
        {...props}
        data-slot="combobox-input"
        className={mergeClassName(comboboxChipsInputBase, className)}
      />
    );
  }
  return (
    <BaseCombobox.InputGroup
      data-slot="combobox-input-group"
      data-size={size ?? comboboxDefaults.size}
      className={mergeClassName(comboboxInputGroupVariants({ size }), groupClassName)}
    >
      <BaseCombobox.Input
        {...props}
        data-slot="combobox-input"
        className={mergeClassName(comboboxInputBase, className)}
      />
      {showClear && <ComboboxClear />}
      {showTrigger && <ComboboxTrigger />}
    </BaseCombobox.InputGroup>
  );
}

export type ComboboxTriggerProps = BaseCombobox.Trigger.Props;

/**
 * A chevron button that toggles the list. Base UI keeps it out of the Tab order (the input opens
 * the list with ArrowDown), so it is a pointer affordance; its default name is "Show options"
 * (inside a `Field`, Base UI names it by the `FieldLabel` instead).
 */
export function ComboboxTrigger({
  className,
  children,
  "aria-label": ariaLabel = "Show options",
  ...props
}: ComboboxTriggerProps) {
  return (
    <BaseCombobox.Trigger
      {...props}
      aria-label={ariaLabel}
      data-slot="combobox-trigger"
      className={mergeClassName(comboboxButtonBase, className)}
    >
      {children ?? <ChevronDownIcon />}
    </BaseCombobox.Trigger>
  );
}

export type ComboboxClearProps = BaseCombobox.Clear.Props;

/**
 * Clears the value and the typed text, then refocuses the input. Rendered only while there is
 * something to clear. Like the trigger, it is out of the Tab order (Base UI); named "Clear".
 */
export function ComboboxClear({
  className,
  children,
  "aria-label": ariaLabel = "Clear",
  ...props
}: ComboboxClearProps) {
  return (
    <BaseCombobox.Clear
      {...props}
      aria-label={ariaLabel}
      data-slot="combobox-clear"
      className={mergeClassName(comboboxButtonBase, className)}
    >
      {children ?? <XIcon />}
    </BaseCombobox.Clear>
  );
}

export type ComboboxValueProps = BaseCombobox.Value.Props;

/**
 * The selected value, for rendering chips: `{(values) => values.map(…)}` inside `ComboboxChips`.
 * Renders no element.
 */
export function ComboboxValue(props: ComboboxValueProps) {
  return <BaseCombobox.Value {...props} />;
}

type PositionerProps = BaseCombobox.Positioner.Props;

export interface ComboboxContentProps extends BaseCombobox.Popup.Props {
  /** Side of the input to place the list on (flips on collision). @default "bottom" */
  side?: PositionerProps["side"];
  /** Alignment against the input. @default "start" */
  align?: PositionerProps["align"];
  /** Distance from the input in px. @default 6 */
  sideOffset?: PositionerProps["sideOffset"];
  /** Offset along the alignment axis in px. */
  alignOffset?: PositionerProps["alignOffset"];
  /** Space kept between the list and the viewport edges when colliding. */
  collisionPadding?: PositionerProps["collisionPadding"];
  /**
   * Element to position against. Defaults to the input group, or to `ComboboxChips` when the
   * combobox uses chips.
   */
  anchor?: PositionerProps["anchor"];
  /**
   * Element to portal into (default `document.body`). Pass an element inside a nested theme scope
   * (`data-primary`, `data-surface`, `.dark` on an inner element) so the list inherits it.
   */
  container?: BaseCombobox.Portal.Props["container"];
}

/**
 * The dropdown: portalled, below the input and at least as wide, on the popover surface, at most
 * 20rem tall (scrolls). Put a `ComboboxEmpty`, optionally a `ComboboxStatus`, and a `ComboboxList`
 * inside.
 */
export function ComboboxContent({
  side = "bottom",
  align = "start",
  sideOffset = 6,
  alignOffset,
  collisionPadding,
  anchor,
  container,
  className,
  ...props
}: ComboboxContentProps) {
  const chips = useContext(ChipsAnchorContext);
  return (
    <BaseCombobox.Portal container={container}>
      <BaseCombobox.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        anchor={anchor ?? chips?.element ?? undefined}
        className="z-(--z-overlay)"
      >
        <BaseCombobox.Popup
          {...props}
          data-slot="combobox-content"
          className={mergeClassName(cn(popupMotion, popupSurface, comboboxContentBase), className)}
        />
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  );
}

export type ComboboxListProps = BaseCombobox.List.Props;

/**
 * The listbox (`role="listbox"`). Pass a function child `{(item) => <ComboboxItem …/>}` to render
 * the filtered `items`, or plain children. Hidden while it holds no options.
 */
export function ComboboxList({ className, ...props }: ComboboxListProps) {
  return (
    <BaseCombobox.List
      {...props}
      data-slot="combobox-list"
      className={mergeClassName(comboboxListBase, className)}
    />
  );
}

export type ComboboxItemProps = BaseCombobox.Item.Props;

/**
 * One option (`role="option"`, `aria-selected`) with a check mark in the leading slot while
 * selected. Pass the item's `value`. A `disabled` item stays reachable by the arrow keys but cannot
 * be chosen.
 */
export function ComboboxItem({ className, children, ...props }: ComboboxItemProps) {
  return (
    <BaseCombobox.Item
      {...props}
      data-slot="combobox-item"
      className={mergeClassName(cn(menuItemBase, comboboxItemBase), className)}
    >
      <BaseCombobox.ItemIndicator
        data-slot="combobox-item-indicator"
        className={comboboxItemIndicatorBase}
      >
        <CheckIcon />
      </BaseCombobox.ItemIndicator>
      {children}
    </BaseCombobox.Item>
  );
}

export type ComboboxEmptyProps = BaseCombobox.Empty.Props;

/**
 * The "no matches" message (a polite live region), shown only while filtering leaves no items.
 * Requires the root's `items`.
 */
export function ComboboxEmpty({ className, ...props }: ComboboxEmptyProps) {
  return (
    <BaseCombobox.Empty
      {...props}
      data-slot="combobox-empty"
      className={mergeClassName(comboboxEmptyBase, className)}
    />
  );
}

export type ComboboxStatusProps = BaseCombobox.Status.Props;

/**
 * A muted polite live region for async state ("Searching…", "3 results", an error). Render the
 * text only while it applies; it collapses when empty.
 */
export function ComboboxStatus({ className, ...props }: ComboboxStatusProps) {
  return (
    <BaseCombobox.Status
      {...props}
      data-slot="combobox-status"
      className={mergeClassName(comboboxStatusBase, className)}
    />
  );
}

export type ComboboxGroupProps = BaseCombobox.Group.Props;

/**
 * Groups related items (`role="group"`); name it with a `ComboboxGroupLabel`. For grouped `items`
 * (`{ value, items }[]`), pass the group's `items` and render them with a `ComboboxCollection`.
 */
export function ComboboxGroup(props: ComboboxGroupProps) {
  return <BaseCombobox.Group {...props} data-slot="combobox-group" />;
}

export type ComboboxGroupLabelProps = BaseCombobox.GroupLabel.Props;

/** A small muted heading that labels its `ComboboxGroup` (via `aria-labelledby`). */
export function ComboboxGroupLabel({ className, ...props }: ComboboxGroupLabelProps) {
  return (
    <BaseCombobox.GroupLabel
      {...props}
      data-slot="combobox-group-label"
      className={mergeClassName(comboboxGroupLabelBase, className)}
    />
  );
}

export type ComboboxCollectionProps = BaseCombobox.Collection.Props;

/**
 * Renders a `ComboboxGroup`'s filtered `items` with a function child. Renders no element. (A flat
 * list passes the function straight to `ComboboxList` instead.)
 */
export function ComboboxCollection(props: ComboboxCollectionProps) {
  return <BaseCombobox.Collection {...props} />;
}

export type ComboboxSeparatorProps = BaseCombobox.Separator.Props;

/**
 * A hairline between groups. Base UI renders it `role="presentation"`: a listbox may only own
 * options and groups.
 */
export function ComboboxSeparator({ className, ...props }: ComboboxSeparatorProps) {
  return (
    <BaseCombobox.Separator
      {...props}
      data-slot="combobox-separator"
      className={mergeClassName(comboboxSeparatorBase, className)}
    />
  );
}

export type ComboboxChipsProps = BaseCombobox.Chips.Props;

/**
 * For `multiple`: the text field holding one `ComboboxChip` per selected value (render them with
 * `ComboboxValue`) followed by a `ComboboxInput`. ArrowLeft from the start of the input moves into
 * the chips; Backspace in an empty input removes the last chip. The list anchors to this field.
 */
export function ComboboxChips({ className, ref, ...props }: ComboboxChipsProps) {
  const chips = useContext(ChipsAnchorContext);
  const setElement = chips?.setElement;
  // Compose the caller's ref with the anchor registration, so both receive the element. The
  // returned cleanup (React 19) detaches both, honouring a callback ref's own cleanup.
  const composedRef = useCallback(
    (element: HTMLDivElement | null) => {
      setElement?.(element);
      const cleanup = assignRef(ref, element);
      return () => {
        setElement?.(null);
        if (cleanup) cleanup();
        else assignRef(ref, null);
      };
    },
    [setElement, ref],
  );
  return (
    <InsideChipsContext.Provider value={true}>
      <BaseCombobox.Chips
        {...props}
        ref={composedRef}
        data-slot="combobox-chips"
        className={mergeClassName(cn(comboboxChipsBase), className)}
      />
    </InsideChipsContext.Provider>
  );
}

/** Sets a callback or object ref; returns the callback ref's cleanup, if any. */
function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    const cleanup = ref(value);
    return typeof cleanup === "function" ? cleanup : undefined;
  }
  if (ref) ref.current = value;
  return undefined;
}

export type ComboboxChipProps = BaseCombobox.Chip.Props;

/**
 * One selected value. Reached with the arrow keys from the input (Base UI moves focus onto it),
 * where Backspace / Delete remove it.
 */
export function ComboboxChip({ className, ...props }: ComboboxChipProps) {
  return (
    <BaseCombobox.Chip
      {...props}
      data-slot="combobox-chip"
      className={mergeClassName(comboboxChipBase, className)}
    />
  );
}

export type ComboboxChipRemoveProps = BaseCombobox.ChipRemove.Props;

/** The chip's × button, named "Remove". Out of the Tab order (Base UI); refocuses the input. */
export function ComboboxChipRemove({
  className,
  children,
  "aria-label": ariaLabel = "Remove",
  ...props
}: ComboboxChipRemoveProps) {
  return (
    <BaseCombobox.ChipRemove
      {...props}
      aria-label={ariaLabel}
      data-slot="combobox-chip-remove"
      className={mergeClassName(comboboxChipRemoveBase, className)}
    >
      {children ?? <XIcon />}
    </BaseCombobox.ChipRemove>
  );
}

function XIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
