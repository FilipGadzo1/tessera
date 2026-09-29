"use client";

import { Autocomplete as BaseAutocomplete } from "@base-ui/react/autocomplete";
import type { ReactElement } from "react";
import { cn } from "../../lib/cn";
import { ChevronDownIcon, CloseIcon } from "../../lib/icons";
import { mergeClassName } from "../../lib/merge-class-name";
import { menuItemBase, popupMotion, popupSurface } from "../../lib/overlay-classes";
import { useLayeredEscape } from "../../lib/tooltip-escape";
import {
  type ComboboxInputGroupVariantProps,
  comboboxButtonBase,
  comboboxContentBase,
  comboboxDefaults,
  comboboxEmptyBase,
  comboboxGroupLabelBase,
  comboboxInputBase,
  comboboxInputGroupVariants,
  comboboxListBase,
  comboboxSeparatorBase,
  comboboxStatusBase,
} from "../combobox/combobox-variants";

/**
 * Base UI Autocomplete.Root props: `items` (the suggestions to filter: strings, `{ value, label }`
 * objects, or groups `{ value, items }`), `value` / `defaultValue` (the input text) +
 * `onValueChange`, `mode` (`list` | `both` | `inline` | `none`), `filter` (`null` for async
 * results you filter yourself), `itemToStringValue` for other object shapes, `name`, `required`,
 * `disabled`, `readOnly`, `open` / `onOpenChange`, `autoHighlight`, `openOnInputClick`, `limit`,
 * `inline` (render the list without a popup, for a command palette).
 */
export type AutocompleteProps<ItemValue = unknown> = BaseAutocomplete.Root.Props<ItemValue>;

/**
 * Groups the input and the list and filters `items` as the user types. Unlike a Combobox the
 * input holds free-form text: choosing a suggestion only fills the input, no selection is kept.
 * The text is submitted through the input when `name` is set. Renders no element.
 */
export function Autocomplete<ItemValue = unknown>({
  onOpenChange,
  ...props
}: AutocompleteProps<ItemValue>) {
  const handleOpenChange = useLayeredEscape(onOpenChange);
  // Base UI overloads the root on flat vs grouped `items`; the union prop type matches neither
  // alone, so call it through its single-props signature.
  const Root = BaseAutocomplete.Root as (props: AutocompleteProps<ItemValue>) => ReactElement;
  return <Root {...props} onOpenChange={handleOpenChange} />;
}

export interface AutocompleteInputProps
  extends Omit<BaseAutocomplete.Input.Props, "size">,
    ComboboxInputGroupVariantProps {
  /** Show a chevron `AutocompleteTrigger` that opens the suggestions. @default false */
  showTrigger?: boolean;
  /** Show an `AutocompleteClear` button while the input has text. @default false */
  showClear?: boolean;
  /** Classes for the text-field group around the input (`className` goes to the `<input>`). */
  groupClassName?: BaseAutocomplete.InputGroup.Props["className"];
}

/**
 * The text input (`role="combobox"`) inside an Input-looking group (`size` `sm` | `md` | `lg`),
 * with an optional trailing clear button and chevron trigger. Typing opens and filters the
 * suggestions; ArrowDown / ArrowUp move the highlight, Enter fills the input with the highlighted
 * one. Inside a `Field`, the `FieldLabel` names it and an invalid Field gives the group the danger
 * border.
 */
export function AutocompleteInput({
  size,
  showTrigger = false,
  showClear = false,
  groupClassName,
  className,
  ...props
}: AutocompleteInputProps) {
  return (
    <BaseAutocomplete.InputGroup
      data-slot="autocomplete-input-group"
      data-size={size ?? comboboxDefaults.size}
      className={mergeClassName(comboboxInputGroupVariants({ size }), groupClassName)}
    >
      <BaseAutocomplete.Input
        {...props}
        data-slot="autocomplete-input"
        className={mergeClassName(comboboxInputBase, className)}
      />
      {showClear && <AutocompleteClear />}
      {showTrigger && <AutocompleteTrigger />}
    </BaseAutocomplete.InputGroup>
  );
}

export type AutocompleteTriggerProps = BaseAutocomplete.Trigger.Props;

/**
 * A chevron button that toggles the suggestions. Base UI keeps it out of the Tab order (the input
 * opens the list with ArrowDown), so it is a pointer affordance; its default name is "Show
 * suggestions" (inside a `Field`, Base UI names it by the `FieldLabel` instead).
 */
export function AutocompleteTrigger({
  className,
  children,
  "aria-label": ariaLabel = "Show suggestions",
  ...props
}: AutocompleteTriggerProps) {
  return (
    <BaseAutocomplete.Trigger
      {...props}
      aria-label={ariaLabel}
      data-slot="autocomplete-trigger"
      className={mergeClassName(comboboxButtonBase, className)}
    >
      {children ?? <ChevronDownIcon />}
    </BaseAutocomplete.Trigger>
  );
}

export type AutocompleteClearProps = BaseAutocomplete.Clear.Props;

/**
 * Clears the typed text, then refocuses the input. Rendered only while there is something to
 * clear. Like the trigger, it is out of the Tab order (Base UI); named "Clear".
 */
export function AutocompleteClear({
  className,
  children,
  "aria-label": ariaLabel = "Clear",
  ...props
}: AutocompleteClearProps) {
  return (
    <BaseAutocomplete.Clear
      {...props}
      aria-label={ariaLabel}
      data-slot="autocomplete-clear"
      className={mergeClassName(comboboxButtonBase, className)}
    >
      {children ?? <CloseIcon />}
    </BaseAutocomplete.Clear>
  );
}

