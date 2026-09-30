"use client";

import { useMediaQuery } from "@base-ui/react/unstable-use-media-query";
import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { isRtl } from "../../lib/direction";
import { useControllableState } from "../../lib/use-controllable-state";
import { useMergedRefs } from "../../lib/use-merged-refs";
import { sidebarWrapperClasses } from "./sidebar-variants";

/**
 * The sidebar's edge in a left-to-right layout. It follows the writing direction, as the column
 * does (an in-flow flex item): `left` is the inline start, so under `dir="rtl"` it is the right.
 */
export type SidebarSide = "left" | "right";

/** The physical edge `side` renders on: flipped when the resolved direction is right-to-left. */
export function physicalSide(side: SidebarSide, rtl: boolean): SidebarSide {
  if (!rtl) return side;
  return side === "left" ? "right" : "left";
}

/**
 * @internal The enclosing Sidebar's `side`, the physical `edge` it renders on (menu tooltips open
 * away from it), `collapsible` (the rail renders nothing when it is `"none"`) and the element the
 * rail renders into: a zero-width sibling on the column's edge, outside the clipped (and,
 * collapsed off-canvas, inert) `aside`.
 */
export const SidebarInstanceContext = createContext<{
  side: SidebarSide;
  edge: SidebarSide;
  collapsible: "offcanvas" | "icon" | "none";
  railHost: HTMLElement | null;
}>({ side: "left", edge: "left", collapsible: "offcanvas", railHost: null });

/** Tailwind's `md` breakpoint: the desktop sidebar from here up, the mobile Drawer below it. */
const DESKTOP_QUERY = "(min-width: 48rem)";

export interface SidebarContextValue {
  /**
   * `"expanded"` while `open`, otherwise `"collapsed"` (desktop). When the only Sidebar mounted is
   * `collapsible="none"` it is always `"expanded"`. With a mix of static and collapsible
   * Sidebars, `open` decides (it drives the collapsible ones; the static ones ignore it).
   */
  state: "expanded" | "collapsed";
  /** The desktop sidebar's open state. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Whether the mobile Drawer is open. */
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  /** Below `md` (48rem) the sidebar renders as a Drawer. */
  isMobile: boolean;
  /** Toggles the Drawer on mobile, the desktop sidebar otherwise. */
  toggleSidebar: () => void;
}

interface SidebarInternalValue {
  /** The id the trigger's `aria-controls` points at: the aside, or the open mobile Drawer. */
  sidebarId: string;
  setSidebarId: (id: string | undefined) => void;
  /**
   * Every mounted Sidebar is `collapsible="none"` (and there is at least one): there is nothing to
   * toggle. With any collapsible Sidebar mounted it is `false`.
   */
  isStatic: boolean;
  /** A Sidebar registers itself while mounted (`fixed`: it is `collapsible="none"`); returns the unregister. */
  registerSidebar: (fixed: boolean) => () => void;
  /**
   * The provider row's resolved writing direction is right-to-left (read from the computed style,
   * as Calendar does, so a `dir` on any ancestor counts).
   */
  rtl: boolean;
}

const SidebarContext = createContext<(SidebarContextValue & SidebarInternalValue) | null>(null);

function useSidebarContext() {
  const context = useContext(SidebarContext);
  if (!context)
    throw new Error("Sidebar parts and useSidebar() must be used within a SidebarProvider.");
  return context;
}

/**
 * The sidebar's state and actions: `{ state, open, setOpen, openMobile, setOpenMobile, isMobile,
 * toggleSidebar }`. Throws outside a `SidebarProvider`.
 */
export function useSidebar(): SidebarContextValue {
  const {
    sidebarId: _id,
    setSidebarId: _setId,
    isStatic: _isStatic,
    registerSidebar: _registerSidebar,
    rtl: _rtl,
    ...value
  } = useSidebarContext();
  return value;
}

/** @internal The trigger's `aria-controls` target and the Sidebar's id registration. */
export function useSidebarInternal() {
  return useSidebarContext();
}

