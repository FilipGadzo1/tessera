"use client";

import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import { toggleFocusClasses } from "../../lib/focus-classes";
import { mergeClassName } from "../../lib/merge-class-name";
import { type ButtonVariantProps, buttonVariants } from "../button/button-variants";
import { inputVariants } from "../input/input-variants";

export interface ToolbarProps extends BaseToolbar.Root.Props {}

/**
 * A container grouping buttons, toggle groups, links and menus (Base UI `Toolbar.Root`) with a
 * single roving Tab stop. Needs an accessible name (`aria-label`).
 */
export function Toolbar({ className, ...props }: ToolbarProps) {
  return (
    <BaseToolbar.Root
      {...props}
      data-slot="toolbar"
      className={mergeClassName(
        "flex items-center gap-1 rounded-lg border border-border bg-background p-1 data-[orientation=vertical]:flex-col",
        className,
      )}
    />
  );
}

export interface ToolbarGroupProps extends BaseToolbar.Group.Props {}

/** Groups related toolbar items (e.g. a set of `ToolbarButton`s) without its own Tab stop. */
export function ToolbarGroup({ className, ...props }: ToolbarGroupProps) {
  return (
    <BaseToolbar.Group
      {...props}
      data-slot="toolbar-group"
      className={mergeClassName("flex items-center gap-1", className)}
    />
  );
}

export interface ToolbarButtonProps extends BaseToolbar.Button.Props {
  /** @default "ghost" */
  variant?: ButtonVariantProps["variant"];
  /** @default "neutral" */
  color?: ButtonVariantProps["color"];
  /** @default "sm" */
  size?: ButtonVariantProps["size"];
}

/**
 * A toolbar item styled like a ghost, neutral, sm Button (Base UI `Toolbar.Button`). Compose it
 * with a popup trigger through `render` — *Amended in Task 2*: verified against
 * `node_modules/@base-ui/react/docs/react/components/toolbar.md` ("Using with Menu"), the
 * documented order is `<ToolbarButton render={<MenuTrigger />}>` / `<PopoverTrigger />` (the
 * `ToolbarButton` is outer and contributes the composite/roving-focus item metadata; the trigger
 * supplies the open behaviour). A `Toggle` composes the other way, as a `ToggleGroupItem` value —
 * see `ToggleGroup`'s doc comment.
 */
export function ToolbarButton({
  variant = "ghost",
  color = "neutral",
  size = "sm",
  className,
  ...props
}: ToolbarButtonProps) {
  return (
    <BaseToolbar.Button
      {...props}
      data-slot="toolbar-button"
      className={mergeClassName(buttonVariants({ variant, color, size }), className)}
    />
  );
}

export interface ToolbarLinkProps extends BaseToolbar.Link.Props {}

/** A plain link toolbar item (Base UI `Toolbar.Link`, renders `<a>`). */
export function ToolbarLink({ className, ...props }: ToolbarLinkProps) {
  return (
    <BaseToolbar.Link
      {...props}
      data-slot="toolbar-link"
      className={mergeClassName(
        `inline-flex h-8 cursor-pointer items-center rounded-md px-2 text-sm text-muted-foreground not-data-disabled:hover:text-foreground ${toggleFocusClasses}`,
        className,
      )}
    />
  );
}

export interface ToolbarInputProps extends BaseToolbar.Input.Props {}

/** A native input integrated with the toolbar's keyboard navigation (Base UI `Toolbar.Input`). */
export function ToolbarInput({ className, ...props }: ToolbarInputProps) {
  return (
    <BaseToolbar.Input
      {...props}
      data-slot="toolbar-input"
      className={mergeClassName(inputVariants({ size: "sm" }), className)}
    />
  );
}

export interface ToolbarSeparatorProps extends BaseToolbar.Separator.Props {}

/**
 * A `role="separator"` divider (Base UI `Toolbar.Separator`). Its own orientation defaults to the
 * opposite of the toolbar's, so a horizontal toolbar renders a vertical bar and vice versa.
 */
export function ToolbarSeparator({ className, ...props }: ToolbarSeparatorProps) {
  return (
    <BaseToolbar.Separator
      {...props}
      data-slot="toolbar-separator"
      className={mergeClassName(
        "mx-1 h-5 w-px shrink-0 bg-border forced-colors:bg-[CanvasText] data-[orientation=horizontal]:mx-0 data-[orientation=horizontal]:my-1 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-5",
        className,
      )}
    />
  );
}
