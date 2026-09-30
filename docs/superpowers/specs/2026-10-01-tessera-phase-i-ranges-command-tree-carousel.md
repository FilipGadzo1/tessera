# Tessera Phase I: Typed Ranges, Command, Tree and Carousel (Spec Addendum)

**Date:** 2026-10-01
**Status:** Claude made these decisions under the owner's standing delegation. The owner said: "IF thats intentional and will be fixed later then continue with the next phase" (the size-story question is answered in commit a7adf51).
**Builds on:**
- design-system-v2 §4:
  - focus uses `outline-none` + `toggleFocusClasses` + `forced-colors:focus-visible:outline-[Highlight]`;
  - selected Highlight/HighlightText + `forced-color-adjust-none`;
  - disabled → `cursor-not-allowed`;
  - motion and reduced motion.
- Phase C/D: the overlay pattern and `useLayeredEscape`.
- Phase E: Drawer.
- Phase G: Autocomplete (the command-palette story recipe) and Form.
- Phase H:
  - `src/lib/date-segments.ts`, DateField, `useDateFormControl`, `useFocusScope`, DatePicker `editable`;
  - DateRangePicker (a single Field control with `{ start, end }`);
  - Sidebar.

**Scope:**
1. Carry-overs.
2. `DateRangeField` and an `editable` DateRangePicker.
3. A first-class `Command` palette.
4. A `Tree` (WAI-ARIA APG treeview).
5. A `Carousel` (APG carousel).
6. A Files example.

**Scope rulings:**
- *Tree and Carousel are hand-built.* Base UI 1.8 has neither, and adding a dependency (Embla, React Aria) for one component each would break the "Base UI + Tailwind only" stack. Both follow the APG patterns (treeview; carousel with a rotation control), which carry the tricky accessibility. Cost if wrong: more code to own than a dependency would have been.
- *Carousel uses native CSS scroll-snap.* A scroll container with snap points handles touch and trackpad natively. JS only tracks the active slide (IntersectionObserver) and drives prev/next with `scrollTo`. There are no drag-physics or loop cloning. `loop` means prev on the first slide jumps to the last, and next on the last jumps to the first. Cost if wrong: no momentum-looped "infinite" carousel.
- *Command is built on Base UI Autocomplete, not cmdk.* It uses the Phase G command-palette recipe: an always-open list, items run actions, and the input filters. `CommandDialog` puts it in Tessera's Dialog. Cost if wrong: Base UI's filter instead of cmdk's fuzzy scoring. A custom `filter` is allowed.
- *DateRangeField is two DateFields in one group, not a new segment engine.* It reuses DateField's segments and keyboard. ←/→ at the end of the start date moves into the end date. Cost if wrong: none expected.

## 0. Carry-over (Task 0, first)

- **Default submit button lookup (Phase H parked).** DateField's Enter-submit (`date-field.tsx`, "default button" helper) uses `form.elements`, which excludes `<input type="image">`.
  - Find the default button per HTML: the first submit button in tree order among the form's descendants and form-associated controls (`[form=<id>]`). Include `button` with type submit or no type, `input[type=submit]` and `input[type=image]`. Do it in a small helper in `src/lib`, and unit-test it (image first, image disabled, `form=` outside, none).
- **A shared `mergeRefs` in `src/lib/merge-refs.ts`** (server-safe, no hooks).
  - It merges object and callback refs.
  - If any callback ref returns a cleanup (React 19), the merged callback returns a cleanup that calls them. The others are set to `null`, per React semantics.
  - Unit-test it. Then replace the ad-hoc merges in DateField, DatePicker's trigger, SidebarProvider, `combobox.tsx` (~416) and `tooltip.tsx` (~202), with no behaviour change; their suites guard it.
