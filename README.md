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
- [x] Switch (on/off toggle; wrap in Label or use inside a Field)
- [x] RadioGroup, Radio (arrow keys move selection; render through a Fieldset so the legend names the group:
  `<Fieldset render={<RadioGroup />}><FieldsetLegend>…</FieldsetLegend>…</Fieldset>`; inside a Field,
  wrap each option in FieldItem)
- [x] Fieldset, FieldsetLegend (groups radios or Fields; a disabled Fieldset disables its RadioGroup;
  to mute the label text as well, set `disabled` on the surrounding `Field` — FieldLabel dims its text
  color, and the control keeps its own 50% opacity)
- [x] Tooltip (TooltipProvider, Tooltip, TooltipTrigger, TooltipContent; inverted neutral bubble, no arrow.
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
  change that with `initialFocus` on PopoverContent. Controlled via `open` / `onOpenChange`)
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
- [x] Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle,
  DrawerDescription, DrawerClose (Tessera's Sheet, on Base UI `Drawer.*`. A modal `role="dialog"`
  panel against an edge over a dimmed backdrop: `side` on the `Drawer` root — `right` (default),
  `left`, `bottom`, `top` — because Base UI's swipe direction is a root prop. Side panels are `w-3/4`
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
  Dates are plain `Date`s standing for local days, no date library. `value` / `defaultValue` /
  `onValueChange`, `month` / `defaultMonth` / `onMonthChange`, `min` / `max` (days beyond are
  disabled and keys stop there; prev/next disable at the bounds), `isDateDisabled` (days stay
  focusable, `aria-disabled`), `locale` (default: the document's `lang`, then the browser's —
  caption, weekday names, full-date labels and week start all come from `Intl`), `weekStartsOn`,
  `showOutsideDays` (default true), `autoFocus`, and `labels` for the prev/next buttons.
  `RangeCalendar` takes a `{ start, end }` value: the first pick sets the start, the second the end
  (swapped if earlier), a third starts over; while only the start is set the hovered or focused day
  previews the band. `numberOfMonths={2}` shows two months side by side with keyboard navigation
  running across both (the days between them aren't repeated as outside days). Client component)
- [x] DatePicker, DateRangePicker (a Select-styled trigger — same `size` scale and heights as
  Select and Input, a leading calendar icon — opening a Calendar in a Popover; no typed date field.
  Focus lands on the picked day (or today); picking closes and returns focus to the trigger, Escape
  or an outside click closes unchanged. `value` / `defaultValue` / `onValueChange`, `placeholder`,
  `format` (Intl options, default `{ dateStyle: "medium" }`), `locale`, `min` / `max`,
  `isDateDisabled`, `weekStartsOn`, `disabled`, `open` / `defaultOpen` / `onOpenChange`,
  `container`, `labels` (`dialog`, `previousMonth`, `nextMonth`), and `name` for a hidden
  `YYYY-MM-DD` input. Inside a `Field` the label names the trigger followed by the value ("Due date
  Sep 25, 2026"), the description describes it, and invalid / disabled apply. `DateRangePicker`
  shows two months (`numberOfMonths`), stays open after the start and closes after the end, reverts
  an unfinished pick on Escape or an outside click, reports only complete ranges, shows the range
  via `formatRange` ("Sep 1 – 12, 2026") and submits `startName` / `endName`. No clear button:
  render a Button beside it. Client component)

Phase A (foundation), Phase B (forms), Phase C (overlays), Phase D (navigation and feedback),
Phase E (data entry and display) and Phase F (dates, toolbars and surfaces — Meter, ScrollArea,
Toggle/ToggleGroup, Toolbar, PreviewCard, ContextMenu, Calendar, RangeCalendar, DatePicker and
DateRangePicker) are complete.

Composition: when a part is rendered through another (`<Fieldset render={<RadioGroup className=…/>}>`),
the outer part's own classes win over conflicting classes on the render element (Base UI merges the
render element's className first; tailwind-merge keeps the last). Lay out children with a wrapper
instead — e.g. a horizontal radio group puts the radios in `<div className="flex flex-row gap-6">`
after the FieldsetLegend.

Overlays (Tooltip, Popover, Dialog, AlertDialog, Drawer, Menu, Select, Combobox) and the Toaster portal into
`document.body`:

- Put theme scopes (`.dark`, `data-primary`, `data-surface`) on `<html>` so overlays pick them up.
- A scope on an inner element does not reach a portalled overlay — pass `container` (an element
  inside that scope) to the `*Content` part: `<TooltipContent container={scopeRef}>`.
- Add `isolation: isolate` to your app root so app z-indexes can't rise above overlays. Overlays
  use `--z-overlay` (50) and `--z-tooltip` (60), toasts `--z-toast` (70), overridable in an
  unlayered `:root`.
- Triggers carry no styles: compose them with `render={<Button … />}`. Anchored `*Content` parts
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

Forms: there is no Tessera `Form` yet — use Base UI's `Form` (`@base-ui/react/form`) around named
Fields for submit-time validation. The Storybook story **Tessera/Examples/Sign-up form**
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
`PreviewCardTrigger` showing an Avatar card; a "Publish on" `DatePicker` and an "Embargo"
`DateRangePicker` sit in a Field row; and a `Meter` reports the character count.

## Roadmap

Phase G candidates: DateField, Menubar, NavigationMenu, Autocomplete, OTP field, Collapsible,
CheckboxGroup, Form, Sidebar/app shell.

Later: visual regression · React Compiler on output · publish to npm (`@tessera/ui` is free).
