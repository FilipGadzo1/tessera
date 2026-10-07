"use client";

import {
  Children,
  type ComponentProps,
  cloneElement,
  createContext,
  Fragment,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { toggleFocusClasses } from "../../lib/focus-classes";
import { GripVerticalIcon } from "../../lib/icons";
import { useElementDirection } from "../../lib/use-element-direction";
import { useMergedRefs } from "../../lib/use-merged-refs";

export type ResizableOrientation = "horizontal" | "vertical";

/* ------------------------------------------------------------------------------------------------
 * Layout maths (spec §5). Sizes are percentages of the group's panel space and sum to 100.
 * ----------------------------------------------------------------------------------------------*/

const EPSILON = 1e-6;

interface PanelConstraints {
  minSize: number;
  maxSize: number;
  collapsible: boolean;
  collapsedSize: number;
}

interface PanelEntry extends PanelConstraints {
  /** The panel's DOM id; `""` for a guessed panel with no `id` prop (its `useId` is not known yet). */
  id: string;
  defaultSize: number | undefined;
  /** `null` for a panel guessed from the children (server HTML, first render). */
  element: HTMLElement | null;
}

type Range = readonly [number, number];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

const sameLayout = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, index) => Math.abs(value - (b[index] ?? 0)) < EPSILON);

const hasGap = (panel: PanelConstraints) =>
  panel.collapsible && panel.collapsedSize < panel.minSize - EPSILON;

const isCollapsed = (size: number | undefined, panel: PanelConstraints) =>
  panel.collapsible && size !== undefined && Math.abs(size - panel.collapsedSize) < EPSILON;

/** A panel's allowed sizes: `[min, max]`, plus the point `{collapsedSize}` when collapsible. */
function allowedSizes(panel: PanelConstraints): Range[] {
  const range: Range = [panel.minSize, panel.maxSize];
  return hasGap(panel) ? [[panel.collapsedSize, panel.collapsedSize], range] : [range];
}

/**
 * The sizes the preceding panel can rest at when the pair shares `total`: its own allowed sizes
 * intersected with `total −` the following panel's. Sorted, disjoint closed ranges (a point is a
 * range of one). Its first start is `lo`, its last end `hi`, so a bound never lands in either
 * panel's gap (spec §5, the critic's collapse-consistency finding).
 */