- **Drawer RTL:**
  - The close button uses `end-4` instead of `right-4`, and the footer alignment is logical.
  - `side` gains `"start" | "end"`, which map by the resolved direction (read as Sidebar does). The physical `left`/`right` stay as they are.
  - The Sidebar then uses `start`/`end` and drops its two workarounds: the edge→physical side mapping and the header's physical `pr-12`.
  - Tests: under `dir="rtl"`, the close button sits at the inline end, and `side="start"` opens from the right.
  - *Amended in Task 0*: how `start`/`end` resolve.
    - Drawer's root renders no element, so `DrawerContent` tells the root how to read the direction: an explicit `dir` on the content wins with no DOM read; otherwise it reads the computed `direction` of its portal container (default `<body>`), which is what the portalled panel inherits. The root reads it when the drawer is asked to open (its `onOpenChange(true)` handler, or the render in which a controlled `open` turns true), and once when `DrawerContent` mounts. All of these happen before the panel's first render, so it never re-resolves after mount.
    - Round 1 (fix): the first version read the direction from the mounted panel and corrected it afterwards ("corrects itself before it paints"). That was wrong: the correction was a style change on an element with `transition-transform`, so an RTL `start`/`end` drawer slid in from the wrong edge on its first open. A test samples the panel every frame from the click and pins the slide-in edge.
    - Consequences: the direction is read once per open, so a runtime `dir` change while the drawer is open is not reflected until the next open. In SSR (no read) `start` = left and `end` = right. The panel is portalled, so a `dir` on the trigger's own ancestors does not reach it (pass `dir` to `DrawerContent`, as the Sidebar does).
    - `data-side` and the swipe direction report the resolved physical edge.
    - The direction read is one shared helper, `isRtl(element)` in `src/lib/direction.ts`. Calendar, DateField, SidebarProvider and Drawer all use it.
    - The Sidebar's mobile Drawer passes `dir` (the provider's resolved direction) to its `DrawerContent`, because the panel is portalled out of the provider's row. The header padding is not dropped but made logical (`pe-12`): the header still has to clear the close button, which now sits at the inline end.
- **Sidebar state edge cases:**
  - Make `isStatic` per Sidebar: a counter, or a set of registered static sidebars, not a single boolean.
  - `useSidebar()` reports `state: "expanded"` when the only Sidebar is `collapsible="none"`; document the rule for mixed setups.
  - Test both.
  - *Amended in Task 0*: the rule.
    - The provider counts the mounted Sidebars (`registerSidebar`). The trigger and shortcut are inert, and `state` is `"expanded"`, only while every mounted Sidebar is `collapsible="none"` and there is at least one.
    - With any collapsible Sidebar mounted (a mixed setup), or with none, the provider's `open` decides. The trigger and shortcut then drive the collapsible Sidebars, and the static ones ignore `open`.
    - `open` itself is not rewritten: it stays the provider's own value (`state: "expanded"` with `open: false` is possible for a lone static Sidebar).
- *Amended in Task 0*: names and shape.
  - The default-button helper is `findDefaultButton(form)` in `src/lib/default-button.ts`. It scans the form's root (document or shadow root) for `button, input` whose form owner is the form. That is the HTML definition: tree order, and `form=<id>` counts wherever the control sits. A disabled default button is returned (the DateField then does not submit).
  - `mergeRefs` returns `undefined` when no ref returns a cleanup, so React still calls it with `null`. `useMergedRefs` (`src/lib/use-merged-refs.ts`, client) memoises it on the refs' identities. DateField, DatePicker's trigger, SidebarProvider and ComboboxChips use it, so their merged callback stays stable as before. TooltipContent keeps its own stable callback with the latest caller ref (insertion effect) and merges inside it with `mergeRefs`.
- **DateField RTL geometry test:** under `dir="rtl"`, the first segment's text starts at the Input's inline-start text position. Also test the editable picker's icon button at the inline end.
- Update the backlog: remove the resolved entries.

## 1. DateRangeField and the editable DateRangePicker

**`DateRangeField`:**
- **Props:** `value` / `defaultValue` / `onValueChange` (`DateRange`: `{ start: Date | null, end: Date | null }`), `min`, `max`, `isDateDisabled`, `locale`, `disabled`, `readOnly`, `required`, `name` / `startName` / `endName` (as DateRangePicker), `size`, `labels` (`start` "Start date", `end` "End date", plus the Phase H validity labels, plus `rangeReversed` "The end date must be on or after the start date.").
- **Structure:**
  - One group (`role="group"`, the text-field group look, `data-slot="date-range-field"`) containing two DateField segment sets, `data-slot="date-range-field-start"` and `-end`.
  - An `aria-hidden` en dash separator with spacing.
  - The inner group names: "Start date" / "End date", combined with the field label via `aria-labelledby`, like Phase H's segment naming.
