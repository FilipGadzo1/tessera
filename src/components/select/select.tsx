"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { cn } from "../../lib/cn";
import { CheckIcon, ChevronDownIcon } from "../../lib/icons";
import { mergeClassName } from "../../lib/merge-class-name";
import { menuItemBase, popupMotion, popupSurface } from "../../lib/overlay-classes";
import { useLayeredEscape } from "../../lib/tooltip-escape";
import { createTriggerDirection } from "../../lib/trigger-direction";
import {
  type SelectTriggerVariantProps,
  selectDefaults,
  selectTriggerVariants,
} from "./select-variants";

/** The list's placement follows the trigger's DOM direction. */
const { TriggerDirectionProvider, useTriggerDirectionRef } = createTriggerDirection();

/*
 * `min-w-0 truncate` is not in the spec string: without it a long value pushes the chevron out
 * of the trigger instead of ending in an ellipsis.
 */
const selectValueBase = "min-w-0 truncate data-placeholder:text-muted-foreground";
const selectIconBase = "flex shrink-0 text-muted-foreground [&_svg]:size-4";
const selectContentBase = "min-w-(--anchor-width) max-h-(--available-height) overflow-y-auto p-1";
const selectItemBase = "pl-8 data-selected:font-medium";
const selectItemIndicatorBase = "absolute left-2 flex size-4 items-center justify-center";
const selectGroupLabelBase = "px-2 py-1.5 text-xs font-medium text-muted-foreground";
const selectSeparatorBase = "-mx-1 my-1 h-px bg-border forced-colors:bg-[CanvasText]";

/**
 * Base UI Select.Root props: `value` / `defaultValue` + `onValueChange`, `items` (value → label, so
 * `SelectValue` shows labels rather than raw values), `multiple`, `name`, `required`, `disabled`,
 * `readOnly`, `open` / `onOpenChange`, `modal` (default `true`).
 */
export type SelectProps<
  Value,
  Multiple extends boolean | undefined = false,
> = BaseSelect.Root.Props<Value, Multiple>;

/**
 * Groups a trigger and its content, and owns the value (submitted through a hidden input when
 * `name` is set). Renders no element. Pass `items` so the trigger shows each value's label.
 */
export function Select<Value, Multiple extends boolean | undefined = false>({
  onOpenChange,
  ...props
}: SelectProps<Value, Multiple>) {
  const handleOpenChange = useLayeredEscape(onOpenChange);
  return (
    <TriggerDirectionProvider>
      <BaseSelect.Root {...props} onOpenChange={handleOpenChange} />
    </TriggerDirectionProvider>
  );
}

export interface SelectTriggerProps extends BaseSelect.Trigger.Props, SelectTriggerVariantProps {}

/**
 * The field that opens the listbox (`role="combobox"`), styled like an Input with the same
 * `size` scale (`sm` | `md` | `lg`), and a chevron after its children (usually a `SelectValue`).
 * Opens on click, Enter, Space or ArrowDown. Inside a `Field`, the `FieldLabel` names it and an
 * invalid Field gives it the danger border.
 */
export function SelectTrigger({ size, className, children, ref, ...props }: SelectTriggerProps) {
  const triggerRef = useTriggerDirectionRef(ref);
  return (
    <BaseSelect.Trigger
      {...props}
      ref={triggerRef}
      data-slot="select-trigger"
      data-size={size ?? selectDefaults.size}
      className={mergeClassName(selectTriggerVariants({ size }), className)}
    >
      {children}
      <BaseSelect.Icon data-slot="select-icon" aria-hidden="true" className={selectIconBase}>
        <ChevronDownIcon />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );
}

export type SelectValueProps = BaseSelect.Value.Props;

/**
 * The selected item's label (comma-joined when `multiple`), or `placeholder` in the muted colour
 * while nothing is selected. Children may be a function of the value: `{(value) => …}`.
 */
export function SelectValue({ className, ...props }: SelectValueProps) {
  return (
    <BaseSelect.Value
      {...props}
      data-slot="select-value"
      className={mergeClassName(selectValueBase, className)}
    />
  );
}