function restingSizes(total: number, before: PanelConstraints, after: PanelConstraints): Range[] {
  const ranges: Range[] = [];
  for (const [beforeMin, beforeMax] of allowedSizes(before)) {
    for (const [afterMin, afterMax] of allowedSizes(after)) {
      const lo = Math.max(beforeMin, total - afterMax, 0);
      const hi = Math.min(beforeMax, total - afterMin, total);
      if (lo <= hi + EPSILON) ranges.push([lo, Math.max(lo, hi)]);
    }
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

/** The largest resting size at or below `target` (keys shrinking the preceding panel). */
function snapDown(target: number, ranges: readonly Range[]): number {
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const [start, end] = ranges[index] as Range;
    if (start <= target + EPSILON) return Math.min(target, end);
  }
  return ranges[0]?.[0] ?? target;
}

/** The smallest resting size at or above `target` (keys growing the preceding panel). */
function snapUp(target: number, ranges: readonly Range[]): number {
  for (const [start, end] of ranges) {
    if (end >= target - EPSILON) return Math.max(target, start);
  }
  return ranges.at(-1)?.[1] ?? target;
}

/** The resting size nearest `target`: a drag snaps across a gap at its midpoint. */
function snapNearest(target: number, ranges: readonly Range[]): number {
  let best = target;
  let distance = Number.POSITIVE_INFINITY;
  for (const [start, end] of ranges) {
    const candidate = clamp(target, start, end);
    if (Math.abs(candidate - target) < distance) {
      best = candidate;
      distance = Math.abs(candidate - target);
    }
  }
  return best;
}

/** A lone size moved into its panel's allowed sizes (a gap snaps at its midpoint). */
function restingSize(size: number, panel: PanelConstraints): number {
  return snapNearest(Number.isFinite(size) ? size : 0, allowedSizes(panel));
}

/**
 * Clamps each size to its panel's allowed sizes, then normalises the total to 100: the difference
 * is shared among the panels that can still move, in proportion to their sizes (equally when they
 * are all 0), within their limits; collapsed panels stay collapsed. If the limits cannot sum to
 * 100, the last panel takes the rest.
 */
function fitLayout(sizes: readonly number[], panels: readonly PanelConstraints[]): number[] {
  const next = panels.map((panel, index) => restingSize(sizes[index] ?? 0, panel));
  let difference = 100 - sum(next);
  for (let pass = 0; pass <= panels.length && Math.abs(difference) > EPSILON; pass += 1) {
    const room = panels.map((panel, index) => {
      const size = next[index] as number;
      if (hasGap(panel) && isCollapsed(size, panel)) return 0;
      return difference > 0 ? panel.maxSize - size : panel.minSize - size;
    });
    const movable = room.flatMap((value, index) => (Math.abs(value) > EPSILON ? [index] : []));
    if (movable.length === 0) break;
    const weight = sum(movable.map((index) => next[index] as number));
    for (const index of movable) {
      const share =
        weight > EPSILON
          ? (difference * (next[index] as number)) / weight
          : difference / movable.length;
      const limit = room[index] as number;
      next[index] =
        (next[index] as number) +
        (difference > 0 ? Math.min(share, limit) : Math.max(share, limit));
    }
    difference = 100 - sum(next);
  }
  if (Math.abs(difference) > EPSILON && next.length > 0) {
    next[next.length - 1] = (next.at(-1) as number) + difference;
  }
  return next;
}

const isValidLayout = (layout: readonly number[] | undefined, count: number) =>
  layout !== undefined &&
  layout.length === count &&
  layout.every((size) => Number.isFinite(size) && size >= 0) &&
  Math.abs(sum(layout) - 100) <= 0.1;

/**
 * The initial layout: a valid `defaultLayout` wins; otherwise each panel's `defaultSize`, the
 * remainder split equally among the panels without one; then clamped and normalised.
 */
function initialLayout(
  defaultLayout: readonly number[] | undefined,
  panels: readonly PanelEntry[],
) {
  if (isValidLayout(defaultLayout, panels.length)) {
    return fitLayout(defaultLayout as number[], panels);
  }
  const sized = panels.flatMap((panel) =>
    panel.defaultSize === undefined ? [] : [panel.defaultSize],
  );
  const unsized = panels.length - sized.length;
  const share = unsized > 0 ? Math.max(0, 100 - sum(sized)) / unsized : 0;
  return fitLayout(
    panels.map((panel) => panel.defaultSize ?? share),
    panels,
  );
}

/**
 * Fits `sizes` (for the panels `ids`, or by index when `ids` is `null`) to the current `panels`.
 * Kept panels keep their relative sizes, a new panel takes its `defaultSize` (else an equal share),
 * and the result is clamped and normalised.
 */
function reconcile(
  sizes: readonly number[],
  ids: readonly string[] | null,
  panels: readonly PanelEntry[],
): number[] {
  const count = panels.length;
  const sameIds =
    ids === null || (ids.length === count && ids.every((id, index) => id === panels[index]?.id));
  if (sizes.length === count && sameIds) return fitLayout(sizes, panels);
  const byId =
    ids && ids.length === sizes.length ? new Map(ids.map((id, i) => [id, sizes[i]])) : null;
  const kept = panels.map((panel, index) => (byId ? byId.get(panel.id) : sizes[index]));
  const fresh = panels.map((panel, index) =>
    kept[index] === undefined ? (panel.defaultSize ?? 100 / count) : 0,
  );
  const keptSizes = kept.filter((size): size is number => size !== undefined);
  const room = Math.max(0, 100 - sum(fresh));
  const keptTotal = sum(keptSizes);
  return fitLayout(
    panels.map((_, index) => {
      const size = kept[index];
      if (size === undefined) return fresh[index] as number;
      return keptTotal > 0 ? (size * room) / keptTotal : room / keptSizes.length;
    }),
    panels,
  );
}

/* ------------------------------------------------------------------------------------------------
 * Context and the render-time guess
 * ----------------------------------------------------------------------------------------------*/

interface GroupContextValue {
  orientation: ResizableOrientation;
  rtl: boolean;
  keyboardStep: number;
  /** The registered panels in DOM order (the guessed ones before mount). */
  panels: readonly PanelEntry[];
  layout: readonly number[];
  register: (entry: PanelEntry) => () => void;
  /** Sets a new layout; `committed` also reports `onLayoutCommitted`. `from` is the collapse reference. */
  setLayout: (next: number[], committed: boolean, from: readonly number[]) => void;
  /** Reports the latest layout through `onLayoutCommitted` (a drag's end). */
  commitLayout: () => void;
  /**
   * The layout last set, written synchronously by `setLayout`: a pointer move is rendered in a
   * later task, so a move and the up flushed together would otherwise read the layout before it.
   */
  latestLayout: RefObject<readonly number[]>;
  /** The size a collapsed panel had before it collapsed. */
  expandedSize: (id: string) => number | undefined;
  setDragging: (dragging: boolean) => void;
  /** The group element, measured on each drag move (its size can change mid-drag). */
  elementRef: RefObject<HTMLDivElement | null>;
}

const GroupContext = createContext<GroupContextValue | null>(null);

function useGroup(part: string) {
  const context = use(GroupContext);
  if (!context) throw new Error(`${part} must be rendered inside a ResizablePanelGroup.`);
  return context;
}

/** A panel's index guessed from the group's element children (server HTML, first render). */
const PanelGuessContext = createContext<number | null>(null);
/** A handle's preceding panel index guessed the same way. */
const HandleGuessContext = createContext<number | null>(null);

function guessedEntry(props: ResizablePanelProps): PanelEntry {
  return {
    id: props.id ?? "",
    defaultSize: props.defaultSize,
    minSize: props.minSize ?? 0,
    maxSize: props.maxSize ?? 100,
    collapsible: props.collapsible ?? false,
    collapsedSize: props.collapsedSize ?? 0,
    element: null,
  };
}

/**
 * Walks the group's element children (fragments flattened, as Carousel and Tree read theirs): each
 * `ResizablePanel` gets its guessed index and each `ResizableHandle` its preceding panel's index.
 * Wrapped panels are not seen here; the panels' registration replaces the guess after mount.
 */
function guessChildren(children: ReactNode, guessed: PanelEntry[]): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === Fragment) {
      const fragment = child as ReactElement<{ children?: ReactNode }>;
      return cloneElement(fragment, undefined, guessChildren(fragment.props.children, guessed));
    }
    if (child.type === ResizablePanel) {
      const index = guessed.length;
      guessed.push(guessedEntry(child.props as ResizablePanelProps));
      return <PanelGuessContext value={index}>{child}</PanelGuessContext>;
    }
    if (child.type === ResizableHandle) {
      return <HandleGuessContext value={guessed.length - 1}>{child}</HandleGuessContext>;
    }
    return child;
  });
}

