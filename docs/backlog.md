# Tessera backlog

Open follow-ups from the foundation, Phase A (2026-09-23), Phase B, Phase C, Phase D (2026-09-24),
Phase E (2026-09-25), Phase F and Phase G (2026-09-26) and Phase H (2026-09-30) reviews.
None block current use.

## Components
- Soft / outline / ghost Button variants have no distinct `active` (pressed) color yet — only solid does.
- `CardTitle` heading semantics: a hook-free render prop that picks the heading level is not possible
  in a server-safe component, so the documented pattern is `<CardTitle role="heading" aria-level={3}>`
  (see the Card stories). Revisit if Card gains a client part.
- Button test: assert the loading spinner renders before the children.
- FieldError renders an empty node when `<Field invalid>` has no FieldError children (fix: apply
  the default `match` only when `children != null`).
- FieldError has no live region — `onBlur` errors are not announced until the control is refocused
  (consider an optional `aria-live`).
- Field blur-validation test should assert the error is absent before the Tab.
- Textarea: the `rows` min-height desyncs with custom padding, and with `rows < 2`.
- No `readOnly` styling test for the text fields (Input, Textarea).
- `read-only:bg-muted` also matches disabled inputs; in dark mode fields shouldn't sit on muted.
- Checkbox: the indicator may flash the check icon on an indeterminate→unchecked exit.
- Checkbox / Switch / Radio: `readOnly` keeps `cursor-pointer`.
- Switch (dark): unchecked hover thumb vs track ≈2.3–2.5:1 (hover-only; the track stays ≥3:1 vs the
  background).
- Label story lacks an `htmlFor` + Input pairing.
- RadioGroup has no story literally named `InField` (the Playground covers the Field composition).
- Sign-up example: the Card width is set via a wrapper element.
- `toneClass` is not exported publicly — export it when a consumer needs toned custom components.
- Project card example: member avatars are initials in tinted `<span>`s (and the Card width is set
  with a class) until an Avatar component lands (Phase D).
- Project card example: `MenuShortcut` hints (⌘L, F2) are decorative — no key handler is wired.
- Overlays: no Tessera helper for dialogs opened from a Menu item; each call site controls `open` and
  passes `finalFocus` (consider a documented pattern or a `DialogTrigger`-less helper).
- Tooltip: no `TooltipArrow` part (the spec chose no arrow); add one if a design needs it.

### Phase C final review — KEEP DEFERRED
- Tooltip: `TooltipContent` stores the caller's `ref` in an insertion effect, but the stable popup
  callback ref is not re-run if the caller swaps `ref` while the tooltip is open, so the new ref gets
  nothing until the next mount (fix: merged refs that re-attach on change).
- Dialog: the close button is last in the tab order (visually top-right) and scrolls away with the
  content in a long dialog (documented in the README). Consider a sticky-header option later.
- Dialog / AlertDialog: `aria-modal` and `data-size` are set after `{...props}` on purpose, so they
  are not overridable.
- `verify-consumer`: `inTypeGraph` matches declaration files by filename and ignores side-effect
  imports. Stricter: walk the import graph from `dist/index.d.ts`.
- Dialog: the backdrop is not customizable (no `backdropClassName`), and Base UI's nested-dialog
  styling hook (`data-nested-dialog-open`) is unused.
- Project card example: the deleted state's `role="status"` mounts together with its content, so
  the announcement is unreliable; moving focus to Undo mitigates it.

