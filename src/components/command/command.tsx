"use client";

import { Autocomplete as BaseAutocomplete } from "@base-ui/react/autocomplete";
import {
  Children,
  type ComponentProps,
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "../../lib/cn";
import { SearchIcon } from "../../lib/icons";
import { mergeClassName } from "../../lib/merge-class-name";
import { menuItemBase } from "../../lib/overlay-classes";
import { claimEscape } from "../../lib/tooltip-escape";
import { useControllableState } from "../../lib/use-controllable-state";
import {
  comboboxEmptyBase,
  comboboxGroupLabelBase,
  comboboxInputBase,
  comboboxListBase,
  comboboxSeparatorBase,
  comboboxStatusBase,
} from "../combobox/combobox-variants";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../dialog";

const commandBase = "flex flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground";
/*
 * The search row carries the focus ring (the input inside has none). The ring is inset, and the row
 * inherits the container's top corner radius, so the ring follows the rounded corners instead of
 * being clipped by the container's `overflow-hidden` (Phase G backlog, T4).
 */
const commandInputWrapperBase =
  "flex items-center gap-2 rounded-t-[inherit] border-b border-border px-3 outline-none focus-within:outline-1 focus-within:outline-solid focus-within:outline-ring focus-within:-outline-offset-1 forced-colors:focus-within:outline-[Highlight]";
const commandInputBase = "h-12 text-sm";
const commandListBase = "max-h-80 overflow-y-auto p-1";
const commandItemBase =
  "forced-colors:data-highlighted:bg-[Highlight] forced-colors:data-highlighted:text-[HighlightText] forced-colors:data-highlighted:forced-color-adjust-none";
const commandShortcutBase =
  "ms-auto text-xs tracking-widest text-muted-foreground forced-colors:in-data-highlighted:text-[HighlightText]";

/** Matches an item against the query: its text (`value`), the query, and its `keywords`. */
export type CommandFilter = (value: string, query: string, keywords: readonly string[]) => boolean;

/** The event `CommandItem`'s `onSelect` receives. `preventDefault()` keeps a CommandDialog open. */
export interface CommandSelectEvent {
  /** The click or the Enter keypress that ran the item. */
  nativeEvent: Event;
  /** Keeps the enclosing `CommandDialog` open. */
  preventDefault: () => void;
  readonly defaultPrevented: boolean;
}

/*
 * Which items match the query. Every mounted `CommandItem` reports whether it matches, so
 * `CommandEmpty` knows when none does. `ready` turns true once the root's first layout effect has
 * run (after every item registered), so the empty text never flashes on mount.
 */
function createMatchStore() {
  const matches = new Map<string, boolean>();
  const listeners = new Set<() => void>();
  let ready = false;
  const emit = () => {
    for (const listener of listeners) listener();
  };
  return {
    set(id: string, match: boolean) {
      if (matches.get(id) === match) return;
      matches.set(id, match);
      emit();
    },
    delete(id: string) {
      if (matches.delete(id)) emit();
    },
    setReady() {
      if (ready) return;
      ready = true;
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isEmpty() {
      if (!ready) return false;
      for (const match of matches.values()) if (match) return false;
      return true;
    },
  };
}

interface CommandContextValue {
  query: string;
  setQuery: (query: string) => void;
  filter: CommandFilter;
  label: string;
  store: ReturnType<typeof createMatchStore>;
}

const CommandContext = createContext<CommandContextValue | null>(null);

/** Set by `CommandDialog`: closes it after an item runs (unless `onSelect` prevented it). */
const CommandRunContext = createContext<(() => void) | null>(null);

function useCommandContext(part: string) {
  const context = useContext(CommandContext);
  if (!context) throw new Error(`${part} must be used inside a Command.`);
  return context;
}

export interface CommandProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "onSelect"> {
  /** The query (the input text). Use with `onValueChange` when controlled. */
  value?: string;
  /** The initial query when uncontrolled. @default "" */
  defaultValue?: string;
  /** Called with the new query as the user types (and when Escape clears it). */
  onValueChange?: (value: string) => void;
  /**
   * Decides whether an item matches the (trimmed, non-empty) query. Receives the item's text, the
   * query and the item's `keywords`. Defaults to Base UI's locale-aware, case- and
   * accent-insensitive "contains" over the text and each keyword.
   */
  filter?: CommandFilter;
  /** ↓ on the last item moves to the first, ↑ on the first to the last. @default false */
  loop?: boolean;
  /** Accessible name of the search input and the list. @default "Command menu" */
  label?: string;
}

/**
 * A command palette: a search input over an always-visible list of actions, built on Base UI
 * Autocomplete in inline mode (`open` + `inline`). Typing filters the items on their text and
 * `keywords`; groups left with no match hide. The first match is highlighted; ↑/↓ move the
 * highlight (`loop` wraps), Home/End jump to the first/last item, Enter runs the highlighted item
 * and Escape clears the query. Compose `CommandInput`, `CommandEmpty`, `CommandList` with
 * `CommandGroup` / `CommandItem` inside, or use `CommandDialog` for a ⌘K palette.
 */
export function Command({
  value,
  defaultValue = "",
  onValueChange,
  filter: filterProp,
  loop = false,
  label = "Command menu",
  className,
  children,
  ...props
}: CommandProps) {
  const [query, setQuery] = useControllableState(value, defaultValue, onValueChange);
  const { contains } = BaseAutocomplete.useFilter();
  const filter: CommandFilter =
    filterProp ??
    ((text, search, keywords) =>
      contains(text, search) || keywords.some((keyword) => contains(keyword, search)));
  const [store] = useState(createMatchStore);
  useLayoutEffect(() => {
    store.setReady();
  }, [store]);
  const context: CommandContextValue = { query, setQuery, filter, label, store };
  return (
    <CommandContext.Provider value={context}>
      <BaseAutocomplete.Root
        open
        inline
        filter={null}
        autoHighlight="always"
        keepHighlight
        loopFocus={loop}
        value={query}
        onValueChange={(next) => setQuery(next)}
      >
        <div {...props} data-slot="command" className={cn(commandBase, className)}>
          {children}
        </div>
      </BaseAutocomplete.Root>
    </CommandContext.Provider>
  );
}

export interface CommandInputProps extends Omit<BaseAutocomplete.Input.Props, "value"> {
  /** Classes for the search row around the input (`className` goes to the `<input>`). */
  wrapperClassName?: string;
}

/**
 * The search row: a leading search icon and the input (`role="combobox"`, named by the Command's
 * `label`), above a hairline. The row shows the focus ring, inset, with the container's rounded
 * top corners. Escape (with or without modifiers) clears a filtering query and claims the event
 * (`claimEscape`), so an enclosing Tessera overlay (CommandDialog, Dialog, Popover, Drawer, …)
 * stays open until the next Escape; the event still propagates. Home/End move the highlight to the
 * first/last item, not the caret (Base UI's inline list navigation).
 */
export function CommandInput({
  wrapperClassName,
  className,
  onKeyDown,
  "aria-label": ariaLabel,
  ...props
}: CommandInputProps) {
  const { query, setQuery, label } = useCommandContext("CommandInput");
  const handleKeyDown: CommandInputProps["onKeyDown"] = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (event.key !== "Escape" || query === "") return;
    // "Filtering" means a non-empty trimmed query, as for the items and `CommandSeparator`: only
    // then does Escape consume itself. A whitespace-only query filters nothing; it is cleared too,
    // but the Escape also closes an enclosing overlay.
    if (query.trim() !== "") claimEscape(event.nativeEvent);
    setQuery("");
  };
  return (
    <div
      data-slot="command-input-wrapper"
      className={cn(commandInputWrapperBase, wrapperClassName)}
    >
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
      <BaseAutocomplete.Input
        {...props}
        aria-label={ariaLabel ?? label}
        onKeyDown={handleKeyDown}
        data-slot="command-input"
        className={mergeClassName(cn(comboboxInputBase, commandInputBase), className)}
      />
    </div>
  );
}

export type CommandListProps = BaseAutocomplete.List.Props;

/**
 * The listbox (`role="listbox"`, named by the Command's `label`): at most 20rem tall, scrolling.
 * Hidden while no item matches (it stays in the DOM so the input's `aria-controls` resolves), so
 * put `CommandEmpty` / `CommandLoading` beside it, not inside: a listbox may only own options and
 * groups.
 */
export function CommandList({ className, "aria-label": ariaLabel, ...props }: CommandListProps) {
  const { label } = useCommandContext("CommandList");
  return (
    <BaseAutocomplete.List
      {...props}
      aria-label={ariaLabel ?? label}
      data-slot="command-list"
      className={mergeClassName(cn(commandListBase, comboboxListBase), className)}
    />
  );
}

/** The plain text of React children, skipping `CommandShortcut` hints. */
function textOf(node: ReactNode): string {
  let text = "";
  Children.forEach(node, (child) => {
    if (typeof child === "string" || typeof child === "number") text += String(child);
    else if (isValidElement<{ children?: ReactNode }>(child) && child.type !== CommandShortcut) {
      text += textOf(child.props.children);
    }
  });
  return text;
}

export interface CommandItemProps
  extends Omit<BaseAutocomplete.Item.Props, "value" | "onSelect" | "children"> {
  children?: ReactNode;
  /**
   * The text the filter matches. Defaults to the item's text content (without its
   * `CommandShortcut`); pass it when the label is not plain text. It is also the item's Base UI
   * value, so it must be unique within the Command: two items with the same text need distinct
   * `value`s.
   */
  value?: string;
  /** Extra words the filter matches (synonyms, ids), never shown. */
  keywords?: readonly string[];
  /**
   * Runs the item (Enter on the highlighted item, or a click). In a `CommandDialog` the dialog then
   * closes, unless this calls `event.preventDefault()`.
   */
  onSelect?: (event: CommandSelectEvent) => void;
  /** Keeps the item reachable by the arrow keys but it cannot run. */
  disabled?: boolean;
}

/**
 * One command (`role="option"`, the menu item look). Rendered only while it matches the query.
 * Put a `CommandShortcut` last for a key hint. In forced colors the highlighted item is
 * Highlight / HighlightText.
 */
export function CommandItem({
  value,
  keywords = [],
  onSelect,
  disabled = false,
  onClick,
  className,
  children,
  ...props
}: CommandItemProps) {
  const { query, filter, store } = useCommandContext("CommandItem");
  const runDialog = useContext(CommandRunContext);
  const id = useId();
  const text = value ?? textOf(children);
  const search = query.trim();
  const matches = search === "" || filter(text, search, keywords);
  useLayoutEffect(() => {
    store.set(id, matches);
  }, [store, id, matches]);
  useLayoutEffect(() => () => store.delete(id), [store, id]);
  if (!matches) return null;
  return (
    <BaseAutocomplete.Item
      {...props}
      value={text}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (disabled || event.defaultPrevented) return;
        let prevented = false;
        const selectEvent: CommandSelectEvent = {
          nativeEvent: event.nativeEvent,
          preventDefault: () => {
            prevented = true;
          },
          get defaultPrevented() {
            return prevented;
          },
        };
        onSelect?.(selectEvent);
        if (!prevented) runDialog?.();
      }}
      data-slot="command-item"
      className={mergeClassName(cn(menuItemBase, commandItemBase), className)}
    >
      {children}
    </BaseAutocomplete.Item>
  );
}