function inDocumentOrder(entries: Iterable<PanelEntry>) {
  return Array.from(entries).sort((a, b) =>
    (a.element as HTMLElement).compareDocumentPosition(b.element as HTMLElement) &
    Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1,
  );
}

/** Keeps the latest value in a ref (updated before any other layout effect of the component). */
function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/* ------------------------------------------------------------------------------------------------
 * ResizablePanelGroup
 * ----------------------------------------------------------------------------------------------*/

export interface ResizablePanelGroupProps extends ComponentProps<"div"> {
  /** `"horizontal"` (default): panels side by side. `"vertical"`: stacked. */
  orientation?: ResizableOrientation;
  /** The panel sizes in percent, in panel (DOM) order; controlled. */
  layout?: number[];
  /**
   * The initial sizes when uncontrolled (e.g. what `onLayoutCommitted` stored). Used when it has one entry
   * per panel summing to 100 (±0.1); otherwise the panels' `defaultSize`s (a dev warning says so).
   */
  defaultLayout?: number[];
  /** Every layout change, also during a drag. */
  onLayoutChange?: (layout: number[]) => void;
  /**
   * The committed layout: a drag's end, each key press, a collapse or restore, a panel mounting or
   * unmounting. The one to persist.
   */
  onLayoutCommitted?: (layout: number[]) => void;
  /** The arrow keys' step in percentage points. Default 10. */
  keyboardStep?: number;
}

