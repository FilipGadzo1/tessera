# Tessera Phase K: TimeField, TimePicker, TagsInput, FileUpload and DataTable (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Phase J carry-overs, then add the time helpers and TimeField / TimePicker, TagsInput, FileUpload, a headless `useDataTable` engine with DataTable parts, an Events admin example composing them, and finish with the docs.

**Architecture:** The same layout as Phases B–J: `src/components/<name>/{<name>.tsx, <name>-classes.ts?, <name>.test.tsx, <name>.stories.tsx, index.ts}`. Shared helpers live in `src/lib`. Tests run in real Chromium with the helpers in `test/overlay.ts`, `test/emulation.ts`, `test/pointer.ts` and `test/platform.ts`.

**Tech stack:** Unchanged. Base UI stays pinned `~1.8.0`, and there are no new dependencies. Every Phase K component is hand-built (Base UI 1.8.0 has no time, tags, file, listbox or table primitive, checked in `node_modules/@base-ui/react`); Base UI Popover, Checkbox, Menu, Select and Progress are used inside them.

**Spec:** `docs/superpowers/specs/2026-10-08-tessera-phase-k-time-tags-upload-datatable.md` is binding. It builds on design-system-v2 §4 and the earlier phase specs it references.

## Global Constraints

- **Environment:** repo `C:\Users\Filip\Desktop\projects\tessera`, Windows 11, Node 24, the Bash tool. Branch `phase-k`.
- **Ports and processes:**
  - Never start anything on 8080, and never kill the process there.
  - Smoke-test only on `-p 6107 --ci --no-open`.
  - Stop only the exact PID you started (`netstat -ano | grep :6107 | grep LISTEN` → `taskkill //PID <pid> //T //F`).
  - Never kill processes by name.
- **Editing files:**
  - Edit or create files ONLY with the Edit/Write tools, including throwaway debug files. Never use Python, `sed -i`, heredocs, or shell redirection into repo files.
  - Keep LF line endings.
  - Use Windows absolute paths with the Edit/Write/Read tools (`C:\Users\Filip\Desktop\projects\tessera\…`).
- **Spec fidelity:** use the class strings from the spec. Adapt only with evidence, and amend the spec in the same commit as an *Amended in Task N* bullet.
- **Component code:**
  - Spread `{...props}` first, then `data-slot`/className. Base UI parts merge with `mergeClassName` (their `className` can be a function); plain-element parts use `cn`, as `CommandShortcut` and `MenuShortcut` do. Every part sets `data-slot`.
  - `"use client"` goes on files that import Base UI or use hooks. `src/lib/*` non-hook modules (`time.ts`, `time-segments.ts`, `file.ts`, `data-table.ts`, `direction.ts`) and `*-classes.ts` / `*-variants.ts` stay server-safe.
  - Interactive controls: `outline-none` + `toggleFocusClasses` + `forced-colors:focus-visible:outline-[Highlight]`. Selected/current Highlight/HighlightText + `forced-color-adjust-none`. Disabled → `cursor-not-allowed`; a disabled control that stays focusable uses `text-muted-foreground` (GrayText in forced colors) at opacity 1.
  - Strings: TimeField and TimePicker take one `labels` object (the date family); every other component takes a per-part `aria-label` with an English default plus label functions (design-system-v2 §4 conventions).
  - Direction: the DOM `dir` is the source of truth. Read it with `useElementDirection` on the component's own element (an overlay root: its trigger's), and wrap direction-reading Base UI parts in Base UI's `DirectionProvider` fed by it. Never detect a consumer's provider. (TimeField's segment row follows the locale's script direction by spec ruling; that is text rendering, not Base UI behaviour.)
  - Import shared icons only from `src/lib/icons.tsx`. Merge refs only with `src/lib/merge-refs.ts` / `use-merged-refs.ts`.
  - Export each component from `src/index.ts`.
  - Every new library source must be reachable from `src/index.ts` (exported, or imported by an exported module): the build's only entry is the index, and `verify:consumer` fails with "missing dist/lib/<file>.d.ts" for a module nothing reaches (the Phase J `color.ts` lesson). A pure helper module added before its first consumer is exported in the same commit.
