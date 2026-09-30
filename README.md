# Tessera

> A *tessera* is a single tile of a mosaic. Every component here is a tile; every project is a mosaic.

Filip's personal React component library — `@tessera/ui`. Local only (not published).

## Setup (first time)

```sh
npm install
npx playwright install chromium   # browser for Vitest browser mode
npm run check                     # should be all green
```

If the Chromium download times out, Playwright prints the exact download URL and revision it
tried — fetch that zip with `curl` and unpack it into `%LOCALAPPDATA%\ms-playwright\chromium-<revision>`
(the folder name Playwright expects), then re-run `npm run check`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Storybook docs + playground at **http://localhost:8080** |
| `npm test` | Component tests in real Chromium (Vitest browser mode + axe) |
| `npm run build` | Builds the library into `dist/` (tsdown) |
| `npm run check` | Palette contrast check + lint + typecheck + tests + build + consumer verification — run before every commit |
| `npm run format` | Biome format + safe lint fixes |
| `npm run palettes` | Regenerates src/styles/palettes.css and checks contrast |

## Stack

React 19 · @base-ui/react · Tailwind CSS v4 · cva + tailwind-merge · tsdown · Vitest 5 browser mode + Playwright + axe-core · Storybook 10 · Biome 2 · TypeScript 7

## Using Tessera in another project (locally, without publishing)

1. In `tessera/`: `npm run build && npm pack` → creates `tessera-ui-<version>.tgz`.
2. In your app: `npm install ../tessera/tessera-ui-<version>.tgz`
   (a tarball install copies files, so there is no duplicate-React problem that `npm link` causes).
3. In your app's main CSS:
   ```css
   @import "tailwindcss";
   @import "@tessera/ui/styles.css";
   ```
4. Use it:
   ```tsx
   import { Button, buttonVariants } from "@tessera/ui";

   <Button variant="outline" onClick={save}>Save</Button>
   <a href="/docs" className={buttonVariants({ variant: "link" })}>Docs</a>
   ```

Requirements: React 19, Tailwind CSS v4.

### Theming

~~~html
<html class="dark" data-primary="lapis" data-surface="slate">
~~~

- Primary: `malachite` (default) · `lapis` · `amethyst` · `carnelian`
- Surface: `marble` (default) · `slate` · `sandstone`
- Dark mode: a `.dark` class on an ancestor

