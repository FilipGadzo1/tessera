# Tessera Phase K: TimeField, TimePicker, TagsInput, FileUpload and DataTable (Spec Addendum)

**Date:** 2026-10-08
**Status:** Claude made these decisions under the owner's standing delegation ("no questions, verify heavily"). The controller set the phase scope (the Phase J carry-overs, TimeField and TimePicker, TagsInput, FileUpload, a headless `useDataTable` with DataTable parts, an Events admin example, the docs task, and the two Phase L deferrals). The design decisions below are Claude's unless marked as a controller ruling.
**Builds on:**
- design-system-v2 §4:
  - focus uses `outline-none` + `toggleFocusClasses` + `forced-colors:focus-visible:outline-[Highlight]`; text fields use the 1px `focus:` / `focus-within:` ring;
  - selected/current Highlight/HighlightText + `forced-color-adjust-none`;
  - disabled → `cursor-not-allowed`; a disabled control that stays focusable uses `text-muted-foreground` (GrayText in forced colors) and keeps opacity 1 (the Phase I amendment);
  - the localisation and naming conventions: the date family takes one `labels` object; every other component takes a per-part `aria-label` with an English default plus label functions;
  - motion and reduced motion.
- Phase E: Table, Pagination (`getPaginationRange`), Combobox chips (`comboboxChipsBase`), Skeleton, Progress.
- Phase H: DateField and its segment engine (`src/lib/date-segments.ts`, `src/components/date-field/date-segments-control.tsx`), the editable DatePicker shell, the hidden-input form control.
- Phase J: `src/components/field/form-control.tsx` (`useFormControl` / `useFocusScope`, with `form` and `slot`), `useElementDirection`, `createTriggerDirection` / `usePopupDirection`, `claimEscape`, the "DOM `dir` is the source of truth" ruling, `test/platform.ts`.

**Scope and tasks:**
1. Phase J carry-overs (§0, Task 0).
2. `src/lib/time.ts`, `getLocaleDirection` and the shared segment plumbing (§1, Task 1).
3. `src/lib/time-segments.ts` (§1.3) and `TimeField` (§2, Task 2; the internal helper lands with its first consumer, since `verify:consumer` fails on a module nothing reaches).
4. `TimePicker` (§3, Task 3).
5. `TagsInput` (§4, Task 4).
6. `FileUpload` and `src/lib/file.ts` (§5, Task 5).
7. The data-table engine: `src/lib/data-table.ts` and `useDataTable` (§6, Task 6).
8. The DataTable parts (§7, Task 7).
9. The Events admin example (§8, Task 8).
10. Docs (§9, Task 9, last).

**Deferred to Phase L (controller ruling):**
- *Calendar events view* (month and week agenda). It needs its own layout engine (overlapping events, all-day lanes) and would double this phase. Phase K's TimePicker and DataTable are its building blocks.
- *DateRangePicker `onValueChange` contract* (backlog Phase I: complete ranges for the button picker vs partial pairs for the editable one). It is an API decision with a breaking option, and it belongs with the next date-family work.

