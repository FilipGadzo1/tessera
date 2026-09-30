"use client";

import {
  Children,
  type ComponentProps,
  type CSSProperties,
  createContext,
  type FocusEvent,
  Fragment,
  isValidElement,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  use,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { isRtl } from "../../lib/direction";
import { ChevronRightIcon } from "../../lib/icons";
import { useControllableState } from "../../lib/use-controllable-state";
import { useMergedRefs } from "../../lib/use-merged-refs";

/*
 * A hand-built WAI-ARIA APG treeview (spec Phase I §3): Base UI 1.8 has no tree.
 *
 * - The focusable element is the `li role="treeitem"` (roving tabindex); its row
 *   (`TreeItemContent`) paints the focus ring through `li:focus-visible > row`, so the ring
 *   surrounds the row and not the item's nested group.
 * - Collapsed children stay mounted inside a `hidden` group, so every item knows whether it has
 *   child treeitems (a child component may render none). The visible items are read from the DOM
 *   at keypress time by walking the expanded groups in document order (O(n)).
 * - Each item registers its element with the root and with its parent item (ref callbacks), so a
 *   key handler can map the focused element back to its value, label, disabled and parent state,
 *   and a parent counts its real child treeitems.
 * - `aria-posinset` / `aria-setsize` come from the DOM: each list's treeitem children are counted
 *   in a layout effect, so wrapper components, fragments and children rendering `null` are counted
 *   as the items they actually render. The render-time values (from the element children) are
 *   only a first guess for server HTML.
 */

/** How many items a user can select: none (a navigation tree), one, or many. */
export type TreeSelectionMode = "none" | "single" | "multiple";

/** The typeahead buffer resets after this long without a printable key (APG). */
const TYPEAHEAD_TIMEOUT = 500;

const EMPTY: string[] = [];

interface ItemRecord {
  value: string;
  label: string | undefined;
  disabled: boolean;
  isParent: boolean;
}

interface TreeContextValue {
  selectionMode: TreeSelectionMode;
  selected: ReadonlySet<string>;
  expanded: ReadonlySet<string>;
  /** The tabbable item's value; `null` until the root's first layout effect. */
  tabStop: string | null;
  /**
   * Before the first layout effect (server HTML, the first client render) the first level-1
   * item to render claims the tab stop, so there is exactly one: render order is tree order.
   */
  firstClaim: { id: string | null };
  register: (element: HTMLElement, record: RefObject<ItemRecord>) => () => void;
  toggleExpanded: (value: string) => void;
  clickRow: (record: ItemRecord, clickCount: number) => void;
  doubleClickRow: (record: ItemRecord) => void;
}

const TreeContext = createContext<TreeContextValue | null>(null);

interface ItemPosition {
  level: number;
  posinset: number;
  setsize: number;
}

const PositionContext = createContext<ItemPosition | null>(null);

/** A parent item's count of its registered child treeitems. */
interface ParentItem {
  add: (element: HTMLElement) => void;
  remove: (element: HTMLElement) => void;
}

const ParentItemContext = createContext<ParentItem | null>(null);

const isTreeItem = (element: Element) => element.getAttribute("role") === "treeitem";

/**
 * Sets `aria-posinset` / `aria-setsize` on a list's treeitem children from their DOM order. Only
 * changed values are written, so a commit that moves nothing causes no attribute mutations.
 */
function syncPositions(list: Element) {
  const items = Array.from(list.children).filter(isTreeItem);
  const setsize = String(items.length);
  items.forEach((item, index) => {
    const posinset = String(index + 1);
    if (item.getAttribute("aria-posinset") !== posinset)
      item.setAttribute("aria-posinset", posinset);
    if (item.getAttribute("aria-setsize") !== setsize) item.setAttribute("aria-setsize", setsize);
  });
}

interface TreeItemContextValue {
  record: ItemRecord;
  rowId: string;
  expanded: boolean;
  selected: boolean;
}

const TreeItemContext = createContext<TreeItemContextValue | null>(null);

function useTreeContext(part: string) {
  const context = use(TreeContext);
  if (!context) throw new Error(`${part} must be rendered inside a Tree.`);
  return context;
}

function useTreeItemContext(part: string) {
  const context = use(TreeItemContext);
  if (!context) throw new Error(`${part} must be rendered inside a TreeItem.`);
  return context;
}

/** The element children, with fragments flattened (their keys prefixed, so they stay unique). */
function flattenChildren(
  children: ReactNode,
  prefix = "",
): { key: string; element: ReactElement }[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const key = `${prefix}${child.key}`;
    if (child.type === Fragment)
      return flattenChildren((child.props as { children?: ReactNode }).children, `${key}/`);
    return [{ key, element: child }];
  });
}