### Phase D notes (from the Phase C review)
- Toast (Task 5, done): `--z-toast: 70` plus verify-consumer needles (token, `z-(--z-toast)`, the
  `--toast-*` stacking utilities). Open: per-toast `className` / custom content (today a toast
  renders title, description, action and close only; `data` is unused), a typed `ToastType` on
  `add()` (it takes Base UI's `type?: string`), and a toast anchored to an element
  (`Toast.Positioner` / `positionerProps`). Base UI keeps an explicit `priority: "high"` toast
  `aria-hidden` but focusable until keyboard focus enters the viewport; axe reports that as
  `aria-hidden-focus` "needs review" (a dedicated axe test allows exactly that entry; the main
  Toast axe test is fully clean). Tessera never raises priority automatically (fix round 1, R6).
- Accordion panel ring room (Task 5): `overflow-clip-margin` is unsupported in Safari, so flush
  focus rings there are clipped at the panel's sides (no layout cost either way).
- Select (Task 4, done): reuses `popupSurface` / `popupMotion` / `menuItemBase`; the popup layer
  stays inline in SelectContent (Base UI's Select parts are their own components, so a shared
  `MenuPopupLayer` would not fit). `alignItemWithTrigger` defaults to `false` (drop-down below the
  trigger, `sideOffset` 6); callers can opt back in. The root wraps `onOpenChange` with
  `useLayeredEscape`. Open: a Tessera `SelectLabel` (Base UI `Select.Label`) for use outside a
  Field, and scroll arrows (`Select.ScrollUpArrow` / `ScrollDownArrow`) for very long lists.
- Tooltip Escape (Task 0, done): layered via a registry of open Tessera tooltips
  (`src/lib/tooltip-escape.ts`). Dialog, AlertDialog, Popover, Menu and MenuSub roots cancel an
  Escape close (`eventDetails.cancel()` + `allowPropagation()`, not forwarded to the caller's
  `onOpenChange`) while a tooltip is open or was open at keydown (a window-capture listener records
  the event without stopping it); the tooltip closes itself with reason `"escape-key"`. Remaining
  trade-offs: any new overlay root with Escape dismissal (Select, Combobox and Drawer do)
  must wrap its `onOpenChange` with `useLayeredEscape`, and a raw Base UI overlay around a Tessera
  Tooltip still closes on the same Escape (with the tooltip's trigger focused, too — the tooltip now
  lets the event propagate). A controlled Tooltip whose owner ignores `onOpenChange(false)` keeps
  outer overlays from closing on Escape while it stays open. A caller that calls `eventDetails.cancel()` in the Tooltip's
  `onOpenChange` keeps it registered as open (final review M2: the registry follows the final
  state). The outer overlay's own Escape close
  still stops propagation (Base UI default), so app listeners don't see that second Escape.
  The first Escape reaches app listeners with `defaultPrevented === true` (the tooltip's own close
  prevents default), so apps that bail out on `if (e.defaultPrevented) return` ignore it. The
  registry is global: any open Tessera tooltip anywhere defers every Tessera overlay's Escape close,
  not just overlays that contain it. The recorded keydown is cleared a macrotask after dispatch.
- Toast: while the stack is collapsed, Base UI keeps each Close button `aria-hidden` yet focusable,
  so axe reports `aria-hidden-focus` "needs review" on a resting toast. By design: keyboard focus
  entering the viewport expands the stack and lifts `aria-hidden` before a Close is reached (final
  review M8 pins both — a Tab test and an axe test of the resting stack that allows exactly those
  entries). Tessera adds no `tabIndex` / `inert` override. The main Toast and Settings example axe
  tests audit the expanded stack (hover), where it is clean.
- Settings example (Task 6): the Billing tab's "Change plan" Button has no handler; the Card width
  is set with a class; the profile Inputs are uncontrolled and are not part of the saved summary.

### Phase D final review — KEEP DEFERRED
- Test gaps from Task 0: AlertDialog layered Escape with the tooltip opened by keyboard focus (only
  Dialog and Popover cover the focus-trigger case); Popover and Menu have no "Escape with no tooltip
  open closes at once" baseline; non-Escape close reasons forwarded to `onOpenChange` are not
  asserted at component level; no controlled-`open` root tests for the layered-Escape wrappers.
- Tabs: vertical orientation lacks detail assertions (segmented list `h-auto` / `self-start`,
  underline tab `px-3`, panel `min-w-0`) and the stories do not expose `orientation` / `variant`
  as args.
- Accordion: no test for `headingLevel` 5 (only the default and one other level), and the TOP
  edge of a panel's first focus ring is still clipped (`overflow-clip-margin` only relieves the
  sides), in addition to the Safari side-ring clipping noted above.