type PositionerProps = BaseAutocomplete.Positioner.Props;

export interface AutocompleteContentProps extends BaseAutocomplete.Popup.Props {
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
  /** Element to position against. Defaults to the input group. */
  anchor?: PositionerProps["anchor"];
  /**
   * Element to portal into (default `document.body`). Pass an element inside a nested theme scope
   * (`data-primary`, `data-surface`, `.dark` on an inner element) so the list inherits it.
   */
  container?: BaseAutocomplete.Portal.Props["container"];
}

/**
 * The suggestions popup: portalled, below the input and at least as wide, on the popover surface,
 * at most 20rem tall (scrolls). Put an `AutocompleteEmpty`, optionally an `AutocompleteStatus`,
 * and an `AutocompleteList` inside. (For an always-open command palette, set `inline` and `open`
 * on the root and render `AutocompleteList` directly instead.)
 */
export function AutocompleteContent({
  side = "bottom",
  align = "start",
  sideOffset = 6,
  alignOffset,
  collisionPadding,
  anchor,
  container,
  className,
  ...props
}: AutocompleteContentProps) {
  return (
    <BaseAutocomplete.Portal container={container}>
      <BaseAutocomplete.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        anchor={anchor}
        className="z-(--z-overlay)"
      >
        <BaseAutocomplete.Popup
          {...props}
          data-slot="autocomplete-content"
          className={mergeClassName(cn(popupMotion, popupSurface, comboboxContentBase), className)}
        />
      </BaseAutocomplete.Positioner>
    </BaseAutocomplete.Portal>
  );
}

export type AutocompleteListProps = BaseAutocomplete.List.Props;

/**
 * The listbox (`role="listbox"`). Pass a function child `{(item) => <AutocompleteItem />}` to
 * render the filtered `items`, or plain children. Hidden while it holds no options.
 */
export function AutocompleteList({ className, ...props }: AutocompleteListProps) {
  return (
    <BaseAutocomplete.List
      {...props}
      data-slot="autocomplete-list"
      className={mergeClassName(comboboxListBase, className)}
    />
  );
}

export type AutocompleteItemProps = BaseAutocomplete.Item.Props;

/**
 * One suggestion (`role="option"`). Pass the item's `value`. Choosing it fills the input; there is
 * no selected state, so no check mark. In a command palette, give it an `onClick` that runs the
 * action. A `disabled` item stays reachable by the arrow keys but cannot be chosen.
 */
export function AutocompleteItem({ className, ...props }: AutocompleteItemProps) {
  return (
    <BaseAutocomplete.Item
      {...props}
      data-slot="autocomplete-item"
      className={mergeClassName(menuItemBase, className)}
    />
  );
}

export type AutocompleteEmptyProps = BaseAutocomplete.Empty.Props;

/**
 * The "no matches" message (a polite live region), shown only while filtering leaves no items.
 * Requires the root `items`.
 */
export function AutocompleteEmpty({ className, ...props }: AutocompleteEmptyProps) {
  return (
    <BaseAutocomplete.Empty
      {...props}
      data-slot="autocomplete-empty"
      className={mergeClassName(comboboxEmptyBase, className)}
    />
  );
}

export type AutocompleteStatusProps = BaseAutocomplete.Status.Props;

/**
 * A muted polite live region for async state ("Searching…", "3 results", an error). Render the
 * text only while it applies; it collapses when empty.
 */
export function AutocompleteStatus({ className, ...props }: AutocompleteStatusProps) {
  return (
    <BaseAutocomplete.Status
      {...props}
      data-slot="autocomplete-status"
      className={mergeClassName(comboboxStatusBase, className)}
    />
  );
}

export type AutocompleteGroupProps = BaseAutocomplete.Group.Props;

/**
 * Groups related items (`role="group"`); name it with an `AutocompleteGroupLabel`. For grouped
 * `items` (`{ value, items }[]`), pass the group `items` and render them with an
 * `AutocompleteCollection`.
 */
export function AutocompleteGroup(props: AutocompleteGroupProps) {
  return <BaseAutocomplete.Group {...props} data-slot="autocomplete-group" />;
}

export type AutocompleteGroupLabelProps = BaseAutocomplete.GroupLabel.Props;

/** A small muted heading that labels its `AutocompleteGroup` (via `aria-labelledby`). */
export function AutocompleteGroupLabel({ className, ...props }: AutocompleteGroupLabelProps) {
  return (
    <BaseAutocomplete.GroupLabel
      {...props}
      data-slot="autocomplete-group-label"
      className={mergeClassName(comboboxGroupLabelBase, className)}
    />
  );
}

export type AutocompleteCollectionProps = BaseAutocomplete.Collection.Props;

/**
 * Renders an `AutocompleteGroup` filtered `items` with a function child. Renders no element. (A
 * flat list passes the function straight to `AutocompleteList` instead.)
 */
export function AutocompleteCollection(props: AutocompleteCollectionProps) {
  return <BaseAutocomplete.Collection {...props} />;
}

export type AutocompleteSeparatorProps = BaseAutocomplete.Separator.Props;

/**
 * A hairline between groups. Base UI renders it `role="presentation"`: a listbox may only own
 * options and groups.
 */
export function AutocompleteSeparator({ className, ...props }: AutocompleteSeparatorProps) {
  return (
    <BaseAutocomplete.Separator
      {...props}
      data-slot="autocomplete-separator"
      className={mergeClassName(comboboxSeparatorBase, className)}
    />
  );
}