- **Tests:**
  - Use `vitest-browser-react` + `userEvent` from `vitest/browser`. Hooks may use `renderHook` from `vitest-browser-react`.
  - Wait on state, never on time (`expect.poll`, no sleeps). Send one key at a time when focus moves. No component in this phase has a timer; if one becomes necessary, make it injectable (the Carousel `carouselTimer` pattern).
  - Pointer drags: `userEvent.dragAndDrop(locator, locator, { force, sourcePosition, targetPosition, steps } as Parameters<typeof userEvent.dragAndDrop>[2])` with a `MutationObserver` for mid-drag attributes (`drawer.test.tsx` ~795–815). Touch: the Phase I `tap()` pattern (dispatched `PointerEvent`s with `pointerType: "touch"`, `carousel.test.tsx` ~875) or CDP `Input.dispatchTouchEvent`. File drops: dispatched `DragEvent`s carrying a `DataTransfer` with `File`s; file picks: `userEvent.upload`.
  - Run axe with violations and incomplete both `[]`, in light and dark. Emulate forced colors and reduced motion with `test/emulation.ts`.
  - Platform stubs (`navigator.userAgentData`, `window.EyeDropper`, `URL.createObjectURL` / `revokeObjectURL` spies) are restored in `afterEach`.
- **Stories:** `title: "Components/<Name>"`, `tags: ["autodocs"]`. Alignment-check stories label their reference controls as references.
- **Gate:** `npm run format && npm run check && npm run build:storybook` must be green at the end of each task.
- **Commits:** end every message with a blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `.omc/`, `.superpowers/`, `dist/`, `storybook-static/`, `.tmp-consumer/`, `*.tgz` or `.vitest/`.

## Pre-flight

- **Order.** Task 0 (carry-overs) → 1 (time helpers and the shared segment plumbing) → 2 (TimeField) → 3 (TimePicker) → 4 (TagsInput) → 5 (FileUpload) → 6 (data-table engine) → 7 (DataTable parts) → 8 (Events admin example) → 9 (docs, last). Tasks 4, 5 and 6 do not depend on 1–3 and could run earlier, but the shared files below are edited one task at a time, so the order is kept.
- **Task 0** is independent of the rest; do it first so Phase K starts from a clean backlog.
- **Reachability decides where internal modules land.** A public helper (`time.ts`, `file.ts`, `data-table.ts`, `getLocaleDirection`) is exported from the index in its own commit. An internal one (`time-segments.ts`, `use-status-message.ts`) is committed together with its first consumer, because until then nothing reaches it and `verify:consumer` fails: `time-segments.ts` lands in Task 2's commit, `use-status-message.ts` in Task 4's.
- **Task 1 provides** `src/lib/time.ts` (public), `getLocaleDirection` in `src/lib/direction.ts` (public), and `src/components/field/segments.tsx` (the plumbing moved out of `date-segments-control.tsx`: `segmentGroupBase`, `segmentBase`, `segmentLiteralBase`, `focusFirstEmpty`, `handleGroupMouseDown`, `useLabelFocusesFirstEmpty`, `useSubmitOnEnter`, `isForeignKey`, `useSegmentTextInput`; reached through the date controls at once). Tasks 2–4 use them.
- **Task 2 provides** `src/lib/time-segments.ts`, `TimeField` and `useTimeSegments`; Task 3 wraps it.
- **Task 3 provides** `ClockIcon`, `src/components/date-picker/editable-shell.tsx` (moved out of `date-picker.tsx`, with `slotPrefix`, `icon` and `initialFocus` props) and `TimePicker`.
- **Task 4 provides** `src/lib/use-status-message.ts` (Tasks 5 and 7 reuse it) and `TagsInput`.
- **Task 5 provides** `src/lib/file.ts` (public), `UploadIcon`, the exported `visuallyHiddenInput` style in `src/components/field/form-control.tsx`, and the FileUpload parts.
- **Task 6 provides** `src/lib/data-table.ts` (public) and `useDataTable`; Task 7 renders it.
- **Task 7 provides** the DataTable parts, `Columns3Icon`, the arrow icons moved into `icons.tsx`, and the Table / TableSortButton / Pagination direction fixes.
- **Task 8** needs Tasks 2–7 committed.
- **New icons** go into `src/lib/icons.tsx` with the task that needs them: `ClockIcon` (Task 3), `UploadIcon` (Task 5), `Columns3Icon` and the moved `ArrowUpIcon` / `ArrowDownIcon` / `ArrowUpDownIcon` (Task 7). Each adds a line to `icons.test.tsx` if that file enumerates icons.
- **Shared files are edited sequentially, one task at a time:** `src/index.ts`, `README.md` (component list), `docs/backlog.md`, `src/lib/icons.tsx`, `src/components/field/form-control.tsx`, `src/lib/direction.ts`. Tasks run in order, so append; never reorder or reformat other entries.
- **Refactor guards.** Before Task 1's move and Task 3's shell move, record the test counts of the suites they touch (`npx vitest run src/components/date-field src/components/date-range-field src/components/date-picker src/components/form`); the same counts must pass after.
- **Spec amendments** go into the spec in the same commit as the change (*Amended in Task N*).