type PositionerProps = BaseSelect.Positioner.Props;

export interface SelectContentProps extends BaseSelect.Popup.Props {
  /** Side of the trigger to place the list on (flips on collision). @default "bottom" */
  side?: PositionerProps["side"];
  /** Alignment against the trigger. @default "start" */
  align?: PositionerProps["align"];
  /** Distance from the trigger in px. @default 6 */
  sideOffset?: PositionerProps["sideOffset"];
  /** Offset along the alignment axis in px. */
  alignOffset?: PositionerProps["alignOffset"];
  /** Space kept between the list and the viewport edges when colliding. */
  collisionPadding?: PositionerProps["collisionPadding"];
  /**
   * Overlap the trigger so the selected item sits over the value (macOS style; mouse only).
   * Off by default: the list drops down below the trigger, like most web dropdowns.
   * @default false
   */
  alignItemWithTrigger?: PositionerProps["alignItemWithTrigger"];
  /**
   * Element to portal into (default `document.body`). Pass an element inside a nested theme scope
   * (`data-primary`, `data-surface`, `.dark` on an inner element) so the list inherits it.
   */
  container?: BaseSelect.Portal.Props["container"];
}

/**
 * The dropdown list (`role="listbox"`): portalled, below the trigger and at least as wide, on the
 * popover surface, scrolling when taller than the viewport. The arrow keys move the highlight,
 * typing jumps to a matching item, Enter selects, Escape closes; focus returns to the trigger.
 */
export function SelectContent({
  side = "bottom",
  align = "start",
  sideOffset = 6,
  alignOffset,
  collisionPadding,
  alignItemWithTrigger = false,
  container,
  className,
  children,
  ...props
}: SelectContentProps) {
  return (
    <BaseSelect.Portal container={container}>
      <BaseSelect.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        alignItemWithTrigger={alignItemWithTrigger}
        className="z-(--z-overlay)"
      >
        <BaseSelect.Popup
          {...props}
          data-slot="select-content"
          className={mergeClassName(cn(popupMotion, popupSurface, selectContentBase), className)}
        >
          <BaseSelect.List data-slot="select-list">{children}</BaseSelect.List>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

export type SelectItemProps = BaseSelect.Item.Props;

/**
 * One option (`role="option"`, `aria-selected`) with a check mark in the leading slot while
 * selected. A `disabled` item stays reachable by the arrow keys but cannot be chosen. Set `label`
 * for typeahead when the children are not plain text.
 */
export function SelectItem({ className, children, ...props }: SelectItemProps) {
  return (
    <BaseSelect.Item
      {...props}
      data-slot="select-item"
      className={mergeClassName(cn(menuItemBase, selectItemBase), className)}
    >
      <BaseSelect.ItemIndicator
        data-slot="select-item-indicator"
        className={selectItemIndicatorBase}
      >
        <CheckIcon />
      </BaseSelect.ItemIndicator>
      <BaseSelect.ItemText data-slot="select-item-text">{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  );
}

export type SelectGroupProps = BaseSelect.Group.Props;

/** Groups related items (`role="group"`); name it with a `SelectGroupLabel`. */
export function SelectGroup(props: SelectGroupProps) {
  return <BaseSelect.Group {...props} data-slot="select-group" />;
}

export type SelectGroupLabelProps = BaseSelect.GroupLabel.Props;

/** A small muted heading that labels its `SelectGroup` (via `aria-labelledby`). */
export function SelectGroupLabel({ className, ...props }: SelectGroupLabelProps) {
  return (
    <BaseSelect.GroupLabel
      {...props}
      data-slot="select-group-label"
      className={mergeClassName(selectGroupLabelBase, className)}
    />
  );
}

export type SelectSeparatorProps = BaseSelect.Separator.Props;

/**
 * A hairline between groups of items. Base UI renders it `role="presentation"`: a listbox may
 * only own options and groups.
 */
export function SelectSeparator({ className, ...props }: SelectSeparatorProps) {
  return (
    <BaseSelect.Separator
      {...props}
      data-slot="select-separator"
      className={mergeClassName(selectSeparatorBase, className)}
    />
  );
}