/**
 * Renders child items, telling each its level and its first-guess position among its siblings
 * (corrected from the DOM after mount).
 */
function renderItems(items: { key: string; element: ReactElement }[], level: number) {
  return items.map(({ key, element }, index) => (
    <PositionContext key={key} value={{ level, posinset: index + 1, setsize: items.length }}>
      {element}
    </PositionContext>
  ));
}

const rowOf = (element: Element) => element.querySelector(":scope > [data-slot=tree-item-content]");

export interface TreeProps extends ComponentProps<"ul"> {
  /** `"none"` (default): a navigation tree without `aria-selected`; `"single"`; `"multiple"`. */
  selectionMode?: TreeSelectionMode;
  /** The selected item values (controlled). */
  selectedValues?: string[];
  /** The initially selected item values (uncontrolled). */
  defaultSelectedValues?: string[];
  /** Called with the new selected values whenever the selection changes. */
  onSelectedValuesChange?: (values: string[]) => void;
  /** The expanded parent values (controlled). */
  expandedValues?: string[];
  /** The initially expanded parent values (uncontrolled). */
  defaultExpandedValues?: string[];
  /** Called with the new expanded values whenever a parent expands or collapses. */
  onExpandedValuesChange?: (values: string[]) => void;
  /** Called with an item's value on Enter or double-click (not for a disabled item). */
  onAction?: (value: string) => void;
}

/**
 * A `ul role="tree"` of `TreeItem`s (APG treeview). Name it with `aria-label` or
 * `aria-labelledby`. ↑/↓ move, → expands then enters, ← collapses then goes to the parent,
 * Home/End, typeahead, `*` expands the siblings, Enter runs `onAction`, Space toggles the
 * selection (multiple: Shift+↑/↓ and Shift+Home/End extend it from the anchor, Ctrl/⌘+A selects
 * every visible item). RTL flips ←/→.
 *
 * `aria-posinset` / `aria-setsize` are re-counted from the DOM on every tree commit. A wrapper
 * component that reorders its items internally without the tree re-rendering keeps stale
 * positions until the next tree commit.
 */