export type CommandShortcutProps = ComponentProps<"span">;

/**
 * A key hint at the end of an item (plain `<span>`, `aria-hidden`, no behaviour), as
 * `MenuShortcut`. It is not part of the filter text.
 */
export function CommandShortcut({ className, ...props }: CommandShortcutProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      data-slot="command-shortcut"
      className={cn(commandShortcutBase, className)}
    />
  );
}

export type CommandGroupProps = BaseAutocomplete.Group.Props;

/**
 * Groups related items (`role="group"`), named by its `CommandGroupLabel`. Hidden while none of
 * its items matches the query.
 */
export function CommandGroup({ className, ...props }: CommandGroupProps) {
  return (
    <BaseAutocomplete.Group
      {...props}
      data-slot="command-group"
      className={mergeClassName("not-has-[[role=option]]:hidden", className)}
    />
  );
}

export type CommandGroupLabelProps = BaseAutocomplete.GroupLabel.Props;

/** A small muted heading that labels its `CommandGroup` (via `aria-labelledby`). */
export function CommandGroupLabel({ className, ...props }: CommandGroupLabelProps) {
  return (
    <BaseAutocomplete.GroupLabel
      {...props}
      data-slot="command-group-label"
      className={mergeClassName(comboboxGroupLabelBase, className)}
    />
  );
}

