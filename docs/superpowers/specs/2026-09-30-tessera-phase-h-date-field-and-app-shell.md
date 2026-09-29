# Tessera Phase H: DateField, Form-ready Pickers and the App Shell (Spec Addendum)

**Date:** 2026-09-30
**Status:** Claude made these decisions under the owner's standing delegation ("okay go to phase H … keep implementing and dont make mistakes").
**Builds on:**
- design-system-v2 §4: tokens, sizes, focus (`outline-none` + `toggleFocusClasses` + `forced-colors:focus-visible:outline-[Highlight]`), selected Highlight/HighlightText states with `forced-color-adjust-none`, cursor (disabled → `cursor-not-allowed`), motion.
- Phase B §3: Field composition, `textFieldBase` / `textFieldStates`.
- Phase C / D: the overlay pattern, `useLayeredEscape`.
- Phase E: Drawer.
- Phase F §3: `src/lib/date.ts`, Calendar, DatePicker / DateRangePicker; Field wiring via `internals/field-root-context` and `labelable-provider`, with Base UI pinned `~1.8.0`.
- Phase G: Form, `src/lib/bar-classes.ts`, NavigationMenu.

**Scope:**
1. A typed, segmented `DateField`.
2. Form and Field validation participation for DatePicker, DateRangePicker and DateField. This closes the Phase F/G backlog gap: pickers were absent from Form validation and from the `onFormSubmit` values.
3. A typed-entry mode for DatePicker.
4. A `Sidebar` app-shell family.
5. A Dashboard example.

**Scope rulings:**
- *Field participation follows Base UI's own Select recipe.* `SelectRoot.js` renders a visually hidden real `<input>` (not `type="hidden"`) with `tabIndex={-1}`, `aria-hidden`, `required`, `name` and the stringified value, and registers it via `internals/field-register-control`'s `useRegisterFieldControl(controlRef, id, value, getStringifiedValueForForm, enabled, name)`. That is exactly what Field validation needs: native validity from a non-hidden input. The date controls reuse the recipe through one shared internal hook/component (`src/components/date-picker/date-form-control.tsx` or `src/lib/…` if it is server-safe; it isn't — it's a client module). It adds a third internal subpath under the same `~1.8.0` pin rationale (backlog entry updated). Cost if wrong: another internals dependency to re-verify on a Base UI bump.
- *DateField segments follow React Aria's date-field pattern*, which is widely used and screen-reader tested. There is no WAI-ARIA APG pattern for it.
  - A `role="group"` named by the label.
  - Each segment is a focusable `role="spinbutton"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext` and `aria-label` (e.g. "month").
  - Literal separators are `aria-hidden`.
  - Each segment is a Tab stop, and ←/→ also move between segments.
  - Cost if wrong: some screen readers announce each segment separately (accepted by React Aria users).
- *No DateRangeField this phase.* DateRangePicker keeps its button trigger. Typed ranges wait for demand. Backlog.
- *Sidebar is shadcn-shaped.* The composition is well known, and the owner's inspiration set (PrimeVue/MUI) has no stronger app-shell API. Mobile uses Tessera's `Drawer`.

## 0. Carry-over (Task 0, first)

Carried over from Phase G's final re-review, kept in project memory:
- `src/lib/bar-classes.ts`: the transition list lacks `translate`, unlike the canonical v2 §4 string. Align it to `transition-[color,background-color,border-color,outline-color,box-shadow,translate]`, with no visual change; the existing reduced-motion tests guard it.
- Checkout example pending-window races:
  - Closing the promo panel during pending runs `setErrors({})`, which consumes Base UI Form's one-shot focus-first-invalid.
  - Enter-to-Apply during pending starts a parallel Apply.
  - Fix: while `pending`, ignore promo-panel close requests that would clear errors (or defer the clear until pending ends), and ignore Enter-to-Apply. Test both.
- Promo Enter handler: ignore `event.nativeEvent.isComposing` (IME). Test it with a composing KeyboardEvent.
- Add the rest of the deferred Phase G re-review notes to docs/backlog.md if missing. Do not rewrap pre-existing long README lines.

## 1. `src/lib/date-segments.ts`