export function Tree({
  selectionMode = "none",
  selectedValues: selectedProp,
  defaultSelectedValues,
  onSelectedValuesChange,
  expandedValues: expandedProp,
  defaultExpandedValues,
  onExpandedValuesChange,
  onAction,
  children,
  className,
  onKeyDown,
  onFocus,
  ref,
  ...props
}: TreeProps) {
  const [selectedValues, setSelectedValues] = useControllableState(
    selectedProp,
    defaultSelectedValues ?? EMPTY,
    onSelectedValuesChange,
  );
  const [expandedValues, setExpandedValues] = useControllableState(
    expandedProp,
    defaultExpandedValues ?? EMPTY,
    onExpandedValuesChange,
  );
  const selected = useMemo(() => new Set(selectedValues), [selectedValues]);
  const expanded = useMemo(() => new Set(expandedValues), [expandedValues]);
  /** The last item that had focus (set only on focus). */
  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  /** The one tabbable item, derived after each commit from the visible items. */
  const [tabStop, setTabStop] = useState<string | null>(null);
  // Bumped when an item mounts or unmounts, so the layout effect below re-runs even when only a
  // subtree re-rendered.
  const [, setItemsVersion] = useState(0);

  const rootRef = useRef<HTMLUListElement>(null);
  const mergedRef = useMergedRefs(ref, rootRef);
  const registry = useRef(new Map<HTMLElement, RefObject<ItemRecord>>()).current;
  /** The Shift+↑/↓ anchor, and the selection the range is added to. */
  const anchorRef = useRef<{ value: string; base: string[] } | null>(null);
  const typeaheadRef = useRef({ buffer: "", time: Number.NEGATIVE_INFINITY });

  const register = useCallback(
    (element: HTMLElement, record: RefObject<ItemRecord>) => {
      registry.set(element, record);
      setItemsVersion((n) => n + 1);
      return () => {
        registry.delete(element);
        setItemsVersion((n) => n + 1);
      };
    },
    [registry],
  );

  const recordOf = (element: Element) => registry.get(element as HTMLElement)?.current;

  /** The visible items in document order: the root's items, and the items of expanded groups. */
  const visibleItems = () => {
    const items: HTMLElement[] = [];
    const walk = (list: Element) => {
      for (const child of Array.from(list.children) as HTMLElement[]) {
        if (!registry.has(child)) continue;
        items.push(child);
        if (child.getAttribute("aria-expanded") !== "true") continue;
        const group = child.querySelector(":scope > [role=group]");
        if (group) walk(group);
      }
    };
    if (rootRef.current) walk(rootRef.current);
    return items;
  };

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    syncPositions(root);
    for (const group of Array.from(root.querySelectorAll("[role=group]"))) syncPositions(group);

    const items = visibleItems();
    const values = items.map((element) => recordOf(element)?.value);

    // A controlled collapse hid the focused item: keep focus in the tree, on the nearest
    // visible ancestor (its focus event then updates `focusedValue`).
    if (focusedValue !== null && !values.includes(focusedValue)) {
      const hidden = [...registry].find(([, record]) => record.current.value === focusedValue)?.[0];
      if (hidden && document.activeElement === hidden) {
        let ancestor = hidden.parentElement?.closest<HTMLElement>("[role=treeitem]");
        while (ancestor && !items.includes(ancestor))
          ancestor = ancestor.parentElement?.closest<HTMLElement>("[role=treeitem]");
        ancestor?.focus();
      }
    }

    // Roving tabindex: exactly one tabbable item. The focused item while it is visible, else
    // the first visible selected item, else the first item.
    const next =
      (focusedValue !== null && values.includes(focusedValue) ? focusedValue : undefined) ??
      values.find((value) => value !== undefined && selected.has(value)) ??
      values[0] ??
      null;
    if (next !== tabStop) setTabStop(next);
  });

  const setSelection = (next: string[]) => {
    if (next.length === selectedValues.length && next.every((value) => selected.has(value))) return;
    setSelectedValues(next);
  };

  const toggleSelection = (record: ItemRecord) => {
    if (selectionMode === "none" || record.disabled) return;
    let next: string[];
    if (selectionMode === "single") next = selected.has(record.value) ? [] : [record.value];
    else
      next = selected.has(record.value)
        ? selectedValues.filter((value) => value !== record.value)
        : [...selectedValues, record.value];
    anchorRef.current = { value: record.value, base: next };
    setSelectedValues(next);
  };

  const toggleExpanded = (value: string) => {
    setExpandedValues(
      expanded.has(value)
        ? expandedValues.filter((expandedValue) => expandedValue !== value)
        : [...expandedValues, value],
    );
  };

  /** Shift+↑/↓: the selection is the anchor's base plus every enabled item from anchor to `to`. */
  const extendSelection = (items: HTMLElement[], from: HTMLElement, to: HTMLElement) => {
    const values = items.map((element) => recordOf(element)?.value);
    let anchor = anchorRef.current;
    if (!anchor || !values.includes(anchor.value)) {
      anchor = { value: recordOf(from)?.value as string, base: selectedValues };
      anchorRef.current = anchor;
    }
    const start = values.indexOf(anchor.value);
    const end = items.indexOf(to);
    const range = items
      .slice(Math.min(start, end), Math.max(start, end) + 1)
      .map((element) => recordOf(element))
      .filter((record) => record && !record.disabled)
      .map((record) => (record as ItemRecord).value);
    setSelection([...new Set([...anchor.base, ...range])]);
  };

  const typeahead = (key: string, items: HTMLElement[], index: number) => {
    const state = typeaheadRef.current;
    const now = Date.now();
    if (now - state.time > TYPEAHEAD_TIMEOUT) state.buffer = "";
    state.buffer += key.toLocaleLowerCase();
    state.time = now;
    const chars = [...state.buffer];
    // One character typed repeatedly cycles through the items starting with it; a longer
    // string is matched from the focused item on, so it stays put while it still matches.
    const repeated = chars.every((char) => char === chars[0]);
    const search = repeated ? (chars[0] as string) : state.buffer;
    const start = repeated ? index + 1 : index;
    for (let offset = 0; offset < items.length; offset++) {
      const element = items[(start + offset) % items.length] as HTMLElement;
      const record = recordOf(element);
      const label = (record?.label ?? rowOf(element)?.textContent ?? "").trim();
      if (label.toLocaleLowerCase().startsWith(search)) {
        element.focus();
        return;
      }
    }
  };

  const typeaheadActive = () => {
    const state = typeaheadRef.current;
    return state.buffer !== "" && Date.now() - state.time <= TYPEAHEAD_TIMEOUT;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    const record = recordOf(target);
    if (!record) return;
    const items = visibleItems();
    const index = items.indexOf(target);
    const { key } = event;
    const modifier = event.ctrlKey || event.metaKey;
    const rtl = isRtl(target);
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";

    const moveTo = (element: HTMLElement | undefined) => {
      if (!element) return;
      if (event.shiftKey && selectionMode === "multiple") extendSelection(items, target, element);
      else anchorRef.current = null;
      element.focus();
    };

    if (modifier && !event.altKey && key.toLowerCase() === "a") {
      if (selectionMode !== "multiple") return;
      const visible = items
        .map((element) => recordOf(element))
        .filter((item) => item && !item.disabled)
        .map((item) => (item as ItemRecord).value);
      anchorRef.current = null;
      setSelection([...new Set([...selectedValues, ...visible])]);
    } else if (modifier || event.altKey) {
      return;
    } else if (key === "ArrowDown") {
      moveTo(items[index + 1]);
    } else if (key === "ArrowUp") {
      moveTo(items[index - 1]);
    } else if (key === forward) {
      if (record.isParent && !expanded.has(record.value)) toggleExpanded(record.value);
      else if (record.isParent)
        target.querySelector<HTMLElement>(":scope > [role=group] > [role=treeitem]")?.focus();
    } else if (key === backward) {
      if (record.isParent && expanded.has(record.value)) toggleExpanded(record.value);
      else {
        const parent = target.parentElement?.closest<HTMLElement>("[role=treeitem]");
        if (parent && registry.has(parent)) parent.focus();
      }
    } else if (key === "Home") {
      moveTo(items[0]);
    } else if (key === "End") {
      moveTo(items[items.length - 1]);
    } else if (key === "Enter") {
      if (record.disabled) return;
      if (selectionMode === "single") setSelection([record.value]);
      onAction?.(record.value);
    } else if (key === " " && !typeaheadActive()) {
      toggleSelection(record);
    } else if (key === "*") {
      const siblings = Array.from(target.parentElement?.children ?? [])
        .map((element) => recordOf(element))
        .filter((item) => item?.isParent && !expanded.has(item.value))
        .map((item) => (item as ItemRecord).value);
      if (siblings.length > 0) setExpandedValues([...expandedValues, ...siblings]);
    } else if ([...key].length === 1) {
      typeahead(key, items, index);
    } else {
      return;
    }
    event.preventDefault();
  };

  const handleFocus = (event: FocusEvent<HTMLUListElement>) => {
    onFocus?.(event);
    const record = recordOf(event.target);
    if (record) setFocusedValue(record.value);
  };

  const context: TreeContextValue = {
    selectionMode,
    selected,
    expanded,
    tabStop,
    firstClaim: { id: null },
    register,
    toggleExpanded,
    clickRow: (record, clickCount) => {
      // The second click of a double-click is the action's, not a second toggle.
      if (clickCount > 1 || record.disabled || selectionMode === "none") return;
      if (selectionMode === "single") {
        anchorRef.current = { value: record.value, base: [record.value] };
        setSelection([record.value]);
      } else toggleSelection(record);
    },
    doubleClickRow: (record) => {
      if (!record.disabled) onAction?.(record.value);
    },
  };

  return (
    <TreeContext value={context}>
      <ul
        {...props}
        ref={mergedRef}
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the APG treeview is a list with tree roles.
        role="tree"
        aria-multiselectable={selectionMode === "multiple" ? true : undefined}
        data-slot="tree"
        className={cn("flex flex-col gap-px text-sm", className)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
      >
        {renderItems(flattenChildren(children), 1)}
      </ul>
    </TreeContext>
  );
}