/**
 * A group of resizable panels separated by `ResizableHandle`s (APG window splitter). A handle
 * redistributes space between its two neighbouring panels only. Sizes are percentages summing to
 * 100. Panel order is DOM order; the server HTML already has the sizes from the defaults.
 */
export function ResizablePanelGroup({
  orientation = "horizontal",
  layout: layoutProp,
  defaultLayout,
  onLayoutChange,
  onLayoutCommitted,
  keyboardStep = 10,
  className,
  children,
  ref,
  ...props
}: ResizablePanelGroupProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs(ref, elementRef);
  const direction = useElementDirection(elementRef);

  const guessed: PanelEntry[] = [];
  const content = guessChildren(children, guessed);

  const entries = useRef(new Map<HTMLElement, PanelEntry>());
  const [registered, setRegistered] = useState<PanelEntry[]>([]);
  const register = useCallback((entry: PanelEntry) => {
    const element = entry.element as HTMLElement;
    entries.current.set(element, entry);
    setRegistered(inDocumentOrder(entries.current.values()));
    return () => {
      if (entries.current.get(element) === entry) entries.current.delete(element);
      setRegistered(inDocumentOrder(entries.current.values()));
    };
  }, []);
  const panels = registered.length > 0 ? registered : guessed;
  const ids = registered.map((panel) => panel.id);
  const idsKey = ids.join(" ");

  // The uncontrolled layout, with the panel ids it belongs to; `null` until the panels register.
  const [internal, setInternal] = useState<{ ids: string[]; sizes: number[] } | null>(null);
  // The registered panel ids the last committed layout belongs to (maps a controlled layout).
  const [knownIds, setKnownIds] = useState<string[] | null>(null);
  const controlled = layoutProp !== undefined;
  let layout: number[];
  if (controlled) {
    layout = reconcile(
      layoutProp,
      knownIds && knownIds.length === layoutProp.length ? knownIds : null,
      panels,
    );
  } else if (internal) {
    layout = reconcile(internal.sizes, internal.ids, panels);
  } else {
    layout = initialLayout(defaultLayout, panels);
  }

  const latest = useLatest({ layout, onLayoutChange, onLayoutCommitted, controlled });
  // The rendered layout, or the one `setLayout` set since (a drag's end reads this one).
  const latestLayout = useLatest<readonly number[]>(layout);

  // Panels registering for the first time adopt the layout silently; later mounts and unmounts
  // (a conditional panel) re-normalise and report it.
  const previousIds = useRef<string[] | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the registered ids change.
  useLayoutEffect(() => {
    const previous = previousIds.current;
    previousIds.current = ids;
    if (ids.length === 0) return;
    const { layout: current, controlled: isControlled } = latest.current;
    setKnownIds(ids);
    if (!isControlled) setInternal({ ids, sizes: current });
    if (previous && previous.length > 0) {
      latest.current.onLayoutChange?.(current);
      latest.current.onLayoutCommitted?.(current);
    }
  }, [idsKey]);

  // A controlled layout that does not fit the panels is normalised and reported.
  const layoutPropKey = layoutProp?.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the controlled layout changes.
  useLayoutEffect(() => {
    if (layoutProp === undefined || panels.length === 0) return;
    if (!sameLayout(layout, layoutProp)) latest.current.onLayoutChange?.(layout);
  }, [layoutPropKey]);

  // Only the initial layout reads `defaultLayout`: a panel mounting later is no reason to warn.
  const invalidDefault =
    !controlled &&
    internal === null &&
    registered.length > 0 &&
    defaultLayout !== undefined &&
    !isValidLayout(defaultLayout, registered.length);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && invalidDefault) {
      console.warn(
        "ResizablePanelGroup: defaultLayout needs one size per panel, summing to 100. Using the panels' defaultSize instead.",
      );
    }
  }, [invalidDefault]);

  const expanded = useRef(new Map<string, number>());
  const [dragging, setDragging] = useState(false);

  const context: GroupContextValue = {
    orientation,
    rtl: direction === "rtl",
    keyboardStep,
    panels,
    layout,
    register,
    setLayout: (next, committed, from) => {
      panels.forEach((panel, index) => {
        const before = from[index];
        if (
          !isCollapsed(before, panel) &&
          isCollapsed(next[index], panel) &&
          before !== undefined
        ) {
          expanded.current.set(panel.id, before);
        }
      });
      latestLayout.current = next;
      if (!controlled) setInternal({ ids, sizes: next });
      onLayoutChange?.(next);
      if (committed) onLayoutCommitted?.(next);
    },
    commitLayout: () => onLayoutCommitted?.([...latestLayout.current]),
    latestLayout,
    expandedSize: (id) => expanded.current.get(id),
    setDragging,
    elementRef,
  };

  return (
    <GroupContext value={context}>
      <div
        {...props}
        ref={mergedRef}
        data-slot="resizable-panel-group"
        data-orientation={orientation}
        data-dragging={dragging ? "" : undefined}
        className={cn(
          "flex size-full data-[orientation=vertical]:flex-col data-dragging:select-none data-dragging:data-[orientation=horizontal]:cursor-col-resize data-dragging:data-[orientation=vertical]:cursor-row-resize",
          className,
        )}
      >
        {content}
      </div>
    </GroupContext>
  );
}