export type CommandSeparatorProps = BaseAutocomplete.Separator.Props;

/**
 * A hairline between groups (`role="presentation"`; CanvasText in forced colors). Not rendered
 * whenever the query is non-empty, so no stray line is left beside a hidden group. That holds even
 * under a custom `filter` that keeps every item: separators show only with an empty query.
 */
export function CommandSeparator({ className, ...props }: CommandSeparatorProps) {
  const { query } = useCommandContext("CommandSeparator");
  // Hidden while filtering: a non-empty trimmed query, the same rule as the items and Escape.
  if (query.trim() !== "") return null;
  return (
    <BaseAutocomplete.Separator
      {...props}
      data-slot="command-separator"
      className={mergeClassName(comboboxSeparatorBase, className)}
    />
  );
}

export type CommandEmptyProps = ComponentProps<"div">;

/**
 * The "no matches" message, in a polite live region (`role="status"`) that stays mounted and
 * speaks only while no item matches. The text defaults to "No results."; pass children to
 * localise it. Place it beside `CommandList`.
 */
export function CommandEmpty({ className, children = "No results.", ...props }: CommandEmptyProps) {
  const { store } = useCommandContext("CommandEmpty");
  const empty = useSyncExternalStore(store.subscribe, store.isEmpty, () => false);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      {...props}
      data-slot="command-empty"
      className={cn(comboboxEmptyBase, className)}
    >
      {empty ? children : null}
    </div>
  );
}