- Select: the trigger's read-only styling is derived from the Input classes by a string replace;
  it is guarded only by the Input-parity test (a shared token would be sturdier).
- Overlays: positioners (Tooltip, Popover, Menu, Select) are not caller-stylable (no
  `positionerClassName`), e.g. to change the z-index of one instance.
- Toast: the Positions story ignores its `position` arg (it renders fixed buttons per position);
  the Close button's `aria-label="Close"` is hardcoded (no i18n prop); Base UI pauses toast timers
  while the window is blurred (the timer tests assert `document.hasFocus()` so a headed run with
  another window in front fails fast instead of timing out).

### Phase E notes
Minor review findings deferred during Phase E (each re-checked against the code at the end of the
phase; items fixed by a later commit are left out).
- Forced-colors focus tests (Task 0): the Select item "no outline before ArrowDown" check is
  conditional (`if (!…hasAttribute("data-highlighted"))`), so it can pass vacuously;
  `forced-colors-focus.test.tsx` casts `role as "button"`; an invalid Switch's forced-colors
  outline (1px idle / 2px focus) is untested; Accordion and Toast tests still send their own
  reduced-motion CDP command instead of `test/emulation.ts`; `systemColor` has no return type.
- Class strings (Task 1): cosmetic order differences against the spec's strings.
- Table (Task 2): `TableHead` sets `aria-sort={sort}` after `{...props}`, so a caller's own
  `aria-sort` is always overridden (even with `sort` unset) — document it or spread last. The
  Sortable / Selectable stories hold their state logic inline.
- Slider (Task 3): `thumbLabels` shorter than the values gives the extra thumbs an empty name; a
  single-thumb slider ignores `thumbLabels` (the doc says ranges only); the disabled test never
  tries to interact; the `slider-header` wrapper is not in the spec.
- NumberField (Task 4): with `readOnly` the stepper buttons keep the pointer cursor and hover;
  disabled buttons are dimmed twice (group and button `opacity-50` → 0.25); the "commits and
  formats" test does not exercise a format; the clamp test never tries to pass the bound (it stops
  when the button disables); group sizes are copied from `textFieldSizes`, not derived.
- Combobox (Task 5): inside a `Field`, an `aria-label` on the trigger is ineffective (Base UI's
  `aria-labelledby` wins; worth documenting); the AsyncWithStatus story mounts `ComboboxEmpty`
  conditionally and its `.catch(() => {})` swallows errors; the InDialog story has no axe test;
  `ComboboxChips` with `aria-invalid` outside a `Field` is untested.
- Drawer (Task 6): the RightWithForm story's body lacks `flex-1`; the drag tests cast
  `dragAndDrop` options; the header keeps `pr-12` with `showCloseButton={false}`; no mutation
  checks for `aria-modal`, `useLayeredEscape` or the `transform` swipe binding.
- Orders example (Task 7): `test/overlay.ts` `auditOpenOverlay` now accepts a Base UI inert marker
  on an ancestor for an `aria-hidden` element whose parent holds an `[aria-live]` region and which
  holds none itself (Base UI keeps such regions, e.g. Slider's `<output>`, and their ancestors
  exposed behind a modal and hides their other children), and re-checks `elmPartiallyObscuring`
  contrast inside an open modal with the hidden page made invisible, only when the popup is topmost
  at the text's rects; all unit-tested in `test/overlay.test.ts`. The topmost check uses
  `elementsFromPoint`, which skips `pointer-events: none` layers above the modal. The example's "Save changes" is
  local state only, the breadcrumb links are `#`, and its axe tests run at a 1024px viewport (at
  414px axe cannot decide the contrast of table cells scrolled out of view).