/* ------------------------------------------------------------------------------------------------
 * ResizablePanel
 * ----------------------------------------------------------------------------------------------*/

export interface ResizablePanelProps extends ComponentProps<"div"> {
  /** The initial size in percent; panels without one share the rest equally. */
  defaultSize?: number;
  /** Default 0. */
  minSize?: number;
  /** Default 100. */
  maxSize?: number;
  /** The panel can collapse to `collapsedSize` (Enter, Home/End or a drag past its gap's midpoint). */
  collapsible?: boolean;
  /** The collapsed size; must be below `minSize`. Default 0. */
  collapsedSize?: number;
  /** Called when the panel collapses (`true`) or expands (`false`). */
  onCollapsedChange?: (collapsed: boolean) => void;
}

/**
 * One panel: `flex: <size> 1 0px`. `data-collapsed` when collapsible and at its collapsed size; a
 * panel collapsed to 0 is `inert`, so Tab skips its hidden content.
 */
export function ResizablePanel({
  id: idProp,
  defaultSize,
  minSize = 0,
  maxSize = 100,
  collapsible = false,
  collapsedSize = 0,
  onCollapsedChange,
  className,
  style,
  ref,
  ...props
}: ResizablePanelProps) {
  const group = useGroup("ResizablePanel");
  const guess = use(PanelGuessContext);
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs(ref, setElement);

  const { register } = group;
  useLayoutEffect(() => {
    if (!element) return undefined;
    return register({
      id,
      element,
      defaultSize,
      minSize,
      maxSize,
      collapsible,
      collapsedSize,
    });
  }, [register, id, element, defaultSize, minSize, maxSize, collapsible, collapsedSize]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (collapsible && collapsedSize >= minSize) {
      console.warn(
        `ResizablePanel: collapsedSize (${collapsedSize}) must be below minSize (${minSize}), or the panel can never collapse.`,
      );
    }
    if (minSize > maxSize) {
      console.warn(
        `ResizablePanel: minSize (${minSize}) is above maxSize (${maxSize}), so the panel has no allowed size.`,
      );
    }
  }, [collapsible, collapsedSize, minSize, maxSize]);

  const registeredIndex = element
    ? group.panels.findIndex((panel) => panel.element === element)
    : -1;
  const index = registeredIndex >= 0 ? registeredIndex : (guess ?? -1);
  const size = index >= 0 ? group.layout[index] : undefined;
  const collapsed = isCollapsed(size, { minSize, maxSize, collapsible, collapsedSize });

  const wasCollapsed = useRef(collapsed);
  useEffect(() => {
    if (wasCollapsed.current === collapsed) return;
    wasCollapsed.current = collapsed;
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  return (
    <div
      {...props}
      ref={mergedRef}
      id={id}
      data-slot="resizable-panel"
      data-collapsed={collapsed ? "" : undefined}
      inert={collapsed && collapsedSize === 0}
      style={{ ...style, flex: `${size ?? defaultSize ?? 0} 1 0px` }}
      className={cn("min-h-0 min-w-0 overflow-hidden", className)}
    />
  );
}

/* ------------------------------------------------------------------------------------------------
 * ResizableHandle
 * ----------------------------------------------------------------------------------------------*/

export interface ResizableHandleProps extends ComponentProps<"div"> {
  /** Renders a visible grip on the line. */
  withHandle?: boolean;
  /** Not focusable (`tabIndex` −1, and a click does not focus it), `aria-disabled`, no drag or keys. */
  disabled?: boolean;
}

/*
 * Spec §5's handle classes with two fixes from the visual and forced-colors checks (*Amended in
 * Task 7*): the ring-coloured hover and drag fills are `not-forced-colors:` (in forced colors
 * `bg-ring` is forced to Canvas, and the hover rule outranks `forced-colors:bg-[CanvasText]`, so the
 * line vanished under the pointer), the colour transition is off in forced colors (Chromium
 * interpolates CanvasText → Highlight through Canvas, so the line blinked out for 150ms at a drag's
 * start and end), and the resize cursors are `not-data-disabled:` (they came later in the CSS than
 * `data-disabled:cursor-not-allowed` at equal specificity).
 */
const handleClasses = [
  "group/resizable-handle relative flex shrink-0 touch-none select-none items-center justify-center bg-border",
  toggleFocusClasses,
  "transition-[background-color,outline-color] duration-150 ease-out motion-reduce:transition-none forced-colors:transition-none",
  "not-forced-colors:not-data-disabled:hover:bg-ring not-forced-colors:data-dragging:bg-ring",
  "forced-colors:bg-[CanvasText] forced-colors:focus-visible:outline-[Highlight] forced-colors:data-dragging:bg-[Highlight]",
  "data-disabled:cursor-not-allowed after:absolute",
  "data-[orientation=horizontal]:w-px data-[orientation=horizontal]:not-data-disabled:cursor-col-resize data-[orientation=horizontal]:after:inset-y-0 data-[orientation=horizontal]:after:-inset-x-1",
  "data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:not-data-disabled:cursor-row-resize data-[orientation=vertical]:after:inset-x-0 data-[orientation=vertical]:after:-inset-y-1",
].join(" ");

interface DragState {
  /** The one pointer driving the drag; other pointers are ignored until it ends. */
  pointerId: number;
  start: readonly number[];
  /** How far past the preceding panel's end edge the pointer was pressed, in px. */
  grab: number;
  /** The group's size along the axis that is not panel space (handles, borders), in px. */
  chrome: number;
}

/**
 * The separator between two panels (APG window splitter): `role="separator"`, focusable, with
 * `aria-valuenow` / `aria-valuemin` / `aria-valuemax` (the preceding panel's size and effective
 * limits) and `aria-controls` (the preceding panel). Arrows resize by the group's `keyboardStep`
 * (← / → in a horizontal group, flipped in RTL; ↑ / ↓ in a vertical one), Home / End go to the
 * limits, Enter collapses or restores a collapsible preceding panel. A pointer drag captures the
 * pointer; touch drags resize too (`touch-action: none`). Name it with `aria-label` (default
 * "Resize panel") or `aria-labelledby`.
 */
export function ResizableHandle({
  withHandle = false,
  disabled = false,
  className,
  children,
  onKeyDown,
  onMouseDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  ref,
  ...props
}: ResizableHandleProps) {
  const group = useGroup("ResizableHandle");
  const guess = use(HandleGuessContext);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs(ref, setElement);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<DragState | null>(null);

  const { panels, layout } = group;
  // After mount the preceding panel is the last registered panel before the handle in the DOM.
  const index =
    element && panels.some((panel) => panel.element)
      ? panels.filter(
          (panel) =>
            panel.element &&
            panel.element.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).length - 1
      : (guess ?? -1);
  const before = panels[index];
  const after = panels[index + 1];
  const size = layout[index];
  const nextSize = layout[index + 1];
  const pair =
    before && after && size !== undefined && nextSize !== undefined
      ? { before, after, size, total: size + nextSize }
      : null;
  const ranges = pair ? restingSizes(pair.total, pair.before, pair.after) : [];
  const lo = ranges[0]?.[0] ?? size ?? 0;
  const hi = ranges.at(-1)?.[1] ?? size ?? 0;

  const horizontal = group.orientation === "horizontal";

  /** The layout with the preceding panel at `target` (the pair keeps its total). */
  const withSize = (from: readonly number[], target: number) => {
    const next = [...from];
    next[index] = target;
    next[index + 1] = (pair as { total: number }).total - target;
    return next;
  };

  // A handle unmounting mid-drag (a conditional panel) must not leave the group dragging.
  const { setDragging: setGroupDragging } = group;
  useEffect(
    () => () => {
      if (drag.current) setGroupDragging(false);
    },
    [setGroupDragging],
  );

  /** The preceding panel's start edge along the axis (left, or right in RTL; top). */
  const startEdge = (rect: DOMRect) =>
    horizontal ? (group.rtl ? rect.right : rect.left) : rect.top;
  /** The pointer's distance from the preceding panel's start edge, in px. */
  const reach = (event: PointerEvent<HTMLDivElement>, rect: DOMRect) => {
    const coordinate = horizontal ? event.clientX : event.clientY;
    return horizontal && group.rtl ? startEdge(rect) - coordinate : coordinate - startEdge(rect);
  };
  const extent = (rect: DOMRect) => (horizontal ? rect.width : rect.height);

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointerId) return;
    drag.current = null;
    setDragging(false);
    group.setDragging(false);
    if (!sameLayout(group.latestLayout.current, state.start)) group.commitLayout();
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: an APG window splitter is a focusable separator; an <hr> cannot hold the grip.
    <div
      tabIndex={disabled ? -1 : 0}
      {...props}
      ref={mergedRef}
      role="separator"
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-valuenow={pair ? Math.round(pair.size) : undefined}
      aria-valuemin={pair ? Math.round(lo) : undefined}
      aria-valuemax={pair ? Math.round(hi) : undefined}
      aria-controls={before?.id || undefined}
      aria-disabled={disabled || undefined}
      aria-label={
        props["aria-label"] ?? (props["aria-labelledby"] === undefined ? "Resize panel" : undefined)
      }
      data-slot="resizable-handle"
      data-orientation={group.orientation}
      data-dragging={dragging ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      className={cn(handleClasses, className)}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || disabled || !pair) return;
        const shrink = horizontal ? (group.rtl ? "ArrowRight" : "ArrowLeft") : "ArrowUp";
        const grow = horizontal ? (group.rtl ? "ArrowLeft" : "ArrowRight") : "ArrowDown";
        let target: number;
        if (event.key === shrink) {
          target = snapDown(Math.max(pair.size - group.keyboardStep, lo), ranges);
        } else if (event.key === grow) {
          target = snapUp(Math.min(pair.size + group.keyboardStep, hi), ranges);
        } else if (event.key === "Home") {
          target = lo;
        } else if (event.key === "End") {
          target = hi;
        } else if (event.key === "Enter" && pair.before.collapsible) {
          if (isCollapsed(pair.size, pair.before)) {
            const restore = group.expandedSize(pair.before.id) ?? pair.before.minSize;
            target = snapDown(Math.min(restore, hi), ranges);
          } else {
            const collapsedSize = pair.before.collapsedSize;
            const reachable = ranges.some(
              ([start, end]) => collapsedSize >= start - EPSILON && collapsedSize <= end + EPSILON,
            );
            target = reachable ? collapsedSize : pair.size;
          }
        } else {
          return;
        }
        event.preventDefault();
        if (Math.abs(target - pair.size) < EPSILON) return;
        group.setLayout(withSize(layout, target), true, layout);
      }}
      onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
        onMouseDown?.(event);
        // `tabIndex` −1 keeps it out of the Tab order; this keeps a click from focusing it too.
        if (disabled) event.preventDefault();
      }}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        onPointerDown?.(event);
        // One pointer drives a drag: a second touch or pen press is ignored until it ends.
        if (event.defaultPrevented || disabled || !pair || event.button !== 0 || drag.current) {
          return;
        }
        const panelElement = pair.before.element;
        const groupElement = group.elementRef.current;
        if (!panelElement || !groupElement) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const panelRect = panelElement.getBoundingClientRect();
        let space = 0;
        for (const panel of panels) {
          if (panel.element) space += extent(panel.element.getBoundingClientRect());
        }
        drag.current = {
          pointerId: event.pointerId,
          start: layout,
          grab: reach(event, panelRect) - extent(panelRect),
          chrome: extent(groupElement.getBoundingClientRect()) - space,
        };
        setDragging(true);
        group.setDragging(true);
      }}
      onPointerMove={(event: PointerEvent<HTMLDivElement>) => {
        onPointerMove?.(event);
        const state = drag.current;
        if (!state || event.pointerId !== state.pointerId || !pair) return;
        const panelElement = pair.before.element;
        const groupElement = group.elementRef.current;
        if (!panelElement || !groupElement) return;
        // Two rect reads per move, so a group resized mid-drag still tracks the pointer. The
        // direction comes from the group (read on mount and on `dir` changes), never per move.
        const space = extent(groupElement.getBoundingClientRect()) - state.chrome;
        if (space <= 0) return;
        const size = reach(event, panelElement.getBoundingClientRect()) - state.grab;
        const target = snapNearest(clamp((size / space) * 100, lo, hi), ranges);
        const next = withSize(state.start, target);
        if (!sameLayout(next, group.latestLayout.current)) {
          group.setLayout(next, false, state.start);
        }
      }}
      onPointerUp={(event: PointerEvent<HTMLDivElement>) => {
        onPointerUp?.(event);
        endDrag(event);
      }}
      onPointerCancel={(event: PointerEvent<HTMLDivElement>) => {
        onPointerCancel?.(event);
        endDrag(event);
      }}
      onLostPointerCapture={(event: PointerEvent<HTMLDivElement>) => {
        onLostPointerCapture?.(event);
        endDrag(event);
      }}
    >
      {withHandle && (
        <span
          aria-hidden="true"
          data-slot="resizable-handle-grip"
          className="z-10 flex h-6 w-3 items-center justify-center rounded-sm border border-border bg-border forced-colors:border-[CanvasText] group-data-[orientation=vertical]/resizable-handle:rotate-90 [&_svg]:size-2.5"
        >
          <GripVerticalIcon />
        </span>
      )}
      {children}
    </div>
  );
}
