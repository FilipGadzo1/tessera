"use client";

import {
  type ComponentProps,
  type MouseEvent,
  type ReactElement,
  type Ref,
  useContext,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cloneRender } from "../../lib/clone-render";
import { cn } from "../../lib/cn";
import { PanelLeftIcon } from "../../lib/icons";
import { buttonVariants } from "../button/button-variants";
import { Drawer, DrawerContent } from "../drawer";
import {
  physicalSide,
  SidebarInstanceContext,
  type SidebarSide,
  useSidebarInternal,
} from "./sidebar-context";
import {
  sidebarColumnVariants,
  sidebarContainerVariants,
  sidebarContentClasses,
  sidebarDefaults,
  sidebarFooterClasses,
  sidebarGroupActionClasses,
  sidebarGroupClasses,
  sidebarGroupContentClasses,
  sidebarGroupLabelClasses,
  sidebarHeaderClasses,
  sidebarInnerVariants,
  sidebarInsetClasses,
  sidebarMobileClasses,
  sidebarRailClasses,
  sidebarRailHostClasses,
  sidebarSeparatorClasses,
  sidebarStaticClasses,
  sidebarTriggerClasses,
} from "./sidebar-variants";

export type { SidebarSide };
export type SidebarVariant = "sidebar" | "floating" | "inset";
export type SidebarCollapsible = "offcanvas" | "icon" | "none";

export interface SidebarProps extends ComponentProps<"aside"> {
  /**
   * The edge the sidebar sits on in a left-to-right layout; the mobile Drawer slides in from it.
   * It follows the writing direction: under `dir="rtl"`, `left` (the inline start) renders on the
   * right, with its rail, off-canvas slide and Drawer mirrored. @default "left"
   */
  side?: SidebarSide;
  /**
   * `sidebar`: a bordered column. `floating`: a card inset from the edges. `inset`: transparent
   * on the shell's backdrop, with the `SidebarInset` drawn as a card beside it. @default "sidebar"
   */
  variant?: SidebarVariant;
  /**
   * How it collapses on desktop: `offcanvas` slides fully out (and is `inert`), `icon` shrinks to
   * `--sidebar-width-icon` showing only icons (menu buttons show their `tooltip`), `none` never
   * collapses and never becomes a Drawer. @default "offcanvas"
   */
  collapsible?: SidebarCollapsible;
}

/**
 * The app shell's navigation column. On desktop (≥ `md`) it renders an `<aside>` landmark named
 * "Sidebar" (override with `aria-label`); put a `<nav>` inside for the links. Below `md` the same
 * children render in a Tessera `Drawer` from `side`, a modal dialog with the same name, opened by
 * `SidebarTrigger` or the shortcut.
 */