export interface SidebarProviderProps extends ComponentProps<"div"> {
  /** The desktop sidebar's open state (controlled). */
  open?: boolean;
  /** The initial desktop open state (uncontrolled). @default true */
  defaultOpen?: boolean;
  /**
   * Called when the desktop open state changes (trigger, rail, shortcut, `setOpen`). Persist it
   * here (localStorage, a cookie) and pass it back as `defaultOpen` or `open` on the next load.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Ctrl+B / ⌘+B toggles the sidebar. The shortcut is ignored while typing in an input, a
   * textarea, a select or a contenteditable element (e.g. DateField's segments). It listens on
   * `window`, so keep it on for only one provider per page. @default true
   */
  shortcut?: boolean;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Holds the sidebar state and renders the app shell's row (`flex min-h-svh w-full`) with the
 * `--sidebar-width` (16rem) and `--sidebar-width-icon` (3rem) variables; override them with
 * `style`. Wrap a `Sidebar` and a `SidebarInset` in it.
 *
 * The first render assumes desktop (server-safe); below `md` the client switches to the mobile
 * Drawer right after mounting.
 */
export function SidebarProvider({
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  shortcut = true,
  className,
  style,
  children,
  ref,
  ...props
}: SidebarProviderProps) {
  const isMobile = !useMediaQuery(DESKTOP_QUERY, { defaultMatches: true });
  const [openMobile, setOpenMobile] = useState(false);
  const [open, setOpenState] = useControllableState(openProp, defaultOpen, onOpenChange);
  const generatedId = useId();
  const [customId, setSidebarId] = useState<string | undefined>(undefined);
  const sidebarId = customId ?? generatedId;
  // The mounted Sidebars, counted: a static one must not hide a collapsible one, or the reverse.
  const [sidebars, setSidebars] = useState({ total: 0, fixed: 0 });
  const isStatic = sidebars.total > 0 && sidebars.fixed === sidebars.total;
  const registerSidebar = useCallback((fixed: boolean) => {
    const step = fixed ? 1 : 0;
    setSidebars((current) => ({ total: current.total + 1, fixed: current.fixed + step }));
    return () =>
      setSidebars((current) => ({ total: current.total - 1, fixed: current.fixed - step }));
  }, []);

  // The resolved direction, re-read after every render (it only re-renders on a change). The
  // desktop column and rail follow it through CSS alone; the mobile Drawer (portalled out of the
  // row) and the menu tooltips need the physical edge.
  const [rtl, setRtl] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const element = wrapperRef.current;
    if (element) setRtl(isRtl(element));
  });
  const setWrapperRef = useMergedRefs(wrapperRef, ref);

  const setOpen = useCallback(
    (next: boolean) => {
      if (next !== open) setOpenState(next);
    },
    [open, setOpenState],
  );

  const toggleSidebar = useCallback(() => {
    // A static sidebar never collapses and never becomes a Drawer.
    if (isStatic) return;
    if (isMobile) setOpenMobile((current) => !current);
    else setOpen(!open);
  }, [isStatic, isMobile, open, setOpen]);

  // Leaving the mobile layout drops the Drawer; do not reopen it on the way back.
  useEffect(() => {
    if (!isMobile) setOpenMobile(false);
  }, [isMobile]);

  useEffect(() => {
    if (!shortcut) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b" || !(event.ctrlKey || event.metaKey)) return;
      if (event.altKey || event.shiftKey || event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      toggleSidebar();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcut, toggleSidebar]);

  const value = useMemo(
    () => ({
      // A lone `collapsible="none"` Sidebar is always expanded, whatever `open` says. With any
      // collapsible Sidebar mounted (or none at all) the provider's `open` decides.
      state: open || isStatic ? ("expanded" as const) : ("collapsed" as const),
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
      sidebarId,
      setSidebarId,
      isStatic,
      registerSidebar,
      rtl,
    }),
    [open, setOpen, openMobile, isMobile, toggleSidebar, sidebarId, isStatic, registerSidebar, rtl],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        {...props}
        ref={setWrapperRef}
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": "16rem",
            "--sidebar-width-icon": "3rem",
            ...style,
          } as CSSProperties
        }
        className={cn(sidebarWrapperClasses, className)}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}