- **Behaviour:**
  - ←/→ across the boundary move between the halves; RTL flips them.
  - Typing a complete start date moves focus into the end's first segment.
  - Paste of "2026-09-01 – 2026-09-12", "2026-09-01/2026-09-12" or two locale dates fills both.
  - `onValueChange` fires when either half changes to a complete valid date or to null. It reports the pair.
  - end < start is invalid (`data-invalid`, custom validity `rangeReversed`). It never auto-swaps; a typed range is the user's intent.
- **Form:** one registered control with the `{ start, end }` value, and one hidden input for `name`, as DateRangePicker has. It reuses `useDateFormControl` and Phase H's rules: Enter submits; the IME guard; blur via `useFocusScope` across both halves.
- **Implementation:** reuse DateField's internals. Extract a `DateSegments` internal from DateField if needed, so DateField and DateRangeField share the segment rendering and keyboard logic without duplicating it. Behaviour must not change (DateField's suite guards it).
- *Amended in Task 1*: what was built and recorded.
  - The shared internal is `useDateSegments` in `src/components/date-field/date-segments-control.tsx` (with `dateGroupBase`, `focusFirstEmpty`, `handleGroupMouseDown`, `useLabelFocusesFirstEmpty` and `useSubmitOnEnter`). It owns one date's segments (typing, the held year, the IME guard, the sync with the value) and renders the spinbuttons; focus movement (←/→, auto-advance, Backspace on an empty segment, the separator key) runs over every segment in a `navigationRef`, so a DateRangeField's two halves are one sequence. DateField uses it unchanged in behaviour (its suite passed unchanged at the refactor commit).
  - Paste, exactly (`parseDateRangeString` in `src/lib/date-segments.ts`): two ISO dates separated by "/", "–" (spaced or not), " - ", " to " or whitespace alone; or two dates `parseDateString` reads (the locale's numeric format, or ISO) separated by "–" (spaced or not), " - " or " to ". "to" is case-insensitive. An unspaced hyphen and a bare "/" between locale dates are not separators (both occur inside dates). A reversed range is kept as pasted. Anything else falls back to a single date, which fills only the half it is pasted into. A range paste reports the pair once.
  - The halves are `role="group"` elements with `aria-label` "Start date" / "End date" and `aria-labelledby` "own id + the field's label" ("Start date Stay"); each segment's `aria-labelledby` is "segment, half, field" ("month Start date Stay").
  - `name` names the one validating input, whose value is the ISO interval `YYYY-MM-DD/YYYY-MM-DD` (empty until both ends are set). The Field's name is only the `onFormSubmit` key and adds no native entry, as DateRangePicker. `startName` / `endName` are extra hidden inputs.
  - `labels.incomplete` (default "Enter a complete date range.") covers a half partly typed and a range with only one end, which is invalid at validation time as in DateRangePicker. The custom validity order is incomplete, then an end outside `min` / `max` / `isDateDisabled`, then `rangeReversed`.

**`DateRangePicker editable`:**
- As DatePicker `editable`: a DateRangeField plus a calendar icon button opening the two-month RangeCalendar.
- A typed complete range updates the calendar.
- Picking fills both halves, closes, and returns focus to the icon button.
- The discriminated union extends to DateRangePickerProps.
- *Amended in Task 1*: what was built.
  - `EditableShell` is shared by both pickers: it renders the field through `renderField` (a DateField or a DateRangeField, handed the native props, `focusScope`, the Field-aware `disabled`, `required`, `size` and the `pe-10` class) and the calendar through `renderCalendar`. The range picker's calendar is the existing `RangePickerCalendar`, so an unfinished pick is a draft that reverts on Escape, and only a complete pick fills the halves.
  - `DateRangePickerProps = DateRangePickerButtonProps | DateRangePickerEditableProps`, both exported. The editable variant forwards `startName` / `endName` to the DateRangeField (the picker still has no `name`).
  - Editable `onValueChange` follows DateRangeField's contract (a typed half reports the pair, so an end can be `null`); the button picker still reports only complete ranges.
  - Defaults: the icon button and the popup are "Choose date range". `DatePickerLabels` gains `start` / `end` / `rangeReversed` for the editable range picker; its `incomplete` there defaults to "Enter a complete date range.".
  - Width: two en-US dates plus the icon button need about 22rem at `lg`. The DateRangeField group is `min-w-max` (over the group's `min-w-0`) and the editable shell's anchor grows with it (`growToContent`), so in a narrower container the control grows past the container instead of painting its segments past its own border.
  - *Fix round 1*: with only the start typed (`{ start, end: null }`), the calendar gets that start, so one click picks the end (an earlier day swaps, per RangeCalendar) and fills both halves. A reversed typed range (end < start, invalid in the field) is passed to the calendar as `emptyRange`: no valid-looking band, and two picks fill both halves with a valid range.

## 2. Command

**Parts:**
- **`Command`:** the root. It wraps Base UI Autocomplete in always-open inline mode.
  - Props: `value`/`onValueChange` for the query, `filter`, `loop`, and `label` (accessible name, default "Command menu").
  - Layout: `flex flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground`.
- **`CommandInput`:** the search row. It has a leading SearchIcon and `border-b`, and the ring sits inside the header with rounded top corners matching the container. That fixes the Phase G "palette header ring clipped at the top corners" backlog item.
- **`CommandList`:** `max-h-80 overflow-y-auto p-1`, keeping the empty/`not-has` rules from Combobox.
- **`CommandItem`:** `menuItemBase`. It takes `onSelect`, `keywords` (extra filter text), `disabled` and a trailing `CommandShortcut`.
- **`CommandGroup` / `CommandGroupLabel` / `CommandSeparator`:** the forced-colors separator rule applies.
- **`CommandEmpty`:** "No results.", localisable.
- **`CommandLoading`:** a status row.
- **`CommandDialog`:**
  - A Tessera Dialog with `p-0`, sm:max-w-lg, a visually hidden DialogTitle "Command menu", and focus on the input when it opens.
  - `open` / `onOpenChange` / `defaultOpen`, and a `shortcut` prop (default `"mod+k"` = Ctrl/⌘+K, `false` to disable).
  - It ignores the shortcut when the target is editable.
  - Running an item closes the dialog unless `onSelect` calls `event.preventDefault()`.

**Behaviour:**
- ↑/↓ move the highlight (`loop` wraps), Enter runs the item, and Home/End go to the first and last items.
- Typing filters on label + keywords.
- Groups with no matches hide.
- The empty state is announced (live region, as Combobox).
- Escape clears the query first, then closes the dialog, via the layered Escape registry.

**Tests:**
- filtering, keywords and group hiding;
- keyboard highlight and loop;
- Enter runs `onSelect` and closes, and `preventDefault` keeps it open;
- the shortcut opens, and is ignored in inputs;
- the Escape sequence;
- focus on open and focus return on close;
- the header ring has rounded corners (a geometry assertion that the outline radius equals the container radius);
- axe light and dark with the dialog open;
- forced colors on the highlighted item.

Update the Autocomplete command-palette story to point at Command.

- *Amended in Task 2*: what was built.
  - Filtering is Command's, not Base UI's: the root is `Autocomplete.Root` with `open inline filter={null}` and no `items` (a composable item API has no item array to hand it). Each `CommandItem` matches itself (`filter(value, query, keywords)`; `value` defaults to its text content without the `CommandShortcut`) and is not rendered when it does not match, so Base UI's list navigation only sees the matches. The default filter is Base UI's `Autocomplete.useFilter().contains` over the text and each keyword; the query is trimmed and an empty query matches everything.
  - `CommandEmpty` is Tessera's own polite live region (`role="status"`, `aria-atomic`, always mounted, text only while no mounted item matches): Base UI's Empty needs `items`. The items report their match to a small store on the root; the empty text is held back until the root's first layout effect, so it never flashes on mount. `CommandLoading` is Base UI's Status with "Loading…" by default. Empty and Loading sit beside `CommandList`, since a listbox may own only options and groups.
  - `label` names the input and the listbox (a plain `div` root cannot carry `aria-label`).
  - `loop` defaults to `false` and maps to Base UI's `loopFocus`; `autoHighlight="always"` + `keepHighlight` keep the first match highlighted. Home/End are Base UI's own inline list navigation (the inline input is not treated as a typeable popup reference), verified by the tests; no extra code.
  - Escape (with or without modifiers): `CommandInput` clears a non-empty query and records that keydown; nothing stops the event (the `tooltip-escape.ts` contract). `CommandDialog`'s `onOpenChange` cancels an `escape-key` close for a recorded event (and allows propagation), as `yieldEscapeToTooltip` does, so the dialog closes on the next Escape. An enclosing overlay other than CommandDialog sees the first Escape too. *Fix round 1* (was: stopped the event).
  - `CommandSeparator` is not rendered whenever the query is non-empty, even under a keep-all custom `filter` (no stray line beside a hidden group); groups hide with `not-has-[[role=option]]:hidden`.
  - `onSelect` receives a `CommandSelectEvent` (`nativeEvent`, `preventDefault()`, `defaultPrevented`); a disabled item stays reachable (as in Autocomplete) but does not run.
  - Header ring: the search row is `rounded-t-[inherit]` with the inset ring, so it takes the Command's radius. In `CommandDialog` the Command is `rounded-[inherit]`: it takes the popup's own radius, which is at least the popup's padding-box radius (radius minus border) where `overflow-hidden` clips, so the inset ring curves inside the clip and follows a `contentClassName` radius or border override (*Fix round 1*; was a hardcoded `calc(var(--radius-xl)-1px)`). The tests assert the radii, including overridden and square popups.
  - `CommandDialog` also takes `title` (default "Command menu"), `description` (an sr-only DialogDescription, *Fix round 1*) and `contentClassName`; `initialFocus` targets the input. `CommandItem`'s `value` is its Base UI value, so it must be unique. The shortcut listener is on `document`; it ignores repeats, a `defaultPrevented` event, an IME composition, and targets that take typing (text-like inputs, textareas, selects, contenteditable, `role="textbox"` / `role="combobox"`); it only opens (the input is focused while open, so a second press is ignored as editable). `mod` is ⌘ on Apple platforms (by `userAgentData.platform`, else `navigator.platform`), Ctrl elsewhere.
  - In forced colors the highlighted item adds `bg-[Highlight] text-[HighlightText] forced-color-adjust-none`, and a `CommandShortcut` inside it turns HighlightText.
  - The Autocomplete `CommandPalette` story now renders a `CommandDialog`; its three tests follow the new Escape sequence and names.

## 3. Tree (APG treeview)

**Parts:**
- **`Tree`:** `role="tree"`, `aria-label`/`aria-labelledby`, `aria-multiselectable` when multiple.
  - Selection props: `selectionMode` (`"none"` default | `"single"` | `"multiple"`), `selectedValues` / `defaultSelectedValues` / `onSelectedValuesChange`.
  - Expansion props: `expandedValues` / `defaultExpandedValues` / `onExpandedValuesChange`.
  - `onAction(value)`, fired on Enter or double-click, e.g. to open a file.
- **`TreeItem`:**
  - Props: `value` (required, unique), `label` (text used for typeahead, defaulting to the text content), `disabled`, and children (a nested `TreeItem` makes it expandable).
  - Renders `li role="treeitem"` with `aria-level` / `aria-setsize` / `aria-posinset`, `aria-expanded` (parents), `aria-selected` (when selectable) and `aria-disabled`, over `ul role="group"`.
- **`TreeItemContent`:** the row, holding a chevron (rotates on expand, reduced-motion safe) and an optional `TreeItemIcon` slot.
- Each row is indented by level through a CSS var: `ps-[calc(var(--tree-level)*1rem+0.5rem)]`.

**Keyboard (APG):**
- ↑/↓ move through the visible items.
- → on a closed parent expands it; on an open parent it moves to the first child.
- ← on an open parent collapses it; on a child it moves to the parent.
- Home/End go to the first and last visible items.
- Typeahead jumps to the next visible item starting with the typed chars (500ms buffer).
- `*` expands all siblings.
- Enter fires `onAction`, and with selection mode single it also selects.
- Space toggles selection (multiple: Shift+↑/↓ extend; Ctrl/⌘+A selects all visible).
- Roving tabindex: exactly one `tabIndex=0`, on the focused item, else the first selected, else the first item.
- RTL flips ←/→.

**Styling:**
- The row uses `menuItemBase`-like hover `bg-accent`.
- Selected: `bg-primary-soft text-primary-soft-foreground`. Forced colors selected: Highlight/HighlightText + `forced-color-adjust-none`.
- Focus: toggleFocusClasses with `-outline-offset-2`, plus Highlight.

**Tests:** the full key table, typeahead, `*`, the selection modes, the controlled and uncontrolled pairs, the roving tabindex invariant, the ARIA attributes (level/setsize/posinset per item), RTL, disabled items (focusable, not selectable or actionable, per APG), forced colors, and axe light and dark.

## 4. Carousel (APG carousel)

**Parts:**
- **`Carousel`:** the root, `section` with `aria-roledescription="carousel"` and `aria-label`.
  - Props: `orientation` (horizontal default | vertical), `loop`, `index` / `defaultIndex` / `onIndexChange`, `autoplay` (off by default; `{ interval: 5000 }`), and `slidesPerView` via CSS on the items.
- **`CarouselContent`:** the scroll container, with `flex snap-x snap-mandatory overflow-x-auto scroll-smooth motion-reduce:scroll-auto` and scrollbar hidden. It has `aria-live="polite"` when not autoplaying and `off` while autoplaying (APG).
- **`CarouselItem`:** `role="group"`, `aria-roledescription="slide"`, `aria-label` "3 of 8" (localisable), and `snap-start shrink-0 basis-full`.
- **`CarouselPrevious` / `CarouselNext`:** buttonVariants outline icon, `aria-label` "Previous slide" / "Next slide", and `aria-controls` pointing at the content. They are disabled at the ends unless `loop`.
- **`CarouselDots`:** tab-like picker buttons "Go to slide N". The current one gets `aria-current="true"`.
- **`CarouselPlayPause`:** shown when `autoplay` is on; "Stop slide rotation" / "Start slide rotation".
  - Autoplay pauses on hover, on focus within, when the tab is hidden, and under `prefers-reduced-motion`. That last case is off-by-default rotation; the user can still start it explicitly.

**Behaviour:**
- The active index comes from IntersectionObserver (≥ 60% visible, first wins).
- Prev/next call `scrollTo` on the item's offset.
- ←/→ act on the focused content (↑/↓ when vertical); RTL flips them.
- Items that are off screen are `inert`, so Tab reaches only the visible slides' controls.

**Tests:**
- next/prev/dots update the index and `aria-label`s;
- the ends are disabled without `loop` and wrap with `loop`;
- controlled index;
- keyboard;
- RTL;
- autoplay advances (with an injectable timer, as the Checkout fake server does, no real waits), pauses on hover and focus, and the play/pause toggle;
- reduced motion: no smooth scroll and autoplay not started;
- off-screen slides inert;
- forced colors on the dots' current state;
- axe light and dark.

## 5. Docs

- Stories:
  - DateRangeField: Default, In Field invalid (reversed), Locales, Sizes (alignment check).
  - DateRangePicker: Editable.
  - Command: Inline, Dialog with ⌘K, Groups and shortcuts, Async loading.
  - Tree: File tree, Single select, Multi select, Controlled expansion, RTL.
  - Carousel: Basic, Loop, Multiple per view, Vertical, Autoplay with pause.
- `Tessera/Examples/Files`, a file manager:
  - a Sidebar app shell whose sidebar content is a `Tree` of folders (selection single, `onAction` opens a folder);
  - an inset showing the folder's files in a Table;
  - an image-preview `Carousel` for image files;
  - a filter Form with an editable `DateRangePicker` ("Modified");
  - a `CommandDialog` (⌘K) with "Go to folder…", "New folder", "Toggle sidebar".
- README: the component list and Phase I completion. The roadmap moves on to Phase J (candidates: data-grid pieces, Resizable panels, Stepper, Rating, Color picker, Calendar events view). Update the backlog.