export function Sidebar({
  side = sidebarDefaults.side,
  variant = sidebarDefaults.variant,
  collapsible = sidebarDefaults.collapsible,
  id,
  className,
  children,
  "aria-label": ariaLabel = "Sidebar",
  ref,
  ...props
}: SidebarProps) {
  const { state, isMobile, openMobile, setOpenMobile, sidebarId, setSidebarId, setStatic, rtl } =
    useSidebarInternal();
  const [railHost, setRailHost] = useState<HTMLDivElement | null>(null);
  const edge = physicalSide(side, rtl);

  useEffect(() => {
    setSidebarId(id);
    return () => setSidebarId(undefined);
  }, [id, setSidebarId]);

  useEffect(() => {
    setStatic(collapsible === "none");
    return () => setStatic(false);
  }, [collapsible, setStatic]);

  const content = (
    <SidebarInstanceContext.Provider value={{ side, edge, collapsible, railHost }}>
      {children}
    </SidebarInstanceContext.Provider>
  );

  if (collapsible === "none") {
    return (
      <aside
        {...props}
        ref={ref}
        id={sidebarId}
        aria-label={ariaLabel}
        data-slot="sidebar"
        // Never collapses, whatever the provider's `open`.
        data-state="expanded"
        data-variant={variant}
        data-side={side}
        className={cn(sidebarStaticClasses, className)}
      >
        {content}
      </aside>
    );
  }

  if (isMobile) {
    return (
      // The Drawer's `side` is physical: the edge the column would render on.
      <Drawer side={edge} open={openMobile} onOpenChange={setOpenMobile}>
        <DrawerContent id={sidebarId} aria-label={ariaLabel} className={sidebarMobileClasses}>
          <div
            {...props}
            // The ref reaches the drawer's wrapper `div` (an HTMLElement, like the aside).
            ref={ref as Ref<HTMLDivElement> | undefined}
            data-slot="sidebar"
            data-mobile="true"
            data-state="expanded"
            data-side={side}
            className={cn("group/sidebar flex h-full flex-col text-foreground", className)}
          >
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  const collapsed = state === "collapsed";
  // The rail's host: a zero-width, non-inert flex item on the column's inner edge (after a left
  // column, before a right one, which is `order-last` like the column), so the rail neither
  // covers the panel's content nor goes inert with a collapsed off-canvas column. `data-edge` is
  // the physical edge, for the rail's resize cursors.
  const railHostElement = (
    <div
      ref={setRailHost}
      data-slot="sidebar-rail-host"
      data-side={side}
      data-edge={edge}
      data-state={state}
      className={sidebarRailHostClasses}
    />
  );
  return (
    <>
      {side === "right" && railHostElement}
      <aside
        {...props}
        ref={ref}
        id={sidebarId}
        aria-label={ariaLabel}
        inert={collapsed && collapsible === "offcanvas"}
        data-slot="sidebar"
        data-state={state}
        data-collapsible={collapsed ? collapsible : undefined}
        data-variant={variant}
        data-side={side}
        className={cn(sidebarColumnVariants({ variant }), className)}
      >
        <div data-slot="sidebar-container" className={sidebarContainerVariants({ variant })}>
          <div data-slot="sidebar-inner" className={sidebarInnerVariants({ variant })}>
            {content}
          </div>
        </div>
      </aside>
      {side === "left" && railHostElement}
    </>
  );
}

export type SidebarTriggerProps = ComponentProps<"button">;

/**
 * A ghost icon button (`icon-sm`) with a panel icon that toggles the sidebar (the Drawer on
 * mobile). Named "Toggle sidebar" (override with `aria-label`), with `aria-expanded` and
 * `aria-controls` pointing at the sidebar. Children replace the icon. With a
 * `collapsible="none"` Sidebar it does nothing (and stays `aria-expanded`); leave it out there.
 */
export function SidebarTrigger({
  className,
  onClick,
  children,
  "aria-label": ariaLabel = "Toggle sidebar",
  ...props
}: SidebarTriggerProps) {
  const { open, openMobile, isMobile, toggleSidebar, sidebarId, isStatic } = useSidebarInternal();
  const expanded = isStatic || (isMobile ? openMobile : open);
  return (
    <button
      type="button"
      {...props}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      // The mobile Drawer only exists while open; never point at a missing element.
      aria-controls={isStatic || !isMobile || openMobile ? sidebarId : undefined}
      data-slot="sidebar-trigger"
      className={buttonVariants({
        variant: "ghost",
        color: "neutral",
        size: "icon-sm",
        className: cn(sidebarTriggerClasses, className),
      })}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) toggleSidebar();
      }}
    >
      {children ?? <PanelLeftIcon />}
    </button>
  );
}

export type SidebarRailProps = ComponentProps<"button">;

/**
 * A thin hit area just outside the sidebar's inner edge that toggles it on click; a line shows on
 * hover. Place it anywhere inside `Sidebar`: it renders into a sibling of the column, so it never
 * covers the sidebar's buttons or scrollbar, and it still reopens a collapsed off-canvas sidebar.
 * Pointer-only: `aria-hidden` and out of the Tab order (the trigger and shortcut cover the
 * keyboard). Renders nothing in the mobile Drawer or with `collapsible="none"`.
 */