Server-safe, pure and unit-tested. Its helpers:
- `getDateSegmentOrder(locale)` returns `Array<{ type: "day" | "month" | "year"; } | { type: "literal"; value: string }>`, derived from `Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(2001, 10, 23))`. Tests: en-US → month/day/year with "/"; de-DE → day.month.year; en-GB → day/month/year; ja-JP → year/month/day; ar-EG (it may use Arabic-Indic digits: the segment values are shown with `Intl.NumberFormat(locale)`, while the typed input accepts ASCII digits and the locale's digits).
- `segmentBounds(type, partial)` gives month 1–12, year 1–9999, and day 1–`daysInMonth(month, year)`. Day max is 31 while month or year is unknown.
- `typeDigit(current, digit, type)` gives the next value and whether to auto-advance. The React Aria semantics:
  - Month: typing "1" waits for a possible second digit; "2"–"9" commit and advance; "1"+"0..2" gives 10–12.
  - Day: "4"–"9" advance at once; "1"–"3" wait.
  - Year: four digits, then advance.
  - Table-driven tests.
- `incrementSegment(value, type, delta, bounds)` wraps within bounds.
- `segmentsToDate({ day, month, year })` returns `Date | null` (null unless all three are set and valid; Feb 30 → null), and `dateToSegments(date)`.
- *Amended in Task 1*: the helpers as built.
  - `getDateSegmentOrder` passes `calendar: "gregory"`. fa-IR otherwise formats in the Persian calendar (verified: 2001-11-23 comes out as `۱۳۸۰/۰۹/۰۲`). Consecutive literals merge, and trailing ones are kept (ko-KR `2001. 11. 23.`, bg-BG ` г.`).
  - `typeDigit(buffer, digit, type, max?)` returns `{ buffer, value, advance }`. `buffer` is the digits typed into the segment so far. `max` is the day's month-dependent bound, so "3" advances at once in February. A digit that would overflow the bound or the segment length starts over, React Aria-style: month "1" then "3" gives 3. A leading "0" waits, with `value: null`.
  - `incrementSegment(value | null, type, delta, bounds, today?)`: an empty segment starts at today's value for that segment, clamped, without stepping, as React Aria does.
  - Also added: `getLocaleDigits` / `parseDigit` (ASCII plus the locale's digits), `parseDateString` (strict ISO, else three digit groups in the locale's order, for paste), `getSegmentLabel` and `getSegmentPlaceholder`.
  - `daysInMonth` is now exported from `date.ts`, which is not duplicated. `resolveLocale` moved from `calendar-base.tsx` to `date.ts` because it is server-safe (it guards `document`). Calendar and DatePicker import it from there.
  - Years 1–9999 stay literal. Dates are built with `setFullYear`, so year 4 is not 1904, and there is no clamp to 100.

## 2. DateField

- **Props:** `value` / `defaultValue` / `onValueChange` (Date | null), `min`, `max`, `isDateDisabled` (invalid when true), `locale`, `disabled`, `readOnly`, `required`, `name` (Form participation §3), `size` (sm/md/lg, the text-field heights), `id`, `aria-label` / `aria-labelledby`, plus div props.
  - `onValueChange` fires with a Date when all segments form a valid date, and with `null` when the user clears a complete value.
  - Partial input keeps internal segment state and doesn't fire.
- **Structure:**
  - A root `div` (`data-slot="date-field"`, `role="group"`, the text-field look: written out explicitly from `textFieldStates` with a focus-within ring like `textFieldGroupBase`, `inline-flex items-center gap-0.5 px-3 tabular-nums`, `data-invalid` / `data-disabled` / `data-readonly`).
  - Segments are `span`s (`data-slot="date-field-segment"`, `data-type`, `data-placeholder` when empty).
  - Literals are `span aria-hidden`.
- **Segment:**
  - `role="spinbutton"`, `tabIndex={disabled ? -1 : 0}`, `inputMode="numeric"`, `aria-valuenow` / `min` / `max`, `aria-valuetext` (e.g. "September" for month, the number for day and year, "Empty" when unset), and `aria-label` from `Intl.DisplayNames(locale, { type: "dateTimeField" })` when available, falling back to "month" / "day" / "year".
  - `aria-readonly` / `aria-disabled` / `aria-invalid` mirror the root.
  - Classes: `rounded-sm px-0.5 caret-transparent outline-none focus:bg-primary focus:text-primary-foreground data-placeholder:text-muted-foreground`. Forced colors: `forced-colors:focus:bg-[Highlight] forced-colors:focus:text-[HighlightText] forced-colors:focus:forced-color-adjust-none`.
  - The placeholder is "mm" / "dd" / "yyyy" localised via `Intl.DisplayNames` where sensible; otherwise use a letter pattern from the locale's order. Keep it simple and record the choice.
- **Keyboard:**
  - Digits type (§1 semantics, auto-advance).
  - ↑/↓ increment and decrement with wrap; PageUp/PageDown step month by 1 / day by 7 / year by 10 (record the choice).
  - Home/End go to the min/max of the segment.
  - Backspace/Delete clears the segment (Backspace on an empty segment moves to the previous one).
  - ←/→ move between segments; RTL flips them.
  - Typing the literal character (e.g. "/") advances.
  - Paste of a full date string in the locale format, or ISO, fills all segments.
- **Focus:** clicking the root's padding focuses the first empty segment (or the first segment).
- **Validation:**
  - Out of `min`/`max`, or `isDateDisabled`, sets `data-invalid` / `aria-invalid` and a `validity` custom error on the form control (§3).
  - `required` with any empty segment is invalid at validation time.
- **In Field:**
  - FieldLabel names the group (`aria-labelledby`) and FieldDescription describes it.
  - Invalid shows the danger border; disabled and readOnly apply.
  - FieldError shows Base UI validation messages (§3).
- *Amended in Task 1*: decisions and deviations.
  - **Placeholders.** The first letter of the segment's `Intl.DisplayNames` name, repeated to the segment's length, for Latin, Cyrillic and Greek scripts. That yields each locale's own convention: en mm/dd/yyyy, de tt.mm.jjjj, fr jj/mm/aaaa, nl dd-mm-jjjj, ru дд.мм.гггг. Other scripts (ja, zh, ar, …) get the English letters, since a repeated 年 or ي is not a convention.
  - **PageUp/PageDown.** They step as the spec says: month 1, day 7, year 10. For month, PageUp is the same as ↑.
  - **Year reporting.** A year is held (shown but not reported) until its fourth digit or blur. Otherwise "2", "20" and "202" on the way to "2026" each count as a valid complete date. Each would fire `onValueChange` and flash min/max invalid (the first failing test showed 4 calls). Arrows, Home/End and paste report at once.
  - **Invalid state** comes from the reported value, not the shown segments, so a held year never flashes invalid. An `aria-invalid` prop moves to the segments (the group carries none) and sets `data-invalid`.
  - **Day clamping.** Once month and year are both known, a too-long day clamps (Jan 31 → month 2 → 28), as React Aria's date `set` does.
  - **Segment class.** It is `data-placeholder:not-focus:text-muted-foreground`, not `data-placeholder:text-muted-foreground`. Tailwind emits `data-*` variants after `focus:`, so the spec string painted muted text on the focused `bg-primary` fill (test evidence: the computed colour was `oklch(0.535 0.009 265)`, expected `oklch(1 0 0)`).
  - **Editable segments.** Segments are `contentEditable` (not when disabled or read-only) with `spellCheck=false`, `autoCorrect`/`autoCapitalize` off and `suppressContentEditableWarning`. The spec's `inputMode="numeric"` and `caret-transparent` only take effect on an editable element, and without it mobile keyboards never open. Every keydown that would edit is prevented. A native `beforeinput` listener handles mobile keyboards ("Unidentified" keydowns): it types the digit, clears on a delete input type, and always `preventDefault`s so React keeps the DOM.
  - **Labelling.** The group registers a `null` control id (`useLabelableId({ id: null })`, Base UI CheckboxGroup's recipe), so FieldLabel omits `for`. The group is named by `aria-labelledby` = the label id. A native click listener on the label focuses the first empty segment, the way a `for` label focuses its control. Clicking the root's padding or a literal does the same.
  - **Layout.** The root is `w-full min-w-0` like Input and Select. Its inline padding comes from `textFieldSizes` (sm `px-2.5`, md `px-3`, lg `px-4`) rather than a fixed `px-3`, so it lines up with Input at every size. Literals are `text-muted-foreground`. `cursor-text` is on the root, and disabled sets `cursor-not-allowed`.
  - **Held year and the day** (fix round 1). A held year neither clamps the day nor bounds it: `aria-valuemax` reads as if the year were unknown. Otherwise 02/29 followed by "2024" clamped to 28 at year "2". The clamp runs when the year's fourth digit lands or on blur.
  - **Leading "0"** (fix round 1). A leading "0" keeps the segment's value `null`, as React Aria does, but shows the typed "0". `aria-valuetext` announces it too, instead of "Empty".
  - **Segment names** (fix round 1). Each segment has `aria-labelledby` = its own id plus the field's name source: the label id, an external `aria-labelledby`, or the group's own id when it is named by `aria-label`. It reads "month Due date", as React Aria does. The group keeps its name.
  - **Disabled segments** (fix round 1) get no `tabindex` at all, because `-1` still takes focus from a click.
  - **Focus and keys** (fix round 1). Focusing a segment collapses the selection into it, as React Aria's `useDateSegment` does. ↑/↓, PageUp/PageDown and Home/End are always prevented, read-only included, so they never scroll the page.
  - **Forced-colors invalid ring** (fix round 1). The root adds `forced-colors:data-invalid:focus-within:outline-[Highlight]`. Tailwind emits `data-invalid:focus-within:` after `forced-colors:focus-within:`, so the danger outline (forced to CanvasText) otherwise won. Input's `:focus` ring in an invalid Field stays Highlight (test evidence), and this makes the two match.
  - **Extras.** `labels` (`DateFieldLabels`: `day` / `month` / `year` names and `empty`, the "Empty" value text) is added. `required` sets `aria-required` on the segments. The validation-time `required` check and `name` come with §3 (Task 2).

## 3. Form participation (DateField, DatePicker, DateRangePicker)

- A shared internal `DateFormControl`: a visually hidden real `<input>` with Base UI's `visuallyHiddenInput` style (import from `@base-ui/utils/visuallyHidden` if it's a public dependency path; otherwise copy the style object with a comment citing it). It carries `tabIndex={-1}`, `aria-hidden`, `required`, `name`, the ISO value, and a custom validity for min/max/disabled-date/partial input. It is registered with `useRegisterFieldControl` exactly as SelectRoot does. When Field focuses the invalid control (Form's focus-first-invalid), focus must move to the visible control (the trigger or the first segment); verify how Select handles this, e.g. a `focus` handler on the hidden input forwarding focus, and mirror it.
- **DatePicker:** `name` / `required` / `validate` work in Field and Form. The value appears in `onFormSubmit` values under `name` as `YYYY-MM-DD`, or `""`/`null` when empty (match Select's convention and record it). The existing `type="hidden"` input is removed or replaced, and native FormData still carries it.
- **DateRangePicker:** `startName` / `endName`. Register one control per name, or a single control with a `{ start, end }` value, whichever `useRegisterFieldControl` supports cleanly (verify; record). `required` means both dates are required.
- Tests replace Phase G's "documents current behaviour" test (form.test.tsx) with real participation tests:
  - required blocks submit and shows FieldError;
  - `validate` runs;
  - `errors[name]` shows and clears on change;
  - the `onFormSubmit` values contain the ISO date(s);
  - focus-first-invalid lands on the visible control;
  - native FormData is unchanged.
- The backlog entries about picker Form participation are removed. The internals backlog entry gains `field-register-control`.
- *Amended in Task 2*: decisions and verifications.
  - **Shape.** `date-form-control.tsx` exports a hook, `useDateFormControl`, rather than a component: it returns the input to render plus focus / blur handlers for the control's outer boundary (Field `focused` / `touched`, and `validationMode="onBlur"` validation, as SelectTrigger's blur does; focus moving between segments, or from the trigger into the popup and back, is not a blur). It also exports `dateValidationMessage`.
  - **Style.** `@base-ui/utils` is only a transitive dependency of `@base-ui/react` (not in Tessera's `dependencies`), so importing it could fail under a strict layout such as pnpm. The `visuallyHidden` / `visuallyHiddenInput` objects are copied (0.4.0) with a comment citing the source. As Select does, a named input uses `visuallyHiddenInput` (absolute), an unnamed one `visuallyHidden` (fixed).
  - **A fourth internal.** `internals/form-context` is needed for `clearErrors(name)`, which SelectRoot calls on a value change; without it a Form `errors[name]` never clears. The backlog internals entry lists all four subpaths.
  - **Focus.** Form's focus-first-invalid focuses the registered `controlRef`, and Select registers its trigger element there, so the hidden input never takes focus in that path. The date controls register the trigger (pickers) or a ref whose `current` reads the first segment (DateField). The input still forwards any focus it gets to that control (Select's `onFocus`), which a test covers.
  - **Values.** Registration follows Select: Field `validate` gets the raw value (`Date | null`; DateRangePicker a `DateRange`), `onFormSubmit` gets the string form via `getValue`. Empty is `""`, as Select reports `serializeValue(null)`. Change detection is keyed by the `YYYY-MM-DD` string, so a new `Date` for the same day is no change.
  - **DateRangePicker.** A Field holds one registration (a second `useRegisterFieldControl` in the same Field replaces the first), so the range is one control. Its validating input is unnamed and holds the ISO interval `start/end` (empty until both are set, so `required` needs both). `onFormSubmit` reports `{ start, end }` (each `YYYY-MM-DD` or `""`) under the Field's name. `startName` / `endName` stay `type="hidden"` inputs for native FormData, unchanged.
  - **Messages.** Custom validity, formatted with `dateStyle: "medium"` in the control's locale: "Enter a date on or after {min}.", "Enter a date on or before {max}.", "This date is unavailable.", DateField's partial input "Enter a complete date.", and DateRangePicker's lone start "Choose both a start and an end date." (it wins over `valueMissing`, as a custom message does natively). They are overridable through the existing `labels` prop (`rangeUnderflow(min)`, `rangeOverflow(max)`, `unavailable`, `incomplete`), so one localisation prop covers everything. `required` + empty gives the native `valueMissing` message.
  - **Name precedence.** The native input keeps the existing `name ?? Field name` (the prop wins, as before); the registration passes the `name` prop, and Base UI reports under the Field's name first, as it does for Select.
  - **Error display** is unchanged: the pickers and DateField already read `field.state.valid` for `aria-invalid` / `data-invalid`, and FieldError is Base UI's. No screenshot was needed.
  - **Native submits** (fix round 1). The custom validity lives on a real input, so it also blocks a plain `<form>` submit outside a Form. This is a behaviour change: a picker value outside `min` / `max` or on a disabled day used to submit. `noValidate` on the `<form>` restores the old behaviour. It is documented in the README entries and the backlog.
  - **onBlur timing** (fix round 1). `validationMode="onBlur"` validation runs in a layout effect after the render that follows the blur, not inside the blur handler. A DateField commits a year still being typed in that same blur, so validating inside it read the old value (year "20" below `min` showed no error until submit).
  - **Label callbacks** (fix round 1). `rangeUnderflow` / `rangeOverflow` also get the bound as a `Date` (second argument), so a translation can format it another way.

## 4. DatePicker typed entry

- A DatePicker `editable` prop (default false). When true, the trigger becomes a `DateField` plus a trailing calendar icon button (`buttonVariants({ variant: "ghost", color: "neutral", size: "icon-sm" })`, `aria-label` "Choose date", localisable via `labels`) that opens the same Popover calendar.
- Typing a complete valid date updates the calendar's value and month. Picking in the calendar fills the segments and returns focus to the field's first segment (or the icon button; record which reads better).
- Sizes line up with Select and Input.
- A Story ("Editable") plus tests: typing then opening shows that month with that day selected; picking fills the segments; Escape closes and focus returns; Field and Form participation as §3.
- *Amended in Task 3*: decisions.
  - **Focus after a pick.** Focus returns to the calendar icon button, not the first segment. That is the Popover's natural return target (its trigger), and what a user expects after closing a popover they opened; Escape returns there too. (The spec left the choice open.)
  - **One Field control.** The DateField is the registered control (it renders the hidden input, validates, and takes Form's focus-first-invalid on its first segment). The popover adds none: it is not a `PickerShell`, so there is no second `useDateFormControl`. The Field label names the group; the icon button is not labelable and carries its own `aria-label`.
  - **Wiring.** `DatePicker editable` renders a wrapper `div` (`data-slot="date-picker-editable"`) holding the DateField (with `pe-10`) and the `PopoverTrigger` icon button, absolutely positioned at the trailing edge inside the border. The popup anchors to the wrapper through a new `PopoverContent` `anchor` prop (a pass-through to `Positioner`), so it aligns to the field's start like the button picker's.
  - **Icon button.** `ghost` / `neutral`; `icon-sm` (32px) at md and lg, `icon-xs` (28px) at sm so it fits inside the 32px field. Its focus ring has `outline-offset-0`: with the default offset the ring overlapped the field's border.
  - **Labels.** `labels.openCalendar` (default "Choose date"), plus DateField's `day` / `month` / `year` / `empty` and, in this mode, `incomplete`.
  - **Rest props.** In editable mode `ref`, `className`, `id` and the other rest props go to the DateField group; `placeholder` and `format` are unused. `DateRangePicker` has no editable mode (no DateRangeField yet). (Fix round 1: `DatePickerProps` is a discriminated union, `DatePickerButtonProps` (`editable?: false`, the button's native props) or `DatePickerEditableProps` (`editable: true`, the group `div`'s), so `ref` and the handlers are typed for the element they reach. This also fixed `DateField` dropping a passed `ref`; it is now merged with its own.)
  - **Blur.** (Fix round 1, replaces the first version, where tabbing from the segments to the icon button counted as leaving.) The field, the icon button and the popup are one focus boundary: `DateField` takes an `@internal` `focusScope`, and with it the Field's focused / touched state and `validationMode="onBlur"` validation follow focus entering or leaving that whole scope (document `focusin` / `focusout`, so it spans the portalled popup). Focus dropping to nowhere from the popup (it closing) is ignored, since Base UI hands focus back to the icon button.
  - **Text start.** (Fix round 1, `DateField` itself.) The first segment's `px-0.5` put the first character 2px right of Input's and Select's text; the first segment now has `-ms-0.5`, so the text starts at border + padding at every size (geometry tests for DateField and the editable picker).
  - **readOnly.** The editable picker takes `readOnly` (the DateField's): segments stay focusable and ignore edits, and the icon button is disabled, since a calendar that cannot pick has no use. (The button picker has no `readOnly`.)

## 5. Sidebar (app shell)

**Parts** (all `data-slot`):
- `SidebarProvider`: state `open` / `defaultOpen` / `onOpenChange`; a mobile `openMobile` sheet; the keyboard shortcut Ctrl/⌘+B (off via `shortcut={false}`); CSS vars `--sidebar-width` (16rem) and `--sidebar-width-icon` (3rem); a wrapper `flex min-h-svh w-full`. Persisting the open state is the caller's job (docs show localStorage/cookie via `onOpenChange`); YAGNI a storage prop.
- `Sidebar`:
  - `side` left/right, `variant` sidebar/floating/inset, `collapsible` offcanvas/icon/none.
  - Desktop (≥ `md`): a fixed column with a width transition (`transition-[width] duration-200 ease-out motion-reduce:transition-none`); collapsed to icon width or off-canvas.
  - Below `md`: Tessera `Drawer` (side matching) with the same content, named "Sidebar" (overridable).
  - Use Base UI's `unstable-use-media-query` if it exists in 1.8 (it does: `@base-ui/react/unstable-use-media-query`), otherwise `matchMedia` in an effect. Server-safe first render: assume desktop and record the choice.
- `SidebarTrigger`: `buttonVariants` ghost neutral `icon-sm` with a panel icon, `aria-label` "Toggle sidebar", `aria-expanded`, `aria-controls` → the sidebar id.
- `SidebarRail` (optional): a thin hit area on the edge that toggles, `aria-hidden`, `tabIndex -1`.
- `SidebarInset`: `main`, `flex-1 min-w-0 bg-background`, with inset variant styling.
- `SidebarHeader` / `SidebarFooter` / `SidebarContent` (scrolls: `min-h-0 flex-1 overflow-auto`, or Tessera `ScrollArea`; record) / `SidebarSeparator` (the forced-colors rule from Phase G §0).
- `SidebarGroup` / `SidebarGroupLabel` (hidden in icon mode) / `SidebarGroupAction` / `SidebarGroupContent`.
- `SidebarMenu` (`ul`) / `SidebarMenuItem` (`li`) / `SidebarMenuButton`:
  - A `button` or `a` via `render`.
  - `isActive` → `aria-current="page"` for links (or `data-active` for buttons) + `bg-accent text-accent-foreground font-medium`; forced colors active: Highlight/HighlightText + `forced-color-adjust-none`.
  - Sizes sm/md/lg: h-8 / h-9 / h-12.
  - In icon mode, a `tooltip` prop shows a Tessera Tooltip with the label (side right), and the text is visually hidden but kept in the accessible name.
  - Focus: `toggleFocusClasses` + Highlight; `-outline-offset-2` inside the sidebar.
- `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSub` / `SidebarMenuSubItem` / `SidebarMenuSubButton` (a nested list with an indent guide; hidden in icon mode), `SidebarMenuSkeleton`.
- Hook: `useSidebar()` returns `{ state: "expanded" | "collapsed", open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }`.

**Landmarks:** the sidebar renders `<aside aria-label="Sidebar">` (overridable) on desktop. Callers put a `<nav>` inside (docs show it).

**Tokens:** use the existing surface tokens (`bg-muted`/`bg-card`/`border-border`) rather than new `--sidebar-*` colours, unless contrast or design needs them. Record it if tokens are added, with contrast gates.

**Tests:**
- Provider state: controlled and uncontrolled.
- The shortcut: Ctrl+B and ⌘+B toggle; it is ignored while typing in an input/textarea/contenteditable; `shortcut={false}` turns it off.
- Collapse to icon: width equals `--sidebar-width-icon`; labels are hidden; tooltips appear on hover and focus; accessible names are kept.
- Offcanvas: the sidebar is fully hidden from AT when collapsed (`inert` or `visibility:hidden`, no focusable content).
- Mobile (a CDP viewport or a stubbed media query): the trigger opens the Drawer, focus goes inside, and Escape closes and returns focus.
- `isActive` → `aria-current`.
- Menu sub lists.
- The rail toggles.
- Reduced motion: no width transition.
- Forced colors: active item and focus.
- axe in light and dark, expanded / icon / mobile open.

- *Amended in Task 4*: decisions and verifications.
  - **Files.** `sidebar-context.tsx` (provider, `useSidebar`), `sidebar.tsx` (Sidebar, Trigger, Rail, Inset, Header/Footer/Content/Separator, Group parts), `sidebar-menu.tsx` (menu parts), server-safe `sidebar-variants.ts`. `render` on SidebarMenuButton / SubButton / GroupLabel / GroupAction / MenuAction uses `cloneRender` (as Breadcrumb and Pagination do; no client component uses Base UI `useRender`).
  - **Media query.** `useMediaQuery("(min-width: 48rem)", { defaultMatches: true })` from `@base-ui/react/unstable-use-media-query` (1.8; `useSyncExternalStore`, whose server snapshot is `defaultMatches`). So the server render and hydration are desktop, and a phone switches to the Drawer right after. The desktop column is also `hidden md:flex`, so a phone never flashes it. Added to vitest `optimizeDeps`.
  - **Layout.** In flow, not `fixed`: the `aside` is a flex item of the provider's row (it stretches to the row's height, `overflow-clip`), and its panel is `sticky top-0 h-svh max-h-full`. Several shells then sit in a Docs page, and the column never overlaps the page. A right sidebar is `order-last`, whatever its DOM position. Collapsed off-canvas, the column animates to width 0 while the panel slides out (`translate`), so the container carries `transition-[width,translate]`; the column itself has the spec's `transition-[width] duration-200 ease-out motion-reduce:transition-none`.
  - **Icon width.** In icon mode the column is `--sidebar-icon-extent`: the icon width plus the variant's own border and padding (sidebar +1px border; floating +1rem padding +2px border; inset +0). So the content area is exactly `--sidebar-width-icon` in every variant (tested), and 32px menu buttons fit in its `p-2` groups.
  - **Off-canvas.** The collapsed `aside` is `inert`: out of the Tab order and the accessibility tree (tested: Tab goes from the page start to the trigger). On mobile the Sidebar's rest props and `ref` go to the drawer's inner wrapper.
  - **Rail** (fix round 1). The first version sat `absolute` inside the panel's inner 12px, so it took clicks from the menu buttons' ends and the content's scrollbar, and went inert with a collapsed off-canvas column. Now Sidebar renders a zero-width, non-inert host (`data-slot="sidebar-rail-host"`) beside the `aside`, on its inner edge (after a left column; before a right one, both `order-last`), and `SidebarRail` portals into it. It is an 8px strip just outside the edge, over the page, with the hover line on the edge. It does not straddle the edge as shadcn's does: any overlap inside would cover the content's scrollbar, which the review asked to keep clear (tested with `elementFromPoint` for menu buttons, expanded and icon, and for the content's inner edge). It reopens a collapsed off-canvas sidebar (tested). It renders nothing in the mobile Drawer or with `collapsible="none"`.
  - **`collapsible="none"`** (fix round 1). The Sidebar registers with the provider, which then makes `toggleSidebar` a no-op (trigger, shortcut): `onOpenChange` does not fire, the aside stays `data-state="expanded"` and the trigger stays `aria-expanded="true"`. It stays a static aside below `md` (no Drawer).
  - **Shortcut scope** (fix round 1). The listener is on `window`, so every provider on a page reacts. Only the Default story keeps it; the README says to keep it on for one provider per page.
  - **`side` is physical** (fix round 1, README), as in shadcn: not mirrored under `dir="rtl"`.
  - **`aria-current`** (fix round 1). An inactive MenuButton / SubButton keeps the caller's own value (e.g. `"step"`); `isActive` sets `"page"`.
  - **Tokens.** No new colours. Surfaces are `bg-card` (the sidebar, the floating card and the inset backdrop), with `bg-accent` for hover and active. `bg-muted` would equal `bg-accent` (surface-100 light, surface-800 dark) and hide the active item. In light mode `card` equals `background`, so the column is set off by its border, and the inset by its border and shadow.
  - **Mobile.** The Drawer is 18rem (`w-72`, at most 85vw), not `--sidebar-width`: it is portalled out of the wrapper that sets the variable (the first screenshot showed a 180px panel). Drawer's close button is kept (a touch screen-reader user needs a visible close); the header gets `pe-12` in the drawer to clear it. The trigger's `aria-controls` is set on mobile only while the Drawer exists. Escape returns focus to the trigger (Base UI returns focus to the previously focused element; tested).
  - **Content scrolling.** Plain `min-h-0 flex-1 overflow-auto` (not ScrollArea); `overflow-hidden` in icon mode.
  - **Menu button.** `isActive` sets `data-active` always and `aria-current="page"` only on a `render`ed element (a link); the render element's own `aria-current` wins. Its label is the last child `<span>`: in icon mode that span is `sr-only`, so a leading avatar (size lg) stays visible. The tooltip wraps the button always and is `disabled` unless collapsed on desktop, so toggling never remounts the button and focus survives Ctrl+B. Its side is `right`, or `left` for a right sidebar. In forced colors the focused active item's inset ring is `HighlightText` (a `Highlight` ring would vanish inside its own `Highlight` fill).
  - **Shortcut.** A `window` keydown listener; ignored with Alt or Shift, when already `defaultPrevented`, and when the target is an input, textarea, select or `isContentEditable` (DateField segments; tested).
  - **Tests** set the viewport with Vitest's `page.viewport()` rather than a CDP device-metrics override or a `matchMedia` stub: 1280×800 for desktop (the iframe defaults to phone width), 390×800 for mobile. It resizes the test iframe, so the real media query switches.

## 6. Docs

- Stories:
  - DateField: Default, Locales (en-US, de-DE, ja-JP, ar-EG), Min/Max, In Field (invalid), Sizes, Read-only/Disabled.
  - DatePicker: Editable.
  - Sidebar: Default, Icon collapse, Floating, Inset, Right side, With submenus.
- `Tessera/Examples/Dashboard`:
  - The app shell: a Sidebar with a header (workspace switcher Menu), nav groups (Overview active, Orders, Customers, Products with a sub-list), and a footer (user Avatar + Menu).
  - An inset with a top bar (SidebarTrigger, Breadcrumb, a search Autocomplete / command palette trigger).
  - A content grid of Cards with Meter/Progress stats and a Table of recent orders.
  - A filter row with an editable DatePicker (date range: DateRangePicker) inside a Form, proving §3.
- README: the component list and Phase H completion. Roadmap next: Phase I (candidates: DateRangeField, Command palette component, Carousel, Tree, Data grid pieces: column visibility / pagination state). Backlog updated.