**Scope rulings:**
- *Every Phase K component is hand-built; nothing new comes from Base UI and there is no new dependency.* `@base-ui/react` 1.8.0 (checked in `node_modules/@base-ui/react`: its folders are accordion … tooltip, plus `direction-provider`, `use-render`, `merge-props`, `unstable-use-media-query`) has no time field, tags input, file upload, standalone listbox or data table. A dependency (React Aria's date package, TanStack Table, react-dropzone) for one component each would break the "Base UI + Tailwind only" stack. Base UI parts are still used where they fit: Popover (TimePicker), Checkbox (row selection), Menu (column visibility), Select (page size), Progress (upload progress). Cost if wrong: more code to own than a dependency; TanStack's features (grouping, column resizing, virtualisation) are not there.
- *TimeField shares DateField's plumbing, not its engine.* The date engine (`useDateSegments`) is built around day/month/year (the held year, the day clamp, month names). Time adds a non-numeric segment (the day period), segments whose minimum is 0, and a step. Task 1 moves the type-agnostic plumbing (the group and segment classes, the IME / `beforeinput` handling, focus-first-empty, the label click, submit-on-Enter) into `src/components/field/segments.tsx`, and TimeField gets its own `useTimeSegments` on top of it. Cost if wrong: two engines to keep in step on key semantics; a third segmented control would argue for a generic engine.
- *Time values are strings: `"HH:mm"`, or `"HH:mm:ss"` with `granularity="second"`, and `null` for none.* That is the wire format of `<input type="time">`, so a server reads TimeField's FormData entry as it would a native time input. There is no `Date` and no time zone: a time of day is wall-clock data. Cost if wrong: a consumer combining a date and a time builds the `Date` themselves (the Events admin example shows it).
- *TimeField and TimePicker are date-family components:* one `labels` object for every string (segment names, empty text, validation messages, the picker's button and list names), as DateField and the pickers. Cost if wrong: none expected; it is the §4 rule.
- *No overnight ranges.* `min` must not be after `max`; a range like 22:00–02:00 is not supported (a dev-only `console.warn`, then `max` is ignored). Cost if wrong: a night-shift form validates with a Field `validate` instead.
- *In 12-hour time, typing or stepping the hour while the day period is empty fills the period with AM, and stepping the hour wraps within the period* (11 AM ↑ → 12 AM, which is 00:00), as React Aria and Chromium's native time input do. Cost if wrong: a user who types "3 45" gets 03:45 and must set PM; that is the platform behaviour users know.
- *The segment row follows the locale's script direction, not the page's, and the clock digits are always LTR.* A time is locale-formatted data: an English time in an RTL page reads "9:30 AM" (the bidi algorithm keeps an LTR run together), and an Arabic time reads "م ٩:٣٠" (digits LTR, the period at the inline end). TimeField puts `dir` from the locale (`getLocaleDirection`, §1) on its segment wrapper and `dir="ltr"` on the run from the first to the last numeric segment. The group's own box (padding, the TimePicker's icon button) follows the page. ←/→ move to the visually neighbouring segment (by geometry), so they are right in every combination. This extends the Phase J precedent (the ColorPicker hex and `KbdGroup` are `dir="ltr"` data) and does not touch the "DOM `dir` is the source of truth" rule, which is about Base UI behaviour. Cost if wrong: an RTL user who expects an English time mirrored; DateField keeps its page-direction segments (a difference recorded in the backlog, not changed here).
- *TimePicker is always editable, and its popup is one listbox of time slots, not columns.* Typing is the main path for a time (a DatePicker's calendar is the main path for a day, so it has a button-only variant; a time does not). A slot list (every `slotStep` minutes between `min` and `max`, filtered by `step`) is one APG listbox with one Tab stop, maps directly to the constraints, and is what Google Calendar and Outlook show. Hour/minute columns would be three coordinated listboxes whose "selection follows focus" changes the value while the user only browses, and APG has no column pattern. Cost if wrong: a time off the slot grid (13:47) is typed, not picked; columns can be added later as a `variant` without breaking the API.
- *TagsInput: the native `<input>` is the Field control and the one Tab stop; chips' remove buttons are reached with ← from the input (roving, `tabIndex={-1}`).* This is Tessera's own variant of Base UI Combobox chips' model: Base UI moves focus to the chip element itself (`ComboboxChip.js` ~95–109, a `tabIndex: -1` `div`), while TagsInput focuses the chip's remove button, so the focused element has a role and a name ("Remove react, button"). Cost if wrong: a keyboard user who never presses ← does not discover the chips; the README and the story say how, and the remove buttons are reachable in a screen reader's browse mode.
- *TagsInput submits one FormData entry per tag*, Base UI Select's `multiple` recipe (`select/root/SelectRoot.js` ~374: a nameless validation input plus one `<input type="hidden" name>` per value). `onFormSubmit` reports `string[]`. Cost if wrong: a server expecting one comma-joined string joins them itself (`getAll(name).join(",")`).
- *TagsInput duplicates are compared case-insensitively* (`toLocaleLowerCase()` after trimming), and rejected by default (`allowDuplicates` permits them). Cost if wrong: a vocabulary where "C" and "c" differ passes `allowDuplicates` and dedupes itself in `validate`.
- *FileUpload: the native `<input type="file">` is the real control,* visually hidden, the one Tab stop, named by the Field label (`<label for>`) and opened natively with Enter/Space. The dropzone is a pointer and drop surface that mirrors the input's focus ring. The accepted list is the source of truth and is written back to `input.files` through `DataTransfer`, so a native form submit carries exactly the listed files. Cost if wrong: a browser without the `DataTransfer` constructor (Safari < 14.1) submits only the last native pick through plain FormData; a Base UI `Form`'s `onFormSubmit` still reports the full list.
- *FileUpload joins the Field and Form through the existing hidden-input recipe* (`useFormControl` with no `name`, so it adds no FormData entry; the file input carries the name). Base UI's `Field.Control` is ruled out: it controls `value`, and a file input's value can only be set to `""`. Cost if wrong: two inputs per FileUpload (one carries files, one carries validity), the Phase H pattern.
- *Rejected files do not make the FileUpload invalid.* They never enter the list; they are reported through `onFilesRejected`, the status live region and the optional `FileUploadRejections` part. Field validity covers only the list (`required`, a Field `validate`). Cost if wrong: a form that must block while a rejection is shown validates in `validate` itself.
- *No network code.* Upload progress is the consumer's: `FileUploadItem` takes `progress` and `status`. Cost if wrong: none; uploads are app-specific.
- *DataTable is a table, not an APG grid.* There is no cell-to-cell arrow navigation; the header sort buttons, the selection checkboxes and any buttons in cells are ordinary Tab stops. Pagination keeps a page short. Cost if wrong: a long page with many interactive cells has many Tab stops; a grid mode can be added later as an opt-in.
- *`aria-sort` goes on the primary sort column only.* WAI-ARIA 1.2: "Authors SHOULD apply aria-sort to only one header at a time." Every sorted column also says its direction and rank in the sort button's visually hidden text ("sorted descending, 2 of 2"), and a status region announces each sort change. Cost if wrong: a screen reader that reads `aria-sort` on every header loses the secondary columns' state from that attribute (the button text still has it).
- *Row selection state is a `string[]` of row ids; the header checkbox selects the current page; selection survives sorting and paging.* An id list is serialisable (URL, storage) and survives `data` refetches when `getRowId` is stable. Page-scoped "select all" is what Gmail and GitHub do, and `selectAll()` covers "Select all 36". Single selection uses native `<input type="radio">`s sharing one generated name (*Amended in review*: a Tessera `RadioGroup` renders a `div` that cannot wrap table rows, but native radios group by `name` across rows, so they announce "radio, 2 of 5" and the arrow keys move the choice natively). Cost if wrong: a "select every row across pages" default needs `selectAll()` wired by the consumer; a native radio cannot be unchecked by the user, so single selection is cleared through `clearSelection()` (a toolbar button), not by clicking the selected row again.
- *Sorting resets the page to the first; a page index past the end clamps.* Cost if wrong: a user on page 3 who re-sorts lands on page 1 (the common behaviour).
- *The DOM `dir` rule from Phase J continues.* Hand-built parts that need a direction read it with `useElementDirection` on their own element; Base UI parts inside them are wrapped in a `DirectionProvider` fed by it. Cost if wrong: the Phase J costs (a consumer `DirectionProvider` that disagrees with the DOM loses; a CSS-only `direction` is read on mount only).

## Amendments convention

As in Phases H–J: an implementation that must deviate from this spec does so with evidence and amends the spec in the same commit, as an *Amended in Task N* bullet under the section it changes (fix rounds: *Amended in Task N (fix round M)*; the final review: *Amended in fix wave*). Class strings here are binding; adapt them only with evidence (a test, a screenshot or Tailwind's generated CSS).

## 0. Phase J carry-overs (Task 0)

From the backlog's "Phase J fix-wave re-review (2026-10-08)" and "Phase J notes". Each fix is RED-tested first.

**Resizable: a drag's start resets `latestLayout`.**
- Cause: `latestLayout` is written by `setLayout` and reset to the rendered `layout` only by `useLatest`'s layout effect after a render. In a controlled group whose parent ignores a key change, no render follows, so `latestLayout` keeps the refused layout. A later `pointerdown` + `pointerup` in the same task with no move compares that stale layout with `start` and commits a layout the user never dragged to.
- Fix: in `ResizableHandle`'s `onPointerDown`, set `group.latestLayout.current = layout` next to `start: layout` (`resizable.tsx` ~803).
- Tests (`resizable.test.tsx`, RED first): (1) a controlled group whose parent ignores changes: press → (ignored), then a pointerdown and pointerup dispatched in one task with no move commits nothing; (2) a drag in a controlled-ignore group commits the attempted layout once at the end (as the keys do: the commit reports what the user did, the parent decides) and the rendered sizes stay the controlled ones.

**NavigationMenu: the vertical chevron follows Base UI's direction.**
- Today: `vertical ? "-rotate-90 rtl:rotate-90" : …` (`navigation-menu.tsx` ~210). `rtl:` matches any `[dir=rtl]` ancestor, so an LTR menu inside an RTL `<html>` points its chevron the wrong way.
- Fix: as `MenuSubTrigger` (`menu.tsx` ~290): `const direction = useDirection()` in `NavigationMenuTrigger` (it sits under the NavigationMenu's own `DirectionProvider`), and `vertical ? (direction === "rtl" ? "rotate-90" : "-rotate-90") : "data-popup-open:rotate-180"`.
- Tests: the computed `transform` of `[data-slot=navigation-menu-icon]` in a vertical menu is −90° in LTR, +90° under a wrapper `dir="rtl"`, and −90° for an LTR-island menu (`<div dir="ltr">`) under `<html dir="rtl">` (RED: that case fails today).
- *Amended in Task 0*: the transition classes move to the horizontal branch only; the icon is `cn("flex", vertical ? (direction === "rtl" ? "rotate-90" : "-rotate-90") : "transition-transform duration-200 ease-out motion-reduce:transition-none data-popup-open:rotate-180")`. Evidence: `useElementDirection` reads the root's computed style in its layout effect, which computes the icon at `-90deg` before the class switches, so with the shared `transition-transform` an RTL chevron spun from −90° to +90° for 200ms on mount (the existing RTL test read `-90deg` right after render). A vertical chevron never turns while open, so it needs no transition. The test reads the computed `rotate` (Tailwind v4's `rotate-*` set the `rotate` property, not `transform`) synchronously after render, which also pins "no spin on mount".

**Radio: the focusable-disabled convention.**
- Today Tessera's `Radio` fades with `data-disabled:opacity-50`, but Base UI keeps a disabled RadioGroup's roving radio focusable (`aria-disabled`), so the focused ring fades too (backlog Phase J, found in Task 5).
- Task 0 first pins Base UI's behaviour in a test: in a disabled `RadioGroup` (and inside a disabled `Fieldset`) the roving radio is reachable with Tab; a lone disabled `Radio` in an enabled group is skipped by Tab and the arrows. Expected (to be confirmed by that test; amend if Base UI differs): only the first case stays focusable.
- Fix: the radios that can take focus while disabled (those inside a disabled group, `in-data-disabled`) keep opacity 1 and look muted: unchecked `bg-muted`, checked `bg-muted-foreground border-muted-foreground`, and in forced colors a GrayText border and dot; a lone disabled radio keeps `opacity-50` (it leaves the Tab order, so the §4 fade applies). The exact selector is written against Tailwind's generated CSS (the fade must lose to the group-scoped rule; `data-disabled:` on the radio and `in-data-disabled:` have different specificities) and recorded as an amendment.
- *Amended in review*: `in-data-disabled:` matches any ancestor with `[data-disabled]`, not only the RadioGroup: a disabled Base UI `Field` root or `Fieldset` also carries it. That is intended, because a radio inside a disabled Field or Fieldset is in a disabled group (Base UI propagates the disabled state), so it is the same focusable roving radio and takes the same muted look.
- Tests: a focused radio in a disabled group has opacity 1, `outline-style: solid` / width 2px, the muted fill; forced colors: its border is GrayText; a lone disabled radio in an enabled group has opacity 0.5; axe light and dark on both.
- *Amended in Task 0*: the focusability pin confirmed the expectation (Base UI 1.8.0: the roving radio of a disabled group and of a group in a disabled Fieldset is a Tab stop with `aria-disabled="true"`; a lone disabled radio in an enabled group is skipped by Tab and the arrows). The exact classes, from Tailwind 4.3.3's generated CSS: `in-data-disabled:` compiles to `:where([data-disabled]) .x` (specificity 0,1,0, an ancestor only, never the radio's own attribute) and `data-disabled:opacity-50` to `.x[data-disabled]` (0,2,0), so an `in-data-disabled:opacity-100` would lose. The fade is gated instead: `data-disabled:not-in-data-disabled:opacity-50` (`.x[data-disabled]:not(:where([data-disabled]) *)`, 0,2,0). The muted look: `in-data-disabled:bg-muted in-data-disabled:data-checked:bg-muted-foreground in-data-disabled:data-checked:not-data-invalid:border-muted-foreground` (the last at 0,3,0 to match `data-checked:not-data-invalid:border-primary`, generated after it). Forced colors: `forced-colors:in-data-disabled:border-[GrayText] forced-colors:in-data-disabled:data-checked:not-data-invalid:border-[GrayText]` (the twin is needed for the checked radio: the 0,1,0 rule lost to the primary border, which forced colors then painted CanvasText), and on the indicator `forced-colors:in-data-disabled:bg-[GrayText] forced-colors:in-data-disabled:forced-color-adjust-none` (without `forced-color-adjust-none` the dot's background was forced to Canvas, `rgb(255, 255, 255)`). The test fixture also adds a disabled-Fieldset case for the muted look at opacity 1.

**Popup direction guards** (backlog: "no wrapper-RTL test for Tooltip, PreviewCard or Autocomplete … and no LTR-island guard for Popover or Select"). Tests only; the Phase J fix wave already made the change, so these are expected green on their first run (a red one is a real bug: fix it in this task):
- wrapper `dir="rtl"`: the Tooltip's, PreviewCard's and Autocomplete's positioners carry `dir="rtl"`; a Tooltip and a PreviewCard with `side="inline-end"` open to the left of their trigger; the Autocomplete list with `align="start"` lines its right edge up with the input's right edge (±1px);
- LTR island (`<html dir="rtl">`, the trigger inside `<div dir="ltr">`): the Popover's and Select's positioners carry `dir="ltr"`, and `align="start"` lines the popup's left edge up with the trigger's left edge (±1px).

**README note** (RTL section, beside the portal note): "A `dir` you pass to a `*Content` part sets the popup's text direction only. Its `start` / `end` alignment follows the positioner, which takes the trigger's direction."

**Kbd: a visible keycap border in dark mode.**
- Today `border-border bg-muted`: in dark mode both are `--tsr-surface-800` (`theme.css` lines 110 and 114), so the border vanishes.
- Fix: `border-border` → `border-foreground/20` in `kbdBase` (the ColorPicker swatch precedent: a rim that follows the theme's foreground). `forced-colors:border-[CanvasText]` is unchanged.
- Tests: in light and dark, the keycap's computed border colour composited over its background differs from the background with `contrastRatio` ≥ 1.4 (`src/lib/color.ts`). *Amended in review*: the computed colours are `oklch(…)` / `color-mix(…)` strings, which `parseColor` rejects (`color.ts` ~100), so the test first resolves each to sRGB bytes with the canvas pattern already in `toast.test.tsx` (~51) and `switch.test.tsx` (~211) (`fillStyle` = the colour, `fillRect`, `getImageData`), then builds the `RGBA` values; forced colors unchanged; the Kbd axe tests stay clean. (1.4:1 is a visibility floor for a decorative edge: a `<kbd>` is not a UI component under WCAG 1.4.11.)
- *Amended in Task 0*: the RED run showed the light theme failing too, not only dark: `border-border` on `bg-muted` measured 1.15:1 in light and 1.00:1 in dark. The same `border-foreground/20` fix clears the 1.4 floor in both. The first `Kbd` test's class assertion follows the new class (`border-foreground/20`).

**Backlog:** remove the resolved entries (Resizable `latestLayout`, the popup-direction test gaps, the README `dir` note, the NavigationMenu chevron, the Radio disabled note, the Kbd dark border). Keep "Floating UI does not observe `dir` changes" and the ↵-glyph size note.

## 1. Time helpers and the shared segment plumbing (Task 1)

### 1.1 `src/lib/time.ts` (public)

Server-safe, no dependency, no hooks; exported from `src/index.ts` (the build's only entry is the index, so a module nothing exports or imports fails `verify:consumer`, the Phase J `color.ts` lesson). Every function is pure and unit-tested in `time.test.ts`.

- `type TimeGranularity = "minute" | "second"`, `type HourCycle = "h11" | "h12" | "h23"`.
- `interface TimeParts { hour: number; minute: number; second: number }` (`hour` 0–23).
- `parseTime(value: string): TimeParts | null`: strict `^\d{2}:\d{2}(:\d{2})?$`, hour 0–23, minute and second 0–59; anything else (`"9:30"`, `"24:00"`, `"12:60"`, a trailing space) → `null`.
- `formatTimeValue(parts, granularity)` → `"HH:mm"` or `"HH:mm:ss"` (zero-padded).
- `timeToSeconds(value: string): number | null`, `secondsToTimeValue(seconds, granularity)` (wraps modulo 86400).
- `compareTime(a, b)`: by seconds; throws nothing, `null`s sort first.
- `resolveHourCycle(locale, hourCycle?: 12 | 24): HourCycle`: `new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: hourCycle === undefined ? undefined : hourCycle === 12 }).resolvedOptions().hourCycle`, with `h24` read as `h23`. en-US → `h12`; de-DE → `h23`; ja-JP with `12` → `h11`.
- `formatTime(value, locale, { hourCycle?, granularity? })` → the display text ("9:30 AM", "21:30"): `Intl.DateTimeFormat` with `hour: "numeric"`, `minute: "2-digit"`, `second` when the granularity is second, the resolved `hourCycle`, and `timeZone: "UTC"` on `Date.UTC(2000, 0, 1, h, m, s)`, so no DST gap or local offset can shift it.
- `timeStepMismatch(value, { step, min })` → `true` when `(seconds(value) − seconds(min ?? "00:00")) % step !== 0` (native `<input type="time">` semantics; `step` in seconds, default 60).
- `getTimeSlots({ slotStep, min, max, step, granularity })` → values from `min ?? "00:00"` to `max ?? "23:59"` (inclusive) every `slotStep` minutes, without the ones that mismatch `step`. `slotStep` < 1 or not finite → `[]` with a dev-only warning.

### 1.2 `src/lib/direction.ts` addition

- `getLocaleDirection(locale?: string): "ltr" | "rtl"`: `new Intl.Locale(locale).getTextInfo?.().direction` (or the `textInfo` getter), else a fallback on the language subtag: `ar`, `arc`, `ckb`, `dv`, `fa`, `he`, `ps`, `sd`, `ug`, `ur`, `yi` → `"rtl"` (*Amended in review*: `ku` is dropped, because Kurmanji is written in Latin script by default and `getTextInfo` reports `ltr` for it; Sorani is `ckb`, which stays); an invalid or missing locale → `"ltr"`. Server-safe, unit-tested (`direction.test.ts`, new: en, ar-EG, he, fa-IR, ur-PK, `undefined`, an invalid tag, with `getTextInfo` stubbed away).

### 1.3 `src/lib/time-segments.ts` (internal; lands in Task 2)

Not exported from the package (as `date-segments.ts`); reachable through TimeField, so it is committed with TimeField in Task 2. Pure (only `Intl`), unit-tested in `time-segments.test.ts`.
- `type TimeSegmentType = "hour" | "minute" | "second" | "dayPeriod"`; `type TimeSegmentPart = { type: TimeSegmentType } | { type: "literal"; value: string }`.
- `interface TimeSegments { hour: number | null; minute: number | null; second: number | null; dayPeriod: 0 | 1 | null }`. `hour` is the *displayed* hour (1–12 in `h12`, 0–11 in `h11`, 0–23 in `h23`); `dayPeriod` 0 = AM, 1 = PM.
- `getTimeSegmentOrder(locale, { hourCycle, granularity })`: `formatToParts` of `Date.UTC(2000, 0, 1, 21, 45, 30)` with `timeZone: "UTC"`, `hour: "2-digit"`, `minute: "2-digit"`, `second: "2-digit"` (second granularity), `hourCycle`. `dayPeriod` parts map to the `dayPeriod` segment; consecutive literals merge (as `getDateSegmentOrder`). en-US `h12`: hour ":" minute " " dayPeriod; ko-KR `h12`: dayPeriod " " hour ":" minute; de-DE: hour ":" minute.
- `timeSegmentBounds(type, hourCycle)`: hour `h12` 1–12, `h11` 0–11, `h23` 0–23; minute / second 0–59; dayPeriod 0–1.
- `typeTimeDigit(buffer, digit, bounds)` → `{ buffer, value, advance }`: appends; when the result exceeds `max` or two digits, starts over with `digit`. `value` is the number when it is ≥ `min`, else `null` ("0" in `h12` is `null` with buffer "0"). `advance` when no further digit fits: `Number(next + "0") > max` or two digits. So minutes "0"–"5" wait and "6"–"9" advance; `h23` hours "0"–"2" wait; `h12` hours "1" waits (10–12) and "0" waits.
- `stepTimeSegment(value, delta, bounds, step = 1, offset = 0)`: wraps within the bounds. With `step` > 1 the result snaps to the grid `offset + k × step` within the bounds: from an off-grid value ↑ goes to the next grid value and ↓ to the previous one (07 with step 15, offset 0: ↑ 15, ↓ 00; with offset 10: grid 10, 25, 40, 55, so 07 ↑ 10, ↓ 55 by wrap). A `step` ≥ the segment's range pins the segment to its grid value (`offset`): ↑ / ↓ set it there and change nothing more.
- `timeSegmentSteps(step, min)` → `{ hour, minute, second }` steps and offsets per segment (*Amended in review*: native `step` is counted from `min`, so the arrows must land on that grid, and a step need not divide an hour):
  - second: `step % 60 !== 0` → step `gcd(step, 60)`, offset `min`'s seconds mod that step; else pinned (step 60, offset `min`'s seconds, normally 0);
  - minute: `step % 60 === 0` → step `gcd(step / 60, 60)`, offset `min`'s minutes mod that step; else 1 (offset 0);
  - hour: `step % 3600 === 0` → step `step / 3600` capped to the hour range, offset `min`'s hour mod it; else 1.
  - Examples: `step` 900 with `min` "09:10" → minutes step 15 on the grid 10, 25, 40, 55. `step` 3600 → the minute segment is pinned to `min`'s minutes (00 with no `min`), hours step by 1. `step` 5400 (90 minutes) → minutes step `gcd(90, 60)` = 30, hours by 1; 01:30 is valid, and 02:30 is reachable with the arrows but shown as a step mismatch (the segments are independent; the validity message says why). The arrows never carry between segments, so a cross-hour step can only be fully enforced by validation. An empty segment goes to `min` for ↑ (positive delta) and `max` for ↓ (`h12` hour: ↑ 1, ↓ 12; dayPeriod: ↑ AM, ↓ PM). No carry into the next segment (59 ↑ → 00, the hour unchanged), as native and React Aria.
- `timeSegmentsToValue(segments, hourCycle, granularity)` → the `"HH:mm[:ss]"` value, or `null` unless every needed segment is set (hour, minute, the second for second granularity, the day period for `h11` / `h12`). `h12`: 12 AM → 0, 12 PM → 12; `h11`: hour + 12 × period.
- `timeValueToSegments(value, hourCycle)` → the segments (all `null` for `null`).
- `getDayPeriodLabels(locale, hourCycle)` → `[am, pm]` from the `dayPeriod` parts at 09:00 and 21:00 (en "AM"/"PM", de with `hourCycle: 12` "AM"/"PM", ko "오전"/"오후").
- `dayPeriodFromKey(key, labels)`: `a` / `A` → 0, `p` / `P` → 1 (always); otherwise the first character of a label, compared with `toLocaleLowerCase`, when the two labels' first characters differ (ko's 오전/오후 share one, so only a/p and ↑/↓ work there); else `null`.
- `getTimeSegmentLabel(type, locale)`: `Intl.DisplayNames(locale, { type: "dateTimeField" })` of `hour`, `minute`, `second`, `dayPeriod`; English "hour" / "minute" / "second" / "AM/PM" where unsupported (try/catch, as `getSegmentLabel`).
- Placeholder: every empty time segment shows `"––"` (two U+2013), as React Aria; a first-letter placeholder would collide (de "Stunde" / "Sekunde").
- `parseTimeString(text, locale, hourCycle)` → a value or `null`: a strict ISO `HH:mm[:ss]` first; else ASCII or locale digits (`parseDigit` / `getLocaleDigits` from `date-segments.ts`) in 2–3 groups, plus an AM/PM marker found case-insensitively among the locale's labels, `am`/`pm`/`a`/`p`. "9:30 PM" → `"21:30"`; "21.30" → `"21:30"`; "12:15 am" → `"00:15"`; "25:00" → `null`.
- *Amended in Task 2* (details the text above leaves open, pinned in `time-segments.test.ts`):
  - `typeTimeDigit` advances only with a value (as `typeDigit`): an `h12` hour "0" "0" stays empty and waits rather than moving on from an empty segment.
  - `stepTimeSegment`'s `delta` is in the segment's units and moves `max(1, round(|delta| / step))` grid values, so ↑ is one grid step and PageUp's `max(15, step)` is 15 minutes on any grid; from an off-grid value the first of those moves lands on the neighbouring grid value.
  - `parseTimeString` takes groups of one or two digits, uses `hourCycle` for the locale's day-period labels, reads the hour 0–12 with a marker and 0–23 without, and returns `"HH:mm:ss"` for three groups (TimeField then fits it to its granularity).
  - `getDayPeriodLabels` asks `Intl` for an `h12` clock when given `h23`, so it always names both periods.

### 1.4 `src/components/field/segments.tsx` (internal, `"use client"`)

A move, no behaviour change, so the date suites are the guard (`date-field`, `date-range-field`, `date-picker-editable`, `date-range-picker-editable`, `form`; same test count before and after). From `date-segments-control.tsx`:
- `segmentGroupBase` (today's `dateGroupBase`, renamed; its callers import the new name), `segmentBase`, `segmentLiteralBase` (`"text-muted-foreground"`), `preventedSegmentKeys`;
- `focusFirstEmpty(root, selector)`, `handleGroupMouseDown(event, disabled, selector)`, `useLabelFocusesFirstEmpty(labelId, rootRef, selector)` (each gains the `selector` parameter; the date controls pass `segmentSelector`);
- `useSubmitOnEnter(rootRef)` unchanged;
- `isForeignKey(event)` (a modifier key, or a key that belongs to an IME composition: `isComposing` or `keyCode === 229`);
- `useSegmentTextInput({ containerRef, selector, editable, onText(target, char), onClear(target) })`: today's `beforeinput` / `compositionstart` / `compositionend` handling, moved verbatim (listeners on the container, the composition's DOM text restored before the committed text is typed).
- `date-segments-control.tsx` keeps `useDateSegments`, `segmentSelector`, `sameDate`, `DateSegmentLabels`, and calls the moved helpers.

**Tests (Task 1, except `time-segments.test.ts`, which is Task 2's):**
- `time.test.ts`: `parseTime` table (valid, padded, out of range, malformed); `formatTimeValue` both granularities; `timeToSeconds` / `secondsToTimeValue` round trip and wrap; `compareTime`; `resolveHourCycle` for en-US, en-GB, de-DE, ja-JP (default and `12`), ko-KR, and `24` on en-US; `formatTime` en-US, de-DE, ja-JP `12` and the second granularity, each compared with the string the same `Intl.DateTimeFormat` options produce in the test (*Amended in review*: ICU may put U+202F NARROW NO-BREAK SPACE before "AM"/"PM", so no test in this phase hard-codes "9:30 AM" as a literal; component tests also take their expected time texts from `formatTime`), and a DST-sensitive check (the string for 02:30 is the same whatever the machine's zone: it formats in UTC); `timeStepMismatch` with and without `min`; `getTimeSlots` (30-minute slots 08:00–10:00 = 5 values; `step: 3600` keeps the whole hours; `max` inclusive; bad `slotStep`).
- `time-segments.test.ts`: segment order for en-US, de-DE, ko-KR, ar-EG (with its literals), second granularity; bounds per cycle; the `typeTimeDigit` table for every cycle and type (wait / advance / start over / "0"); `stepTimeSegment` wrap, step snapping both ways, an offset grid, a pinned segment, empty ↑ / ↓; `timeSegmentSteps` for `step` 60, 900 with `min` "09:10", 3600, 5400 and 30 (seconds); `timeSegmentsToValue` / `timeValueToSegments` round trips over all 1440 minutes in `h12`, `h11` and `h23`; `getDayPeriodLabels` en / ko; `dayPeriodFromKey` (a/p, the label letters, ko's shared letter); `getTimeSegmentLabel` with `Intl.DisplayNames` stubbed away; `parseTimeString` table.
- `direction.test.ts` per §1.2.
- The date suites: unchanged and green after the move.

## 2. TimeField (Task 2)

**Parts:** `TimeField` (`src/components/time-field/time-field.tsx`, `"use client"`) and its engine `useTimeSegments` (`time-segments-control.tsx`, internal).

**Props** (`Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "children">` plus):
- `value?: string | null` / `defaultValue?: string | null` (default `null`) / `onValueChange?(value: string | null)`: called with a value once every needed segment forms a time, and with `null` when the user clears a segment of a complete time; partial input never calls it. An unparsable controlled `value` is ignored with a dev-only `console.warn`; a value with seconds under minute granularity is shown without them (not reported back).
- `granularity?: "minute" | "second"` (default `"minute"`).
- `hourCycle?: 12 | 24` (default the locale's, `resolveHourCycle`).
- `min?: string`, `max?: string` (`"HH:mm[:ss]"`; an earlier/later value is shown invalid, not clamped, as DateField); `step?: number` (seconds, default 60; 1 at second granularity, *Amended in Task 2* below).
- `locale?: string` (default `resolveLocale()`: the document's `lang`, else the browser's; pass it when server-rendering, as DateField's doc says).
- `disabled`, `readOnly`, `required`, `name`, `form`, `size?: "sm" | "md" | "lg"` (default `"md"`, `textFieldSizes`), `labels?: TimeFieldLabels`, and the internal `focusScope` (as DateField, for TimePicker).
- `TimeFieldLabels`: `hour`, `minute`, `second`, `dayPeriod` (segment names; defaults `getTimeSegmentLabel`), `empty` (default "Empty"), `incomplete` (default "Enter a complete time."), `rangeUnderflow(minText)` (default `` `Enter a time at or after ${minText}.` ``), `rangeOverflow(maxText)` (default `` `Enter a time at or before ${maxText}.` ``), `stepMismatch(step)` (default: `step % 60 === 0` → `` `Enter a time in ${step / 60}-minute steps.` ``, else `` `Enter a time in ${step}-second steps.` ``). `minText` / `maxText` are `formatTime` in the field's locale and cycle.

**Structure and classes:**
- Group: a `div role="group"` with `data-slot="time-field"`, `data-size`, `data-invalid` / `data-disabled` / `data-readonly`, classes `cn(segmentGroupBase, textFieldSizes[size])`. Named like DateField: `aria-labelledby` (prop, else the Field label id) or `aria-label`; `useLabelableId({ id: null })`; a FieldDescription describes it.
- Segment wrapper: `span data-slot="time-field-segments" dir={getLocaleDirection(locale)}` with `inline-flex items-center gap-0.5`. Inside, the run from the first to the last numeric segment is `span data-slot="time-field-clock" dir="ltr"` with `inline-flex items-center gap-0.5`; the day period sits before or after it in the locale's order.
- Segments: `span role="spinbutton"` with `data-slot="time-field-segment"`, `data-type`, `data-placeholder` when empty, `className={cn(segmentBase, isFirstInRow && "-ms-0.5")}` (the first visual segment pulls back its padding, as DateField's), `contentEditable` when editable, `inputMode="numeric"` (the day period: `inputMode="text"`), `tabIndex` 0 (none when disabled), `aria-label` (the segment name), `aria-labelledby` "segment id + the field's label source" ("hour, Start time"), `aria-valuemin` / `aria-valuemax` (the bounds), `aria-valuenow` (hour as displayed; the day period 0/1), `aria-valuetext` (the number formatted in the locale; the day period's label; empty → `labels.empty`), `aria-invalid`, `aria-required`, `aria-readonly`, `aria-disabled`.
- Literals: `span aria-hidden` with `data-slot="time-field-literal"` and `segmentLiteralBase`.
- Hidden input: `useFormControl({ slot: "time-form-control", value, inputValue: value ?? "", formValue: value ?? "", name: name ?? field.name, registrationName: name, form, required, disabled, readOnly, customValidity, controlRef: the first segment })`. `customValidity` = `labels.incomplete` while partial, else the range message, else the step message, else `""`.

**Keyboard** (on a focused segment; physical keys, React Aria's date-field pattern):

| Key | Effect |
|---|---|
| digit (ASCII, full-width, locale digits) | `typeTimeDigit`; advance to the next segment (DOM order) when no digit fits; in `h11` / `h12` an empty day period becomes AM |
| ↑ / ↓ | `stepTimeSegment` with the segment's step and offset from `timeSegmentSteps(step, min)` (§1.3, *Amended in review*: the grid counts from `min`, as native `step`), wrapping; the day period toggles |
| PageUp / PageDown | hour ±2; minute and second ±max(15, their step); day period toggles |
| Home / End | the segment's min / max (day period AM / PM) |
| `a` / `p` / the labels' letters | on the day period: AM / PM (`dayPeriodFromKey`) |
| Backspace | clears the segment; on an empty segment (nothing typed) moves to the previous one |
| Delete | clears the segment |
| ← / → | the visually neighbouring segment (segments sorted by `getBoundingClientRect().left`, read on the key press), clamped at the ends |
| a literal's character (`:`, `.`) | moves to the next segment |
| Enter | submits the enclosing form after the render that reports the value (`useSubmitOnEnter`) |
| Tab / Shift+Tab | native, through the segments in DOM order |

- Modifier keys and IME composition keys are ignored (`isForeignKey`); IME text and mobile `beforeinput` go through `useSegmentTextInput`.
- Read-only: keys that would edit or scroll are prevented and do nothing; ←/→ and Tab still move. Disabled: no segment is focusable.
- Clicking the group's padding or a literal focuses the first empty segment (`handleGroupMouseDown`); a Field label click does too (`useLabelFocusesFirstEmpty`).
- Paste on the group: `parseTimeString`; a valid time fills every segment and reports it; anything else is ignored.
- Blur: `useFocusScope` over the group (or the `focusScope`).

**RTL** (scope ruling): the group box follows the page; the segment row follows the locale's direction and the clock run is LTR. ←/→ are visual, so they need no direction read.

**Forced colors:** as DateField (the group's Highlight `focus-within` ring, the focused segment Highlight/HighlightText with `forced-color-adjust-none`, from `segmentBase`).

**Reduced motion:** the group's transition is `motion-reduce:transition-none` (from `segmentGroupBase`).

**SSR / hydration:** the locale, the hour cycle, the order and the direction come from `Intl` during render. With an explicit `locale` the server HTML and the hydration render agree; without one `resolveLocale` reads `document.documentElement.lang` on the client only (the DateField caveat, in the prop's doc). No layout is read during render.
- *Amended in review*: for TimeField the caveat is sharper than for DateField. A server in en-US (`h12`) and a client in de-DE (`h23`) render a different *number* of segments (the day period), not just different text, so hydration fails rather than patching text. There is no dev warning for a missing `locale`: a client-only app (Storybook, a Vite SPA) never hydrates and would be warned for nothing, and the component cannot tell that it is hydrating. Instead: the `locale` doc and the README say "required when server-rendering", and a test pins the failure mode (`renderToString` without `locale` under one `lang`, then `hydrateRoot` under a different `document.documentElement.lang`, reports a recoverable error) next to the passing case with an explicit `locale`, so the documentation is backed by evidence.

**Tests (Task 2, `time-field.test.tsx`):**
- structure: a `group` named by `aria-label` / a Field label; en-US minute: three spinbuttons named "hour, Start time", "minute, Start time", "AM/PM, Start time" (or the `Intl.DisplayNames` names); de-DE two; second granularity adds one; literals `aria-hidden`; `data-slot`s; placeholders "––".
- typing: "9" "3" "0" → `onValueChange("09:30")` once (en-US: AM filled); "1" "2" "0" "0" "p" → the *last* `onValueChange` call is `"12:00"` (*Amended in review*: the AM auto-fill completes the time at "1" "2" "0" "0", so `"00:00"` is reported first; the test asserts the call sequence ends with `"12:00"`, not that it was called once); de-DE "2" "1" "4" "5" → `"21:45"`; `h11` (ja-JP `hourCycle={12}`) "0" "5" "3" "0" "p" → `"17:30"`; the auto-advance table (minute "6" advances, "5" waits); full-width and Arabic-Indic digits (ar-EG); a second press after advance replaces.
- the key table above, row by row, asserting `aria-valuenow` / `aria-valuetext` and the reported value: ↑/↓ wrap (`h12` 12 → 1, 11 AM → 12 AM = `"00:xx"`); step 900 snaps minutes (07 ↑ 15, ↓ 00); *Amended in review*: an off-grid `min="09:10"` with `step={900}` snaps the minutes to 10 / 25 / 40 / 55 and 09:25 is valid while 09:15 is a step mismatch; `step={5400}` steps the minutes by 30, 01:30 is valid and 02:30 shows the step message; `step={3600}` leaves the minutes at 00 on ↑ / ↓; PageUp/PageDown; Home/End; Backspace / Delete; Backspace on an empty segment moves back; separators; Enter submits a `<form>` (the `requestSubmit` spy) and is not handled while read-only.
- arrows: en-US in LTR, en-US under `dir="rtl"` (the row still reads hour, minute, AM from left to right: geometry), ar-EG under `dir="rtl"` (the period is leftmost, the hour left of the minute); in each, → focuses the segment to the right.
- `null` reporting: clearing a segment of a complete time reports `null` once; partial input reports nothing.
- min / max / step: an out-of-range time is shown invalid (`aria-invalid` on the segments, `data-invalid` on the group) with the custom validity message; a step mismatch likewise; an overnight `min` > `max` warns once.
- controlled / uncontrolled pairs: `defaultValue`; `value` + `onValueChange`; a controlled parent that ignores changes resets the segments to its value; an unparsable `value` warns and is ignored; seconds dropped under minute granularity.
- paste: "9:30 PM" → `"21:30"`; "21.30" (de-DE); garbage ignored.
- IME: a composition of full-width digits types them (the CDP `Input.imeSetComposition` / `insertText` pattern from `date-field.test.tsx`); a mobile `beforeinput` with `insertText` types.
- Form and Field: `name` → FormData `start=09:30`; `onFormSubmit` reports it under the Field name; `required` with an empty or partial field blocks submit and focuses the first segment; the Field label names the group and clicking it focuses the first empty segment; FieldDescription describes it; Field `disabled` / `invalid`; `form` reaches an outside `<form id>`; the Field blur fires when focus leaves the group.
- read-only and disabled: no edits; disabled segments are not focusable and the group has opacity 0.5.
- focus: a focused segment has the primary fill; the group shows the 1px ring (`outline-style: solid`, width 1px).
- forced colors: the focused segment is Highlight / HighlightText with `forced-color-adjust: none`; the group ring is Highlight; `outline-style: none` before focus.
- reduced motion: the group's `transition-property` is `none`.
- SSR: `renderToString` with `locale="en-US"` contains the three segments; `hydrateRoot` raises no recoverable error.
- axe light and dark: empty, filled, invalid, disabled, read-only, in a Field, ar-EG under `dir="rtl"`; violations and incomplete both `[]`.

**Stories (Task 2, `Components/TimeField`):** Basic, With seconds, 24-hour / 12-hour (`hourCycle`), Min, max and step (09:00–17:00, 15-minute steps), In a Form (Field + submit echo), Disabled and read-only, Locales (en-US, de-DE, ko-KR, ar-EG in an RTL frame).

- *Amended in Task 2*: a number still waiting for its next digit is *held*, as DateField's year: it shows but is not reported until the segment advances, or on blur or Enter (Enter reports it, then submits after that render). Evidence: without the hold, "9" "3" "0" reported `"09:03"` and then `"09:30"` (two calls; the RED run of the "once" test), and de-DE "2" "1" "4" "5" reported `"21:04"` first, contradicting the tests above. With it both report once, and "1" "2" "0" "0" "p" reports `"00:00"` (at the second "0", when the minute advances) and then `"12:00"`, as the review amendment says. Tested: the held minute shows, is reported on blur, and on Enter before the submit.
- *Amended in Task 2*: the `h11` typing case presses "p" on the day-period segment (the ja-JP period is the first segment, so the test moves focus there after "0" "5" "3" "0"); `a` / `p` act only on the day period, as the key table says.
- *Amended in Task 2*: `-ms-0.5` goes on the row's first DOM segment only when the locale's direction is LTR. In an RTL-locale row the first DOM segment sits inside the LTR clock run, away from the group's inline-start edge, so pulling it back would only shift it. The en-US text start is tested against Input's.
- *Amended in Task 2*: `step` defaults to 1 at second granularity (60 at minute granularity). Evidence: the visual check of the With seconds story showed `"14:05:30"` marked invalid, because a 60-second step makes every non-zero second a step mismatch (and pins the second segment); a native time input likewise shows seconds only with a `step` below 60. Tested: a second-granularity `"14:05:30"` is valid and ↑ on the seconds goes to 31.
- *Amended in Task 2*: when `resolveLocale` finds no locale (no `locale` prop and no `lang`), the field uses `Intl.DateTimeFormat().resolvedOptions().locale`, since `resolveHourCycle` / `formatTime` need one.

## 3. TimePicker (Task 3)

**Parts:** `TimePicker` (`src/components/time-picker/time-picker.tsx`, `"use client"`); the slot list is internal (`TimePickerList`, not exported). `ClockIcon` is added to `icons.tsx` (a circle with hands at 12 and 3).

**The shared editable shell.** Task 3 moves `EditableShell` out of `date-picker.tsx` into `src/components/date-picker/editable-shell.tsx` (internal), unchanged in behaviour except two new props: `slotPrefix: "date-picker" | "time-picker"` (its `data-slot`s become `${slotPrefix}-editable` / `-trigger` / `-content` / `-icon`) and `icon: ReactNode`; `initialFocus` becomes a prop (the date pickers pass today's calendar-day query). The editable DatePicker / DateRangePicker suites are the guard (unchanged and green).

**Props:** TimeField's props (value, granularity, hourCycle, min, max, step, locale, disabled, readOnly, required, name, form, size, the group's native props), plus:
- `slotStep?: number` (minutes between list slots, default 30);
- `open` / `defaultOpen` / `onOpenChange` (as the date pickers);
- `container` (PopoverContent's);
- `labels?: TimePickerLabels` = `TimeFieldLabels` + `open` (the icon button's name, default "Choose time"), `dialog` (the popup's name, default "Choose a time"), `list` (the listbox's name, default "Times"), `noTimes` (the empty-list status, default "No times available"; *Amended in review*: it was used below but missing from the type).

**Structure:**
- The shell: `div data-slot="time-picker-editable"` (`relative w-full`) holding the TimeField (`className="pe-10"`, the one Field / Form control) and a `PopoverTrigger` icon button (`buttonVariants({ variant: "ghost", color: "neutral", size: size === "sm" ? "icon-xs" : "icon-sm", className: "absolute inset-y-0 end-1 my-auto outline-offset-0" })`, `aria-label={labels.open}`, `data-slot="time-picker-trigger"`, disabled when the field is disabled or read-only) with `ClockIcon data-slot="time-picker-icon"`.
- The popup: `PopoverContent` anchored to the shell, `align="start"`, `sideOffset={6}`, `aria-label={labels.dialog}`, `data-slot="time-picker-content"`, classes `p-0 w-auto`.
- The list: `div role="listbox" aria-label={labels.list}` with `data-slot="time-picker-list"`, classes `max-h-[min(var(--available-height),16rem)] min-w-36 overflow-y-auto p-1`, one `div role="option"` per `getTimeSlots({ slotStep, min, max, step })` value.
- An option: `id` (`${listId}-${value}`), `data-slot="time-picker-option"`, `data-value`, `aria-selected` (`"true"` for the value's slot, `"false"` otherwise), `data-selected`, `data-highlighted` while it has focus, `tabIndex` 0 for the focused option and −1 for the rest (roving), classes `cn(menuItemBase, "ps-8 tabular-nums data-selected:font-medium")`, holding `span aria-hidden data-slot="time-picker-option-indicator"` (`absolute start-2 flex size-4 items-center justify-center`, a `CheckIcon` when selected) and the text `formatTime(slot, locale, { hourCycle })`.
- An empty slot list (constraints leave nothing) renders `div role="status"` "No times available" (`labels.noTimes`), and the icon button stays enabled so the user learns why.

**Behaviour:**
- Opening focuses the selected option, else the first slot after the value, else (the value is later than every slot) the last slot, else (no value) the first slot (`initialFocus`), and scrolls it into view (`block: "nearest"`). *Amended in review*: a value past the end used to fall through to the first slot, the farthest one from it; it now lands on the nearest.
- List keys: ↓ / ↑ next / previous option (no wrap); Home / End first / last; PageDown / PageUp ±5 options (clamped); Enter / Space select it: the value becomes the slot (with `":00"` seconds in second granularity), `onValueChange` fires, the popup closes and focus returns to the icon button (Popover's return); Escape closes without a change (Popover); Tab leaves (the non-modal popover closes on focus out, Base UI's default). No typeahead (the field is the typing path; a timer-free typeahead is not worth its code here).
- Pointer: hovering an option focuses it (`focus({ preventScroll: true })`, as Base UI menus move the highlight); a click selects.
- The list follows the field: a typed value changes which option is selected next time it opens.
- Field and Form: the TimeField is the one registered control; the popover adds none (the editable DatePicker's rule). Blur: `useFocusScope` over the shell and the popup.
- Escape layering: the popover's root uses Popover's existing `useLayeredEscape`.

**RTL:** the shell and the popup follow the page (`end-1`, `start-2`, `ps-8`, Popover's trigger-direction). The option texts are locale-formatted times in a list, so they follow the page like any text.

**Forced colors:** the focused option uses `menuItemBase`'s transparent outline (painted in forced colors); the selected option is marked by its check icon (shape, not colour).

**Reduced motion:** the popup uses `popupMotion` through PopoverContent.

**Tests (Task 3, `time-picker.test.tsx`):**
- the shell: the icon button named "Choose time" inside the field's border (geometry, LTR and RTL: at the inline end); the TimeField inside it typing as in §2; the editable DatePicker suites unchanged after the shell move.
- open: the popup is a dialog named "Choose a time" holding a listbox "Times"; with `min="09:00" max="11:00" slotStep={30}` there are 5 options whose texts equal `formatTime("09:00", "en-US")` … `formatTime("11:00", "en-US")` (never literals: ICU may use U+202F before AM/PM); `step={3600}` leaves 3; focus lands on the selected option (value 10:00), the first slot after the value (10:10 → the 10:30 option), the last slot for a value after every slot (12:00 → the 11:00 option), or the first with no value; the focused option is in view (its rect inside the list's).
- keys: the table above; Enter on the 10:30 option → `onValueChange("10:30")`, the segments show it, the popup closes, focus is on the icon button; Escape closes with no change; Tab closes.
- pointer: hover focuses an option (`data-highlighted`); click selects.
- second granularity: picking reports `"10:30:00"`.
- empty list: the status text shows.
- Form and Field: one hidden input and one FormData entry for the name with the popup used; `onFormSubmit` reports the picked value; the blur fires only when focus leaves the shell and the popup.
- controlled / uncontrolled `open` and `value`.
- RTL: under `dir="rtl"` the popup's start edge lines up with the shell's right edge (`align="start"`), and the indicators sit at the inline start (`inlineOffsets`).
- forced colors: the focused option has `outline-style: solid` (transparent, painted); the selected option shows the check icon.
- axe light and dark: closed and open (`auditOpenOverlay`); violations and incomplete both `[]`.

**Stories (Task 3, `Components/TimePicker`):** Basic, Business hours (min/max/step, `slotStep={15}`), With seconds, In a Form, Disabled and read-only, RTL.

- *Amended in Task 3*: an option's text is a `span dir={getLocaleDirection(locale)}`, as TimeField's segment row (the scope ruling on locale direction), not plain text that follows the page. Evidence: the visual check of the RTL story showed en-US options reading "AM 9:30" under `dir="rtl"`: the formatted time starts with a digit (a weak character), so the bidi algorithm does not keep "9:30 AM" together in an RTL paragraph. Tested: under `dir="rtl"` the en-US option's digits sit left of "AM"; an ar-EG option has its period at the inline end (left) in an LTR and an RTL page. The option's box (the indicator at `start-2`, the text at `ps-8`) still follows the page.
- *Amended in Task 3*: the popup keeps to the vertical axis. `PopoverContent` gains an optional `collisionAvoidance` prop (passed to the positioner; default unchanged, Base UI's popup rule), the shell an optional `collisionAvoidance` it hands on, and TimePicker passes `{ fallbackAxisSide: "none" }`, the rule Base UI gives its own scrollable dropdowns (`DROPDOWN_COLLISION_AVOIDANCE` in `internals/constants.js`; Popover's default is `fallbackAxisSide: "end"`). Evidence: the visual check of With seconds (800×560) opened the list to the right of the field, because a 16rem list fitted neither below nor above at full height and the popup rule falls back to the other axis before the list shrinks. Tested: in an 800×400 viewport with the field centred, the popup's `data-side` is `top` or `bottom`, it stays inside the viewport and the list scrolls.
- *Amended in Task 3*: the opening scroll is an explicit `scrollIntoView({ block: "nearest" })` on the list's mount. Evidence: without it the option still came into view, but centred (Base UI's initial focus does not pass `preventScroll` for a non-popup element, and Chromium centres a focused element): 112px above and below it in the 48-slot list, against 0px below with the call. Tested: the focused 20:00 option sits at the list's bottom edge.
- *Amended in Task 3*: Space picks on keydown, as Enter. A Space still held when focus returns to the icon button does not click it (Chromium activates a button on keyup only when the press started on it); tested with a held Space. The shell's `initialFocus` is `(popup) => HTMLElement | true`; the empty status carries `data-slot="time-picker-empty"`; with an overnight `min` > `max` the list ignores `max`, as the field does.

## 4. TagsInput (Task 4)

**Parts** (`src/components/tags-input/tags-input.tsx`, `"use client"`; classes in `tags-input-classes.ts`, server-safe). One component with no composition API: `TagsInput`. (A compound API can come later; one control is what forms need.)

**Props** (`Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "children">` for the root, plus):
- `value?: string[]` / `defaultValue?: string[]` (default `[]`) / `onValueChange?(tags: string[])`;
- `inputValue?: string` / `defaultInputValue?: string` (default `""`) / `onInputValueChange?(text: string)`;
- `delimiters?: string[]` (default `[","]`; Enter always commits);
- `max?: number` (default `Infinity`), `allowDuplicates?: boolean` (default `false`), `validate?(tag: string, tags: readonly string[]): string | null` (an error message or `null`);
- `addOnBlur?: boolean` (default `false`);
- `onTagRejected?(rejection: { tag: string; reason: "duplicate" | "max" | "invalid"; message: string })`;
- `disabled`, `readOnly`, `required` (at least one tag), `name`, `form`, `size?: "sm" | "md" | "lg"` (default `"md"`), `placeholder`;
- `inputProps?: ComponentProps<"input">` (the inner input; `aria-label` goes here when there is no Field label, default "Add a tag");
- label functions (§4 convention): `listLabel` (string, default "Tags", the list's name when there is no Field label), `removeLabel(tag)` (default `` `Remove ${tag}` ``), `addedLabel(tag)` (default `` `${tag} added` ``), `removedLabel(tag)` (default `` `${tag} removed` ``), `rejectionLabel(reason, tag, { max })` (defaults: duplicate `` `${tag} is already added` ``, max `` `You can add up to ${max} tags` ``, invalid = the `validate` message).

**Structure:**
- Root `div data-slot="tags-input"` with `data-size`, `data-disabled`, `data-readonly`, `data-invalid` (Field invalid, or an entry rejected while its text is still in the input), `onMouseDown` on its padding focuses the input (`preventDefault` unless the target is the input or a button).
- The tags: `ul role="list"` (`data-slot="tags-input-list"`, class `contents`), named by the Field label (`aria-labelledby`) or `aria-label={listLabel}`; rendered only when there are tags. Each tag: `li data-slot="tags-input-tag"` holding `span data-slot="tags-input-tag-text"` (the text, `truncate`) and, unless read-only, `button type="button" tabIndex={-1} data-slot="tags-input-tag-remove" aria-label={removeLabel(tag)}` with `CloseIcon`.
- The input: a native `<input>` (not Tessera's `Input`, which is Base UI's `Field.Control` and would register a second control: the Phase J ColorInput rule), `data-slot="tags-input-input"`, `id` registered as the Field's labelable id (`useLabelableId`), so the FieldLabel's `for` focuses it; `aria-describedby` from the Field's descriptions; `aria-invalid` when invalid; `enterKeyHint="enter"`, `autoComplete="off"`.
- Status: `span role="status" class="sr-only" data-slot="tags-input-status"`, always rendered (a live region must exist before its text changes), fed by `useStatusMessage` (§4.1).
- Form: `useFormControl({ slot: "tags-input-form-control", name: undefined, value: tags, inputValue: tags.join("\n"), formValue: tags, registrationName: name, required, disabled, readOnly, customValidity: "", controlRef: inputRef })` (the validation input is nameless), plus one `<input type="hidden" name={name ?? field.name} form value={tag} disabled>` per tag when there is a name (Select's recipe). All of them render as siblings after the root, outside its border, so the root's `has-` selectors never see them.
- *Amended in review*: the native name falls back to the Field's name (`name ?? field.name`), as DateField (`date-field.tsx` ~186) and ColorPicker (`color-picker.tsx` ~325) do, so a TagsInput named only by its `Field name` still submits native FormData. React keys: the tag text while duplicates are rejected; the index (`${index}`) when `allowDuplicates` is on (two equal tags would collide), for both the chips and the hidden inputs.

**Classes** (`tags-input-classes.ts`):
- `tagsInputBase`:
  `flex w-full min-w-0 flex-wrap items-center gap-1 rounded-md border border-field-border bg-field text-foreground shadow-xs cursor-text`,
  `not-data-disabled:not-data-invalid:not-focus-within:hover:border-field-border-hover`,
  `outline-none focus-within:outline-1 focus-within:outline-solid focus-within:outline-ring focus-within:border-ring forced-colors:focus-within:outline-[Highlight]`,
  `data-invalid:border-danger data-invalid:focus-within:outline-danger forced-colors:data-invalid:focus-within:outline-[Highlight]`,
  `data-disabled:cursor-not-allowed data-disabled:opacity-50 data-readonly:bg-muted`,
  `transition-[color,background-color,border-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none`.
- `tagsInputSizes`: `sm: "min-h-8 p-0.5 text-sm"`, `md: "min-h-10 p-1 text-sm"`, `lg: "min-h-12 p-1.5 text-base"`.
- `tagsInputTag`: `inline-flex h-6 max-w-full items-center gap-1 rounded-md bg-muted ps-1.5 pe-0.5 text-xs text-foreground forced-colors:border forced-colors:border-[CanvasText] outline-none outline-offset-1 outline-ring has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-solid forced-colors:has-[button:focus-visible]:outline-[Highlight]` (read-only: `pe-1.5`, no button). The ring goes round the whole chip while its remove button is focused (the Rating item precedent).
- `tagsInputTagRemove`: `flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none not-disabled:hover:bg-foreground/10 not-disabled:hover:text-foreground disabled:cursor-not-allowed [&_svg]:size-3` (Combobox's chip remove, keyed on the native `disabled`).
- `tagsInputInput`: `h-7 min-w-16 flex-1 bg-transparent px-1.5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed` (`sm`: `h-6`). *Amended in review* (checked, not changed): this string equals `comboboxChipsInputBase`, a module-local constant in `combobox.tsx` (~27–28, not exported), so `tags-input-classes.ts` writes its own copy. It is not `comboboxInputBase` (`combobox-variants.ts` ~59), which has no `h-7 min-w-16 px-1.5`.

**Behaviour:**
- *Commit:* Enter, or a delimiter key, with text in the input: trim; empty → nothing; otherwise check in order: `max` reached → reason `max`; a duplicate (case-insensitive, unless `allowDuplicates`) → `duplicate`; `validate` returns a message → `invalid`. Accepted: append, clear the input, announce `addedLabel`. Rejected: the text stays, the root gets `data-invalid` and the input `aria-invalid` until the text changes, `onTagRejected` fires and the message is announced. The key is prevented in both cases. Enter with an empty input is not handled, so it submits an enclosing form as in a native input.
- *Typed delimiters without a keydown* (mobile keyboards send "Unidentified"): on `change`, a text that contains a delimiter commits each piece before the last delimiter and keeps the rest.
- *Paste* of text containing a delimiter or a newline: prevented; every trimmed, non-empty piece is committed in order (each checked as above, `max` counted as they go); the rejected pieces stay in the input, joined by `", "`; one announcement sums it up (`addedLabel` for one, else "3 tags added", and the first rejection message). Text without a delimiter pastes natively.
- *Blur* with text and `addOnBlur`: commits as Enter (no `preventDefault` needed).
- *Backspace* with the caret at 0 and no selection, input empty: removes the last tag and announces `removedLabel` (Base UI Combobox chips do the same).
- *Arrow into the tags:* ← (→ in RTL; the direction from `useElementDirection(rootRef)`) with the caret at 0 and no selection focuses the last tag's remove button. On a remove button: ← / → move to the previous / next tag (visual order), → past the last (← in RTL) returns to the input with the caret at 0; Home / End first / last tag; Backspace, Delete, Enter and Space remove that tag and move focus to the tag now at that index, else the previous one, else the input; Escape returns to the input. Tab from a remove button goes on in DOM order (the input).
- *Escape in the input* with text: clears it and calls `claimEscape(event)` (so an enclosing Tessera overlay closes only on the next Escape); without text: not handled.
- *Click* on a remove button removes that tag (focus goes to the input, since a pointer user is not navigating tags); a click on the root's padding focuses the input.
- *IME:* keys during a composition are ignored (`isForeignKey`), so Enter that commits a composition does not add a tag.
- *Read-only:* tags show without remove buttons; the input is `readOnly`; no commit, removal or paste-splitting. *Disabled:* the input and buttons are disabled; nothing is focusable.
- *Controlled:* a controlled `value` that the parent refuses (it keeps its array) stays; the input text is not cleared by a refused add (the text is cleared only when the new value arrives).

**Key table** (the same rules as the bullets above, in one place):

| Focus | Key | Effect |
|---|---|---|
| input | Enter (text) / a delimiter | commit (accepted or rejected); prevented |
| input | Enter (empty) | not handled: native implicit form submission |
| input | Backspace (empty, caret 0) | removes the last tag, announces it |
| input | ← (→ in RTL), caret 0, no selection | focuses the last tag's remove button |
| input | Escape (text) | clears the text, `claimEscape` |
| remove button | ← / → | previous / next tag in visual order; past the last: the input |
| remove button | Home / End | first / last tag |
| remove button | Backspace, Delete, Enter, Space | removes the tag; focus to the tag now at that index, else the previous, else the input |
| remove button | Escape | the input |
| any | Tab / Shift+Tab | native (one stop: the input; a remove button Tabs on to the input) |

**ARIA summary:** input: the Field label (`for`) or `aria-label`, `aria-describedby` (Field descriptions), `aria-invalid`, `aria-required` (native `required` is on the validation input, not this one, so the attribute states it); list: `role="list"`, named by the Field label or `listLabel`; each tag: `listitem` whose remove button is named `removeLabel(tag)`; status: `role="status"` (polite) with the add / remove / reject messages.

**RTL:** the root is a flex row, so tags run right to left; the keys are direction-aware through `useElementDirection(rootRef)`; the classes are logical.

**Forced colors:** chips get a CanvasText border (their `bg-muted` is forced to Canvas); the ring is Highlight; the root's focus-within ring is Highlight.

**Reduced motion:** the root's colour transition is `motion-reduce:transition-none`; chips have no transition.

**SSR:** no browser API during render; the direction is LTR until mount (the `useElementDirection` contract).

### 4.1 `useStatusMessage` (`src/lib/use-status-message.ts`, `"use client"`, internal)

- `useStatusMessage(): [message: string, announce: (text: string) => void]`. The component renders the message in its own always-present `role="status"` element.
- An `announce` with the same text as the current message appends a no-break space (U+00A0), and the next identical one removes it, so the DOM text changes and screen readers speak it again.
- No timer: the message stays until the next one (house rule: no timers in components).
- Shared by TagsInput, FileUpload and DataTable. Tests: `use-status-message.test.tsx` (the same text twice changes the DOM text; a different text replaces it).

**Tests (Task 4, `tags-input.test.tsx`):**
- structure: the input named by the Field label (`for`) or `inputProps["aria-label"]`; the list named "Tags" or by the Field label; one listitem per tag; each remove button named "Remove react" and out of the Tab order; the status region exists before any change.
- commit: Enter and "," add (trimmed); empty Enter submits an enclosing `<form>` (spy) and adds nothing; `delimiters={[",", ";"]}`; a mobile-style `change` containing "a,b," commits two and keeps ""; paste "a, b\nc" adds three; paste with a duplicate and an invalid piece keeps them in the input ("b, x") and announces.
- rejections: duplicate (case-insensitive "React" after "react"), `max={2}`, `validate` (e.g. no spaces); each: the text stays, `aria-invalid` on the input, `data-invalid` on the root, `onTagRejected` with the reason, the message in the status region; typing clears the invalid state; `allowDuplicates` accepts the duplicate.
- removal: Backspace in the empty input removes the last tag; Backspace with text or the caret after 0 does not; clicking × removes that tag and focuses the input; the announcements.
- tag navigation: ← from the caret at 0 focuses the last remove button; ← / → / Home / End move; → past the last returns to the input; Backspace / Delete / Enter / Space remove and move focus as specified; Escape returns; under `dir="rtl"` → enters the tags and ← / → follow the visual order (geometry).
- Escape: clears text and claims it (a Popover around the TagsInput stays open on the first Escape, closes on the second: the ColorPickerPopover layering test pattern).
- IME: a composition's Enter adds nothing (CDP composition); the committed text stays in the input.
- `addOnBlur`.
- read-only and disabled behaviour; disabled opacity 0.5 and cursor `not-allowed`.
- controlled / uncontrolled pairs for `value` and `inputValue`; a controlled parent that refuses an add keeps its tags and the typed text.
- Form and Field: `name="tags"` → `FormData.getAll("tags")` is the tags in order, and an empty value submits no entry; with no `name` prop and only `<Field name="tags">`, native `new FormData(form).getAll("tags")` still holds the tags (*Amended in review*); with `allowDuplicates`, two equal tags give two entries and two chips without a React key warning; `onFormSubmit` reports `string[]` under the Field name; exactly one registered control (one `[data-slot=tags-input-form-control]`, nameless); `required` with no tags blocks submit and focuses the input; `form` reaches an outside form; FieldDescription describes the input; the Field blur fires when focus leaves the input and its tags.
- geometry: the input shares a line with the tags while it fits and wraps below them when it does not; the root's height grows (no overflow); at 390px nothing overflows.
- focus: the root shows the 1px `focus-within` ring while the input is focused; a focused remove button gives its chip a 2px solid ring.
- forced colors: chip CanvasText border; chip ring Highlight; root ring Highlight; `outline-style: none` before focus.
- reduced motion: the root's `transition-property` is `none`.
- SSR: `renderToString` with tags renders them and the hidden inputs; `hydrateRoot` raises no recoverable error.
- axe light and dark: empty, with tags, a rejection showing, read-only, disabled, in a Field, RTL; violations and incomplete both `[]`.

**Stories (Task 4, `Components/TagsInput`):** Basic, Max and validate (lowercase, no spaces, up to 5), Custom delimiters, In a Form (submit echo of `getAll`), Read-only and disabled, Sizes, RTL, Keyboard (a story whose description lists the keys).

- *Amended in Task 4*: a disabled TagsInput puts `aria-disabled="true"` on its list. Evidence: the axe run reported the disabled chips' text as `color-contrast` incomplete (3.25:1 at `opacity-50`, `shortTextContent`): axe exempts only text inside a disabled control or an `aria-disabled` subtree, and a chip's text is in neither (the remove buttons are disabled, the text is not). An inactive control is exempt from WCAG 1.4.3, and the attribute states that state to assistive technology too. Tested by the axe case with a disabled field (light and dark, violations and incomplete both `[]`).
- *Amended in Task 4*: Escape on a remove button also calls `claimEscape` (it returns focus to the input, so it is consumed like the input's Escape with text); inside a Popover the first Escape returns to the input and the second closes. Tested.
- *Amended in Task 4* (details the text above leaves open, pinned in `tags-input.test.tsx`):
  - A delimiter key in an empty input is prevented too, so a delimiter never becomes text.
  - The paste / mobile summary joins its parts with ". " ("a added. b is already added"); "N tags added" is the English text for several adds (no label function, as the spec's list of label functions has none for it).
  - `rejectionLabel`'s third argument is `{ max, message }`, `message` being `validate`'s message (`null` for the other reasons), so a translated `"invalid"` text can include it.
  - `TagRejectionReason` (the `reason` union) is exported with `TagRejection`.
  - The status region is the root's last child (inside its border; `sr-only` takes it out of the flex row); the validation input and the per-tag hidden inputs are the siblings after the root.
  - After a keyboard removal on a remove button, focus moves once the new tags arrive; a controlled parent that refuses the removal keeps the tag and the focus where they are.
- *Amended in Task 6*: a keyboard removal on a remove button moves focus **before** the button unmounts (the FileUpload rule, §5 *Amended in Task 5*): to the next tag's button, else the previous one, else the input. Tags keyed by text unmount the removed tag's button; with `allowDuplicates` (keyed by index) only the last button unmounts, so focus stays put unless the last tag is removed. A controlled parent that refuses the removal gets the focus back on the kept tag's button. Evidence: the Task 5 finding applied here too: `validationMode="onBlur"` marked the Field touched (`data-touched`) after Enter / Delete / Backspace on a focused remove button while focus never left the TagsInput. Tested (both keyings, and the refusing-parent case).

## 5. FileUpload (Task 5)

### 5.1 `src/lib/file.ts` (public)

Server-safe (no `window`), exported from `src/index.ts`; unit-tested in `file.test.ts` with `new File([...], name, { type })`.
- `matchesAccept(file: { name: string; type: string }, accept?: string): boolean`: `accept` as the HTML attribute: comma-separated, trimmed, case-insensitive tokens; `.ext` matches the name's suffix; `type/sub` matches exactly; `type/*` matches the major type; an empty or missing `accept` matches everything; a file with an empty `type` matches only extension tokens.
- `formatFileSize(bytes, locale?)`: SI units (1 kB = 1000 B, the `Intl` unit names): `Intl.NumberFormat(locale, { style: "unit", unit: "byte" | "kilobyte" | "megabyte" | "gigabyte", unitDisplay: "short", maximumFractionDigits: 1 })`, picking the largest unit whose value is ≥ 1 (999 → "999 byte" as `Intl` prints it; 1536 → "1.5 kB"; 5_000_000 → "5 MB"). The tests pin `Intl`'s own output, not hand-written strings.
- `type FileRejectionReason = "type" | "too-large" | "too-small" | "too-many" | "duplicate" | "invalid"`; `interface FileRejection { file: File; reason: FileRejectionReason; message?: string }` (the first failing check only, in the order below).
- `validateFiles(incoming: File[], current: File[], { accept, minSize, maxSize, maxFiles, multiple, validate })` → `{ accepted: File[]; rejected: FileRejection[]; replace: boolean }`, checking each file in order: `type` (`matchesAccept`), `too-small`, `too-large`, `duplicate` (same name, size and `lastModified` as a current or earlier incoming file), `invalid` (`validate(file)` returns a message), `too-many` (more than `maxFiles` in total). When `multiple` is `false` (or `maxFiles === 1`) the first acceptable incoming file replaces the current one (`replace: true`), and the other incoming files are `too-many`.
- `getFileKey(file: File): string`: a stable key per `File` object for React lists (a module `WeakMap` and counter; the same object always gets the same key).

### 5.2 Parts (`src/components/file-upload/file-upload.tsx`, `"use client"`; classes in `file-upload-classes.ts`)

`UploadIcon` is added to `icons.tsx` (an arrow up out of a tray).

- **`FileUpload`** (root): `div data-slot="file-upload"` (`relative flex w-full flex-col gap-3`), `data-disabled`, `data-dragging`, `data-invalid` (Field invalid). It renders the native input and the status region, and provides the context.
  - Props: `value?: File[]` / `defaultValue?: File[]` (default `[]`) / `onValueChange?(files: File[])`, `onFilesRejected?(rejections: FileRejection[])`, `accept`, `minSize`, `maxSize` (bytes), `maxFiles` (default `Infinity`), `multiple` (default `maxFiles !== 1`), `validate?(file: File): string | null`, `disabled`, `required`, `name`, `form`, `aria-label` (the input's name when there is no Field label; default "Choose files", or "Choose a file" when not `multiple`), and label functions `addedLabel(files: File[])` (default `"photo.png added"` for one, `"3 files added"` for more), `removedLabel(file)` (default `` `${file.name} removed` ``), `rejectedLabel(rejections)` (default one: `` `${name} rejected: ${message}` ``, more: `` `${n} files rejected` ``), `rejectionMessage(rejection)` (defaults: type "This file type is not accepted", too-large `` `Larger than ${formatFileSize(maxSize)}` ``, too-small `` `Smaller than ${formatFileSize(minSize)}` ``, too-many `` `More than ${maxFiles} files` ``, duplicate "Already added", invalid = `validate`'s message), `locale` (for sizes; default `resolveLocale()`).
  - The native input: `<input type="file">` with `data-slot="file-upload-input"`, `id` registered as the Field's labelable id (`useLabelableId`), `name={name ?? field.name}` (*Amended in review*: the Field-name fallback, as DateField and ColorPicker), `form`, `accept`, `multiple`, `disabled`, `aria-required={required || undefined}` and **no** native `required` (*Amended in review*: the validation input carries `required`, the TagsInput rule; without `DataTransfer` a dropped file never reaches `input.files`, so a native `required` there would block a submit whose list is not empty), `aria-describedby` (the dropzone's instructions id when a dropzone is rendered, plus the Field's description ids), `aria-invalid` when invalid, and the visually hidden style (`visuallyHiddenInput`, exported from `form-control.tsx` for this). It is the one Tab stop of the picker; it reports `:focus-visible` to the context so the dropzone can draw the ring.
  - Form: `useFormControl({ slot: "file-upload-form-control", name: undefined, value: files, inputValue: files.map((f) => f.name).join("\n"), formValue: files, registrationName: name, required, disabled, customValidity: "", controlRef: nativeInputRef })`. The file input carries the FormData entries (one per file, native).
  - Status: `span role="status" class="sr-only" data-slot="file-upload-status"` (`useStatusMessage`).
- **`FileUploadDropzone`:** a `div` (no role) with `data-slot="file-upload-dropzone"`, `data-dragging`, `data-focus-visible`, `data-disabled`, `data-invalid`. It is a pointer and drop surface for the input: a click opens the picker (`input.click()`, then focuses the input with `preventScroll`), and a drop adds the files. Its children default to: `UploadIcon` (`aria-hidden`), "Drag files here or click to browse" (`span`), and, when `maxSize` is set, `` `Up to ${formatFileSize(maxSize)}` `` (`text-xs`). Friendlier hints ("PNG or PDF, up to 5 MB, 3 files") are the consumer's children. The element holding the text carries the id the input's `aria-describedby` points at (`data-slot="file-upload-instructions"`; a consumer's children go inside it).
  - *Amended in review* (WCAG 2.4.7 and a visible control): the dropzone is the FileUpload's only visible control and its only focus indicator, so it is **required**. The dropzone registers with the root's context in a layout effect; a root that has no registered dropzone after mount logs a dev-only `console.warn` ("FileUpload renders no FileUploadDropzone: the file input has no visible control or focus indicator"). The alternatives were rejected: a `FileUploadTrigger` button would be a second Tab stop doing the same thing as the input, and a ring on the root still leaves no visible control to click. A compact look is the dropzone with the consumer's own children and classes (e.g. `min-h-0 py-2` holding a button-styled `span`, as the Single file story shows).
  - Classes `fileUploadDropzone`:
    `relative flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-field-border bg-field px-6 py-8 text-center text-sm text-muted-foreground [&_svg]:size-6`,
    `outline-none outline-offset-2 outline-ring data-focus-visible:outline-2 data-focus-visible:outline-solid forced-colors:data-focus-visible:outline-[Highlight]`,
    `not-data-disabled:hover:border-field-border-hover not-data-disabled:hover:bg-muted/50`,
    `data-dragging:border-primary data-dragging:bg-primary-soft data-dragging:text-primary-soft-foreground forced-colors:data-dragging:border-[Highlight]`,
    `data-invalid:border-danger`,
    `data-disabled:cursor-not-allowed data-disabled:opacity-50`,
    `transition-[color,background-color,border-color,outline-color] duration-150 ease-out motion-reduce:transition-none`.
- **`FileUploadList`:** `ul role="list"` with `data-slot="file-upload-list"` (`flex flex-col gap-2`), `aria-label` (default "Selected files"); rendered only when there are files. `children?: (files: File[]) => ReactNode`; the default renders `<FileUploadItem key={getFileKey(file)} file={file} />` per file.
- **`FileUploadItem`:** `li data-slot="file-upload-item"` with `data-status`. Props: `file` (required), `progress?: number | null` (0–100; `null` = indeterminate; `undefined` = no bar), `status?: "idle" | "uploading" | "complete" | "error"` (default `"idle"`), `error?: ReactNode` (shown when `status="error"`), `preview?: boolean` (default `true` for `image/*`), `progressLabel(file)` (default `` `Uploading ${file.name}` ``), `children` (replaces the inner layout; the remove button stays available as `FileUploadItemRemove`).
  - Classes `fileUploadItem`: `flex items-center gap-3 rounded-md border border-border bg-card p-2 text-sm data-[status=error]:border-danger`.
  - Inside: a `size-10 shrink-0 overflow-hidden rounded-sm bg-muted` box (`data-slot="file-upload-item-preview"`) holding the preview `img` (`alt=""`, `size-full object-cover`; decorative, the name is next to it) or a `FileIcon`; a `min-w-0 flex-1` column with the name (`truncate font-medium`, `data-slot="file-upload-item-name"`) and `formatFileSize` (`text-xs text-muted-foreground tabular-nums`); `Progress size="sm"` with `aria-label={progressLabel(file)}` when `progress !== undefined`; the error (`text-xs text-danger` with `AlertIcon`, `data-slot="file-upload-item-error"`); and `FileUploadItemRemove`.
  - Preview URL: `URL.createObjectURL(file)` in an effect (so the server HTML and the first client render show the icon box), revoked in its cleanup and when the file changes.
- **`FileUploadItemRemove`:** `Button variant="ghost" color="neutral" size="icon-sm"` with `CloseIcon`, `data-slot="file-upload-item-remove"` (through a `render` element, the ColorEyeDropper precedent), `aria-label={removeLabel(file)}` (default `` `Remove ${file.name}` ``). It removes the file, announces `removedLabel`, and moves focus to the next item's remove button, else the previous one, else the native input.
- **`FileUploadRejections`:** `ul role="list"` with `data-slot="file-upload-rejections"` (`flex flex-col gap-1 text-sm text-danger`), rendered only while the last batch had rejections; one `li` per rejection: `AlertIcon` (`aria-hidden`) + "name — message". Cleared by the next accepted add or a removal. Not a live region (the status region announces).

**Behaviour:**
- *Native pick:* the input's `change` → `validateFiles(input.files, current)`; accepted files are appended (or replace, single mode), `onValueChange` fires, the rejections go to `onFilesRejected`, the context and the status (`addedLabel` / `rejectedLabel`, one message per batch: accepted first, then rejected). Then the full list is written back to `input.files` (`DataTransfer`), since a native pick replaces the input's files.
- *Write-back:* a layout effect keyed on the list sets `input.files = dataTransfer.files` built from it. Without `DataTransfer` (feature-tested once), the input is left alone (documented).
- *Drag and drop on the dropzone:* `dragenter` / `dragleave` keep a depth counter; `data-dragging` is set while the counter is > 0 and the drag carries `"Files"` in `dataTransfer.types`. `dragover` prevents the default and sets `dropEffect` to `"copy"` (`"none"` while disabled). `drop` prevents the default, resets the counter and processes `dataTransfer.files` like a pick; a dropped folder (`items[i].webkitGetAsEntry()?.isDirectory`) is rejected with reason `type`. Disabled: drops are ignored.
- *Keyboard:* Tab reaches the hidden native input (the dropzone shows the 2px ring); Enter / Space open the system picker (native). Each item's remove button is a Tab stop. No other keys.
- *Disabled:* the input, the dropzone and the remove buttons are disabled; opacity 0.5 on the dropzone (it leaves the Tab order).
- *Controlled:* a parent that refuses a change keeps its files, and the input's files are written back from the controlled list.

**ARIA and keyboard summary:**

| Element | Role / name | Keys |
|---|---|---|
| native input (visually hidden) | the platform's file button; named by the Field label (`for`) or `aria-label` ("Choose files"); `aria-describedby` = dropzone instructions + Field descriptions; `aria-invalid`; `aria-required` (native `required` is on the validation input) | Tab reaches it; Enter / Space open the picker (native) |
| dropzone | none (presentational; mirrors the input's focus ring) | none: pointer and drop only |
| list | `role="list"`, "Selected files" | none |
| item remove button | `button`, `removeLabel(file)` | Tab stop; Enter / Space remove, focus moves on |
| item progress | `progressbar` (Base UI Progress), `progressLabel(file)`, `aria-valuenow` or indeterminate | none |
| rejections | `role="list"` (not live) | none |
| status | `role="status"` (sr-only, polite) | none |

**RTL:** the item row and the rejections are flex rows with logical classes; the dropzone is centred. Nothing reads the direction.

**Forced colors:** the dropzone's dashed border is forced to CanvasText; dragging switches it to Highlight; the ring is Highlight; the error item keeps its icon and text (not colour alone).

**Reduced motion:** the dropzone transition is `motion-reduce:transition-none`.

**SSR:** no `File` methods, object URLs or `DataTransfer` during render; `defaultValue` is normally `[]` on the server.

**Tests (Task 5):**
- `file.test.ts`: the `matchesAccept` table (extensions, MIME, wildcards, case, spaces, empty type, empty accept); `formatFileSize` (0, 999, 1000, 1536, 5 MB, 2.5 GB; de-DE uses a comma); `validateFiles` (each reason, the order of checks, duplicates within a batch and against the current list, `maxFiles` counting, single-mode replacement); `getFileKey` stability.
- `file-upload.test.tsx`:
  - structure: the input named by the Field label (`for`) or "Choose files"; described by the dropzone text and the Field description; the dropzone has no role; the status region exists before any change;
  - pick: `userEvent.upload(input, files)` adds them; `onValueChange` reports the full list; `multiple={false}` replaces; the input's `files` equal the list after a second pick (write-back);
  - rejections: `accept="image/*,.pdf"` rejects a `.txt`; `maxSize` rejects a big file; `maxFiles={2}` rejects the third; a duplicate; `validate`; each: `onFilesRejected` with the reason, `FileUploadRejections` shows "name — message", the status announces; a later accepted pick clears the rejections;
  - drag and drop: dispatched `dragenter` / `dragover` / `dragleave` / `drop` events with a `DataTransfer` holding `File`s: `data-dragging` while over (also over a child), cleared on leave and drop; the drop adds the files; `dropEffect` is `"none"` while disabled and the drop is ignored; a drag without files does not set `data-dragging`;
  - the click on the dropzone calls the input's `click` (spy) and focuses the input;
  - focus: Tab focuses the input and the dropzone has `data-focus-visible` and a 2px solid outline; a pointer click focuses the input without the ring;
  - the list: name, size ("1.5 kB"), an image preview `img` with a `blob:` src after mount and none in the server HTML, its URL revoked on removal (spy on `URL.revokeObjectURL`); a non-image shows `FileIcon`;
  - progress and status: `progress={40}` renders a progressbar named "Uploading photo.png" at 40; `null` is indeterminate; `status="error"` with `error` shows the message and the danger border;
  - removal: the remove button named "Remove photo.png" removes it, announces, and moves focus next / previous / to the input;
  - controlled / uncontrolled pairs; a refusing parent keeps its list and the input's files;
  - Form and Field: `name="attachments"` → `FormData.getAll("attachments")` holds the listed `File`s (including dropped ones); `onFormSubmit` reports `File[]` under the Field name; one registered control (one nameless `[data-slot=file-upload-form-control]`); `required` with no files blocks submit and focuses the input; the file input has `aria-required="true"` and no `required` attribute, and a list holding only dropped files submits with `DataTransfer` stubbed away (`vi.stubGlobal("DataTransfer", undefined)` for the write-back; the drop event is built before the stub); with no `name` prop and only `<Field name="attachments">`, native `new FormData(form).getAll("attachments")` holds the files (*Amended in review*); the Field blur fires when focus leaves the input; disabled submits nothing;
  - a FileUpload with no `FileUploadDropzone` warns once in development (spy), and one with a dropzone does not (*Amended in review*);
  - forced colors: the dropzone border is CanvasText, Highlight while dragging; the ring Highlight; `outline-style: none` before focus;
  - reduced motion: the dropzone's `transition-property` is `none`;
  - SSR: `renderToString` with a `defaultValue` file renders its name and the icon box; `hydrateRoot` raises no recoverable error;
  - axe light and dark: empty, dragging, with files (image and PDF, one uploading, one error), rejections showing, disabled, in a Field; violations and incomplete both `[]`.

**Stories (Task 5, `Components/FileUpload`):** Basic, Images with previews, Single file (avatar), Constraints and rejections, Upload progress (a story-local fake uploader driven by `setTimeout`; stories may use timers, components may not), In a Form, Disabled, RTL.

- *Amended in Task 5*: a disabled dropzone puts `aria-disabled="true"` on itself. Evidence: the axe run reported the disabled dropzone's text as a `color-contrast` violation (2.02:1 light, 2.53:1 dark at `opacity-50`); the dropzone is no form control, so axe's disabled exemption did not apply. The TagsInput rule (§4, *Amended in Task 4*): an inactive control is exempt from WCAG 1.4.3, and the attribute states it. Tested by the axe case with a disabled FileUpload (light and dark, violations and incomplete both `[]`).
- *Amended in Task 5*: a removal moves focus **before** the item unmounts (to the next item's remove button, else the previous one, else the input), and a controlled parent that refuses the removal gets the focus back on the kept item's button. Evidence: Chromium reports the removal of a focused element as a `focusout` with no `relatedTarget`, which `useFocusScope` took for a Field blur, so `validationMode="onBlur"` showed "fill out this field" while focus was still inside (the Field-blur test failed). Tested (the onBlur test and the refusing-parent test).
- *Amended in Task 5* (details the text above leaves open, pinned in `file-upload.test.tsx`):
  - `removeLabel(file)` (default `` `Remove ${file.name}` ``) is a root label function, as the other strings; `FileUploadItemRemove` also takes an `aria-label` that wins.
  - The rejections `onFilesRejected` receives and `FileUploadRejections` shows carry `message` filled with `rejectionMessage(rejection)` (or the default), so the reported, shown and announced texts agree.
  - `too-many` counts the limit as 1 in single mode, and the default reads "More than 1 file" (singular) there, never "More than Infinity files".
  - One announcement per batch joins its parts with ". " ("report.pdf added. 2 files rejected"), as TagsInput.
  - The write-back also runs after a pick a controlled parent refuses (a pick counter re-runs the layout effect), since the native pick replaced `input.files` without changing the list.
  - A drag whose `dataTransfer.types` has no `"Files"` is not handled at all (no `preventDefault`, so it is no drop target). While disabled, `dragover` and `drop` are still prevented (`dropEffect` `"none"`), so the browser does not open the dropped file instead.
  - The dropzone prevents `mousedown`'s default (focus stays where it is; no text selection), and its click focuses the input with `{ preventScroll: true, focusVisible: false }`, so a pointer click shows no ring (tested).
  - The preview box adds `flex items-center justify-center text-muted-foreground [&_svg]:size-5` to centre the file icon; the progress bar and the error sit in the name column under the size, so the row keeps its three columns.
  - A preview image the browser cannot decode (a corrupt file, HEIC in Chromium) falls back to the file icon (`onError`); the visual check showed the broken-image glyph for an undecodable PNG. Tested.
  - `src/lib/file.ts` also exports the `ValidateFilesOptions` and `ValidateFilesResult` types.
  - Tests drop the very same `File` objects for the duplicate cases: a pick through the test driver (`userEvent.upload`) restamps `lastModified`. Outside a real drag session Chromium ignores writes to `dropEffect`, so those tests give the `DataTransfer` an own writable `dropEffect`.
  - Biome's `useAriaPropsSupportedByRole` flags `aria-required` on the file input; ARIA in HTML allows it there, so the line carries a `biome-ignore` naming the review rule.

## 6. The data-table engine (Task 6)

### 6.1 `src/lib/data-table.ts` (public, server-safe, pure)

Exported from `src/index.ts` (types and functions: they also serve server-side sorting and paging). Unit-tested in `data-table.test.ts` with plain arrays (no DOM, no React).

*Amended in review*: the exact `src/index.ts` additions in Task 6:
- from `./lib/data-table`: `nextSorting`, `defaultCompare`, `sortRows`, `getPageCount`, `clampPageIndex`, `paginateRows`, `getRowRange`, `toggleRowSelection`, `getPageSelection`, `togglePageSelection`, `getVisibleColumns`, `toggleColumnVisibility`, and the types `DataTableColumn`, `SortDirection`, `SortingState`, `PaginationState`, `ColumnVisibility`, `SelectionMode`, `PageSelection`;
- from `./components/data-table`: `useDataTable` and the types `UseDataTableOptions`, `DataTableInstance`, `DataTableRow`.
- Task 7 adds `DataTable`, `DataTableColumnsMenu`, `DataTablePagination` and their `*Props` types.

**Types:**
- `interface DataTableColumn<TData>`: `id: string` (unique); `header: ReactNode`; `label?: string` (plain text for menus and announcements; default `header` when it is a string, else `id`); `accessor?: (row: TData) => unknown`; `cell?: (row: TData) => ReactNode` (default `String(accessor(row) ?? "")`); `sortable?: boolean` (default `accessor !== undefined || compare !== undefined`); `compare?: (a: TData, b: TData) => number`; `hideable?: boolean` (default `true`); `align?: "start" | "end"` (default `"start"`); `rowHeader?: boolean` (renders the cell as `th scope="row"`); `headerClassName?`, `cellClassName?`.
- `type SortDirection = "ascending" | "descending"`; `type SortingState = { id: string; desc: boolean }[]` (index 0 is the primary sort).
- `interface PaginationState { pageIndex: number; pageSize: number }`.
- `type ColumnVisibility = Record<string, boolean>` (a missing id is visible).
- `type SelectionMode = "none" | "single" | "multiple"`.
- `type PageSelection = "all" | "some" | "none"`.

**Functions:**
- `nextSorting(sorting, columnId, { multi, maxMultiSort = 3 })`:
  - not `multi`: when `sorting` is exactly `[{ id: columnId }]`: ascending → descending, descending → `[]`; otherwise → `[{ id: columnId, desc: false }]`;
  - `multi`: when the column is in `sorting`: ascending → descending in place, descending → removed; otherwise appended ascending; beyond `maxMultiSort` the lowest-priority entry (the last before the new one) is dropped.
- `defaultCompare(a, b, collator)`: two finite numbers by value; two `Date`s by time; two booleans `false < true`; otherwise `collator.compare(String(a), String(b))`.
- `sortRows(rows, sorting, columns, { collator })`: a new array, stable (`Array.prototype.sort` is stable since ES2019), comparing by each sorting entry in order with the column's `compare` or `defaultCompare` on the accessor's values; `null` / `undefined` values sort last in both directions; an unknown or non-sortable id is skipped. The collator default is `new Intl.Collator(locale, { numeric: true, sensitivity: "base" })`.
- `getPageCount(total, pageSize)` = `max(1, ceil(total / pageSize))`; `clampPageIndex(pageIndex, pageCount)`; `paginateRows(rows, pagination)`; `getRowRange(pagination, total)` → `{ from, to }` 1-based (`{ from: 0, to: 0 }` for none).
- `toggleRowSelection(selection, id, mode)`: `single` → `[id]`, or `[]` when it was the selected one; `multiple` → added or removed (order kept); `none` → unchanged.
- `getPageSelection(selection, pageIds)` → `"all"` (every page id selected, and the page is not empty), `"some"`, or `"none"`.
- `togglePageSelection(selection, pageIds)`: when `"all"` → removes the page ids; otherwise adds the missing ones.
- `getVisibleColumns(columns, visibility)`; `toggleColumnVisibility(visibility, id, columns)`: refuses (returns the same object) to hide the last visible column or a column with `hideable: false`.

### 6.2 `useDataTable` (`src/components/data-table/use-data-table.ts`, `"use client"`)

**Options:** `data: readonly TData[]`, `columns: DataTableColumn<TData>[]`, `getRowId?(row, index): string` (default `String(index)`; with selection on and no `getRowId`, a dev-only `console.warn`, since index ids do not survive sorting by the server or a refetch), `getRowLabel?(row): string` (for the row checkbox's name; default the first `rowHeader` column's accessor text, else the id), `locale?`;
- sorting: `sorting` / `defaultSorting` (default `[]`) / `onSortingChange`, `enableMultiSort` (default `true`), `maxMultiSort` (default 3);
- selection: `selectionMode` (default `"none"`), `rowSelection` / `defaultRowSelection` (`string[]`, default `[]`) / `onRowSelectionChange`, `isRowSelectable?(row)`;
- pagination: `pagination` / `defaultPagination` (default `{ pageIndex: 0, pageSize: 10 }`) / `onPaginationChange`, `paginate` (default `true`; `false` shows every row);
- visibility: `columnVisibility` / `defaultColumnVisibility` (default `{}`) / `onColumnVisibilityChange`;
- `manual?: boolean` with `rowCount?: number`: the data is already the sorted current page (server-side); sorting and paging change state only, and `rowCount` drives the page count.

**Returns `DataTableInstance<TData>`:**
- `columns`, `visibleColumns`, `rows: DataTableRow<TData>[]` (the current page: `{ id, original, index, selected, selectable }`), `rowCount` (after sorting, before paging; `manual`: `rowCount`), `pageCount`, `pageIds`;
- `state: { sorting, rowSelection, pagination, columnVisibility }` (the effective, clamped page index);
- sorting: `toggleSort(id, { multi })`, `setSorting`, `getSort(id)` → `{ direction: SortDirection | null; priority: number | null }` (1-based), `primarySortId`;
- selection: `selectionMode`, `toggleRow(id)`, `togglePage()`, `pageSelection`, `selectAll()` (every selectable row of `data`), `clearSelection()`, `selectedRows: TData[]` (rows of `data` whose id is selected; ids not in `data` are kept in state but not returned);
- paging: `setPageIndex(i)`, `setPageSize(n)` (keeps the first visible row on screen: the new index is `floor(firstRowIndex / n)`), `nextPage()`, `previousPage()`, `canNextPage`, `canPreviousPage`;
- visibility: `toggleColumn(id)`, `canHideColumn(id)`;
- `getRowLabel(row)`, `locale`.
- `toggleSort` resets `pageIndex` to 0 (scope ruling). Every setter calls its `on…Change` (through `useControllableState`) only when the state changes.
- The derived rows are memoised on `data`, `columns`, `sorting`, the collator and pagination, so a re-render with the same inputs does not re-sort (tested with a `compare` spy).

**Tests (Task 6):**
- `data-table.test.ts` (pure, no DOM): `nextSorting` tables (plain cycle; plain on another column replaces; multi append / flip / remove; `maxMultiSort`); `defaultCompare` (numbers, dates, booleans, numeric strings "item 2" < "item 10", case and accents equal under `sensitivity: "base"`); `sortRows` (stability with equal keys; multi-key; desc; nulls last in both directions; custom `compare`; unknown id ignored; the input array not mutated); paging (`getPageCount` with 0 rows = 1; clamp; `getRowRange` for the last partial page and for none); selection (single / multiple / none; page states; toggle page in both directions; empty page is `"none"`); visibility (the last visible and non-hideable columns refused).
- `use-data-table.test.tsx` (`renderHook` from `vitest-browser-react`): uncontrolled and controlled pairs for each state slice; `on…Change` not called for a no-op; sorting resets the page; a page index beyond the end after `data` shrinks is clamped in `state` and `rows`; `setPageSize` keeps the first visible row; `selectAll` / `clearSelection`; `selectedRows` ignores ids no longer in `data`; `isRowSelectable` rows are skipped by `togglePage` and `selectAll`; `manual` mode does not sort or slice and uses `rowCount`; the dev warning for selection without `getRowId`; memoisation (the `compare` spy is not called on an unrelated re-render).

- *Amended in Task 6* (details the text above leaves open, pinned in `data-table.test.ts` and `use-data-table.test.tsx`):
  - Engine edges: `nextSorting`'s options default to `{ multi: false, maxMultiSort: 3 }`; `defaultCompare`'s collator is optional (a numeric, base-sensitivity collator for the runtime locale), and two values of mixed or non-finite types compare as strings; `sortRows` takes `{ collator?, locale? }` and returns a copy also for an empty sort; a column that is `sortable` but has neither `accessor` nor `compare` is skipped by `sortRows` (nothing to sort by); `getPageCount` is 1 for a page size that is not positive; `paginateRows` does not clamp (a page past the end is empty, callers clamp); `getRowRange` past the end is `{ from: 0, to: 0 }`; `toggleRowSelection` in `"none"` and `togglePageSelection` with nothing to add return the same array; `toggleColumnVisibility` ignores an unknown id and always lets a hidden column (even a non-hideable one) be shown.
  - `setSorting` resets the page as `toggleSort` does (the scope ruling covers any sort change). `toggleSort` ignores an unknown or non-sortable column; a column with `sortable: true` and no accessor (server-side) can be toggled.
  - The page-index clamp is derived, not stored: after `data` shrinks, `state.pagination` and `rows` show the clamped page, and nothing calls `onPaginationChange`. With `paginate={false}` the effective page index is 0. Every setter compares against the effective state for the no-op rule.
  - `pageIds` are the ids of every row on the page; `pageSelection` and `togglePage` count only its selectable rows, so a page whose selectable rows are all selected is `"all"` (the header checkbox ignores rows `isRowSelectable` refuses). `togglePage` and `selectAll` act only in `"multiple"` mode; `toggleRow` does nothing in `"none"` mode or for a row of `data` that is not selectable. `rows[].selectable` is `false` in `"none"` mode.
  - The instance's `getRowLabel` takes a `DataTableRow` (the option takes the original row), so it can fall back to the row's id; an empty `rowHeader` text falls back to the id too.
  - `canHideColumn(id)` is "`toggleColumn(id)` would change it": `true` for a hidden column (so its menu item stays enabled to show it again), `false` for an unknown id, a non-hideable column or the last visible one.
  - The dev warning fires once per hook instance (a `console.warn` in an effect, the FileUpload pattern).
- *Amended in Task 7*: the instance also returns `canSort(id)` (`toggleSort`'s rule: `sortable`, else an `accessor` or `compare`; `false` for an unknown id) and `enableMultiSort`. Evidence: DataTable renders a sort button only where `toggleSort` acts and the multi-sort hint only while Shift adds a column, and neither the rule nor the option was reachable from the instance. Tested in `use-data-table.test.tsx`.

## 7. DataTable parts (Task 7)

**Parts** (`src/components/data-table/data-table.tsx`, `"use client"`; classes in `data-table-classes.ts`). Icons: `ArrowUpIcon`, `ArrowDownIcon`, `ArrowUpDownIcon` move from `table.tsx` into `icons.tsx` (house rule: shared icons live there), plus a new `Columns3Icon`.

**Table fixes that DataTable needs** (in this task, guarded by `table.test.tsx`; an expectation that pinned `left` changes to `start`, recorded as an amendment):
- `TableHead`: `text-left` → `text-start` (RTL headers sat on the wrong side).
- `TableSortButton`: `-ml-2` → `-ms-2`, plus `forced-colors:focus-visible:outline-[Highlight]` and `transition-[color,background-color,outline-color] duration-150 ease-out motion-reduce:transition-none`.
- `PaginationPrevious` / `PaginationNext`: the chevrons get `rtl:-scale-x-100` (they are server-safe, so a CSS variant is the only option; the `rtl:` ancestor limit is recorded in the backlog).
- *Amended in review*: an optional `"data-slot"` prop on `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` and `TableSortButton`. Today each sets `data-slot` *after* `{...props}` (`table.tsx` ~20, 32, 42, 84, 103, 120, 214), so DataTable's slots below could not be applied. Each part takes `"data-slot": dataSlot = "<today's name>"` and renders it, as `PaginationLink` and `PopoverContent` already do (`popover.tsx` ~61, 79). On `Table` the prop names the `<table>`; the container keeps `table-container`. Defaults are unchanged, so existing selectors and tests hold. Test (`table.test.tsx`): each part renders its default slot, and a passed `data-slot` replaces it.

**`DataTable<TData>`:** renders the whole table from the instance.
- Props: `table: DataTableInstance<TData>` (required), `caption?: ReactNode` (a `TableCaption`; or name it with `aria-label` / `aria-labelledby`), `loading?: boolean`, `loadingRows?: number` (default `min(pageSize, 5)`), `empty?: ReactNode` (default "No results."), label functions `selectAllLabel` (string, default "Select all rows on this page"), `selectRowLabel(label: string)` (default `` `Select ${label}` ``), `sortStateLabel(direction, priority, count)` (default: "sorted ascending" / "sorted descending", plus `` `, ${priority} of ${count}` `` when `count > 1`), `sortAnnouncement(label, direction | null)` (default `` `Sorted by ${label}, ${direction}` `` / "Sorting cleared"), `multiSortHint` (string, default "Shift-click to sort by more than one column"), `getRowProps?(row)` (extra `tr` props), and the `Table` props (`className`, `containerClassName`).
- Table: `Table` with `data-slot="data-table"`, `aria-busy` while `loading`, `aria-describedby` the multi-sort hint (a visually hidden `span`, rendered once when multi-sort is on and a column is sortable).
- Header: `TableHeader` > `TableRow`:
  - selection column (`selectionMode !== "none"`): `TableHead` with `data-slot="data-table-select-head"` and `w-10`; multiple: a `Checkbox` (`aria-label={selectAllLabel}`, `checked={pageSelection === "all"}`, `indeterminate={pageSelection === "some"}`, `disabled` on an empty page, `onCheckedChange={togglePage}`, `data-slot="data-table-select-all"`); single: an `sr-only` "Select" text (from `selectColumnLabel`, default "Select");
  - per visible column: `TableHead` with `sort` = the direction **only for the primary sort column** (scope ruling), `data-slot="data-table-head"`, `text-end` when `align: "end"`. A sortable column's content is `TableSortButton` (`data-slot="data-table-sort-button"`, `direction` from `getSort`; when end-aligned it adds `ms-0 -me-2`, *Amended in review*: tailwind-merge does not treat `-ms-2` and `-me-2` as conflicting, so the start margin must be reset explicitly) holding the header, a priority badge when more than one column is sorted, and `span class="sr-only"` with `sortStateLabel` when sorted. Plain click → `toggleSort(id, { multi: false })`; Shift+click, Shift+Enter and Shift+Space → `toggleSort(id, { multi: true })` (handled on `keydown` with `preventDefault` for the keyboard, so exactly one toggle happens; `event.shiftKey` on click for the pointer). Each sort change announces `sortAnnouncement` through the table's status region (`span role="status" class="sr-only" data-slot="data-table-status"`, `useStatusMessage`).
  - priority badge: `span aria-hidden data-slot="data-table-sort-priority"` with `inline-flex size-4 items-center justify-center rounded-full bg-muted text-[10px] font-medium tabular-nums text-muted-foreground forced-colors:border forced-colors:border-[CanvasText]`.
- Body (`TableBody`):
  - rows: `TableRow` with `data-slot="data-table-row"`, `data-state="selected"` when selected (the existing selected look, with Highlight / HighlightText and `forced-color-adjust: none` in forced colors), `getRowProps(row)` merged first. Selection cell `TableCell` (`data-slot="data-table-select-cell"`, `w-10 forced-colors:forced-color-adjust-auto`, so the Checkbox is painted with system colours even inside a selected row whose `forced-color-adjust: none` it would otherwise inherit) holding `Checkbox` (`aria-label={selectRowLabel(getRowLabel(row))}`, `checked={selected}`, `disabled={!selectable}`, `onCheckedChange={() => toggleRow(id)}`, `data-slot="data-table-select-row"`).
    - *Amended in review*, single selection: the cell holds a native `<input type="radio">` instead, `name` = one `useId`-generated name per DataTable, `checked={selected}`, `disabled={!selectable}`, `onChange` → `toggleRow(id)` (it fires only when the radio becomes checked), the same `aria-label`, `data-slot="data-table-select-row"`, classes `size-4 cursor-pointer accent-primary ${toggleFocusClasses} forced-colors:focus-visible:outline-[Highlight] disabled:cursor-not-allowed`. The browser groups the radios by name across rows: one Tab stop, the arrows move and select, and screen readers say "radio button, 2 of 5". Native `accent-color` keeps system colours in forced colors. The selected row cannot be unchecked by the user; a consumer clears with `clearSelection()`. Then per visible column a `TableCell` (`th scope="row"` with `TableCell`'s classes for `rowHeader` columns), `text-end` when end-aligned, rendering `cell(row)`.
  - empty: one `TableRow data-slot="data-table-empty"` with a `TableCell colSpan={visible columns + selection column}` and `h-24 text-center text-muted-foreground`, holding `empty`.
  - loading: `loadingRows` rows, each `aria-hidden` (the table's `aria-busy` speaks for them), with a `Skeleton` (`h-4 w-full max-w-32`) per cell; the selection column shows a `Skeleton size-5 rounded-sm`.
  - *Amended in review*, loading in detail:
    - The header (sort buttons, the header checkbox) and the pager stay interactive while loading. A server-side table re-fetches *because* the user sorted or paged, so disabling them would trap a slow load. The header checkbox is disabled (no rows are on the page), as for an empty page.
    - Column widths: the header row stays rendered, the skeleton cells are block `Skeleton`s capped at `max-w-32`, and the selection column is `w-10`, so the widths come from the header texts while loading, not from the data. A consumer that needs widths to stay identical when the data comes back sets `headerClassName` widths (e.g. `w-40`); the stories do. Tested: with `headerClassName="w-40"` the column width is equal (±1px) loading and loaded.
    - Only one region speaks per action: the sort status (DataTable) announces sorts; `DataTablePagination` announces only its own page and page-size actions (below). Sorting from page 3 resets to page 1 and changes the visible range text, but nothing announces it twice (tested: after Enter on a sort button, only `data-table-status` has new text).
    - *Amended in review fix wave*: a pending announcement records what the action asked for, not just that one is due. A sort button stores its column and the direction `nextSorting` gives it; `DataTablePagination` stores the target page index (or page size) and sets nothing for an action that changes nothing (the current page's button, Previous / Next past an end, the current size). At the next change the flag is cleared, and the change is announced only if it is the requested one. Before, a click on the current page (a no-op in `setPagination`) left the flag set, so a later sort that reset the page spoke in both regions; a sort or page a controlled parent refused announced the next unrelated change. Tested: page 3, its button again, then a sort → only the sort status speaks; with a parent that refuses a Title sort and page 3, a sort set from outside the table speaks in neither region.
- No row-click selection and no range (Shift+click) selection on checkboxes (rows may hold links and buttons; range selection is a later addition).

**`DataTableColumnsMenu<TData>`:** `Menu` with a `MenuTrigger` rendered as `Button variant="outline" color="neutral" size="sm"` (`data-slot="data-table-columns-trigger"`, `Columns3Icon` + `label`, default "Columns"), and `MenuContent` (`align="end"`) holding a `MenuCheckboxItem` per hideable column (`checked` = visible, `onCheckedChange` → `toggleColumn`, `disabled` when `!canHideColumn(id)`, text `column.label`). Menu items stay open on toggle (Base UI's checkbox item default).

**`DataTablePagination<TData>`:** a `div data-slot="data-table-pagination"` with `flex flex-wrap items-center justify-between gap-3 text-sm`:
- the range text: `p data-slot="data-table-range"` (`text-muted-foreground tabular-nums`), `rangeLabel(from, to, total)` (default `` `Showing ${from}–${to} of ${total}` ``, `"No results"` for 0). *Amended in review*: it is not a live region itself. A sibling `span role="status" class="sr-only" data-slot="data-table-pagination-status"` (`useStatusMessage`) announces the new range text only after this part's own actions (a page button, Previous / Next, the page size), so a sort that resets the page is announced once, by DataTable's sort status. Page changes are still announced, which covers the Orders example's backlog note for consumers that use this part.
- page size (when `pageSizeOptions` is given): a `Field`-less `Select` (`size="sm"`, `aria-label={pageSizeLabel}`, default "Rows per page") with the options.
- the pager: `Pagination` (`aria-label={paginationLabel}`, default "Pagination") > `PaginationContent` with `PaginationPrevious`, the `getPaginationRange` items as `PaginationLink render={<button type="button" />}` (`aria-label={pageLabel(page)}`, default `` `Page ${page}` ``; `isActive` on the current page), `PaginationEllipsis`, and `PaginationNext`.
- *Amended in review* (Previous / Next): without `render` they are an `<a>` with no `href` (`pagination.tsx` ~116), which the keyboard cannot reach or activate. So `PaginationPrevious` and `PaginationNext` also get `render={<button type="button" />}` and `onClick`. At the ends they are `disabled`, which with a `render` element means (as `PaginationLink` documents): `aria-disabled="true"` and `data-disabled`, `tabIndex={-1}` (they leave the Tab order), no `onClick`, and no native `disabled`, so a Next button focused when it becomes disabled on the last page keeps focus instead of dropping it to `<body>`.

**ARIA and keyboard summary:**

| Element | Semantics | Keys |
|---|---|---|
| `table` | named by `caption` / `aria-label`; `aria-busy` while loading; `aria-describedby` the multi-sort hint | none (not a grid) |
| primary sorted `th` | `aria-sort="ascending" \| "descending"` | none |
| other `th` | no `aria-sort` | none |
| sort button | `button` named by the header, plus sr-only `sortStateLabel` when sorted | Enter / Space: sort; Shift+Enter / Shift+Space: multi-sort (one toggle) |
| header checkbox | `checkbox`, `selectAllLabel`, `aria-checked` true / false / mixed | Space |
| row checkbox | `checkbox`, `selectRowLabel(label)` | Space |
| selected row | `data-state="selected"` (no `aria-selected`: not a grid) | none |
| loading rows | `aria-hidden` | none |
| status | `role="status"` (sr-only): sort announcements | none |
| range text | plain text "Showing 1–5 of 12"; a sibling sr-only `role="status"` announces it after pager actions only | none |
| pager | `nav` "Pagination"; page, Previous and Next are `<button>`s; the current page `aria-current="page"`; Previous / Next at the ends `aria-disabled="true"` with `tabIndex={-1}` (out of the Tab order; one that was focused keeps focus) | Enter / Space |
| single-selection radio | native `radio`, one shared name, `selectRowLabel(label)` | Tab enters the group; arrows move and select |
| columns menu | Tessera Menu: `menuitemcheckbox` per hideable column | Menu's keys |

**RTL:** headers and cells use `text-start` / `text-end`; the sort icon follows the label at the inline end; the pager's chevrons flip (`rtl:-scale-x-100`); the columns menu is a Tessera Menu (trigger-direction). Nothing reads the direction in DataTable itself.

**Forced colors:** selected rows Highlight / HighlightText (`TableRow`); checkboxes system-painted (`forced-color-adjust-auto` on the selection cell); sort buttons ring Highlight; the priority badge has a CanvasText border; the active page uses Pagination's existing Highlight pair.

**Reduced motion:** the sort button's transition is `motion-reduce:transition-none`; checkboxes and the menu keep their own.

**SSR:** the instance is pure; `renderToString` of a DataTable gives the sorted first page, the `aria-sort` header and the checkboxes; with no `locale` the collator uses the runtime default, which can differ between server and client (documented beside the date family's `locale` note).

**Tests (Task 7, `data-table.test.tsx`):**
- structure: `table` with the caption name; column headers; a `th scope="row"` per row for the `rowHeader` column; the selection column first; `data-slot`s.
- sorting: clicking "Title" sets `aria-sort="ascending"` on its `th`, the rows reorder, the status says "Sorted by Title, ascending"; again → descending; again → no `aria-sort` and "Sorting cleared"; Shift+click "Start" adds a secondary sort: `aria-sort` stays only on "Title", "Start"'s button text includes "sorted ascending, 2 of 2" and both show priority badges; Shift+Enter and Shift+Space do the same exactly once (keyboard); a plain click on "Start" replaces the sort; sorting resets to page 1; the hint is the sort buttons' table description.
- selection (multiple): row checkboxes named "Select Launch party"; toggling sets `data-state="selected"`; the header checkbox is unchecked / indeterminate (`aria-checked="mixed"`) / checked; clicking it selects the page, again clears the page; selection survives sorting and paging; `isRowSelectable` disables a checkbox and the header ignores it; single mode (*Amended in review*): no header checkbox, the rows hold native radios sharing one name (two DataTables on a page get different names), clicking a radio selects its row and clears the previous, ↓ from a focused radio selects the next row, and Tab leaves the radios after one stop.
- pagination: "Showing 1–5 of 12"; Next / Previous / page buttons are `<button>`s reachable with Tab and activated with Enter; the active page has `aria-current="page"`; on page 1 Previous is `aria-disabled="true"` with `tabIndex="-1"` (out of the Tab order); pressing Enter on Next until the last page leaves focus on the now-disabled Next (not `<body>`); the pagination status announces the range after a page action and not after a sort (*Amended in review*); page size 10 → "Showing 1–10 of 12" and the first visible row stays visible; the range text updates (the status region's text).
- columns menu: lists hideable columns as `menuitemcheckbox`; unchecking "Attendees" hides its header and cells; the last visible column's item is disabled; the menu stays open while toggling.
- empty and loading: no rows → one cell spanning every column with "No results." (colSpan geometry: the cell is as wide as the header row); `loading` → `aria-busy="true"` on the table and `aria-hidden` skeleton rows; switching loading off restores rows.
- keyboard: Tab order is header checkbox → sort buttons → row checkboxes / cell buttons → pager; Space toggles a focused checkbox; Enter sorts.
- RTL: under `dir="rtl"` headers align right (`text-align: start` → the text's right edge at the cell's right padding), the sort icon sits left of the label, the end-aligned column's text sits at the cell's left, and the pager's Previous chevron points right (its computed `scale` / `transform`).
- end alignment: the Attendees header and cells are right-aligned in LTR.
- focus: sort buttons and checkboxes show a 2px solid ring.
- forced colors: a selected row is Highlight / HighlightText with `forced-color-adjust: none`, its checkbox cell `forced-color-adjust: auto` and the checkbox border not Highlight-on-Highlight (its computed border colour differs from the row's background); sort button ring Highlight.
- reduced motion: the sort button's `transition-property` is `none`.
- SSR: `renderToString` gives the sorted first page and `aria-sort` on the primary column; `hydrateRoot` raises no recoverable error.
- axe light and dark: default, sorted by two columns, rows selected, empty, loading, the columns menu open (`auditOpenOverlay`), RTL; violations and incomplete both `[]`.
- the existing `table.test.tsx` and `pagination.test.tsx` stay green (amended only for `text-start`).

**Stories (Task 7, `Components/DataTable`):** Basic (sortable, 12 rows, 5 per page), Multi-sort, Selection (multiple, with a "Delete 3 selected" toolbar button), Single selection, Column visibility, Pagination with page sizes, Empty and loading, Server-side (`manual` with a story-local fake fetch), RTL.

- *Amended in Task 7* (keyboard sorting, evidence for the review's open question): Chromium's keyboard-activated click carries the modifier keys (`shiftKey` is `true` on the click from Shift+Enter and Shift+Space), and a `preventDefault` on a button's keydown suppresses its click for Enter (keydown) and for Space (keyup) alike. So the keydown handler with `preventDefault` is required, not just sufficient: without it Shift+Enter toggled the sort twice (the keydown and the click's `shiftKey`; a mutation run of the test failed with 2 calls). Pinned by "a prevented Space keydown on a button fires no keyup click" and "Shift+Enter and Shift+Space each toggle a multi-sort exactly once".
- *Amended in Task 7*: `sortAnnouncement(label, direction, count)` takes a third argument, the number of sorted columns after the change, and the default for a removed column is `` `Not sorted by ${label}` `` while other columns stay sorted ("Sorting cleared" only when nothing is). Evidence: Shift-removing a secondary column left the primary sorted, so "Sorting cleared" was false. Tested.
- *Amended in Task 7*: the sort state's `span.sr-only` holds `sortStateLabel(...)` alone; the accessible name is "Title sorted ascending, 1 of 2" (Chromium separates the absolutely positioned span's text with a space; a ", " prefix produced "Title , sorted ascending"). Announcements are made in an effect after the change renders (a sort button or a pager action marks itself pending), so they speak the state a controlled parent accepted, and a refused change speaks nothing.
- *Amended in Task 7*: `Checkbox` takes an optional `"data-slot"` (default `"checkbox"`), as the Table parts do: it set `data-slot` after `{...props}`, so `data-table-select-all` / `data-table-select-row` could not be applied. Tested in `checkbox.test.tsx`.
- *Amended in Task 7*: the columns trigger is `MenuTrigger` styled with `buttonVariants({ variant: "outline", color: "neutral", size: "sm" })`, not `render={<Button />}`: `Button` sets `data-slot="button"` after its props, which would replace `data-table-columns-trigger`. Same look and focus ring (tested).
- *Amended in Task 7* (details the text above leaves open):
  - The `rowHeader` cell is `th scope="row"` with `px-3 py-2.5 align-middle text-start font-normal` (TableCell's classes plus resets of the UA `th` centring and bold; tested against the next cell's weight).
  - Slots the text does not name: `data-table-cell` (every body cell, the row header too), `data-table-loading-row`, `data-table-sort-hint`, and `data-table-pagination-controls`, a `flex flex-wrap items-center gap-3` group holding the page-size Select (`w-20`) and the pager, so `justify-between` puts the range text at the start and the controls at the end.
  - The header checkbox is disabled while loading or when the page has no selectable row. An end-aligned column's skeleton adds `ms-auto`.
  - `getRowProps` returns `tr` props plus any `data-*` attribute; the row's own `data-slot` and `data-state` win.
  - `DataTableColumnsMenu` takes `label` (default "Columns") and `className` (the trigger); `DataTablePagination` takes `rangeLabel`, `pageSizeLabel`, `paginationLabel`, `pageLabel` and `div` props.
  - No existing `table.test.tsx` or `pagination.test.tsx` expectation pinned `left`, so none changed; new guards cover `text-start` and `-ms-2` in both directions, the chevrons' `scale` (`none` LTR, `-1 1` RTL), the sort button's Highlight ring and its `transition-property`. The Orders example's `-mr-2 ml-0` keeps its 0 / −8px margins (the physical utilities win over `-ms-2`; checked).
  - The axe cases run in a 1280px viewport: at the default 414px one axe leaves the columns clipped by the scroll container as `color-contrast` "elmPartiallyObscured" (needs review). A 390px case checks the scrolling instead: the container scrolls, the page and the pager do not overflow.
- *Amended in Task 8*: a body row also carries `forced-colors:[&_:is(a,button,input,select,textarea)]:forced-color-adjust-auto` (`dataTableRow`, merged with a `getRowProps` `className`), so links, buttons and fields in a selected row's cells are repainted with system colours, as the selection cell's checkbox already was. Evidence: the Events admin visual check in forced colors showed each selected row's outline "Edit" button in its theme colours (dark text on the Highlight fill, unreadable), because it inherited the row's `forced-color-adjust: none`. The row's own text keeps the Highlight / HighlightText pair. Tested in `data-table.test.tsx` (the Edit button in a selected row: `forced-color-adjust: auto`, ButtonText, a background other than Highlight; RED first: `none`).

## 8. Events admin example (Task 8)

**`Tessera/Examples/Events admin`** (`src/docs/examples/events-admin-page.{tsx,test.tsx,stories.tsx}` plus `events-admin-data.ts`). Under ~450 lines, using local sub-components (`EventsToolbar`, `EventsTable`, `EventDrawer`, `EventForm`).

- Data: 12 events `{ id, title, date ("YYYY-MM-DD"), start ("HH:mm"), tags: string[], attendees: number, attachments: { name, size }[] }`.
- Header: the page title "Events" and a "New event" Button.
- Toolbar: a search `Input` ("Search events", filters by title, case-insensitive, before the data reaches `useDataTable`; changing it resets to page 1); `DataTableColumnsMenu`; a "Delete selected" Button (`color="danger" variant="soft"`, showing the count, disabled with none selected) that deletes the selected rows and reports "3 events deleted" in the page's `role="status"` line.
- `DataTable` (`selectionMode="multiple"`, `getRowId` = `id`, `defaultSorting` `[{ id: "date", desc: false }, { id: "start", desc: false }]`, `defaultPagination` page size 5, `pageSizeOptions` [5, 10, 20]): columns Title (`rowHeader`), Date (formatted with `Intl.DateTimeFormat` `dateStyle: "medium"`, sorted by the ISO string), Start (`formatTime`, sorted by the value), Tags (`Badge`s, not sortable), Attendees (end-aligned number), Files (count, hidden by default through `defaultColumnVisibility`), and an Edit button per row (not sortable, not hideable; `aria-label` "Edit Launch party").
- `EventDrawer`: a right `Drawer` (controlled; `finalFocus` back to "New event" or the row's Edit button, the Orders pattern) holding a `Form` with Fields:
  - Title (`Input`, required);
  - Date (`DatePicker editable`, required);
  - Start (`TimePicker`, required, `min="08:00"`, `max="20:00"`, `step={900}`, `slotStep={30}`, `locale="en-US"`);
  - Tags (`TagsInput`, `max={5}`, `validate`: lowercase letters, digits and hyphens only → "Use lowercase letters, digits and hyphens");
  - Attachments (`FileUpload`, `accept="image/*,.pdf"`, `maxSize` 5 MB, `maxFiles={3}`, with `FileUploadDropzone`, `FileUploadList` and `FileUploadRejections`).
- Save (`type="submit"`, `loading` while uploading): on a valid submit the page uploads the attachments through `uploadFile(file, onProgress): Promise<void>` (a prop; the story's default is a `setTimeout` fake, the test injects one it resolves by hand), showing each item's `progress` and `status`; when all resolve it adds or updates the row (the date and time combined only for display), closes the drawer and reports "Event saved". A rejected upload marks its item `status="error"` and keeps the drawer open.
- `EventsAdminPage` takes `initialEvents?`, `uploadFile?`, `onSave?(event)` (called with `{ title, date, start, tags, attachments: File[] }`, for the test).

**Keyboard-flow test (`events-admin-page.test.tsx`):**
- Tab from the page start: "New event", the search input, the Columns button, the header checkbox, the sort buttons, … in that order.
- Type "launch" in search: "Showing 1–1 of 1"; clear it.
- Enter on the "Title" sort button: rows sort by title; `aria-sort="ascending"` on Title; Shift+Enter on "Start": "Title" keeps `aria-sort`, "Start" reads "sorted ascending, 2 of 2".
- Space on the header checkbox selects the page (5); Space on one row's checkbox → the header is indeterminate (`aria-checked="mixed"`); "Delete selected (4)" deletes them: "Showing 1–5 of 8" and "4 events deleted".
- The Columns menu: check "Files" → the Files column appears.
- "New event" opens the drawer with focus in Title. Type a title; type the date into the DatePicker's segments; in Start type "9" "3" "0" "p" → 21:30, which is after `max`: Save shows "Enter a time at or before 8:00 PM." under Start and focuses its first segment. Open the TimePicker list with its button: no slot equals 21:30 and none comes after it, so the last slot (the 20:00 option) is focused (§3's rule, pinned here; *Amended in review*: it was the first slot); Home ↓ ↓ Enter → 09:00, focus back on the clock button, and the error clears on the next submit. Option texts are compared with `formatTime`'s output, not literals.
- Tags: type "launch" Enter, "Team Day" Enter (rejected: "Use lowercase letters, digits and hyphens" announced, `aria-invalid`), fix to "team-day" Enter; Backspace in the empty input removes "team-day"; type it again.
- Attachments: `userEvent.upload` a 1 kB `agenda.pdf` and a 6 MB `video.mov`: the PDF is listed, the rejections list "video.mov — This file type is not accepted" (type is checked before size); Tab reaches "Remove agenda.pdf".
- Save: the injected uploader receives `agenda.pdf`; the item shows a progressbar at 50 after the test calls `onProgress(50)`, and Save is loading (`data-loading`); resolving it closes the drawer, focus returns to "New event", the new row is in the table ("Showing 1–5 of 9"), "Event saved" shows, and `onSave` got `{ title, date: "2026-10-20", start: "09:00", tags: ["launch", "team-day"], attachments: [agenda.pdf] }`.
- Edit on a row opens the drawer prefilled (title, date, start, tags) and Escape closes it with focus back on that row's Edit button.
- axe in light and dark: the page, the page with rows selected, the drawer open (`auditOpenOverlay`), the TimePicker list open (hiding `main` if axe leaves text behind the popup undecided, as the Checkout and Dashboard tests do).
- 390px: no horizontal page scroll (the table scrolls in its container), the drawer fills the width, axe clean.
- *Amended in Task 8* (details the text above leaves open, pinned in `events-admin-page.test.tsx`):
  - The keyboard flow is split into tests on a fresh page each: the table flow (Tab order, search, sorts, selection, "Delete selected (4)" → "Showing 1–5 of 8", the Columns menu) and the add-event flow, so the latter ends at "Showing 1–5 of 13" (12 + 1) rather than 9; the new row (Oct 20, 9:00 AM) sorts onto page 2, reached with the keyboard. Separate tests cover a failed upload (the item's `status="error"` with "Upload failed. Save again to retry.", the drawer stays open, `onSave` not called) and an edit saved back to its row (focus returns to the renamed row's Edit button).
  - The add flow also checks the native `FormData` of the submit (`title`, `date` `"2026-10-20"`, `start` `"09:00"`, `getAll("tags")`, `getAll("attachments")`), next to `onSave`'s payload.
  - "Delete selected" empties and disables itself, so it moves focus to the page's status line (`p role="status" tabIndex={-1}`, the Orders pattern) before the rows go; it reads "Delete selected" with nothing selected and "Delete selected (4)" otherwise.
  - The TimePicker-open axe case hides the drawer's Fields after Start and Start's description (the list covers them: `color-contrast` `bgOverlap`), as the Checkout test hides what its popups cover; the drawer itself is audited open in its own case. The 25 slots scroll inside the 16rem list, and axe leaves the options clipped by it as `elmPartiallyObscured`, so the list is audited at several scroll positions, scrolled with ↓ as a keyboard user does, each pass hiding only the options the list clips, until every option was audited fully visible. The 390px case audits with the drawer open; the closed page at 390px is not audited, as §7 explains (axe leaves the columns clipped by the table's scroll container undecided).
  - The Start cell renders `formatTime` in a `span dir={getLocaleDirection(locale)}` (the §3 *Amended in Task 3* rule). Evidence: the RTL visual check showed "AM 10:00"; tested (in an RTL page the digits sit left of "PM"; RED with the `dir` removed).
  - The tags are outline Badges with `forced-colors:border-current forced-colors:text-inherit`. Evidence: a soft badge's fill equals a selected row's `bg-muted`, so the chips lost their shape; in forced colors an outline badge kept its theme text colour on the selected row's Highlight (unreadable) until it took the row's text colour. Checked visually (light, dark, forced colors).
  - Editing an event keeps its existing attachments (they are names and sizes, not `File`s): the Attachments description lists them ("invite.pdf is already attached.") and new uploads are appended. The Edit drawer's description is the event's start as one local `Date` (`startsAt`, the day and the wall-clock time combined for display only).
  - The columns live in `events-admin-data.ts` (`eventColumns`, with the Start and Tags cells, the actions header and the Edit button passed in), keeping the page near the size limit (470 lines). The story adds an RTL variant for the visual check.
  - Known limit (backlog): flush with the viewport's right edge in an RTL page, DataTable's 1px `sr-only` status spans (`margin: -1px`) overflow it by 1px (`scrollWidth` 1281 at 1280); the RTL test pads the page as the story does.

## 9. Docs (Task 9, last)

- Stories (written by each component task; `title: "Components/<Name>"`, `tags: ["autodocs"]`): §2, §3, §4, §5, §7 list them; Task 8 adds `Tessera/Examples/Events admin`.
- README:
  - the component list: TimeField, TimePicker, TagsInput, FileUpload, DataTable (`useDataTable`, `DataTable`, `DataTableColumnsMenu`, `DataTablePagination`) and the time / file / data-table helpers, in the house style (each entry added by its own task; Task 9 checks them);
  - "Phase K is complete";
  - the Events admin example paragraph (in the style of the Theme Studio one);
  - the RTL notes: TimeField's locale-direction segment row; the `dir` on `*Content` note (Task 0);
  - Roadmap: Phase L candidates:
    - a Calendar events view (month and week agenda; deferred from Phase K);
    - the DateRangePicker `onValueChange` contract decision (deferred from Phase K);
    - DataTable additions: row range selection, column resizing and pinning, an opt-in APG grid mode, virtualised bodies;
    - TimePicker hour/minute columns as a `variant`;
    - a FileUpload paste target and folder upload.
- Backlog: the Phase K notes (each task's deferred minors, e.g. DateField's page-direction segments vs TimeField's locale direction, Pagination's `rtl:` chevron limit, the `DataTransfer`-less Safari limit); nothing resolved left in it.
- `src/docs/introduction.mdx`: a "Times, tags, files and data tables" section pointing at **Examples / Events admin**, in the style of the Phase J section.
- `docs/backlog.md`'s "Next components" paragraph: Phase K done, Phase L next with the candidates above.