export function SidebarRail({ className, onClick, ...props }: SidebarRailProps) {
  const { toggleSidebar, isMobile } = useSidebarInternal();
  const { collapsible, railHost } = useContext(SidebarInstanceContext);
  // Nothing to toggle in a static sidebar or in the mobile Drawer.
  if (isMobile || collapsible === "none" || !railHost) return null;
  return createPortal(
    <button
      type="button"
      {...props}
      aria-hidden="true"
      tabIndex={-1}
      data-slot="sidebar-rail"
      className={cn(sidebarRailClasses, className)}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) toggleSidebar();
      }}
    />,
    railHost,
  );
}

export type SidebarInsetProps = ComponentProps<"main">;

/** The page beside the sidebar (`<main>`). Next to an `inset` sidebar it becomes a rounded card. */
export function SidebarInset({ className, ...props }: SidebarInsetProps) {
  return (
    <main {...props} data-slot="sidebar-inset" className={cn(sidebarInsetClasses, className)} />
  );
}

export type SidebarHeaderProps = ComponentProps<"div">;

/** The top of the sidebar (a workspace switcher, a logo). */
export function SidebarHeader({ className, ...props }: SidebarHeaderProps) {
  return (
    <div {...props} data-slot="sidebar-header" className={cn(sidebarHeaderClasses, className)} />
  );
}

export type SidebarFooterProps = ComponentProps<"div">;

/** The bottom of the sidebar (the user menu). */
export function SidebarFooter({ className, ...props }: SidebarFooterProps) {
  return (
    <div {...props} data-slot="sidebar-footer" className={cn(sidebarFooterClasses, className)} />
  );
}

export type SidebarContentProps = ComponentProps<"div">;

/** The scrolling middle of the sidebar, between the header and the footer. */
export function SidebarContent({ className, ...props }: SidebarContentProps) {
  return (
    <div {...props} data-slot="sidebar-content" className={cn(sidebarContentClasses, className)} />
  );
}

export type SidebarSeparatorProps = ComponentProps<"div">;

/** A decorative rule between sidebar sections (hidden from assistive technology). */
export function SidebarSeparator({ className, ...props }: SidebarSeparatorProps) {
  return (
    <div
      {...props}
      role="none"
      data-slot="sidebar-separator"
      className={cn(sidebarSeparatorClasses, className)}
    />
  );
}

export type SidebarGroupProps = ComponentProps<"div">;

/** A section of the sidebar: a label, an optional action and its content. */
export function SidebarGroup({ className, ...props }: SidebarGroupProps) {
  return (
    <div {...props} data-slot="sidebar-group" className={cn(sidebarGroupClasses, className)} />
  );
}

type RenderElement = ReactElement<{ className?: string } & Record<string, unknown>>;

export interface SidebarGroupLabelProps extends ComponentProps<"div"> {
  /** Render another element, e.g. `<CollapsibleTrigger />` for a collapsible group. */
  render?: RenderElement;
}

/** The group's heading text, muted. Hidden while collapsed to icons. */
export function SidebarGroupLabel({ className, render, ...props }: SidebarGroupLabelProps) {
  const classes = cn(sidebarGroupLabelClasses, className);
  if (render)
    return cloneRender(render, props, { slot: "sidebar-group-label", className: classes });
  return <div {...props} data-slot="sidebar-group-label" className={classes} />;
}

export interface SidebarGroupActionProps extends ComponentProps<"button"> {
  /** Render another element, e.g. `<MenuTrigger />`. */
  render?: RenderElement;
}

/** A small icon button at the group label's end (give it an `aria-label`). Hidden in icon mode. */
export function SidebarGroupAction({ className, render, ...props }: SidebarGroupActionProps) {
  const classes = cn(sidebarGroupActionClasses, className);
  if (render)
    return cloneRender(render, props, { slot: "sidebar-group-action", className: classes });
  return <button type="button" {...props} data-slot="sidebar-group-action" className={classes} />;
}

export type SidebarGroupContentProps = ComponentProps<"div">;

/** The group's body, usually a `SidebarMenu`. */
export function SidebarGroupContent({ className, ...props }: SidebarGroupContentProps) {
  return (
    <div
      {...props}
      data-slot="sidebar-group-content"
      className={cn(sidebarGroupContentClasses, className)}
    />
  );
}