export interface TreeItemProps extends ComponentProps<"li"> {
  /** The item's value: required, and unique across the whole tree. */
  value: string;
  /** The text typeahead matches; defaults to the row's text content. */
  label?: string;
  /** Focusable (APG) but not selectable or actionable. A disabled parent still expands. */
  disabled?: boolean;
}

/**
 * A `li role="treeitem"`. Its children are its `TreeItemContent` row (a direct child, or inside a
 * fragment) and its child items: every other child renders inside a `ul role="group"` (hidden
 * while collapsed), so `TreeItem`s, wrapper components and fragments of them all work. The item is
 * an expandable parent when at least one child treeitem actually renders.
 */
export function TreeItem({
  value,
  label,
  disabled = false,
  children,
  className,
  style,
  ref,
  ...props
}: TreeItemProps) {
  const tree = useTreeContext("TreeItem");
  const position = use(PositionContext) ?? { level: 1, posinset: 1, setsize: 1 };
  const rowId = useId();
  const flat = flattenChildren(children);
  const rows = flat.filter(({ element }) => element.type === TreeItemContent);
  const items = flat.filter(({ element }) => element.type !== TreeItemContent);

  // The child treeitems that actually rendered, counted as they register. Until the first
  // layout effect (server HTML, the first client render) the element children are the guess.
  const childItems = useRef(new Set<HTMLElement>()).current;
  const [childCount, setChildCount] = useState<number | null>(null);
  const parentItem = useMemo<ParentItem>(
    () => ({
      add: (element) => {
        childItems.add(element);
        setChildCount(childItems.size);
      },
      remove: (element) => {
        childItems.delete(element);
        setChildCount(childItems.size);
      },
    }),
    [childItems],
  );
  const isParent = childCount === null ? items.length > 0 : childCount > 0;
  const expanded = isParent && tree.expanded.has(value);
  const selected = tree.selected.has(value);
  const record: ItemRecord = { value, label, disabled, isParent };

  const groupRef = useRef<HTMLUListElement>(null);
  const recordRef = useRef(record);
  useLayoutEffect(() => {
    recordRef.current = record;
    if (childCount !== childItems.size) setChildCount(childItems.size);
    // This item's children may have changed without the root re-rendering.
    if (groupRef.current) syncPositions(groupRef.current);
  });

  const { register } = tree;
  const parent = use(ParentItemContext);
  const registerElement = useCallback(
    (element: HTMLLIElement | null) => {
      if (!element) return;
      const unregister = register(element, recordRef);
      parent?.add(element);
      return () => {
        unregister();
        parent?.remove(element);
      };
    },
    [register, parent],
  );
  const mergedRef = useMergedRefs(ref, registerElement);

  const labelledBy =
    props["aria-labelledby"] ??
    (props["aria-label"] === undefined && rows.length > 0 ? rowId : undefined);

  // Before the root has picked a tab stop, the first level-1 item to render is tabbable.
  const { firstClaim } = tree;
  let tabbable = tree.tabStop === value;
  if (tree.tabStop === null && position.level === 1) {
    if (firstClaim.id === null) firstClaim.id = rowId;
    tabbable = firstClaim.id === rowId;
  }

  return (
    <TreeItemContext value={{ record, rowId, expanded, selected }}>
      <li
        {...props}
        ref={mergedRef}
        role="treeitem"
        aria-level={position.level}
        aria-setsize={position.setsize}
        aria-posinset={position.posinset}
        aria-expanded={isParent ? expanded : undefined}
        aria-selected={tree.selectionMode === "none" ? undefined : selected}
        aria-disabled={disabled || undefined}
        aria-labelledby={labelledBy}
        tabIndex={tabbable ? 0 : -1}
        data-slot="tree-item"
        className={cn("flex flex-col gap-px outline-none", className)}
        style={{ "--tree-level": position.level - 1, ...style } as CSSProperties}
      >
        {rows.map(({ element }) => element)}
        {items.length > 0 && (
          // biome-ignore lint/a11y/useSemanticElements: an APG treeview's nested items are a list with role="group", not a fieldset.
          <ul
            ref={groupRef}
            role="group"
            hidden={!expanded}
            data-slot="tree-group"
            className="flex flex-col gap-px"
          >
            <ParentItemContext value={parentItem}>
              {renderItems(items, position.level + 1)}
            </ParentItemContext>
          </ul>
        )}
      </li>
    </TreeItemContext>
  );
}