export type CommandLoadingProps = BaseAutocomplete.Status.Props;

/**
 * A muted status row (a polite live region) for async results. Render it while loading; the text
 * defaults to "Loading…". Place it beside `CommandList`.
 */
export function CommandLoading({
  className,
  children = "Loading…",
  ...props
}: CommandLoadingProps) {
  return (
    <BaseAutocomplete.Status
      {...props}
      data-slot="command-loading"
      className={mergeClassName(comboboxStatusBase, className)}
    >
      {children}
    </BaseAutocomplete.Status>
  );
}

interface ParsedShortcut {
  key: string;
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts.pop() ?? "";
  const has = (name: string) => parts.includes(name);
  return {
    key,
    mod: has("mod"),
    ctrl: has("ctrl"),
    meta: has("meta") || has("cmd"),
    shift: has("shift"),
    alt: has("alt"),
  };
}

function isApplePlatform() {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

function matchesShortcut(event: globalThis.KeyboardEvent, shortcut: ParsedShortcut) {
  const apple = isApplePlatform();
  const ctrl = shortcut.ctrl || (shortcut.mod && !apple);
  const meta = shortcut.meta || (shortcut.mod && apple);
  if (event.ctrlKey !== ctrl || event.metaKey !== meta) return false;
  if (event.shiftKey !== shortcut.shift || event.altKey !== shortcut.alt) return false;
  const key = event.key.toLowerCase();
  // With Alt (Option) held, `key` can be another character; fall back to the physical key.
  return key === shortcut.key || event.code.toLowerCase() === `key${shortcut.key}`;
}

const nonTextInputTypes = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Whether the target takes typing: a text input, textarea, select, contenteditable, or an ARIA textbox / combobox. */
function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target.matches("[role=textbox], [role=combobox]")) return true;
  return target instanceof HTMLInputElement && !nonTextInputTypes.has(target.type);
}