## Review amendments

The critic's review changed these task steps. The spec carries the matching *Amended in review* bullets, which are binding. Each item below adds to the RED and GREEN steps of its task.
- *Amended in review*, Task 0: the Radio fix records that `in-data-disabled:` matches any `[data-disabled]` ancestor (a Field or Fieldset), on purpose. The Kbd border test resolves `oklch` / `color-mix` colours to sRGB with the canvas pattern from `toast.test.tsx` / `switch.test.tsx` before calling `contrastRatio`.
- *Amended in review*, Task 1: `getLocaleDirection`'s fallback drops `ku` and keeps `ckb`. The time-string tests compare against `formatTime` / `Intl` output, never a literal "9:30 AM" (ICU may use U+202F before AM/PM).
- *Amended in review*, Task 2:
  - `timeSegmentSteps(step, min)` gives each segment its step and grid offset from `min`: `gcd`-based, capped to the range, pinned when the step is at least the range. Tests cover `min="09:10"` with `step={900}`, plus `step` 3600 and 5400.
  - The "1 2 0 0 p" test asserts the last `onValueChange` call ("12:00").
  - An SSR test pins the hydration failure without `locale` (`h12` vs `h23` segment counts) next to the passing case with `locale`. There is no dev warning, for the reason in the spec.
- *Amended in review*, Task 3: `labels.noTimes` is part of `TimePickerLabels`. A value later than every slot focuses the last slot (test: 12:00 → the 11:00 option).
- *Amended in review*, Task 4:
  - The per-tag hidden inputs use `name ?? field.name`.
  - With `allowDuplicates`, chips and hidden inputs are keyed by index.
  - New test: native FormData with only a Field name.
  - The input class string is TagsInput's own copy of the local `comboboxChipsInputBase`.
  - The "chips model" wording calls this Tessera's variant: focus goes to the remove button, not to the chip as in Base UI.
- *Amended in review*, Task 5:
  - The file input uses `name ?? field.name` and `aria-required`, with no native `required` (the validation input has it).
  - `FileUploadDropzone` is required: the root warns in dev when none registers.
  - New tests: the Field-name FormData case, `required` with only dropped files and `DataTransfer` stubbed away, and the no-dropzone warning.
- *Amended in review*, Task 6: the exact `src/index.ts` exports are listed in the Task 6 steps below and in spec §6.1.
- *Amended in review*, Task 7:
  - **First step:** an optional `"data-slot"` prop (default unchanged) on `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` and `TableSortButton`, with one `table.test.tsx` case for the defaults and an override.
  - **Pager:** `DataTablePagination` gives Previous / Next `render={<button type="button" />}`. At the ends they are `aria-disabled`, `tabIndex={-1}` (out of the Tab order), and keep focus when they become disabled while focused.
  - **Range text:** plain text, plus a pagination status that announces only after pager actions, never after a sort.
  - **Single selection:** native radios sharing a generated name.
  - **End-aligned sort button:** `ms-0 -me-2`.
  - **Loading:** the header and pager stay interactive, and column widths come from the headers (`headerClassName` widths keep them identical; tested).