/*
 * The row's focus ring: `toggleFocusClasses` (outline-none, 2px solid ring colour) moved inside
 * the row (`-outline-offset-2`) and drawn while the owning treeitem has keyboard focus
 * (`li:focus-visible > row`, not `:focus-visible` on the row, which is never focused). Written out
 * rather than derived from `toggleFocusClasses`, so Tailwind sees every class in the source.
 * Focused and selected in forced colors, the inset ring is HighlightText on the Highlight fill.
 */
const rowFocusClasses =
  "outline-none -outline-offset-2 outline-ring [li:focus-visible>&]:outline-2 [li:focus-visible>&]:outline-solid forced-colors:[li:focus-visible>&]:outline-[Highlight] forced-colors:data-selected:[li:focus-visible>&]:outline-[HighlightText]";

const rowClasses = [
  "group/tree-item-content flex h-8 cursor-pointer select-none items-center gap-2 rounded-md pe-2 ps-[calc(var(--tree-level)*1rem+0.5rem)] text-sm",
  "transition-[color,background-color,outline-color] duration-150 ease-out motion-reduce:transition-none",
  "not-data-disabled:not-data-selected:hover:bg-accent not-data-disabled:not-data-selected:hover:text-accent-foreground",
  "data-selected:bg-primary-soft data-selected:text-primary-soft-foreground not-data-disabled:data-selected:hover:bg-primary-soft-hover",
  // The hover selector matches the tint's specificity, so Highlight is not replaced under HighlightText.
  "forced-colors:data-selected:bg-[Highlight] forced-colors:not-data-disabled:data-selected:hover:bg-[Highlight] forced-colors:data-selected:text-[HighlightText] forced-colors:data-selected:forced-color-adjust-none",
  // Muted text instead of the usual `opacity-50`: a disabled item stays focusable (APG), and row
  // opacity would fade its focus ring too.
  "data-disabled:cursor-not-allowed data-disabled:text-muted-foreground forced-colors:data-disabled:text-[GrayText]",
  rowFocusClasses,
  "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
].join(" ");

