"use client";

import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import { createContext, useContext, useMemo } from "react";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";
import { type ToggleVariantProps, toggleDefaults, toggleVariants } from "./toggle-variants";

export interface ToggleProps extends BaseToggle.Props {
  /** @default "ghost" */
  variant?: ToggleVariantProps["variant"];
  /** @default "md" */
  size?: ToggleVariantProps["size"];
}

/**
 * A two-state button (`aria-pressed`, Base UI `Toggle`). Standalone, or as a `ToggleGroup` item
 * (pass `value`) — Base UI detects the group automatically. Icon-only toggles need `aria-label`.
 */
export function Toggle({
  variant = toggleDefaults.variant,
  size = toggleDefaults.size,
  className,
  ...props
}: ToggleProps) {
  return (
    <BaseToggle
      {...props}
      data-slot="toggle"
      data-variant={variant}
      data-size={size}
      className={mergeClassName(toggleVariants({ variant, size }), className)}
    />
  );
}

interface ToggleGroupItemContextValue {
  variant: ToggleVariantProps["variant"];
  size: ToggleVariantProps["size"];
  orientation: "horizontal" | "vertical";
  /** The group is attached (`variant="outline"`): items lose their inner radii and overlap. */
  attached: boolean;
}

const ToggleGroupItemContext = createContext<ToggleGroupItemContextValue>({
  variant: toggleDefaults.variant,
  size: toggleDefaults.size,
  orientation: "horizontal",
  attached: false,
});

export interface ToggleGroupProps extends BaseToggleGroup.Props<string> {
  /** Default `variant` passed to every `ToggleGroupItem` (items can override). @default "ghost" */
  variant?: ToggleVariantProps["variant"];
  /** Default `size` passed to every `ToggleGroupItem` (items can override). @default "md" */
  size?: ToggleVariantProps["size"];
}

/**
 * Shares pressed state across `ToggleGroupItem`s (Base UI `ToggleGroup`; `value` is an array,
 * `multiple` default `false`). Nested inside a `Toolbar`, Base UI detects it and keeps a single
 * roving Tab stop for the whole toolbar (*Amended in Task 2*: verified against
 * `@base-ui/react/toggle-group/ToggleGroup.js` — it reads `useToolbarRootContext` and, when
 * present, renders a plain `<div role="group">` instead of its own `CompositeRoot`, deferring
 * roving focus to the Toolbar's composite list. `Toggle` does the same for `ToggleGroupContext`.
 * So the verified composition is a plain `<ToggleGroup>` nested directly in `<Toolbar>` — no
 * `Toolbar.Group render={<ToggleGroup />}` wrapper is needed or used).
 * With `variant="outline"` the group is attached (`gap-0`; see `ToggleGroupItem`).
 */
export function ToggleGroup({
  variant = toggleDefaults.variant,
  size = toggleDefaults.size,
  orientation = "horizontal",
  className,
  ...props
}: ToggleGroupProps) {
  const contextValue = useMemo<ToggleGroupItemContextValue>(
    () => ({ variant, size, orientation, attached: variant === "outline" }),
    [variant, size, orientation],
  );
  return (
    <ToggleGroupItemContext.Provider value={contextValue}>
      <BaseToggleGroup
        {...props}
        orientation={orientation}
        data-slot="toggle-group"
        className={mergeClassName(
          cn(
            "flex items-center gap-1 data-[orientation=vertical]:flex-col",
            variant === "outline" && "gap-0",
          ),
          className,
        )}
      />
    </ToggleGroupItemContext.Provider>
  );
}

export interface ToggleGroupItemProps extends Omit<ToggleProps, "value"> {
  /** The value Base UI reports in the group's `value` array. Required inside a `ToggleGroup`. */
  value: string;
}

const attachedClasses: Record<"horizontal" | "vertical", string> = {
  horizontal: "rounded-none first:rounded-s-md last:rounded-e-md -ms-px first:ms-0",
  vertical: "rounded-none first:rounded-t-md last:rounded-b-md -mt-px first:mt-0",
};

/**
 * A `Toggle` inside a `ToggleGroup`: takes the group's `variant` / `size` by default (either can
 * be overridden per item), and — when the group is attached (`variant="outline"`) — loses its
 * inner radii and overlaps its neighbour's border by 1px. `focus-visible:z-10` keeps the focused
 * item's ring above its neighbours.
 */
export function ToggleGroupItem({ variant, size, className, ...props }: ToggleGroupItemProps) {
  const group = useContext(ToggleGroupItemContext);
  return (
    <Toggle
      {...props}
      variant={variant ?? group.variant}
      size={size ?? group.size}
      className={mergeClassName(
        cn("focus-visible:z-10", group.attached && attachedClasses[group.orientation]),
        className,
      )}
    />
  );
}