- *Amended in review*, Task 8: the TimePicker step of the flow is "the last slot (20:00) is focused; Home ↓ ↓ Enter → 09:00". Option and time texts come from `formatTime`.

---

### Task 0: Phase J carry-overs
Spec §0.
- [ ] RED: `resizable.test.tsx`: in a controlled group whose parent ignores changes, (1) a key press (refused) followed by a pointerdown and pointerup dispatched in one task with no move commits nothing; (2) a pointer drag commits the attempted layout once at the end while the rendered sizes stay the controlled ones.
- [ ] GREEN: `group.latestLayout.current = layout` in `ResizableHandle`'s `onPointerDown`, next to `start: layout`. Run the Resizable suite. Commit `fix(resizable): reset the latest layout when a drag starts`.
- [ ] RED: `navigation-menu.test.tsx`: the vertical chevron's computed rotation is −90° in LTR, +90° under a wrapper `dir="rtl"`, and −90° for an LTR-island menu under `<html dir="rtl">` (fails today).
- [ ] GREEN: `useDirection()` in `NavigationMenuTrigger`, replacing `-rotate-90 rtl:rotate-90` (the `MenuSubTrigger` approach). Commit `fix(navigation-menu): vertical chevron follows the Base UI direction`.
- [ ] RED: `radio-group.test.tsx`: pin Base UI's focusability (the roving radio of a disabled group and of a group in a disabled Fieldset is reachable with Tab; a lone disabled radio in an enabled group is not); a focused radio in a disabled group has opacity 1, a 2px solid ring and the muted fill; forced colors: GrayText border; a lone disabled radio keeps opacity 0.5; axe light and dark on both.
- [ ] GREEN: the group-scoped disabled look on `Radio` (write the selector against Tailwind's generated CSS; record the exact classes as an amendment). Commit `fix(radio): focusable disabled radios keep opacity 1 and look muted`.
- [ ] RED/guard: popup direction tests: wrapper `dir="rtl"` Tooltip, PreviewCard (`side="inline-end"` opens left; positioner `dir="rtl"`) and Autocomplete (`align="start"` lines up right edges); LTR-island Popover and Select under `<html dir="rtl">` (positioner `dir="ltr"`, left edges line up). Expected green on first run; a red one is a real bug: fix it here and amend the spec.
- [ ] GREEN: commit `test(overlays): wrapper-RTL and LTR-island popup direction guards`.
- [ ] RED: `kbd.test.tsx`: in light and dark the keycap border composited over its background has `contrastRatio` ≥ 1.4 against the background (dark fails today: both are `surface-800`).
- [ ] GREEN: `border-foreground/20` in `kbdBase`. Commit `fix(kbd): visible keycap border in dark mode`.
- [ ] README: the `dir`-on-`*Content` note beside the portal note. Backlog: remove the resolved entries (spec §0 "Backlog"). Run the gate. Commit `docs: Phase J carry-overs in the README and backlog`.

### Task 1: Time helpers and the shared segment plumbing
Spec §1.
- [ ] RED: `src/lib/time.test.ts` per spec §1.1 (parse / format / seconds / compare / `resolveHourCycle` / `formatTime` in UTC / `timeStepMismatch` / `getTimeSlots`).
- [ ] GREEN: `src/lib/time.ts`, exported from `src/index.ts` (functions and `TimeGranularity`, `HourCycle`, `TimeParts`). Run the gate. Commit `feat(time): time value parsing, formatting and slots`.
- [ ] RED: `src/lib/direction.test.ts` per spec §1.2 (with `Intl.Locale.prototype.getTextInfo` stubbed away for the fallback).
- [ ] GREEN: `getLocaleDirection` in `src/lib/direction.ts`, exported from the index. Commit `feat(lib): getLocaleDirection`.
- [ ] Move the plumbing into `src/components/field/segments.tsx` per spec §1.4 (`dateGroupBase` → `segmentGroupBase`; `selector` parameters; `useSegmentTextInput`, `isForeignKey`). RED is the date suites, run before and after with the same counts. Run the gate. Commit `refactor(field): shared segment plumbing`.

### Task 2: TimeField
Spec §1.3 and §2.
- [ ] RED: `src/lib/time-segments.test.ts` per spec §1.3 (order, bounds, typing table, stepping with snapping, the 1440-minute round trips per cycle, day-period labels and keys, segment names, `parseTimeString`).
- [ ] GREEN: `src/lib/time-segments.ts` (internal; imports `parseDigit` / `getLocaleDigits` from `date-segments.ts`). Its suite is green; do not commit yet (nothing reaches it until TimeField, so `verify:consumer` would fail).
- [ ] RED: `src/components/time-field/time-field.test.tsx` per spec §2 "Tests" (structure; typing per cycle and locale digits; the key table row by row; visual ←/→ in en-US LTR, en-US RTL and ar-EG RTL; `null` reporting; min / max / step validity; controlled / uncontrolled; paste; IME and mobile `beforeinput`; Form and Field; read-only and disabled; focus; forced colors; reduced motion; SSR + hydration; axe).
- [ ] GREEN: `time-segments-control.tsx` (`useTimeSegments`) and `time-field.tsx` on the shared plumbing and `useFormControl` (`slot: "time-form-control"`). Stories (Basic, With seconds, 24-hour / 12-hour, Min max and step, In a Form, Disabled and read-only, Locales), exports (`TimeField`, `TimeFieldProps`, `TimeFieldLabels`), README entry. Visual check on 6107 (light and dark, focused segment, invalid, forced colors, en-US and ar-EG under RTL, 390px). Stop only your own PID. Run the gate. Commit `feat(time-field): time segment helpers and TimeField`.

### Task 3: TimePicker
Spec §3.
- [ ] Move `EditableShell` into `src/components/date-picker/editable-shell.tsx` with `slotPrefix`, `icon` and `initialFocus` props; the date pickers pass `"date-picker"`, `CalendarIcon` and today's calendar-day query. RED is the editable DatePicker / DateRangePicker suites, unchanged (same counts). Commit `refactor(date-picker): shared editable shell`.
- [ ] RED: `src/components/time-picker/time-picker.test.tsx` per spec §3 "Tests" (shell geometry LTR / RTL; slots from min / max / slotStep / step; initial focus rule; the list key table; Enter / Escape / Tab; hover focus and click; second granularity; empty list; one Form control and the blur scope; controlled `open` and `value`; RTL alignment and indicators; forced colors; axe closed and open).
- [ ] GREEN: `ClockIcon`; `time-picker.tsx` with the internal `TimePickerList` (roving `role="option"`s on `menuItemBase` with `data-highlighted` on focus). Stories (Basic, Business hours, With seconds, In a Form, Disabled and read-only, RTL), exports (`TimePicker`, `TimePickerProps`, `TimePickerLabels`), README entry. Visual check on 6107 (popup open light and dark, selected and focused options, forced colors, RTL, 390px). Run the gate. Commit `feat(time-picker): TimePicker`.

### Task 4: TagsInput
Spec §4 and §4.1.
- [ ] RED: `src/lib/use-status-message.test.tsx` (an identical announcement changes the DOM text; a new one replaces it; no timer).
- [ ] GREEN: `src/lib/use-status-message.ts` (internal). Its suite is green; do not commit yet (it is reached only through TagsInput, so it lands in the TagsInput commit).
- [ ] RED: `src/components/tags-input/tags-input.test.tsx` per spec §4 "Tests" (structure and names; commit by Enter / delimiters / mobile change / paste; each rejection reason; removal; tag navigation including RTL; Escape claim inside a Popover; IME; `addOnBlur`; read-only and disabled; controlled pairs; Form `getAll` and one registered control; wrapping geometry and 390px; focus rings; forced colors; reduced motion; SSR + hydration; axe).
- [ ] GREEN: `tags-input.tsx`, `tags-input-classes.ts`. Stories (Basic, Max and validate, Custom delimiters, In a Form, Read-only and disabled, Sizes, RTL, Keyboard), exports (`TagsInput`, `TagsInputProps`, `TagRejection`), README entry. Visual check on 6107 (chips wrapping, a rejection, focused chip ring, forced colors, RTL, 390px). Run the gate. Commit `feat(tags-input): useStatusMessage and TagsInput`.

### Task 5: FileUpload
Spec §5.
- [ ] RED: `src/lib/file.test.ts` per spec §5.1 (`matchesAccept` table, `formatFileSize` pinned to `Intl`'s output incl. de-DE, `validateFiles` reasons and order, single-mode replacement, `getFileKey`).
- [ ] GREEN: `src/lib/file.ts`, exported from the index (functions and `FileRejection`, `FileRejectionReason`). Run the gate. Commit `feat(file): file accept, size and validation helpers`.
- [ ] RED: `src/components/file-upload/file-upload.test.tsx` per spec §5.2 "Tests" (structure and names; `userEvent.upload` picks and the `input.files` write-back; each rejection and `FileUploadRejections`; dispatched drag-and-drop incl. child elements, disabled `dropEffect`, non-file drags; dropzone click; focus mirroring; list, previews and object-URL revocation; progress and error status; removal focus; controlled pairs; Form `getAll` with dropped files and one registered control; `required`; forced colors; reduced motion; SSR + hydration; axe).
- [ ] GREEN: `UploadIcon`; export `visuallyHiddenInput` from `form-control.tsx`; `file-upload.tsx` (`FileUpload`, `FileUploadDropzone`, `FileUploadList`, `FileUploadItem`, `FileUploadItemRemove`, `FileUploadRejections`), `file-upload-classes.ts`. Stories (Basic, Images with previews, Single file, Constraints and rejections, Upload progress with a story-local `setTimeout` fake, In a Form, Disabled, RTL), exports, README entry. Visual check on 6107 (idle, dragging, previews, progress, error item, rejections, forced colors, RTL, 390px). Run the gate. Commit `feat(file-upload): FileUpload`.

### Task 6: The data-table engine
Spec §6.
- [ ] RED: `src/lib/data-table.test.ts` per spec §6.1 (pure: `nextSorting` tables, `defaultCompare`, stable multi-key `sortRows` with nulls last and no mutation, paging helpers, selection helpers, visibility helpers).
- [ ] GREEN: `src/lib/data-table.ts`, exported from `src/index.ts` exactly as spec §6.1 lists (*Amended in review*): `nextSorting`, `defaultCompare`, `sortRows`, `getPageCount`, `clampPageIndex`, `paginateRows`, `getRowRange`, `toggleRowSelection`, `getPageSelection`, `togglePageSelection`, `getVisibleColumns`, `toggleColumnVisibility`, and types `DataTableColumn`, `SortDirection`, `SortingState`, `PaginationState`, `ColumnVisibility`, `SelectionMode`, `PageSelection`. Run the gate. Commit `feat(data-table): sorting, paging, selection and visibility engine`.
- [ ] RED: `src/components/data-table/use-data-table.test.tsx` per spec §6.2 (`renderHook`: controlled / uncontrolled per slice; no-op setters; sort resets the page; clamping after `data` shrinks; `setPageSize` keeps the first row; `selectAll` / `clearSelection` / `selectedRows`; `isRowSelectable`; `manual` with `rowCount`; the dev warning; memoisation with a `compare` spy).
- [ ] GREEN: `use-data-table.ts`, `data-table/index.ts`, and in `src/index.ts`: `useDataTable` and the types `UseDataTableOptions`, `DataTableInstance`, `DataTableRow`. Run the gate. Commit `feat(data-table): useDataTable`.

### Task 7: DataTable parts
Spec §7.
- [ ] RED: `table.test.tsx`: each Table part renders its default `data-slot`, and a passed `data-slot` replaces it (fails today: the slot is set after `{...props}`).
- [ ] GREEN: the optional `"data-slot"` prop on `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` and `TableSortButton` (the `PaginationLink` / `PopoverContent` pattern; defaults unchanged). Commit `feat(table): overridable data-slot on table parts`.
- [ ] RED: `src/components/data-table/data-table.test.tsx` per spec §7 "Tests" (structure; single and multi-sort with `aria-sort` on the primary only, the sr-only state, priority badges, Shift+click / Shift+Enter / Shift+Space exactly once, the status announcements, page reset; multiple and single selection with the indeterminate header; pagination range status, page buttons and sizes; the columns menu; empty colSpan geometry and loading `aria-busy`; Tab order; RTL alignment and the flipped pager chevron; end alignment; focus rings; forced colors incl. the checkbox inside a selected row; reduced motion; SSR + hydration; axe incl. the open menu).
- [ ] GREEN: move the arrow icons into `icons.tsx` and add `Columns3Icon`; the Table fixes (`text-start`, `-ms-2`, the sort button's forced-colors ring and transition) and `rtl:-scale-x-100` on the pager chevrons, amending `table.test.tsx` / `pagination.test.tsx` only where they pinned `left`; `data-table.tsx` (`DataTable`, `DataTableColumnsMenu`, `DataTablePagination`), `data-table-classes.ts`. Stories (Basic, Multi-sort, Selection, Single selection, Column visibility, Pagination with page sizes, Empty and loading, Server-side, RTL), exports, README entry. Visual check on 6107 (two-column sort with badges, selected rows, the columns menu, empty, loading, forced colors, RTL, 390px with the table scrolling in its container). Run the gate. Commit `feat(data-table): DataTable, column menu and pagination`.

### Task 8: Events admin example
Spec §8. Files: `src/docs/examples/events-admin-page.{tsx,test.tsx,stories.tsx}`, `events-admin-data.ts`. Keep the page under ~450 lines with local sub-components (`EventsToolbar`, `EventsTable`, `EventDrawer`, `EventForm`).
- [ ] RED: `events-admin-page.test.tsx`, the keyboard flow in spec §8 (Tab order; search; sort and Shift+Enter multi-sort; header and row checkboxes with the indeterminate state; "Delete selected (4)"; the Columns menu; the drawer form: the out-of-range TimeField error and the TimePicker fix to 09:00 from the focused last slot (Home ↓ ↓ Enter); TagsInput add / reject / fix / Backspace; FileUpload accept and reject with Tab to the remove button; Save with the injected uploader at 50% then resolved; the new row, "Event saved", `onSave`'s payload; Edit prefill and Escape focus return), axe light and dark (page, selection, drawer open, TimePicker list open), and 390px.
- [ ] GREEN: implement the page. Story `Tessera/Examples/Events admin` (the default `uploadFile` is a story-local `setTimeout` fake). Run the gate. Visual check on 6107 (`events-admin-*.png`: light, dark, rows selected, drawer with an upload in progress, TimePicker open, rejections, forced colors, RTL, 390px). Stop only your own PID. Commit `docs(examples): events admin composing Phase K components`.

### Task 9: Docs
Spec §9.
- [ ] README: check every Phase K component-list entry (TimeField, TimePicker, TagsInput, FileUpload, DataTable and the helpers) against the shipped API; "Phase K is complete"; the Events admin paragraph; the RTL notes (TimeField's locale-direction row); roadmap Phase L (the Calendar events view and the DateRangePicker `onValueChange` decision, both deferred from Phase K, plus the spec §9 candidates).
- [ ] `docs/backlog.md`: the Phase K notes (each task's deferred minors, the known limits named in the spec), the "Next components" paragraph moved to Phase L; nothing resolved left in it.
- [ ] `src/docs/introduction.mdx`: the "Times, tags, files and data tables" section pointing at **Examples / Events admin**.
- [ ] Run the gate. Smoke-check Storybook on 6107 (the new component pages and the example render; stop only your own PID). Commit `docs: Phase K complete`.