/**
 * Icons in a selected or disabled row take its text colour (in forced colors, HighlightText or
 * GrayText).
 */
const rowIconClasses =
  "flex size-4 shrink-0 items-center justify-center text-muted-foreground group-data-selected/tree-item-content:text-inherit group-data-disabled/tree-item-content:text-inherit";

export type TreeItemContentProps = ComponentProps<"div">;

/**
 * The item's row: a chevron (parents; it rotates on expand and mirrors in RTL) or a spacer,
 * then the children (an optional `TreeItemIcon` and the label). Indented by level through
 * `--tree-level`. A click selects (multiple: toggles), a double-click runs `onAction`, and a
 * click on the chevron expands or collapses.
 */
export function TreeItemContent({
  className,
  children,
  onClick,
  onDoubleClick,
  ...props
}: TreeItemContentProps) {
  const tree = useTreeContext("TreeItemContent");
  const { record, rowId, expanded, selected } = useTreeItemContext("TreeItemContent");
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: pointer shortcuts for the row; the focused treeitem (its li) handles the keys on the Tree root.
    <div
      {...props}
      id={rowId}
      data-slot="tree-item-content"
      data-expanded={expanded ? "" : undefined}
      data-selected={selected && tree.selectionMode !== "none" ? "" : undefined}
      data-disabled={record.disabled ? "" : undefined}
      className={cn(rowClasses, className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) tree.clickRow(record, event.detail);
      }}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);
        if (!event.defaultPrevented) tree.doubleClickRow(record);
      }}
    >
      {record.isParent ? (
        <span
          aria-hidden="true"
          data-slot="tree-item-chevron"
          className={cn(
            rowIconClasses,
            "transition-[rotate] duration-150 ease-out motion-reduce:transition-none rtl:-scale-x-100 rtl:[--tree-chevron-turn:-90deg] group-data-expanded/tree-item-content:rotate-[var(--tree-chevron-turn,90deg)]",
          )}
          onClick={(event) => {
            event.stopPropagation();
            tree.toggleExpanded(record.value);
          }}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <ChevronRightIcon />
        </span>
      ) : (
        <span aria-hidden="true" data-slot="tree-item-spacer" className="size-4 shrink-0" />
      )}
      {children}
    </div>
  );
}

export type TreeItemIconProps = ComponentProps<"span">;

/** A decorative icon slot at the start of a row (hidden from assistive technology). */
export function TreeItemIcon({ className, ...props }: TreeItemIconProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      data-slot="tree-item-icon"
      className={cn(rowIconClasses, className)}
    />
  );
}