**Custom brand colors.** The supported path is overriding the palette *scale* in an unlayered
`:root` (Tessera's tokens live in `@layer base`, so any unlayered rule wins):

~~~css
:root {
  --tsr-primary-50: oklch(0.975 0.018 300);
  /* … every step … */
  --tsr-primary-950: oklch(0.255 0.07 300);
  /* and/or --tsr-surface-0 … --tsr-surface-950 */
}
~~~

Every role follows the scale — resting, hover, active, soft, soft-hover, foreground, ring, the
`primary-*` / `surface-*` utilities — in light **and** dark, including nested `data-surface` scopes.
Keep the scale's lightness curve (600 carries white text, 400 carries its own 950) so contrast holds.
Overriding a single semantic token such as `--primary` changes only that one resting value: its
hover, active, soft and ring colors stay on the old palette, it has no separate dark value (with
`.dark` on `<html>` the `:root` value also wins in dark mode — add a later `.dark` rule for one), and
nested `data-primary` / `data-surface` scopes re-derive it from their own palette.
A nested `data-primary` scope likewise rebinds `--tsr-primary-*` to its own palette, so a `:root`
primary-scale override does not reach inside it (override the scale on that scope too).
`--radius` is a plain token and can be overridden on its own.

Token names are shadcn-compatible (`--primary`, `--muted-foreground`, `--ring`, …), so utilities
such as `bg-primary` or `text-muted-foreground` work unchanged. What does **not** carry over is an
existing shadcn color setup: Tessera defines the values, and an app's own `--primary` etc. override
only the individual resting colors as described above.

Limits and naming:

- Dark mode is one-way: there is no `.light` scope to switch a region back to light inside `.dark`.
- Card variants are `outlined` / `elevated` (MUI naming for surfaces); Button and Badge use
  `outline` (a variant of a colored control).

Palettes are generated — edit `scripts/generate-palettes.mjs`, then `npm run palettes`.

After changing Tessera, repeat steps 1–2 (bump `version` in package.json when you want a new tarball name).

## Adding a component

```
src/components/<name>/
  <name>.tsx            # "use client" if it uses hooks/state
  <name>-variants.ts    # cva classes, server-safe (optional)
  <name>.test.tsx       # Vitest browser tests incl. axe
  <name>.stories.tsx    # Storybook stories (tags: ["autodocs"])
  index.ts              # barrel
```
Export it from `src/index.ts` and run `npm run check` — `scripts/verify-consumer.mjs` discovers new
source files automatically (build output + `"use client"` directive checks).

## Components

- [x] Button
- [x] Badge
- [x] Card
- [x] Label
- [x] Input
- [x] Field (FieldLabel, FieldDescription, FieldError, FieldItem for one option of a radio or checkbox group)
- [x] Textarea (auto-grows with its content; `rows` sets the minimum height)
- [x] Checkbox (checked and indeterminate states; wrap in Label or use inside a Field)
- [x] CheckboxGroup (Base UI CheckboxGroup: shares an array of checked `value`s between Checkboxes, stacked with `gap-3`;
  `className="flex-row"` lays them in a row. `allValues` on a controlled group plus `parent` on one Checkbox makes a
  select-all that is indeterminate when partly checked. Name it with `<Fieldset render={<CheckboxGroup />}>` and a
  FieldsetLegend, or `aria-labelledby`; the checked values submit under each Checkbox's `name`)
- [x] Form (Base UI Form: a `<form>` with no styling of its own. `errors` takes server-returned errors keyed by Field `name`;
  Field/FieldError show them and clear them on change. `validationMode` is `onSubmit` (default), `onBlur` or `onChange`;
  `onFormSubmit(values)` gets the values as an object. DateField, DatePicker and DateRangePicker take part like Select:
  `required`, Field `validate`, `errors`, focus-first-invalid on the visible control, and `YYYY-MM-DD` values)
- [x] OTPField, OTPFieldInput, OTPFieldSeparator (Base UI `OTPField`: one input per character with typing, paste,
  Backspace and arrow keys handled for you. `length` is required; `<OTPField length={6} groups={[3, 3]} />` with no
  children renders the inputs (and a separator between groups), the first labelled by a surrounding `Field` and the
  rest "Character N of 6"; pass `OTPFieldInput` / `OTPFieldSeparator` children for your own layout. `onValueComplete`,
  `validationType` (`numeric` default, `alphanumeric`, …), `mask`, `autoSubmit`, `size` `sm` / `md` / `lg` (square slots
  at the Input heights). With a Field `name` the whole code submits as one value)
- [x] Collapsible, CollapsibleTrigger, CollapsiblePanel (one show/hide section. The trigger is a plain `<button>` with only a
  pointer cursor; compose it with `render={<Button variant="ghost" />}`, and Base UI sets `data-panel-open` on it for a
  rotating chevron (`group-data-panel-open:`). The panel animates its height like the Accordion panel (instant under reduced
  motion); `hiddenUntilFound` keeps it in the page for find-in-page)
- [x] Switch (on/off toggle; wrap in Label or use inside a Field)
- [x] RadioGroup, Radio (arrow keys move selection; render through a Fieldset so the legend names the group:
  `<Fieldset render={<RadioGroup />}><FieldsetLegend>…</FieldsetLegend>…</Fieldset>`; inside a Field,
  wrap each option in FieldItem)
- [x] Fieldset, FieldsetLegend (groups radios or Fields; a disabled Fieldset disables its RadioGroup;
  to mute the label text as well, set `disabled` on the surrounding `Field` — FieldLabel dims its text
  color, and the control keeps its own 50% opacity)
- [x] Tooltip (TooltipProvider, Tooltip, TooltipTrigger, TooltipContent; a raised chip on its own
  `--tooltip` / `--tooltip-foreground` / `--tooltip-border` tokens (`bg-tooltip text-tooltip-foreground
  border-tooltip-border`), not `--neutral` — `--neutral` flips to a near-white surface-50 in dark mode,
  which would make the tooltip read as an unstyled white box, so dark mode gives it its own
  surface-700 chip (surface-600 border) that still follows the active surface palette. No arrow.
  Compose the trigger: `<TooltipTrigger render={<Button size="icon" aria-label="Add" />}>`. Hover delay
  is set on the trigger or a TooltipProvider (`delay`, default 600 ms). The content gets
  `role="tooltip"` and the trigger `aria-describedby` while it is open — still give icon-only triggers
  an `aria-label`: tooltips don't reach touch users. Escape closes an open tooltip first, whether
  it opened on hover or focus, even inside a Tessera Dialog, AlertDialog, Popover, Menu or Select: the
  outer overlay stays open until the next Escape. That first Escape is not swallowed — your
  `document` / `window` keydown listeners receive it — but it arrives with `defaultPrevented ===
  true` (the tooltip handled it), so a listener that starts with `if (e.defaultPrevented) return`
  ignores it. The open-tooltip registry is global: any open Tessera tooltip anywhere on the page
  defers every Tessera overlay's Escape close. The outer overlay's own Escape close keeps Base UI's
  default of stopping the event it handles. Only Tessera overlay roots yield to the tooltip: inside a
  raw Base UI overlay, one Escape closes both)
- [x] Popover (Popover, PopoverTrigger, PopoverContent, PopoverTitle, PopoverDescription, PopoverClose;
  a `role="dialog"` panel on the popover surface, named by PopoverTitle and described by
  PopoverDescription. Compose the trigger and close: `<PopoverTrigger render={<Button variant="outline" />}>`.
  Opens on click, Enter or Space; Escape, an outside click or PopoverClose closes it and focus returns
  to the trigger. On open, focus moves to the first tabbable element inside (or the panel itself);
  change that with `initialFocus` on PopoverContent, and position against another element (not the
  trigger) with `anchor`. Controlled via `open` / `onOpenChange`)
- [x] Dialog (Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle,
  DialogDescription, DialogClose; a centred modal `role="dialog"` over a dimmed backdrop. DialogContent
  takes `size` (`sm` / `md` default / `lg`) and `showCloseButton` (default true: a ghost icon Button
  named "Close" in the corner). Focus moves to the first tabbable element and is trapped; page scroll
  is locked; Escape, a backdrop click or DialogClose closes it and focus returns to the trigger. Long
  content scrolls inside the dialog. The close button comes last in the tab order (it sits top-right
  visually) and scrolls away with the content in a long dialog; Escape always closes.
  `dialogVariants({ size })` gives the popup classes)
- [x] AlertDialog (AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogClose; `role="alertdialog"`
  styled like Dialog, with no close button. A backdrop click does not close it — Escape does. Put the
  choices in the footer: `<AlertDialogClose render={<Button variant="outline" color="neutral" />}>Cancel</AlertDialogClose>`
  and a confirm `<Button color="danger" onClick={…}>`)
- [x] Menu (Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, MenuGroup, MenuGroupLabel,
  MenuCheckboxItem, MenuRadioGroup, MenuRadioItem, MenuSub, MenuSubTrigger, MenuSubContent,
  MenuShortcut; a `role="menu"` on the popover surface, below the trigger and aligned to its start.
  Compose the trigger: `<MenuTrigger render={<Button variant="outline" />}>`. The arrow keys move the
  highlight (disabled items stay reachable but can't be activated), Enter activates an item and
  closes the menu, Escape closes it and focus returns to the trigger. `<MenuItem variant="danger">`
  marks a destructive action; checkbox and radio items stay open on toggle. A submenu opens on hover,
  click or ArrowRight and closes with ArrowLeft. `<MenuShortcut>⌘E</MenuShortcut>` is a visual hint,
  `aria-hidden` so it stays out of the item's name; when the app really handles the key, add
  `aria-keyshortcuts` to the MenuItem)
- [x] Separator (a 1px rule, `orientation` horizontal or vertical — vertical stretches to its flex
  row. Decorative by default (`role="none"`); `decorative={false}` gives `role="separator"` and
  `aria-orientation` when it divides content semantically. Server-safe)
- [x] Avatar, AvatarImage, AvatarFallback, AvatarGroup (a round picture, sizes `sm` / `md` / `lg`.
  The image shows only once it has loaded; until then, or if it fails, AvatarFallback shows its
  initials (uppercased) or an icon — `<AvatarFallback delay={600}>` avoids a flash on fast loads.
  Give AvatarImage an `alt`. AvatarGroup overlaps avatars with a background ring and is
  server-safe; pass it an `aria-label` / `role="group"` if the group needs a name)
- [x] Progress, ProgressLabel, ProgressValue (a `role="progressbar"` bar; `value={null}` is
  indeterminate — a sweeping third of the bar; under reduced motion a full-width, half-opacity bar
  that can't be read as a value. In forced colors the bar is painted in `Highlight` inside an
  outlined track. `min`, `max`, `format`
  (`Intl.NumberFormatOptions`), `color` (tone, default primary), `size` `sm` / `md` / `lg`.
  Children render in a row above the bar: `<Progress value={64}><ProgressLabel>Storage</ProgressLabel><ProgressValue /></Progress>`
  — the label names the bar; without one, pass `aria-label`)
- [x] Tabs, TabsList, TabsTab, TabsPanel (`<Tabs defaultValue="profile">` around a TabsList of
  TabsTabs and one TabsPanel per `value`. `variant` on TabsList: `underline` (default — text tabs on
  a rule with a primary indicator that slides to the active tab, instant under reduced motion) or
  `segmented` (a muted track with the active tab raised). In forced colors the indicator and the
  active segmented tab use `Highlight`. TabsTab reads the variant from its TabsList
  through context. Arrow keys move focus (looping; `loopFocus={false}` stops at the ends), Home/End
  jump; activation is manual (Enter/Space) unless TabsList has `activateOnFocus`. A disabled tab stays
  focusable (`aria-disabled`) but can never be activated. `orientation="vertical"` on Tabs puts the
  list beside the panels, with Up/Down arrows. Name the list with `aria-label`. The panel is focusable,
  so Tab from the active tab lands on it. Vertical layout classes are set with
  `data-[orientation=vertical]:` (e.g. the list's `gap-1`, the panel's `pt-0`) and outrank a plain
  className, so in vertical tabs prefix your overrides too: `className="data-[orientation=vertical]:gap-2"`.
  `tabsListVariants` / `tabsTabVariants` give the classes)
- [x] Accordion, AccordionItem, AccordionTrigger, AccordionPanel (`<Accordion defaultValue={["shipping"]}>`
  around AccordionItems, each holding an AccordionTrigger and an AccordionPanel; the value is an
  array of item `value`s. One item open at a time unless `multiple`. AccordionTrigger renders the
  heading and the button together and adds a chevron that turns when open; the heading is an `h3`
  unless you pass `headingLevel` (1–6) to fit the page outline, and other props go to the button.
  Enter/Space toggle it; there is no roving focus (Tab moves between triggers). The panel is a
  `role="region"` named by its trigger and animates its height (instant under reduced motion).
  `hiddenUntilFound` on Accordion keeps closed panels in the DOM as `hidden="until-found"`, so the
  browser's find-in-page opens the matching section; `keepMounted` keeps them mounted but hidden.
  A disabled item stays focusable (`aria-disabled`) but never opens. The panel clips its content for
  the animation but lets 4px paint past its sides (`overflow-clip-margin`), so focus rings of
  flush-left/right content aren't clipped and the panel never widens its scroll parent. Browsers
  without `overflow-clip-margin` (Safari, as of this writing) clip those rings at the sides)
- [x] Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectGroupLabel,
  SelectSeparator (`<Select items={{ en: "English", de: "Deutsch" }} name="language">` around a
  SelectTrigger holding `<SelectValue placeholder="Pick a language" />`, and a SelectContent of
  SelectItems. Pass `items` (value → label) so the trigger shows labels, not raw values. The trigger
  is a `role="combobox"` styled like Input, with the same `size` (`sm` / `md` default / `lg`) and a
  chevron; inside a `Field` the FieldLabel names it and an invalid Field gives it the danger border.
  The list drops down below the trigger (`side` bottom, `align` start, `sideOffset` 6, at least as
  wide as the trigger); `alignItemWithTrigger` on SelectContent opts into the macOS-style overlap.
  Opens on click, Enter, Space or ArrowDown; typing jumps to a matching item, Enter selects, closes
  and returns focus to the trigger. The selected item gets a check mark and `aria-selected`; a
  disabled item can't be chosen. `multiple` keeps the list open and joins labels with commas;
  SelectValue also takes a render function `{(value) => …}`. The value is submitted through a
  hidden input named by `name`. `selectTriggerVariants({ size })` gives the trigger classes)
- [x] Toaster, useToast, createToaster (wrap the app in `<Toaster>`; anywhere inside,
  `const toast = useToast()` then `toast.add({ title, description, type })`. `type` is `default`,
  `success`, `warning`, `danger` or `info`: toned types get a leading icon and a left accent.
  `actionProps: { children: "Undo", onClick }` adds an action Button — give such toasts
  `timeout: 0` or a longer timeout so people have time to act (WCAG 2.2.1). Toasts are announced
  politely (`priority: "low"`, the default); use `priority: "high"` only for urgent messages
  (failed save, lost connection) — it is announced assertively and hidden from browse mode until
  focused (F6).
  `toast.close(id)`, `toast.update(id, …)`, and `toast.promise(promise, { loading, success, error })`
  (a spinner, then success or `error` — styled as danger) come from Base UI's toast manager.
  Toaster props: `position` (`bottom-right` default, `top-right`, `bottom-center`, `top-center`),
  `limit` (default 3; older toasts hide), `timeout` (ms, default 5000; `0` or a per-toast
  `timeout: 0` keeps it until closed), `container`, `className` (the viewport). Toasts live in a
  polite `role="region"` named "Notifications"; hovering or focusing it pauses the timers and
  spreads the stack, F6 jumps into it, Escape closes a focused toast, and a swipe towards the edge
  dismisses one. Base UI hides each Close button from assistive tech until the stack is expanded or
  the button is focused. Outside React: `const toaster = createToaster()` at module level,
  `<Toaster toastManager={toaster}>`, then `toaster.add(…)` from anywhere — calls made before that
  Toaster mounts are dropped. Toasts sit on `--z-toast` (70), above dialogs and tooltips)
- [x] Skeleton (a pulsing `bg-muted` placeholder, `aria-hidden`; shape it with `className`, e.g.
  `size-12 rounded-full` for an avatar or `h-4 w-48` for a line of text. The pulse stops under
  reduced motion and stays visible (`GrayText`) in forced colors. Server-safe)
- [x] Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
  BreadcrumbEllipsis (a `nav aria-label="Breadcrumb"` landmark around an `ol` of crumbs; the current
  page is a `BreadcrumbPage` (`aria-current="page"`, not a link). `BreadcrumbSeparator` defaults to a
  chevron, hidden from assistive technology (`children` overrides it); `BreadcrumbEllipsis` collapses
  a run of crumbs — wrap it in a `MenuTrigger` to expand them. `BreadcrumbLink` takes a `render`
  element (a router `Link`, cloned onto rather than Base UI's `useRender`, to stay server-safe) in
  place of `<a>`. Server-safe)
- [x] Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious,
  PaginationNext, PaginationEllipsis, getPaginationRange (a `nav aria-label="Pagination"` landmark
  around a `ul` of page links, each styled like an outline (active, `aria-current="page"`) or ghost
  icon Button; in forced colors the active page is filled with `Highlight` / `HighlightText`.
  A `disabled` link is `aria-disabled`, dimmed, and drops its `href` and `onClick`, so it stays out
  of the tab order and ignores clicks; a `render` element (e.g. `<button type="button" />` for
  client-side paging) also gets `tabIndex={-1}` and keeps focus if it disables while focused.
  `PaginationLink` takes the same server-safe `render` escape hatch as `BreadcrumbLink`.
  `PaginationPrevious` / `PaginationNext` take `children` (visible text, default "Previous" /
  "Next") and `aria-label` (default "Go to previous page" / "Go to next page") to localise.
  `getPaginationRange({ page, pageCount, siblings, boundaries })` is a pure helper that collapses a
  long run of pages into `1 … 4 5 [6] 7 8 … 20` (never collapsing a single page — it shows that page
  instead, since hiding it saves no space). Server-safe)
- [x] Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption,
  TableSortButton (a `<table>` inside a horizontally-scrolling container — wide tables scroll instead
  of overflowing the page; `className` styles the `<table>`, `containerClassName` the wrapper.
  `TableHead` is `scope="col"` by default (override for row headers) and takes a `sort` prop
  (`"ascending" | "descending" | "none"`) that sets `aria-sort` (omitted when left `undefined`).
  `TableRow` highlights on hover and looks selected via `data-state="selected"` or `aria-selected`
  (in forced colors a selected row is filled with `Highlight` / `HighlightText`).
  `TableSortButton` is a presentational `<button>` for a sortable column header — no hooks, `onClick`
  and the current `direction` are the caller's, and it swaps its trailing icon (arrow-up / arrow-down
  / arrow-up-down) to match. Server-safe)
- [x] Slider, SliderLabel, SliderValue (Root → Control → Track → Indicator + one Thumb per value —
  a plain number or, for a range, a `number[]` with one Thumb each. `color` (tone) and `size`
  (`sm` | `md`, default `md`) match Progress; `SliderLabel`/`SliderValue` render in a row above the
  control, same as `ProgressLabel`/`ProgressValue`. Focus lives on each thumb's visually-hidden
  `<input type="range">`, so the ring is drawn on the thumb wrapper with `has-[:focus-visible]:`.
  A range slider's thumbs get distinct accessible names from `thumbLabels` (index-aligned with the
  value array); a single-thumb slider is named by its own `aria-label`/`aria-labelledby`, a
  `SliderLabel`, or a wrapping `Field`. Client component)
- [x] NumberField, NumberFieldGroup, NumberFieldInput, NumberFieldIncrement, NumberFieldDecrement,
  NumberFieldScrubArea (on Base UI `NumberField.*`. `<NumberField>` with no children renders the
  common stepper — `NumberFieldGroup` around `NumberFieldDecrement`, `NumberFieldInput`,
  `NumberFieldIncrement` — at the default size; pass children to compose the parts yourself, e.g. a
  non-default `size` on `NumberFieldGroup` or a `NumberFieldScrubArea`. The group looks like an Input
  (same heights per size) with a focus-within ring, since focus lives on the child input; the
  increment/decrement buttons are excluded from the Tab order (Base UI: the input already handles
  keyboard stepping) and come pre-named "Increase"/"Decrease". Supports `format`
  (`Intl.NumberFormatOptions`), `min`/`max`/`step`/`smallStep`/`largeStep`, `readOnly`, `disabled`,
  and works inside a `Field` (label names the input; invalid shows the danger border on the group,
  as does `aria-invalid` on a `NumberFieldInput` outside a `Field`). Client component)
- [x] Combobox, ComboboxInput, ComboboxTrigger, ComboboxClear, ComboboxContent, ComboboxList,
  ComboboxItem, ComboboxEmpty, ComboboxStatus, ComboboxGroup, ComboboxGroupLabel, ComboboxCollection,
  ComboboxSeparator, ComboboxValue, ComboboxChips, ComboboxChip, ComboboxChipRemove (on Base UI
  `Combobox.*`. Pass `items` to the root and a function child to `ComboboxList`; Base UI filters as
  you type — strings, `{ value, label }` objects, other objects via `itemToStringLabel` /
  `itemToStringValue`, or groups `{ value, items }` rendered with `ComboboxGroup` +
  `ComboboxCollection`; `filter={null}` + `onInputValueChange` for async results announced by
  `ComboboxStatus`. `ComboboxInput` looks like an Input (`size` `sm` / `md` / `lg`, focus-within
  ring) with a chevron trigger (`showTrigger`, default on) and a clear button (`showClear`);
  `className` styles the `<input>`, `groupClassName` the field. `multiple` uses `ComboboxChips` —
  chips from `ComboboxValue`, then a `ComboboxInput` — and the list anchors to the chips field.
  Only the input is in the Tab order (Base UI): trigger, clear and chip remove buttons are pointer
  affordances, chips are reached with ArrowLeft. Escape closes the list; on a closed combobox it
  clears the value (Base UI). Works inside a `Field` and a `Dialog`. Client component)
- [x] Autocomplete, AutocompleteInput, AutocompleteTrigger, AutocompleteClear, AutocompleteContent, AutocompleteList,
  AutocompleteItem, AutocompleteEmpty, AutocompleteStatus, AutocompleteGroup, AutocompleteGroupLabel,
  AutocompleteCollection, AutocompleteSeparator (on Base UI `Autocomplete.*`, sharing its look with the Combobox. An input
  that suggests as you type but keeps free text: choosing a suggestion only fills the input, so there is no selected state
  or check mark. `value` / `onValueChange` are the input text; `name` submits it. `mode` `both` / `inline` fills the
  highlighted suggestion into the input while arrowing, `filter={null}` + `AutocompleteStatus` is async search, groups use
  `AutocompleteGroup` + `AutocompleteCollection`. `AutocompleteInput` takes `size`, `showClear` and `showTrigger` (both off
  by default; both are pointer-only, out of the Tab order). For a command palette use `Command` / `CommandDialog`
  (below), built on it. Works inside a `Field`. Client component)
- [x] Command, CommandInput, CommandList, CommandItem, CommandShortcut, CommandGroup, CommandGroupLabel,
  CommandSeparator, CommandEmpty, CommandLoading, CommandDialog (a command palette on Base UI `Autocomplete` in inline
  mode: a search row over an always-visible list of actions. Compose
  `<Command><CommandInput /><CommandEmpty /><CommandList><CommandGroup><CommandGroupLabel>…</CommandGroupLabel><CommandItem onSelect={…}>…</CommandItem></CommandGroup></CommandList></Command>`.
  Typing filters on each item's text (its `value`, else its text content without the `CommandShortcut`) and its
  `keywords`, with Base UI's locale-aware "contains" (replace it with `filter(value, query, keywords)`); groups with no
  match hide, separators step aside while filtering, and `CommandEmpty` ("No results.", pass children to localise) is
  a polite live region. The first match is highlighted; ↑/↓ move (`loop` wraps, off by default), Home/End jump to the
  ends, Enter or a click runs `onSelect`, Escape clears the query. A `disabled` item stays reachable but does not run.
  `value` / `defaultValue` / `onValueChange` are the query; `label` (default "Command menu") names the input and the
  list. `CommandLoading` is a status row for async results. `CommandDialog` puts it in a Dialog (no padding, 32rem
  wide, a visually hidden title, the input focused on open): `open` / `defaultOpen` / `onOpenChange`, and `shortcut`
  (default `"mod+k"`, ⌘K on Apple platforms and Ctrl+K elsewhere; `false` turns it off) opens it from anywhere but a
  text field. Running an item closes it unless `onSelect` calls `event.preventDefault()`; Escape clears the query,
  then closes; focus returns where it was. In forced colors the highlighted item is Highlight / HighlightText. Client
  component)
- [x] Menubar, MenubarTrigger (Base UI `Menubar`: a `role="menubar"` bar of menus. Compose
  `<Menubar><Menu><MenubarTrigger>File</MenubarTrigger><MenuContent>…</MenuContent></Menu>…</Menubar>`: `Menu` needs no
  extra prop, Base UI detects the bar, and the content and items are the ordinary Menu parts (`MenuItem`,
  `MenuCheckboxItem`, `MenuSub*`, …). ←/→ move between triggers (one Tab stop), with a menu open they switch to the
  neighbouring menu, and hovering another trigger switches while one is open. `orientation`, `disabled` and `loopFocus`
  pass through. The open trigger is painted `bg-muted` (Highlight in forced colors). Give it an `aria-label`. Client
  component)
- [x] NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent,
  NavigationMenuLink (Base UI `NavigationMenu.*`: site navigation in a `<nav>`. Write List > Item > Trigger + Content
  (or a Link); `NavigationMenu` renders the popup itself, so each Content shows in one shared panel that animates to
  the new panel's size, and the content slides in from the side of the trigger it came from (fade only under reduced
  motion). Opens on click, Enter, Space, ArrowDown or hover after `delay`; Tab reaches each trigger and link, and
  moves into an open panel; Escape closes it and returns focus. `NavigationMenuLink` is a real `<a>`, sized like a
  trigger directly in the list and a padded row inside a panel: `active` sets `aria-current="page"` (underlined in the
  bar, medium weight in a panel), `render={<RouterLink … />}` swaps in a router link, `closeOnClick` closes the menu. A
  `NavigationMenu` inside a Content is an inline submenu (give it a `defaultValue`): vertical puts its list beside its
  content, horizontal above it. Give it an `aria-label`. Client component)
- [x] Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle,
  DrawerDescription, DrawerClose (Tessera's Sheet, on Base UI `Drawer.*`. A modal `role="dialog"`
  panel against an edge over a dimmed backdrop: `side` on the `Drawer` root — `right` (default),
  `left`, `bottom`, `top`, plus the logical `start` / `end` that follow the panel's writing
  direction (the `dir` of `DrawerContent`, else its portal container's, read before the panel opens; LTR in SSR; the close button sits at the inline
  end) — because Base UI's swipe direction is a root prop. Side panels are `w-3/4`
  up to `max-w-sm`; bottom/top sheets span the width up to 85% of the viewport height, and bottom
  sheets show a grab handle. DrawerContent takes `showCloseButton` (default true) and `container`,
  like DialogContent. Focus moves to the panel and is trapped; page scroll is locked; Escape, a
  backdrop click, DrawerClose or swiping the panel towards its edge closes it and focus returns to
  the trigger. Long content scrolls inside the drawer (`overscroll-contain`); the footer sits at the
  bottom via `mt-auto`, and the corner close button scrolls away with the content, as in Dialog —
  Escape always closes. Children render inside Base UI's `Drawer.Content`, so with a mouse, text
  can be selected and controls (e.g. a Slider) dragged without dismissing the drawer; the bottom
  handle and the panel's edges stay swipeable, touch swipes work anywhere. Slides in over 300ms,
  instantly under reduced motion.
  Tooltips and Dialogs inside take Escape first. Client component)
- [x] Meter, MeterLabel, MeterValue (Progress's twin — a `role="meter"` measurement within a known
  range, like disk usage or password strength, not task completion. Same props as Progress:
  `min`, `max`, `format` (`Intl.NumberFormatOptions`), `color` (tone, default primary), `size`
  `sm` / `md` / `lg`, and MeterLabel/MeterValue render in the same header row. No indeterminate
  state — `value` is required. `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-valuetext`
  come from Base UI; a MeterLabel names it, otherwise pass `aria-label`. Client component)
- [x] ScrollArea, ScrollBar, ScrollAreaRoot, ScrollAreaViewport, ScrollAreaContent, ScrollAreaCorner
  (custom, pointer-draggable scrollbars over native scrolling — wheel, touch and keyboard on the
  viewport keep working unchanged, the bars are visual plus draggable. `orientation` on
  `ScrollArea`: `vertical` (default), `horizontal`, or `both` (adds the corner). Base UI makes the
  viewport focusable (`tabIndex=0`) only when it overflows, so it never adds a dead Tab stop; a
  focus ring shows on keyboard focus. The bars fade in on hover or while scrolling
  (`data-hovering`/`data-scrolling`) and the thumb tracks the visible fraction of the content. For
  a custom layout, compose `ScrollAreaRoot`, `ScrollBar`, `ScrollAreaViewport`,
  `ScrollAreaContent` and `ScrollAreaCorner` directly — use Tessera's `ScrollAreaRoot`, not Base
  UI's own `ScrollArea.Root`: Tessera is pinned to `~1.8.0`, and a consumer's own, different copy
  of Base UI would not share React context with Tessera's other ScrollArea parts. Client
  component)
- [x] Toggle, ToggleGroup, ToggleGroupItem, toggleVariants (a two-state `aria-pressed` button —
  `variant` `ghost` (default) / `outline`, `size` `sm`/`md`/`lg`/`icon-sm`/`icon`/`icon-lg`,
  heights matching Button. `ToggleGroup` shares pressed state across `ToggleGroupItem`s (`value` is
  an array; `multiple` default `false`; roving focus with the arrow keys, one Tab stop), passing
  its `variant`/`size` down (items can override). With `variant="outline"` the group is attached
  (`gap-0`, items lose their inner radii and overlap borders by 1px; the focused item raises
  above its neighbours with `focus-visible:z-10`). Nested inside a `Toolbar`, `ToggleGroup` and
  `Toggle` detect it (Base UI) and defer to the toolbar's own roving focus — see `Toolbar` below.
  Client component)
- [x] Toolbar, ToolbarButton, ToolbarLink, ToolbarInput, ToolbarGroup, ToolbarSeparator (a
  `role="toolbar"` container — pass `aria-label` — with a single roving Tab stop; arrows cross
  every item, including a nested `ToggleGroup`, a `ToolbarLink` and a `ToolbarInput` (which keeps
  ←/→ for its own caret; Tab still leaves it). `ToolbarButton` is styled like a ghost, neutral, sm
  Button by default (`variant`/`color`/`size` override it) and composes with a popup trigger
  through `render`: `<ToolbarButton render={<MenuTrigger />}>` (also `PopoverTrigger`,
  `AlertDialogTrigger` / `DialogTrigger` / `SelectTrigger` per Base UI's docs) — the `ToolbarButton`
  is outer. A `Toggle` composes the other way: nest a plain `<ToggleGroup>` directly inside
  `<Toolbar>` with its `Toggle`/`ToggleGroupItem` children, no wrapper needed (verified against
  `@base-ui/react/toggle-group`'s source — see the spec's *Amended in Task 2* note).
  `ToolbarSeparator`'s own orientation defaults to the opposite of the toolbar's, so a horizontal
  toolbar gets a vertical divider and vice versa. `orientation` on `Toolbar`: `horizontal`
  (default) or `vertical`. Client component)
- [x] PreviewCard, PreviewCardTrigger, PreviewCardContent (Base UI's name for what other libraries
  call HoverCard — it also opens on keyboard focus, not just hover, so "hover" undersold it. The
  trigger is an unstyled `<a>`, like `MenuTrigger`; style it as any link, or compose with `render`.
  Opens after `delay` (default 600ms) on hover or immediately on focus, closes after `closeDelay`
  (default 300ms) on unhover or immediately on blur; Escape closes it, yielding first to a layered
  Tooltip open inside it. No arrow (Tooltip has none either). Client component)
- [x] ContextMenu, ContextMenuTrigger, ContextMenuContent (opens on right-click or long-press,
  positioned at the pointer. `ContextMenuTrigger` is an unstyled `<div>` drop-zone-like area —
  `data-slot` and, while open, `data-popup-open` to style it. Its items are the `Menu` parts
  unchanged (`MenuItem`, `MenuCheckboxItem`, `MenuRadioGroup`/`MenuRadioItem`, `MenuGroup`/
  `MenuGroupLabel`, `MenuSeparator`, `MenuSub`/`MenuSubTrigger`/`MenuSubContent`, `MenuShortcut`):
  Base UI's `ContextMenu.*` re-exports the same `Menu` item parts, so Tessera only adds the Root,
  Trigger and Content. `ContextMenuContent` doesn't size to an anchor width like `MenuContent`
  (`min-w-32` instead): its anchor is the whole trigger area, not one item. Base UI 1.8 has no
  keyboard opening for the trigger (checked its source: only `onContextMenu` / `onTouchStart` /
  `onTouchMove` are wired, no `keydown` handler) — *Amended in Task 3*, see the spec. Escape closes
  it and focus returns to where it was. A context menu should only duplicate actions reachable
  elsewhere. Client component)
- [x] Calendar, RangeCalendar (hand-built month grids — Base UI has no calendar primitive —
  following the WAI-ARIA APG date picker grid: a `role="grid"` table per month named by its live
  caption, one roving Tab stop (the focused, selected, today's or first enabled day), ←/→ days
  (flipped under `dir="rtl"`), ↑/↓ weeks, Home/End the locale's week, PageUp/PageDown months,
  Shift+PageUp/PageDown years, Enter/Space select; moving onto another month's day turns the page.
  The caption's month and year are buttons that open a month view (3 columns × 4 rows of months) and a
  year view (12 years at a time); choosing a year opens its months, choosing a month returns to the
  days with focus on the same day number; the year view's range button, or Escape, returns to the
  days (Escape without closing a surrounding DatePicker). Both views have the same arrow/Home/End/PageUp/PageDown keys and keep
  the day grid's size, so a popover never jumps.
  Dates are plain `Date`s standing for local days, no date library. `value` / `defaultValue` /
  `onValueChange`, `month` / `defaultMonth` / `onMonthChange`, `min` / `max` (days beyond are
  disabled and keys stop there; prev/next disable at the bounds), `isDateDisabled` (days stay
  focusable, `aria-disabled`), `locale` (default: the document's `lang`, then the browser's —
  caption, weekday names, full-date labels and week start all come from `Intl`), `weekStartsOn`,
  `showOutsideDays` (default true), `autoFocus`, and `labels` for the prev/next buttons, the
  caption buttons and the month/year views.
  `RangeCalendar` takes a `{ start, end }` value: the first pick sets the start, the second the end
  (swapped if earlier), a third starts over; while only the start is set the hovered or focused day
  previews the band. `numberOfMonths={2}` shows two months side by side with keyboard navigation
  running across both (the days between them aren't repeated as outside days). Pass `locale`
  explicitly when server-rendering; an inline Calendar's today marker is computed on the client.
  Client component)
- [x] DatePicker, DateRangePicker (a Select-styled trigger — same `size` scale and heights as
  Select and Input, a leading calendar icon — opening a Calendar in a Popover. DatePicker also has
  an `editable` mode (below), and so does DateRangePicker. Focus lands on the picked day (or today); picking closes and returns focus to the trigger, Escape
  or an outside click closes unchanged. `value` / `defaultValue` / `onValueChange`, `placeholder`,
  `format` (Intl options, default `{ dateStyle: "medium" }`), `locale`, `min` / `max`,
  `defaultMonth` (the month shown while nothing is picked, e.g. decades back for a birthday; a
  picked value's month wins, unlike `Calendar`, whose `defaultMonth` wins over the selected day),
  `isDateDisabled`, `weekStartsOn`, `disabled`, `required`, `open` / `defaultOpen` /
  `onOpenChange`, `container`, `labels` (`dialog`, the Calendar's labels and the validation
  messages), and `name` for a `YYYY-MM-DD` form value. Inside a `Field` the label names the trigger
  followed by the value ("Due date Sep 25, 2026"), the description describes it, and invalid /
  disabled apply. In a `Form` it validates like Select (Base UI's hidden-input recipe): `required`,
  Field `validate` (it gets the `Date`), a value outside `min` / `max` or on a disabled day
  ("Enter a date on or after Sep 1, 2026."; the date family's one rule: such a value is marked
  invalid at once, in every mode and in DateField, while a missing or partial value waits for
  validation), `errors[name]`, and an invalid submit focuses the
  trigger; `onFormSubmit` reports `YYYY-MM-DD` (`""` when empty). The custom validity also blocks a
  native `<form>` submit outside a Form. The trigger and popup are one blur boundary for
  `validationMode="onBlur"` (and Field `touched`): a blur is focus landing outside both, so
  Shift+Tab out of the calendar or an outside click (focus returns to the trigger) is not one, and
  Tab past the calendar is; every date control follows this rule. `DateRangePicker`
  shows two months (`numberOfMonths`), stays open after the start and closes after the end, reverts
  an unfinished pick on Escape or an outside click, reports only complete ranges, shows the range
  via `formatRange` ("Sep 1 – 12, 2026") and submits `startName` / `endName`. In a `Form` it is one
  control: `required` needs both ends, an end outside `min` / `max` or only one end set ("Choose
  both a start and an end date.") is invalid, Field `validate` gets the `DateRange`, and
  `onFormSubmit` reports `{ start, end }` under the Field's name
  (`<Field name="stay">` → `{ stay: { start: "2026-09-01", end: "2026-09-12" } }`). Native FormData
  entries come only from `startName` / `endName`, not from the Field's `name` (unlike DatePicker).
  The custom validity also blocks a native `<form>` submit outside a Form. `DatePicker editable`
  swaps the trigger for a typed, segmented DateField with a calendar icon button (`labels.openCalendar`,
  default "Choose date") inside its border, at the Input / Select heights. Typing a
  complete valid date updates the value and the month the calendar opens on; picking a day fills
  the segments, closes the popup and returns focus to the icon button. The DateField is the one
  Field / Form control (label names the group, first segment takes focus on an invalid submit), and
  `placeholder` / `format` are unused; `ref`, `className`, `id` and the other native props go to the
  DateField group (`DatePickerProps` is a union of `DatePickerButtonProps` and
  `DatePickerEditableProps`, so they are typed per mode; a runtime `editable={flag}` type-checks only
  while the other props fit both modes, so with a typed `ref` or element handlers branch instead:
  `flag ? <DatePicker editable ref={divRef} … /> : <DatePicker ref={buttonRef} … />`), `readOnly` disables the icon button, and
  the field, icon button and popup are one blur boundary for `validationMode="onBlur"`.
  `DateRangePicker editable` is the same with a DateRangeField (below) and the two-month
  RangeCalendar: the icon button is "Choose date range", a typed complete range shows selected in
  the calendar (which opens on the start's month), and picking both ends fills both halves, closes
  and returns focus to the icon button (an unfinished pick reverts on Escape); with only the start
  typed, one click picks the end (an earlier day swaps them). A reversed typed range stays invalid
  in the field and shows no selection in the calendar. The DateRangeField is
  the one Field / Form control and takes `startName` / `endName`; `onValueChange` then follows
  DateRangeField's contract (it also reports a typed half, so an end can be `null`): code written
  for the button mode, which only ever reports complete ranges, must guard `start && end` before
  using the range once it switches to `editable`, and
  `labels.start` / `labels.end` / `labels.rangeReversed` reach it. `DateRangePickerProps` is a
  union of `DateRangePickerButtonProps` and `DateRangePickerEditableProps`, as DatePicker's. It
  never shrinks below its content (about 22rem at `lg` for two dates and the button): in a
  narrower container it grows past it rather than overflowing its own border. No clear button:
  render a Button beside it. Pass `locale` explicitly when server-rendering; an inline Calendar's
  today marker is computed on the client. Client component)
- [x] DateField (a typed, segmented date input on React Aria's date-field pattern: a `group` of
  `spinbutton` segments in the locale's order — en-US mm/dd/yyyy, de-DE tt.mm.jjjj, ja-JP
  yyyy/mm/dd, ar-EG with Arabic-Indic digits — with the Input look and `size` heights. Digits type
  with auto-advance (month "2"–"9" or two digits, day "4"–"9" or two digits, four year digits; a
  year is reported once its four digits are in or on blur), ↑/↓ step with wrap (an empty segment
  starts at today's), PageUp/PageDown step month 1 / day 7 / year 10, Home/End jump to the
  bounds, Backspace/Delete clear (Backspace on an empty segment goes back), ←/→ (flipped in RTL)
  and Tab move, the separator key advances, Enter submits the enclosing form (not when read-only),
  and pasting a locale-formatted or ISO date fills every segment. Full-width digits (a CJK IME's
  ０–９) type like ASCII ones; an IME composition is ignored until it commits, then its text is typed. `value` / `defaultValue` / `onValueChange` (a `Date` once all segments form a valid
  day, `null` when a complete date is cleared; partial input never reports), `min` / `max` /
  `isDateDisabled` (outside them it is invalid, not blocked), `locale`, `disabled`, `readOnly`,
  `required`, `name` (submits `YYYY-MM-DD`), `size`, `labels` (segment names, "Empty", validation
  messages). Inside a `Field` the label names the group (clicking it focuses the first empty
  segment), the description describes it, and invalid / disabled apply. In a `Form` it validates
  like the pickers (`required`, `validate`, `min` / `max`, partial input "Enter a complete date.",
  `errors[name]`), and an invalid submit focuses its first segment. The custom validity also
  blocks a native `<form>` submit outside a Form.
  Pass `locale` explicitly when server-rendering. Client component)
- [x] DateRangeField (two DateField segment sets in one group with the Input look and `size`
  heights: the start, an aria-hidden en dash, the end. The halves are named "Start date" / "End
  date" followed by the field's label (`labels.start` / `labels.end`), and every segment types and
  steps as DateField's. ←/→ (flipped in RTL) and the auto-advance run across both halves, so a
  complete start date moves on into the end, and Backspace on the end's empty first segment goes
  back. Pasting a range fills both halves — two ISO dates separated by "/", "–", " - ", " to " or
  a space, or two locale dates separated by "–", " - " or " to " ("9/1/2026 – 9/12/2026") — and a
  single date fills the half it is pasted into. `value` / `defaultValue` / `onValueChange` take a
  `{ start, end }` range; `onValueChange` reports the pair whenever either half becomes a complete
  date or `null` (partial input never reports). An end before the start is invalid at once
  (`labels.rangeReversed`, "The end date must be on or after the start date."), never swapped.
  `min` / `max` / `isDateDisabled` check the two ends, plus `locale`, `disabled`, `readOnly`,
  `required` (both ends), `size` and `labels`. In a `Form` it is one control, as DateRangePicker:
  Field `validate` gets the `DateRange`, `onFormSubmit` reports `{ start, end }` under the Field's
  name, a half partly typed or one end missing is "Enter a complete date range.", an invalid submit
  focuses the first segment, Enter in either half submits and the halves are one blur boundary.
  `name` submits the ISO interval `YYYY-MM-DD/YYYY-MM-DD` natively (the Field's name adds no
  native entry), `startName` / `endName` each end. Client component)
- [x] Sidebar, SidebarProvider, SidebarTrigger, SidebarRail, SidebarInset, SidebarHeader, SidebarFooter,
  SidebarContent, SidebarSeparator, SidebarGroup, SidebarGroupLabel, SidebarGroupAction, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarMenuBadge, SidebarMenuSub,
  SidebarMenuSubItem, SidebarMenuSubButton, SidebarMenuSkeleton, useSidebar (a shadcn-shaped app shell:
  `<SidebarProvider><Sidebar>…</Sidebar><SidebarInset>…</SidebarInset></SidebarProvider>`. The provider holds
  `open` / `defaultOpen` / `onOpenChange` (persist it yourself, e.g. to localStorage, and pass it back as
  `defaultOpen`), sets `--sidebar-width` (16rem) and `--sidebar-width-icon` (3rem), and binds Ctrl/⌘+B
  (`shortcut={false}` turns it off; it is ignored while typing in an input, a textarea, a select or a
  contenteditable such as DateField). The shortcut listens on `window`, so keep it on for only one provider
  per page. From `md` up the Sidebar is an `<aside aria-label="Sidebar">` column — put a `<nav>` inside —
  sticky to the viewport, with `side` left/right, `variant` sidebar (bordered) / floating (a card) / inset (the
  page becomes a card) and `collapsible` offcanvas (slides out and is `inert`) / icon (a 3rem column of icons;
  menu buttons show their `tooltip`, labels stay in the accessible name) / none (static at every width; the
  trigger and shortcut do nothing while every Sidebar on the provider is static, so leave the trigger
  out; `useSidebar().state` is then always `"expanded"`, and in a mix of static and collapsible Sidebars
  `open` decides and drives the collapsible ones). `side` names the edge in a left-to-right
  layout and follows the writing direction: under `dir="rtl"`, `left` (the inline start) renders on the
  right, and its rail, off-canvas slide, icon-mode tooltips and mobile Drawer mirror with it. Below `md`
  the same children open in a `Drawer` from the column's edge, named "Sidebar".
  `SidebarTrigger` is a ghost icon button with `aria-expanded` / `aria-controls`; `SidebarRail` is a
  pointer-only 8px strip just outside the column's edge (over the page, never over the sidebar's buttons or
  scrollbar) that toggles, and reopens a collapsed off-canvas sidebar.
  `SidebarMenuButton` is a `<button>`, or a link via `render={<a href="…" />}`; `isActive` sets `data-active`
  (and `aria-current="page"` on a link); sizes sm / md / lg (32 / 36 / 48px). `SidebarContent` scrolls. The
  width animates over 200ms, instantly under reduced motion. The first render assumes desktop (server-safe);
  a phone switches to the Drawer after mounting. `useSidebar()` returns `{ state, open, setOpen, openMobile,
  setOpenMobile, isMobile, toggleSidebar }`. Client component)
- [x] Tree, TreeItem, TreeItemContent, TreeItemIcon (a hand-built WAI-ARIA APG treeview — Base UI has no
  tree. Compose `<Tree aria-label="Files"><TreeItem value="src/"><TreeItemContent><TreeItemIcon>…</TreeItemIcon>src</TreeItemContent><TreeItem value="src/index.ts">…</TreeItem></TreeItem></Tree>`:
  a `TreeItem`'s children are its `TreeItemContent` row (a direct child, or inside a fragment) and its child
  items: everything else renders in its group, so `TreeItem`s, recursive or wrapper components and fragments
  of items all work, and it is an expandable parent when a child treeitem actually renders. `aria-posinset` /
  `aria-setsize` are counted from the rendered items. `value` is required and unique across the tree.
  Collapsed children stay mounted in a hidden group. ↑/↓ move through the visible items, → expands
  then enters, ← collapses then goes to the parent (RTL flips them), Home/End, typeahead (500ms buffer, on
  `label` or the row text), `*` expands the siblings, Enter or a double-click runs `onAction(value)`. One Tab
  stop (roving tabindex: the last focused item while visible, else the first visible selected, else the first;
  a controlled collapse that hides the focused item moves focus to its nearest visible ancestor). `selectionMode`
  `none` (default) / `single` / `multiple` with `selectedValues` / `defaultSelectedValues` /
  `onSelectedValuesChange`: a click or Space selects (multiple: toggles), Enter also selects in single mode,
  Shift+↑/↓ and Shift+Home/End extend from the last toggled item and Ctrl/⌘+A selects every visible item. `expandedValues` /
  `defaultExpandedValues` / `onExpandedValuesChange`; the chevron toggles on click. A `disabled` item stays
  focusable but is not selected or actioned (a disabled parent still expands). Rows indent by
  `--tree-level`; selected rows are primary-soft, Highlight / HighlightText in forced colors, and disabled rows
  are GrayText there. Client component)

Phase A (foundation), Phase B (forms), Phase C (overlays), Phase D (navigation and feedback),
Phase E (data entry and display), Phase F (dates, toolbars and surfaces — Meter, ScrollArea,
Toggle/ToggleGroup, Toolbar, PreviewCard, ContextMenu, Calendar, RangeCalendar, DatePicker and
DateRangePicker) and Phase G (forms and navigation — Collapsible, CheckboxGroup, Form, OTPField,
Autocomplete, Menubar and NavigationMenu) and Phase H (DateField, editable DatePicker, form participation
for the date controls, and the Sidebar app shell) are complete.

Composition: when a part is rendered through another (`<Fieldset render={<RadioGroup className=…/>}>`),
the outer part's own classes win over conflicting classes on the render element (Base UI merges the
render element's className first; tailwind-merge keeps the last). Lay out children with a wrapper
instead — e.g. a horizontal radio group puts the radios in `<div className="flex flex-row gap-6">`
after the FieldsetLegend.

Overlays (Tooltip, Popover, Dialog, AlertDialog, Drawer, Menu, Select, Combobox, Autocomplete,
NavigationMenu) and the Toaster portal into `document.body`:

- Put theme scopes (`.dark`, `data-primary`, `data-surface`) on `<html>` so overlays pick them up.
- A scope on an inner element does not reach a portalled overlay — pass `container` (an element
  inside that scope) to the `*Content` part: `<TooltipContent container={scopeRef}>`.
  NavigationMenu takes `container` on the root: `<NavigationMenu container={scopeRef}>`.
- Add `isolation: isolate` to your app root so app z-indexes can't rise above overlays. Overlays
  use `--z-overlay` (50) and `--z-tooltip` (60), toasts `--z-toast` (70), overridable in an
  unlayered `:root`.
- Most triggers carry no styles: compose them with `render={<Button … />}`. `MenubarTrigger` and
  `NavigationMenuTrigger` are the exception: they are styled for their bar. Anchored `*Content` parts
  (Tooltip, Popover, Menu, Select) take the positioning props `side`, `align`, `sideOffset` (default 6),
  `alignOffset`, `collisionPadding` (MenuSubContent defaults to `sideOffset` 0, `alignOffset` -5 so
  its first item lines up with its trigger); dialogs are centred and take none.
- Menus, Selects, Popovers and Tooltips work inside a modal Dialog: they stack above it, stay interactive,
  and Escape closes the innermost overlay first.
- A dialog opened from a Menu item has no trigger of its own: control it with `open` /
  `onOpenChange` and pass `finalFocus` (a ref, or a function returning an element) to its
  `*Content` so focus returns somewhere sensible — usually the Menu trigger.

The Storybook story **Tessera/Examples/Project card** (`src/docs/examples/project-card.tsx`) composes
every overlay: Tooltips on icon Buttons, a members Popover, and a Menu that opens a rename Dialog and
a delete AlertDialog.

Forms: wrap named Fields in Tessera's `Form` for submit-time validation and server `errors`. The Storybook story **Tessera/Examples/Sign-up form**
(`src/docs/examples/sign-up-form.tsx`) composes every form control this way.

The Storybook story **Tessera/Examples/Settings** (`src/docs/examples/settings-page.tsx`) composes
the Phase D components: Tabs (Profile / Notifications / Billing) with an Avatar, Fields and a
language Select; an Accordion of notification channels holding Switches; Progress bars and
Separators for billing; and a "Save changes" Button that shows a success toast from `useToast()`.

The Storybook story **Tessera/Examples/Orders** (`src/docs/examples/orders-page.tsx`) composes the
Phase E components: a Breadcrumb (Home / Store / Orders); a toolbar with a customer Combobox and an
order-total range Slider; a Table sortable by Total (`TableSortButton` + `sort` on `TableHead`)
with Pagination under it (`getPaginationRange`, `<button>` page links through `render`); and a
right Drawer with the order's line items, opened from each row's "View" button, whose quantities
are NumberFields. The Drawer has no trigger of its own, so it is controlled and returns focus to
that row's button with `finalFocus`. A `loading` toggle swaps the rows for Skeletons and marks the
list `aria-busy`.

The Storybook story **Tessera/Examples/Editor** (`src/docs/examples/editor-page.tsx`) composes the
Phase F components in a "New post" editor card: a Toolbar holds a formatting `ToggleGroup`
(Bold/Italic/Underline, multiple), an alignment `ToggleGroup` (single) and an "Insert" `Menu`; the
body sits in a `ScrollArea` under a `ContextMenu` (right-click it) whose Format submenu reuses
`MenuCheckboxItem`s bound to the same toolbar state; the byline's `@name` is a
`PreviewCardTrigger` showing an Avatar card; a `Menubar` (File / Edit / View) tops the card and its View
checkbox items really hide the Toolbar and switch the body between wrapping and scrolling sideways; a "Publish on" `DatePicker` and an "Embargo"
`DateRangePicker` sit in a Field row; and a `Meter` reports the character count.

The Storybook story **Tessera/Examples/Checkout** (`src/docs/examples/checkout-page.tsx`) composes the
Phase G components: a `NavigationMenu` header (Shop and Help panels and a plain Orders link, none marked
current); a `Form` with contact Fields; a phone check whose "Send code" button reveals an `OTPField` (6 digits,
groups `[3, 3]`, `onValueComplete` shows "Phone verified"); a city `Autocomplete`; a delivery-options
`CheckboxGroup` with a "Select all" parent checkbox (gift wrap adds a row to the total); and a `Collapsible`
promo code. A fake server rejects the code `EXPIRED` after a short delay and the message comes back through the
Form's `errors`, under the promo Field, until the field is edited or the panel is closed. An order-summary Card
holds a `Collapsible` list of items.

The Storybook story **Tessera/Examples/Dashboard** (`src/docs/examples/dashboard-page.tsx`) composes
the Phase H app shell with earlier components: an icon-collapsible `Sidebar` (Ctrl/⌘+B; a Drawer below
`md`) with a workspace-switcher `Menu`, a nav whose current page has `aria-current`, and an account
`Menu` on an `Avatar`; an inset top bar with `SidebarTrigger`, `Breadcrumb` and a Search button that
opens the `Autocomplete` command palette in a `Dialog`; `Card`s with `Progress` and `Meter`; a filter
`Form` (an editable `DatePicker` and a `DateRangePicker`; Apply shows what `onFormSubmit` reported
under the Field names) and a `Table` of recent orders.

## Roadmap

Phase H is complete. Next, Phase I; candidates: DateRangeField, a first-class Command palette (the
Autocomplete story is a 40-line recipe today), Carousel, Tree, and data-grid pieces (column
visibility, pagination state).

Later: visual regression · React Compiler on output · publish to npm (`@tessera/ui` is free).