- Orders example (Task 7 review): the story's claim that Escape or Cancel discards the drawer's
  draft quantities is untested; the "Showing 1–5 of 36 orders" result count is not a live region,
  so filter changes are not announced; the filters, sort and pager stay interactive while
  `loading`; the loading skeleton rows shift the column widths when the data arrives; on mobile
  widths the range Slider's thumbs overhang the card edge; `orders-page.tsx` is ~468 lines (split
  the filters / table / drawer into local components).
- Pagination (final review): `getPaginationRange` returns 4–7 items depending on the page, so the
  pager's width changes as the user pages (the Previous/Next controls move); consider an optional
  steady-width mode that always returns the same count (padding with extra pages near the edges).

### Phase F notes
- Calendar / DatePicker (final review I1, SSR/hydration): `calendar-base.tsx` resolves the locale
  from `document.documentElement.lang` and computes "today" during render (`resolveLocale`, moved
  to `src/lib/date.ts` in Phase H, and `calendar-base.tsx`'s `today` local; `date-picker.tsx`'s
  pickers inherit both through `Calendar`/`RangeCalendar`, and DateField shares `resolveLocale`).
  When a client component is server-rendered, the server (no
  `document`, no reliable "now") and the client can disagree, causing a hydration mismatch. The
  README and the `locale` prop's JSDoc now say to pass `locale` explicitly when server-rendering.
  Real fix later: a `today` prop (so the caller controls it, e.g. from a server-computed value), or
  compute "today" in an effect instead of during render.
- Calendar (final review I2): the visible month doesn't follow a controlled `value` changed after
  mount on the standalone `Calendar` (`DatePicker` is covered — it always shows the picked day's
  month once open). A caller that controls `value` and jumps it far from the visible month must
  also update `month` itself.
- `date.ts` (final review I2): years 0–99 are handled inconsistently — `parseISODate` keeps them
  literal (via `setFullYear`), but the `Date(year, month, day)` constructor used elsewhere (e.g.
  `toDay`, `addDays`) maps a 0–99 year to 1900–1999, per the spec. A round trip through
  `parseISODate` then any other helper can silently jump a century for such years. (DateField, Phase
  H, builds its dates with `setFullYear` and never passes them through those helpers, so a typed
  year 4 stays year 4; its `min`/`max` checks use `compareDay`, which reads the fields directly.)
- Calendar (final review I2): the two-month Tab-stop fallback (`CalendarBase`'s `firstEnabledDay`)
  only searches the first visible month, so with `numberOfMonths={2}` and every day of the first
  month disabled, the Tab stop can land on a disabled day instead of falling through to the second
  month.
- Calendar (final review I2): with `numberOfMonths={2}`, both months render their own `aria-live`
  caption, so a month change that touches both (e.g. jumping a year) can announce twice.
- Calendar (final review I2): no test asserts that a controlled `month` which ignores
  `onMonthChange` (the app keeps `month` fixed) is respected — i.e. that the calendar doesn't
  silently move anyway.
- Calendar (final review I2): no test exercises the prev/next month buttons' cursor (`min`/`max`
  disable them at the bounds) directly — only keyboard clamping is covered.
- DateRangePicker (final review I2): a partial controlled range (only `start` set, passed via
  `value`) isn't reverted on Escape or an outside click the way an uncontrolled in-progress pick
  is — `RangePickerCalendar`'s draft-drop logic only clears its own internal draft, not a
  caller-controlled `value`.
