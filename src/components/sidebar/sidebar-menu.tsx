"use client";

import { type ComponentProps, type ReactElement, useContext } from "react";
import { cloneRender } from "../../lib/clone-render";
import { cn } from "../../lib/cn";
import { Skeleton } from "../skeleton";
import { Tooltip, TooltipContent, type TooltipContentProps, TooltipTrigger } from "../tooltip";
import { SidebarInstanceContext, useSidebar } from "./sidebar-context";
import {
  type SidebarMenuButtonVariantProps,
  sidebarMenuActionClasses,
  sidebarMenuBadgeClasses,
  sidebarMenuButtonDefaults,
  sidebarMenuButtonVariants,
  sidebarMenuClasses,
  sidebarMenuItemClasses,
  sidebarMenuSkeletonClasses,
  sidebarMenuSubButtonClasses,
  sidebarMenuSubClasses,
  sidebarMenuSubItemClasses,
} from "./sidebar-variants";

type RenderElement = ReactElement<{ className?: string } & Record<string, unknown>>;

export type SidebarMenuProps = ComponentProps<"ul">;

/** A list of menu items (`<ul>`). */
export function SidebarMenu({ className, ...props }: SidebarMenuProps) {
  return <ul {...props} data-slot="sidebar-menu" className={cn(sidebarMenuClasses, className)} />;
}

export type SidebarMenuItemProps = ComponentProps<"li">;

/** One entry (`<li>`): a `SidebarMenuButton`, plus an optional action, badge or sub list. */
export function SidebarMenuItem({ className, ...props }: SidebarMenuItemProps) {
  return (
    <li
      {...props}
      data-slot="sidebar-menu-item"
      className={cn(sidebarMenuItemClasses, className)}
    />
  );
}

export interface SidebarMenuButtonProps
  extends ComponentProps<"button">,
    SidebarMenuButtonVariantProps {
  /**
   * Render a link instead of the `<button>`: `render={<a href="/orders" />}` or a router link.
   * Its own props win over the button's.
   */
  render?: RenderElement;
  /**
   * The current page (or the selected item): `data-active` and the accent fill. A `render`ed
   * element (a link) also gets `aria-current="page"`.
   */
  isActive?: boolean;
  /**
   * The label shown in a Tooltip (to the side, away from the sidebar's edge) while the sidebar is
   * collapsed to icons. A string, or TooltipContent props (`{ children, … }`).
   */
  tooltip?: string | TooltipContentProps;
}

/**
 * A menu row: an icon and a label (wrap the label in a `<span>`, so icon mode can hide it visually
 * while it keeps naming the button). A `<button>` by default; `render` makes it a link.
 */
export function SidebarMenuButton({
  render,
  isActive = false,
  size = sidebarMenuButtonDefaults.size,
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const { state, isMobile } = useSidebar();
  const { side } = useContext(SidebarInstanceContext);
  const classes = cn(sidebarMenuButtonVariants({ size }), className);
  const shared = {
    ...props,
    "data-active": isActive ? "" : undefined,
    "data-size": size ?? undefined,
  };
  const element = render ? (
    cloneRender(
      render,
      { ...shared, "aria-current": isActive ? "page" : undefined },
      {
        slot: "sidebar-menu-button",
        className: classes,
      },
    )
  ) : (
    <button type="button" {...shared} data-slot="sidebar-menu-button" className={classes} />
  );
  if (!tooltip) return element;

  const content = typeof tooltip === "string" ? { children: tooltip } : tooltip;
  // Always wrapped, and disabled unless collapsed to icons, so toggling never remounts the button
  // (it keeps focus through Ctrl+B).
  return (
    <Tooltip disabled={state !== "collapsed" || isMobile}>
      <TooltipTrigger render={element} />
      <TooltipContent side={side === "right" ? "left" : "right"} align="center" {...content} />
    </Tooltip>
  );
}

export interface SidebarMenuActionProps extends ComponentProps<"button"> {
  /** Render another element, e.g. `<MenuTrigger />`. */
  render?: RenderElement;
}

/**
 * A small icon button at the end of a menu item (give it an `aria-label`), e.g. a "More" menu
 * trigger. Hidden while collapsed to icons.
 */
export function SidebarMenuAction({ className, render, ...props }: SidebarMenuActionProps) {
  const classes = cn(sidebarMenuActionClasses, className);
  if (render)
    return cloneRender(render, props, { slot: "sidebar-menu-action", className: classes });
  return <button type="button" {...props} data-slot="sidebar-menu-action" className={classes} />;
}

export type SidebarMenuBadgeProps = ComponentProps<"div">;

/** A count or status at the end of a menu item. Hidden while collapsed to icons. */
export function SidebarMenuBadge({ className, ...props }: SidebarMenuBadgeProps) {
  return (
    <div
      {...props}
      data-slot="sidebar-menu-badge"
      className={cn(sidebarMenuBadgeClasses, className)}
    />
  );
}

export type SidebarMenuSubProps = ComponentProps<"ul">;

/** A nested list under a menu item, with an indent guide. Hidden while collapsed to icons. */
export function SidebarMenuSub({ className, ...props }: SidebarMenuSubProps) {
  return (
    <ul {...props} data-slot="sidebar-menu-sub" className={cn(sidebarMenuSubClasses, className)} />
  );
}

export type SidebarMenuSubItemProps = ComponentProps<"li">;

/** One entry (`<li>`) of a `SidebarMenuSub`. */
export function SidebarMenuSubItem({ className, ...props }: SidebarMenuSubItemProps) {
  return (
    <li
      {...props}
      data-slot="sidebar-menu-sub-item"
      className={cn(sidebarMenuSubItemClasses, className)}
    />
  );
}

export interface SidebarMenuSubButtonProps extends ComponentProps<"a"> {
  /** Render a router link instead of the `<a>`. Its own props win. */
  render?: RenderElement;
  /** The current page: `aria-current="page"`, `data-active` and the accent fill. */
  isActive?: boolean;
}

/** A link in a sub list (`<a>`; pass `href`, or `render` a router link). */
export function SidebarMenuSubButton({
  render,
  isActive = false,
  className,
  ...props
}: SidebarMenuSubButtonProps) {
  const classes = cn(sidebarMenuSubButtonClasses, className);
  const shared = {
    ...props,
    "aria-current": isActive ? ("page" as const) : undefined,
    "data-active": isActive ? "" : undefined,
  };
  if (render) {
    return cloneRender(render, shared, { slot: "sidebar-menu-sub-button", className: classes });
  }
  return <a {...shared} data-slot="sidebar-menu-sub-button" className={classes} />;
}

export interface SidebarMenuSkeletonProps extends ComponentProps<"div"> {
  /** Show an icon placeholder before the text line. @default false */
  showIcon?: boolean;
}

/** A loading placeholder the shape of a menu row, hidden from assistive technology. */
export function SidebarMenuSkeleton({
  showIcon = false,
  className,
  ...props
}: SidebarMenuSkeletonProps) {
  return (
    <div
      {...props}
      aria-hidden="true"
      data-slot="sidebar-menu-skeleton"
      className={cn(sidebarMenuSkeletonClasses, className)}
    >
      {showIcon && <Skeleton className="size-4 rounded-md" />}
      <Skeleton className="h-4 max-w-(--skeleton-width) flex-1 [--skeleton-width:70%]" />
    </div>
  );
}