export interface CommandDialogProps extends CommandProps {
  /** Whether the dialog is open. Use with `onOpenChange` when controlled. */
  open?: boolean;
  /** Whether the dialog is initially open when uncontrolled. @default false */
  defaultOpen?: boolean;
  /** Called when the dialog opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * The keyboard shortcut that opens the dialog, as `modifier+key` (`mod` is ⌘ on Apple platforms
   * and Ctrl elsewhere; also `ctrl`, `meta`, `shift`, `alt`). Ignored while focus is in a field that
   * takes typing (text input, textarea, select, contenteditable, `role="textbox"` /
   * `role="combobox"`) and during an IME composition. `false` turns it off. @default "mod+k"
   */
  shortcut?: string | false;
  /** The dialog's visually hidden title. @default "Command menu" */
  title?: string;
  /** A visually hidden description of the dialog (`aria-describedby`), e.g. how to use it. */
  description?: ReactNode;
  /**
   * Classes for the dialog popup (`className` goes to the Command). The Command inherits the
   * popup's corner radius, so a radius or border override here keeps the search row's ring on the
   * corners.
   */
  contentClassName?: string;
}

/**
 * A `Command` in a Tessera Dialog: centred, no padding, at most 32rem wide, named by a visually
 * hidden title (and described by an optional visually hidden `description`), with the input focused
 * when it opens. The `shortcut` (⌘K / Ctrl+K) opens it from anywhere but a field that takes typing.
 * Running an item closes it (unless `onSelect` calls `event.preventDefault()`) and focus returns
 * where it was. Escape clears the query first, then closes it: the Escape that cleared the query
 * still propagates, and the dialog cancels its own close for that event.
 */
export function CommandDialog({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  shortcut = "mod+k",
  title = "Command menu",
  description,
  contentClassName,
  className,
  children,
  ...props
}: CommandDialogProps) {
  const [open, setOpen] = useControllableState(openProp, defaultOpen, onOpenChange);
  // The latest state for the document shortcut listener, updated after each commit (not in render).
  const latest = useRef({ open, setOpen });
  useLayoutEffect(() => {
    latest.current = { open, setOpen };
  });
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shortcut === false) return;
    const parsed = parseShortcut(shortcut);
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      if (!matchesShortcut(event, parsed)) return;
      if (isEditable(event.target)) return;
      event.preventDefault();
      if (!latest.current.open) latest.current.setOpen(true);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcut]);

  return (
    // Tessera's Dialog wraps `onOpenChange` in `useLayeredEscape`, which cancels the Escape close
    // that `CommandInput` claimed while clearing the query.
    <Dialog open={open} onOpenChange={(next) => setOpen(next)}>
      <DialogContent
        ref={popupRef}
        showCloseButton={false}
        initialFocus={() =>
          popupRef.current?.querySelector<HTMLElement>("[data-slot=command-input]") ?? true
        }
        className={cn("gap-0 overflow-hidden p-0 sm:max-w-lg", contentClassName)}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="sr-only">{description}</DialogDescription>
        ) : null}
        <CommandRunContext.Provider value={() => setOpen(false)}>
          {/*
           * The Command takes the popup's own radius: at least the radius of the popup's padding
           * box (radius minus border), where `overflow-hidden` clips, so the search row's inset
           * ring curves inside the clip, and it follows a `contentClassName` override.
           */}
          <Command {...props} className={cn("rounded-[inherit]", className)}>
            {children}
          </Command>
        </CommandRunContext.Provider>
      </DialogContent>
    </Dialog>
  );
}
