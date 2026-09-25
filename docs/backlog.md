# Tessera backlog

Open follow-ups from the foundation, Phase A (2026-09-23), Phase B, Phase C, Phase D (2026-09-24)
and Phase E (2026-09-25) reviews.
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
  when the button disables); group sizes are copied from `textFieldSizes`, not derived; the
  transition comment in `number-field-variants.ts` is written around the test.
- Combobox (Task 5): inside a `Field`, an `aria-label` on the trigger is ineffective (Base UI's
  `aria-labelledby` wins; worth documenting); Select, Menu and Combobox each keep their own check /
  chevron icons (extract shared ones); the AsyncWithStatus story mounts `ComboboxEmpty`
  conditionally and its `.catch(() => {})` swallows errors; the InDialog story has no axe test;
  `ComboboxChips` with `aria-invalid` outside a `Field` is untested.
- Drawer (Task 6): the RightWithForm story's body lacks `flex-1`; `CloseIcon` is copied a third
  time (Dialog, Toast, Drawer — extract it); verify-consumer has no needles for the drawer swipe
  vars; the drag tests cast `dragAndDrop` options; the header keeps `pr-12` with
  `showCloseButton={false}`; no mutation checks for `aria-modal`, `useLayeredEscape` or the
  `transform` swipe binding.
- Orders example (Task 7): `test/overlay.ts` `auditOpenOverlay` now accepts a Base UI inert marker
  on an ancestor (Base UI keeps `[aria-live]` regions such as Slider's `<output>` exposed behind a
  modal) and re-checks `elmPartiallyObscuring` contrast inside an open modal with the hidden page
  made invisible; both are unit-tested in `test/overlay.test.ts`. The example's "Save changes" is
  local state only, the breadcrumb links are `#`, and its axe tests run at a 1024px viewport (at
  414px axe cannot decide the contrast of table cells scrolled out of view).

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

## Next components
Follow the phases in the design-system spec §6
(`docs/superpowers/specs/2026-09-23-tessera-design-system-v2.md`): Phase B forms (Label, Field, Input,
Textarea, Checkbox, Switch, RadioGroup — use the `field*` / `switch-track` tokens), Phase C overlays,
Phase D navigation and feedback, Phase E data entry and display. Phases B–E are done. Phase F:
Calendar, DatePicker, DateRangePicker, ToggleGroup, Toolbar, ScrollArea, Meter,
HoverCard/PreviewCard, ContextMenu.