- DatePicker (final review I2): a caller's own `aria-invalid` on the trigger doesn't set
  `data-invalid` (only the Field's `invalid` state does), so the invalid border only applies
  through a Field, not a bare `aria-invalid` prop.
- ToggleGroup (final review I2): vertical attached geometry (`variant="outline"` +
  `orientation="vertical"`) has no test — only the horizontal attached case
  (`attachedClasses.vertical` in `toggle.tsx`) is exercised.
- Tooling (final review I2): `test/pointer.ts` parks the real pointer at `(0, 0)` between tests,
  which collides with hover fixtures rendered at the page origin (see the `m-4` workaround note in
  `scroll-area.test.tsx`'s `TallList`). A fixture that must sit at the origin needs its own
  workaround; there's no general fix yet.
- Editor example (final review I2): the formatting/alignment `ToggleGroup` state is cosmetic —
  toggling Bold/Italic/Underline or the alignment doesn't style `bodyParagraphs`' rendered text (no
  real rich-text engine backs the example). The byline avatar loads from an external host
  (`i.pravatar.cc`), which is fine for a Storybook example but not for an offline/CSP-restricted
  build.
- DateRangePicker (Task 5): a range may span disabled days (`isDateDisabled`, e.g. weekends or
  booked nights). Only the two ends are checked (each must be an enabled day); the days between
  are not validated, and the picker accepts the range. A caller that needs contiguous availability
  validates in `onValueChange`. Possible later: an `allowsNonContiguousRanges`-style prop.
- DatePicker / DateRangePicker (Task 5): no built-in clear button (spec §3, YAGNI; render a Button
  beside the picker that sets the value to `null` / `{ start: null, end: null }`).
- DatePicker / DateRangePicker / DateField (Task 5; Phase H Task 2): Field and Form wiring uses four Base UI
  internals (`@base-ui/react/internals/field-root-context`, `…/internals/labelable-provider`,
  `…/internals/field-register-control` and `…/internals/form-context`, the last two in
  `src/components/date-picker/date-form-control.tsx`, which follows `SelectRoot.js`'s hidden-input recipe); they are
  in the package's `exports` but undocumented, so a Base UI upgrade can move or change them. The Field tests (label
  name, description, invalid, disabled) and the date-control tests in `src/components/form/form.test.tsx` (required,
  `validate`, `errors`, `onFormSubmit` values, focus-first-invalid, FormData) are the guard. Before bumping Base UI,
  re-read `SelectRoot.js` / `useRegisterFieldControl` and run those tests against the new version; the range is pinned
  to `~1.8.0` because of this (a minor that moved any subpath would break every import from Tessera, since
  `src/index.ts` re-exports the date controls). Two more pins on the same upgrade (Phase H): the Sidebar's
  `@base-ui/react/unstable-use-media-query` (`sidebar-context.tsx`; `unstable_`, so it can change or go in any
  release), and `useFocusScope`'s reliance on Base UI's `data-base-ui-focus-guard` attribute and its guards
  sending Shift+Tab from a non-modal popup back to the trigger (`date-form-control.tsx`; the form.test.tsx
  Shift+Tab / outside-click tests are the guard).
- Editor example (Task 6): `ContextMenu` marks the rest of the page inert while open (Base UI's
  `data-base-ui-inert` on the background), so a test that picks a Format submenu item and then
  checks the toolbar's mirrored `ToggleGroup` state must close the context menu first — the
  toolbar's buttons are unreachable by role while the menu (or its submenu) is open. `Meter`
  formats `MeterValue`'s `formatted` argument as a percentage by default; getting a raw formatted
  count ("1,240") for the character Meter needs an explicit `format={{}}` (or other non-percent
  `Intl.NumberFormatOptions`) on `Meter` itself, not just a custom `MeterValue` render function.

### Phase G notes
- Checkout example (Task 7): `ContextMenu` cannot be opened from the keyboard (Base UI opens it on `contextmenu`
  only).
- Autocomplete (Task 7, upstream): with the input outside the popup, Base UI's focus manager treats the open
  list as modal and marks the rest of the page `aria-hidden` while its buttons and inputs stay focusable, which
  axe reports as `aria-hidden-focus` on any page with other controls. The Checkout test audits the open list with
  the header and main content hidden for that reason; a Base UI upgrade may change it.
- Checkout example (Task 7): the fake server only knows the code `EXPIRED`. The delivery option label
  includes its price note, so its accessible name is "Gift wrap +€3.00".
- NavigationMenu (Task 7): an open panel covers page text, so axe leaves that text's contrast undecided
  (`incomplete`). The Checkout test hides `main` for the open-panel audit; the closed page is audited whole.
- Deferred minors from the Phase G review (test gaps and polish, none blocking):
  - T0: the submenu-settle helper is duplicated in the menu and context-menu tests.
  - T1: no function-form `className` test for CheckboxGroup / CollapsibleTrigger; focus tests only cover the
    Button-composed trigger; the CheckboxGroup Tab test lacks the 2px assertion; a disabled group's click is
    not asserted.
  - T3: the cursor test only reads the computed cursor (not the class).
  - T4: the palette header ring is clipped at the top corners; the forced-colors item ring colour is not
    asserted; no axe run on the open command palette; a fragile `querySelector('button')`; `AsyncMovies`
    has `.catch(() => {})`.
  - T5: the tooltip-layering test does not assert the tooltip was shown; vertical Menubar arrow keys are untested.
  - T6: links written directly in a nested vertical `NavigationMenuList` get the panel style; the bar-link
    active underline is not asserted in forced colors.
  - T5: `menubar.test.tsx` (~line 172, the arrow-key roving test) has one synchronous `document.activeElement`
    check right after a key press, where its neighbours use `expect.poll`.
  - T7: the OTPField paste test is synthetic (a dispatched paste event, not a real clipboard paste).
  - T7: the Checkout Apply error stays sticky until the code is edited (or the panel closes); no test covers it.

## Theming
- No `.light` scope: a region cannot switch back to light inside `.dark` (documented limit).

## Storybook
- The palettes story id is `tessera-palettes--role-tokens` while the Phase A plan's smoke test says
  `--roles` (historical plan inconsistency; the plan is not updated). Harmless.
- Storybook build prints a `MODULE_LEVEL_DIRECTIVE` and a >500 kB chunk warning (Storybook internals).

## Tooling
- `.d.ts.map` / `.js.map` point at `src/**` which is not shipped (`files: ["dist"]`). Either ship `src` or drop maps.
- Biome: `linter.rules.recommended` deprecation notice — run `npx biome migrate --write` at next Biome major.
- The consumer fixture resolves `tailwindcss` via the repo's own node_modules — it validates the package contents, not dependency installation.
- `verify-consumer` type-only check misclassifies a semicolon-less `type` alias (latent: Biome
  enforces semicolons).
- `verify-consumer` does not recognize `export type * from` (fails loudly rather than silently).
- Test order dependence (Phase E Task 3b): under a shuffled test order (`--sequence.shuffle`) some
  focus-dependent tests fail; the default order is green. Task 3b fixed the order-dependent Tooltip
  id flake (a stale pointer from an earlier hover), and the final review's global pointer parking
  (`test/setup.ts` `afterEach` → `test/pointer.ts`) fixed the Switch track-colour failure (a hover
  leak). Still failing with seeds 1 / 1234 (seed 42 green): the Toast "uses the Toaster's timeout"
  test (`document.hasFocus()` false — the page lost window focus), RadioGroup "moves selection and
  focus with the arrow keys" and NumberField "stepper buttons are excluded from the Tab order"
  (focus lands on `<body>`). All three look like lost window/document focus after some earlier
  test, not hover; not chased further.

### Phase H notes
- Date controls' custom validity (Task 2, upgrade note): DateField, DatePicker and DateRangePicker set a custom
  validity on their hidden input (outside `min` / `max`, an `isDateDisabled` day, partial input, a range with one
  end). That blocks a plain `<form>` submit too, not only a Base UI `Form`: before Phase H a picker with such a
  value submitted anyway. A caller that wants the old behaviour adds `noValidate` to its `<form>`.
- Manual testing: DateField: do a manual NVDA/VoiceOver pass, a real mobile numeric-keyboard check and a
  real IME check (Japanese full-width digits; Safari and Android composition are only covered by CDP in Chromium).
- Label override (Task 2): the label-override test drives 4 forms in one test; the DateField fragment renders its
  hidden input as a sibling of the group (as Select does), so a `className` / `ref` never reaches it.
- Blur without focus return (Task 3): where Base UI does not return focus on close (no `focus({ preventScroll })`
  support, some Android browsers), popup→nowhere stays "in transit" under `useFocusScope`, so the Field's blur
  (touched, `onBlur` validation) is only reported once focus next lands outside the control.
- Ref callbacks (Task 3): the merged ref setters ignore a React 19 ref-callback cleanup return (DateField,
  DatePicker's trigger, `SidebarProvider`; also `combobox.tsx` ~416 and `tooltip.tsx` ~202). A shared
  `mergeRefs` in `src/lib` should call the cleanup.
- RTL geometry (Task 3): no tests pin the DateField first segment's `-ms-0.5` or the editable picker's
  `pe-10` / `end-1` icon button under `dir="rtl"` (logical classes, checked visually only).
- Sidebar (Task 4): the rail takes 8px of the page's edge next to the column (clicks there toggle); the
  content-scrollbar `elementFromPoint` tests use a fixture too short to scroll, so they pin the edge, not a
  real scrollbar; `useSidebar()` reports `state: "collapsed"` for a `collapsible="none"` Sidebar under
  `defaultOpen={false}` although it renders expanded; the provider keeps one `isStatic` flag, so with two
  Sidebars (one `collapsible="none"`) the trigger and shortcut do nothing for the other.
- Sidebar direction (final review): `SidebarProvider` reads the text direction in a layout effect after its
  own renders, so a runtime `dir` change on an ancestor that doesn't re-render the provider is picked up
  only on its next render (e.g. the next toggle) for the JS-driven parts: the mobile Drawer's side, the
  icon-mode tooltip side and the rail's resize cursor (`data-edge`). The desktop column, rail placement
  and off-canvas slide are CSS and follow at once.
- Drawer RTL (final review): Drawer's `side`, its close button (`right-4`) and footer alignment are
  physical, not mirrored under `dir="rtl"`. The mobile Sidebar maps its edge onto `side` and pads its
  header on the physical right to match; a logical Drawer would drop both workarounds.
- Dashboard tests (Task 5): the keyboard flow still clicks in places (the segments, the Period trigger and
  the days) rather than tabbing everywhere.
- Dashboard example (Task 5): the nav only changes the heading, breadcrumb and `aria-current`; every
  view shows the same content. The sidebar open state is not persisted (`onOpenChange` is where a
  real app would). The date filter only echoes the applied values; it does not filter the table.
  The axe test for the open DatePicker calendar hides `main` (the popup covers table text, which axe
  leaves undecided), as the Checkout tests do.

## Next components
Follow the phases in the design-system spec §6
(`docs/superpowers/specs/2026-09-23-tessera-design-system-v2.md`): Phase B forms (Label, Field, Input,
Textarea, Checkbox, Switch, RadioGroup — use the `field*` / `switch-track` tokens), Phase C overlays,
Phase D navigation and feedback, Phase E data entry and display, Phase F dates/toolbars/surfaces
(Calendar, DatePicker, DateRangePicker, ToggleGroup, Toolbar, ScrollArea, Meter,
HoverCard/PreviewCard, ContextMenu). Phases B–G are done (G: Collapsible, CheckboxGroup, Form, OTPField,
Autocomplete, Menubar, NavigationMenu); Phase H is done (DateField, editable DatePicker, date form
participation, Sidebar, Dashboard example). Next, Phase I (Phase H spec §6): candidates are DateRangeField,
a first-class Command palette (if the Autocomplete story's recipe proves worth extracting), Carousel, Tree,
and data-grid pieces (column visibility, pagination state).
