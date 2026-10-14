# Tessera Phase L: Audit fixes and foundations (Spec Addendum)

**Date:** 2026-10-14
**Status:** Written after a six-agent read-only audit of every component (baseline `npm run check` green) and a gap analysis. The owner approved the split below and the rulings in "Owner rulings"; the remaining design decisions are Claude's, under the standing delegation ("no questions, verify heavily").
**Builds on:** design-system-v2 §4 (focus, forced colours, logical properties, `labels` conventions), Phases A–K, `docs/backlog.md`.

## Owner rulings (this session)
- Phase L is split into **L1 (bug-fix wave)** and **L2 (additions)**. **L3 (breaking label/API pass)** is *not* part of this phase: it waits for explicit rulings (see "Deferred").
- **Calendar locales:** force the Gregorian calendar everywhere (Calendar, DateField, pickers). Non-Gregorian calendars are documented as unsupported.
- **L2 additions:** CI, Alert, Spinner, InputGroup. Nothing else is added in this phase.

## L1: bug-fix wave (non-breaking)

Every fix is test-first: a failing test that reproduces the audit repro, then the fix. Every component that gets an RTL fix gains an RTL test. No public prop is removed or renamed.

| # | Area | Fix | Source |
|---|---|---|---|
| 1 | Switch | Checked thumb translate flips in RTL (`rtl:` variant). RTL test. | `switch.tsx:31` |
| 2 | NumberField | `border-l`/`border-r` → `border-s`/`border-e` on Increment/Decrement. RTL test. | `number-field.tsx:107,122` |
| 3 | Calendar family | Pass `calendar: "gregory"` to every `Intl.DateTimeFormat` in `useFormatters`, and to the DateField year segment path. Tests for `fa-IR`, `th-TH`, `ar-SA` and a `-u-ca-` tag. | `calendar-base.tsx:137-179`, `date-segments-control.tsx:328` |
| 4 | ColorInput | `commit` skips `commitColor` when the draft equals the current display or re-parses to the current value. Test: no-op edit in hsl display fires no change. | `color-picker.tsx:710-737` |
| 5 | DataTable | (a) Hiding a sorted column removes it from `sorting`; (b) one shared `isSortable` rule used by `canSort` and `sortRows` (the lib's rule); (c) `getRowId` held in a ref, so inline functions do not re-sort; a test with inline `columns`/`getRowId`. | `use-data-table.ts`, `lib/data-table.ts` |
| 6 | Sidebar | Per-instance `useId()` for each `<aside>`; the trigger's `aria-controls` targets the first collapsible one. Ignore `event.repeat` in the Ctrl/Cmd+B handler. | `sidebar.tsx`, `sidebar-context.tsx` |
| 7 | DateField / TimeField family | Native form `reset` restores `defaultValue` (listen on `inputRef.current.form`; controlled fields call `onValueChange(defaultValue)`). | `field/form-control.tsx:138-158` |
| 8 | `parseDateString` | Reject years below 100 (null), accept non-padded ISO (`2026-9-5`, `2026/09/25`). | `date-segments.ts:165-183` |
| 9 | TimeField step | For steps that are not whole hours or a divisor of 60 minutes, step the total seconds on the `step` grid and re-split. | `time-segments.ts:160-181` |
| 10 | `getTimeSlots` | Round a fractional `slotStep`; ignore seconds in `min` at minute granularity. | `time.ts:119-148` |
| 11 | DateRangePicker (button) | A reversed controlled range shows `data-invalid`/is sorted for display, consistent with DateRangeField. | `date-picker.tsx:587-601` |
| 12 | Dialog | Header reserves end padding for the Close button (as Drawer's `pe-12`). Geometry test: title rect and close rect do not intersect. | `dialog-variants.ts:46` |
| 13 | Toast | `border-l-4`→`border-s-4`, `-mr-1`→`-me-1`. RTL test. | `toast.tsx:95,196` |
| 14 | Breadcrumb / Accordion | Separator chevron `rtl:-scale-x-100`; trigger `text-left`→`text-start`. RTL tests. | `breadcrumb.tsx:92`, `accordion.tsx:10` |
| 15 | Meter / Progress | Header renders only when it has real children (`Children.toArray(children).length > 0`). | `meter.tsx:58`, `progress.tsx:48` |
| 16 | Separator | Vertical variant gets `h-full` so it has height in a block parent. | `separator.tsx:26` |
| 17 | Pagination | `PaginationLink` with no `href`, no `render`, not disabled gets `role="button"`, `tabIndex={0}` and Enter/Space activation; `getPaginationRange` guards `NaN`/fractional inputs. | `pagination.tsx:99-108`, `pagination-range.ts:38` |
| 18 | OTPField / Rating | `fitGroups` returns `[length]` when every group is ≤ 0; read-only Rating honours the caller's `aria-label` (falls back to the value label). | `otp-field.tsx:79`, `rating.tsx:178` |
| 19 | `formatFileSize` | Round first, then pick the unit. Boundary tests (999 999, 999 950, 1e9 edges). | `lib/file.ts:79-88` |
| 20 | Select | Trigger `text-left` → `text-start`. | `select-variants.ts:17` |

**Also in L1 (hardening, no behaviour change):**
- `verify-consumer` CSS needles for Phase J/K classes (`rtl:`, `forced-colors:`, ColorPicker gradients, `data-dragging`).
- Declare `tailwindcss` ^4 as a documented peer dependency (package.json `peerDependencies` + README).
- Missing coverage the audits named: `ref`/`className` forwarding tests for the display components, controlled-mode tests for the form controls, RTL tests for Input, Textarea, Checkbox, Field, accordion, collapsible, badge, card, meter, progress, skeleton, avatar.

**Needs a ruling, so deliberately not changed in L1** (recorded in `docs/backlog.md`): Resizable End/Enter on a collapsible following panel; `SidebarMenuButton` `aria-current` on buttons; Toast reachable by Tab under a modal; Ctrl/Cmd+K over another modal; `CommandEmpty` on async load; Drawer `vh` vs `dvh`; Tooltip `aria-describedby` timing (needs a screen-reader pass); the `validate` call order for `too-many` files; the 2-digit-year pivot beyond rejection.

## L2: additions

All hand-built on Tailwind + CVA, following the existing conventions (`data-slot`, `className` last through `cn`, logical properties, forced-colours, reduced motion). No new dependencies.

- **Spinner.** Extracts the spinner `Button loading` already renders into a public component (`role="status"`-free by default; takes `aria-label`, `size`, inherits `currentColor`). `Button` is changed to use it, with no visual change.
- **Alert** (`Alert`, `AlertTitle`, `AlertDescription`, `AlertAction`). `tone`: `info | success | warning | danger | neutral` using the existing tone tokens. Renders `role="status"` (non-urgent tones) or `role="alert"` (`danger`); an icon slot defaulting to the tone's icon; optional dismiss via an `onDismiss` prop. Closes the FieldError live-region backlog item by reusing the same role rule.
- **InputGroup** (`InputGroup`, `InputGroupAddon`, `InputGroupInput`, `InputGroupButton`). A bordered flex container owning the ring (`focus-within:`), with start/end addons inside; the inner `Input` is borderless. Works with Input and NumberField; picker integration is out of scope for this phase. States (`invalid`, `disabled`) come from the surrounding Field.
- **CI.** `.github/workflows/ci.yml` running `npm ci`, Playwright Chromium install, and `npm run check` on push and PR; plus a weekly, non-blocking canary job that installs `@base-ui/react@latest` and runs the Form and date-control tests.
- Docs: stories, README component list and roadmap, backlog "Next components".

## Deferred (not in Phase L)
- **L3, the breaking pass:** `labels` API normalisation (`addedLabel`, `labels.open` vs `openCalendar`, DataTablePagination Previous/Next, Toast Close), the DateRangePicker `onValueChange` contract. Awaiting owner rulings.
- ButtonGroup, EmptyState, ThemeProvider/ModeToggle, Link/Typography, SSR `today` prop and fixture, visual regression, a screen-reader session, react-hook-form recipes.
- On demand only: Chart wrapper, DataTable row-range/pinning/resizing/virtualisation, Calendar events view.
- Dropped: Mentions, Tour, Timeline, Affix, Spotlight.

## Verification
- Each fix lands with its failing-first test; `npm run check` is green after every task.
- A final read-only re-audit pass re-runs the original repros against the fixed tree; a separate reviewer pass (`code-reviewer`, not the author) reviews the diff.
- The report lists each audit finding as fixed, deferred (with the reason), or rejected.

## Tasks
1. Task 1: RTL and logical-property fixes (#1, 2, 13, 14, 20) with RTL tests.
2. Task 2: Date and time (#3, 7, 8, 9, 10, 11).
3. Task 3: DataTable, ColorInput, file size (#4, 5, 19).
4. Task 4: Sidebar, Dialog, display components (#6, 12, 15, 16, 17, 18).
5. Task 5: Test-gap backfill and `verify-consumer` / peer-dependency hardening.
6. Task 6: Spinner, Alert, InputGroup.
7. Task 7: CI workflow and canary.
8. Task 8: Docs, backlog update, final re-audit.
