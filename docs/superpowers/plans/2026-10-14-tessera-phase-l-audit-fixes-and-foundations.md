# Tessera Phase L: Audit fixes and foundations (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 20 bugs a six-agent audit reproduced across Phases A–K (each test-first), backfill the test gaps that let them through, then add Spinner, Alert, InputGroup and a CI workflow with a Base UI canary.

**Architecture:** The same layout as Phases B–K: `src/components/<name>/{<name>.tsx, <name>.test.tsx, <name>.stories.tsx, index.ts}`, shared helpers in `src/lib`, cross-component tests in `test/`. Tests run in real Chromium (vitest browser mode). Tasks 1–5 are fixes and tests with no public API change; Tasks 6–7 add components and CI; Task 8 closes with docs and a read-only re-audit.

**Tech stack:** Unchanged. Base UI stays pinned `~1.8.0`; no new runtime dependencies. `tailwindcss` ^4 becomes a declared peer dependency (Task 5).

**Spec:** `docs/superpowers/specs/2026-10-14-tessera-phase-l-audit-fixes-and-foundations.md` is binding, with the "Spec correction" notes inside tasks recording where reading the code showed the spec's file or approach was off. They are decisions to review, not silent changes.

## Global Constraints

- **Environment:** repo `C:\Users\Filip\Desktop\projects\tessera`, Windows 11, the Bash tool. Work on a branch `phase-l` (not `main`).
- **Ports and processes:** never start anything on 8080 and never kill the process there. Smoke-test only on `-p 6107 --ci --no-open`. Stop only the exact PID you started. Never kill processes by name.
- **Editing files:** edit or create files only with the Edit/Write tools. Keep LF line endings. Use Windows absolute paths with those tools.
- **Test-first:** every fix has a failing test that reproduces the audit repro before the fix. Run it, see it fail for the stated reason, then fix.
- **Component code:** spread `{...props}` first, then `data-slot`/`className` through `cn` (`mergeClassName` for Base UI parts). Logical properties only (`start`/`end`, `text-start`, `border-s`), never `left`/`right`, unless the name is physical. `"use client"` on files that import Base UI or use hooks; `src/lib/*` non-hook modules and `*-classes.ts` / `*-variants.ts` stay server-safe. Interactive controls: `outline-none` + `toggleFocusClasses` + `forced-colors:focus-visible:outline-[Highlight]`.
- **No breaking changes:** no public prop is removed or renamed in this phase (the breaking label pass is deferred to a later phase).
- **Calendar locales (owner ruling):** the Gregorian calendar everywhere. Non-Gregorian calendars are documented as unsupported.
- **Verification:** `npm run check` must be green after every task, not only at the end. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Predicted output:** the "expected FAIL/PASS" lines and test counts in this plan were written without running the tests. If real output differs, investigate the difference before changing the test or the fix.

## Review Focus

Failure modes the spec implies that a person using the library would hit; each is pinned by a test in the task that owns the code (the task's own "Review focus" list names the step).

- A checked Switch, a NumberField group and a Toast in an RTL page: control geometry mirrors correctly (Tasks 1, 4).
- `fa-IR`, `th-TH`, `ar-SA` and a `-u-ca-` locale in Calendar, DatePicker and validation messages: caption, day numbers and aria-labels agree with the Gregorian grid (Task 2).
- A form `reset` on date and time controls, controlled and uncontrolled, including a parent that ignores the reset (Task 2).
- Two-digit years, leap days, and non-padded ISO input to `parseDateString`; a TimeField step of 90 minutes (Task 2).
- A sorted column that is hidden, a `sortable: true` column with no accessor, and inline `columns` / `getRowId` in DataTable (Task 3).
- A no-op edit in the ColorPicker text field in hsl display, and file sizes at unit boundaries (Task 3).
- Two Sidebars in one provider, a held Ctrl/Cmd+B, a click-only PaginationLink, and `NaN` / fractional pagination input (Task 4).
- Existing `FieldError` tests when it gains the shared live-region role (Task 6).

## Plan-review amendments (critic pass, 2026-10-14)

Fixed in the plan text: the Task 8 baseline-worktree command now names the branch tip by commit; the Separator step gained a no-fixed-height flex-row test with a documented fallback; the button DateRangePicker reset only calls `onValueChange` for a complete default range (the contract change is L3); the DateField "ignores the request" reset test now clears the mock before resetting so it can fail on the baseline. Apply these during execution:

- **Canary (Task 7):** give the `npm install @base-ui/react@latest` step `continue-on-error: true` and guard the report step against an empty version, so an ERESOLVE cannot fail the run. `ci.yml` has 7 steps, not 8.
- **OTPField (Task 4.6):** in `fitGroups`, skip non-finite counts (`if (!Number.isFinite(count)) continue`) so `[2, NaN]` for `length` 4 does not return `[2]`.
- **DataTable (Task 3):** `toggleColumn` drops a hidden column from `sorting` even when a parent controls `columnVisibility` and refuses the hide. Only drop it when the visibility change is applied (uncontrolled), and say so in the spec-correction note.
- **Counts:** the live-region test has 6 tests (six tones), not 7.
- **Commit trailer:** use the session's attribution line; the hardcoded `Co-Authored-By` text in the steps is a stand-in.
- **`getPaginationRange` edit:** anchor on the text, not on "lines 23-39".
- **Backlog entries to add (Task 8):** `parseDateRangeString` still needs padded ISO; a controlled button DateRangePicker with an incomplete default is not notified on reset (L3); a plain `<Input>` inside `InputGroup` is unsupported (use `InputGroupInput`); a new `getRowId` with unchanged `data` keeps old ids.
- **Behaviour changes to list in the report:** client-mode `sortable: true` columns with no accessor lose their sort button; a `PaginationLink` with no `href` and no `onClick` becomes a dead Tab stop; a picker's `format.calendar` is overridden.

## File structure

- Fix tasks modify existing component files and their tests; the one new shared module is `src/lib/live-region.ts` (Task 6).
- New components: `src/components/{spinner,alert,input-group}/`, each exported from `src/index.ts`.
- New cross-component tests: `test/display-forwarding.test.tsx`, `test/controlled-mode.test.tsx`, `test/rtl-layout.test.tsx` (Task 5).
- New infra: `.nvmrc`, `.github/workflows/ci.yml`, `.github/workflows/base-ui-canary.yml` (Task 7).
- New report: `docs/superpowers/reports/2026-10-14-phase-l-audit-report.md` (Task 8).

---

### Task 1: RTL and logical-property fixes

Spec L1 rows #1, #2, #13, #14, #20. Five independent commits, one per row; each starts from a failing RTL test. All RTL tests render inside a wrapper `dir="rtl"` (`<div dir="rtl">`) except Toast, whose viewport is portalled to `document.body`, so the Toast test sets `document.documentElement.dir` (the `drawer.test.tsx` pattern) and removes it in a `finally`.

**Spec correction.** None of the five audit claims was refuted by the code, with two scoping notes: (a) #14 flips only the *default* chevron; a `BreadcrumbSeparator` with custom `children` is the caller's to flip, and the new class goes on the default icon only; (b) #20 and the Accordion half of #14 change the *computed* `text-align` from `left` to `start`. Because both triggers are `justify-between` flex rows, the visible effect is only on wrapped multi-line labels, so the test pins the computed `text-align` rather than a pixel position.

**Files:**
- Modify: `src/components/switch/switch.tsx:31-35` (`thumbClasses`)
- Modify: `src/components/number-field/number-field.tsx:107,122`
- Modify: `src/components/toast/toast.tsx:95,196`
- Modify: `src/components/breadcrumb/breadcrumb.tsx:90`
- Modify: `src/components/accordion/accordion.tsx:11`
- Modify: `src/components/select/select-variants.ts:17`
- Test: `src/components/switch/switch.test.tsx`, `src/components/number-field/number-field.test.tsx`, `src/components/toast/toast.test.tsx` (new RTL block, plus the existing `border-l-4` assertions at lines 207, 214, 221-222, 230, 251 are rewritten), `src/components/breadcrumb/breadcrumb.test.tsx`, `src/components/accordion/accordion.test.tsx`, `src/components/select/select.test.tsx`

**Interfaces:**
- Consumes: Tailwind `rtl:` variant and the logical utilities `border-s`, `border-e`, `border-s-4`, `-me-1`, `text-start`; the shared `scale` pattern already pinned in `pagination.test.tsx:223-236` (`getComputedStyle(svg).scale` is `"none"` in LTR and `"-1 1"` in RTL).
- Produces: no new exports and no prop changes. Class strings only.

---

#### 1.1 Switch (#1)

- [ ] **Write the failing test.** Append a new top-level `describe` at the end of `src/components/switch/switch.test.tsx` (it already imports `describe`, `expect`, `it`, `render`; nothing new is needed). The track is `w-11` (44px) with `p-0.5` and a 20px thumb, so the thumb's distance from the track's inline-start edge is 2px unchecked and 22px checked in both directions:

```tsx
describe("Switch RTL", () => {
  it.each(["ltr", "rtl"] as const)(
    "%s: the thumb starts at the inline start and slides to the inline end when checked",
    async (dir) => {
      const screen = await render(
        <div dir={dir}>
          <Switch aria-label="Notifications" />
        </div>,
      );
      const toggle = screen.getByRole("switch", { name: "Notifications" });
      const track = toggle.element();
      const thumb = track.querySelector('[data-slot="switch-thumb"]') as HTMLElement;
      /** The thumb's distance from the track's inline-start edge. */
      const fromStart = () => {
        const t = track.getBoundingClientRect();
        const h = thumb.getBoundingClientRect();
        return dir === "rtl" ? t.right - h.right : h.left - t.left;
      };
      expect(fromStart()).toBeCloseTo(2, 0);
      await toggle.click();
      await expect.poll(fromStart).toBeCloseTo(22, 0);
    },
  );
});
```

- [ ] **Run it, expect FAIL.** `npx vitest run src/components/switch/switch.test.tsx`. The `rtl` case fails with `expected -18 to be close to 22` (the thumb translates 20px to the right, off the track); the `ltr` case passes.

- [ ] **Minimal fix.** In `src/components/switch/switch.tsx`, `thumbClasses`:

```tsx
// old
  "translate-x-0 data-checked:translate-x-5",
// new
  "translate-x-0 data-checked:translate-x-5 rtl:data-checked:-translate-x-5",
```

  The stacked `rtl:data-checked:` rule has the same specificity as `data-checked:` and Tailwind emits it later (the variant with more/higher-order variants sorts after), so it wins in RTL only.

- [ ] **Run it, expect PASS.** `npx vitest run src/components/switch/switch.test.tsx` (the whole file, so the existing forced-colors and axe cases still pass).

- [ ] **Commit.**
```
git add src/components/switch/switch.tsx src/components/switch/switch.test.tsx
git commit -m "fix(switch): checked thumb slides toward the inline end in RTL" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

#### 1.2 NumberField (#2)

- [ ] **Write the failing test.** Append to `src/components/number-field/number-field.test.tsx` (helpers `incrementOf`, `decrementOf`, `inputOf` and `render` already exist at the top):

```tsx
describe("NumberField RTL", () => {
  it.each(["ltr", "rtl"] as const)(
    "%s: the stepper dividers sit on the sides facing the input",
    async (dir) => {
      const screen = await render(
        <div dir={dir}>
          <NumberField aria-label="Quantity" defaultValue={3} />
        </div>,
      );
      const root = screen.container.querySelector('[data-slot="number-field"]') as HTMLElement;
      const increment = incrementOf(root);
      const decrement = decrementOf(root);
      const input = inputOf(root);
      // The decrement button comes first in the reading order: at the left in LTR, the right in RTL.
      if (dir === "ltr") {
        expect(decrement.getBoundingClientRect().right).toBeLessThanOrEqual(
          input.getBoundingClientRect().left + 1,
        );
      } else {
        expect(decrement.getBoundingClientRect().left).toBeGreaterThanOrEqual(
          input.getBoundingClientRect().right - 1,
        );
      }
      const decrementStyle = getComputedStyle(decrement);
      const incrementStyle = getComputedStyle(increment);
      // Decrement's divider is on its inline end, Increment's on its inline start.
      expect(dir === "ltr" ? decrementStyle.borderRightWidth : decrementStyle.borderLeftWidth).toBe(
        "1px",
      );
      expect(dir === "ltr" ? decrementStyle.borderLeftWidth : decrementStyle.borderRightWidth).toBe(
        "0px",
      );
      expect(dir === "ltr" ? incrementStyle.borderLeftWidth : incrementStyle.borderRightWidth).toBe(
        "1px",
      );
      expect(dir === "ltr" ? incrementStyle.borderRightWidth : incrementStyle.borderLeftWidth).toBe(
        "0px",
      );
    },
  );
});
```

- [ ] **Run it, expect FAIL.** `npx vitest run src/components/number-field/number-field.test.tsx`. The `rtl` case fails at the first border assertion with `expected '0px' to be '1px'` (the divider is on the physical right of the decrement button, i.e. its outer edge); `ltr` passes.

- [ ] **Minimal fix.** In `src/components/number-field/number-field.tsx`:

```tsx
// line 107, NumberFieldIncrement
// old
      className={mergeClassName(`${numberFieldButtonBase} border-l border-field-border`, className)}
// new
      className={mergeClassName(`${numberFieldButtonBase} border-s border-field-border`, className)}

// line 122, NumberFieldDecrement
// old
      className={mergeClassName(`${numberFieldButtonBase} border-r border-field-border`, className)}
// new
      className={mergeClassName(`${numberFieldButtonBase} border-e border-field-border`, className)}
```

- [ ] **Run it, expect PASS.** `npx vitest run src/components/number-field/number-field.test.tsx`.

- [ ] **Commit.**
```
git add src/components/number-field/number-field.tsx src/components/number-field/number-field.test.tsx
git commit -m "fix(number-field): stepper dividers use logical borders" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

#### 1.3 Toast (#13)

- [ ] **Write the failing test.** Append to `src/components/toast/toast.test.tsx` (uses the file's `renderToaster`, `toastWith`, `toasts`; `expect.poll` as elsewhere in the file). The Close wrapper has `-me-1` = `margin-inline-end: -4px`; the toned accent is a 4px inline-start border on a 1px border:

```tsx
describe("Toast RTL", () => {
  it.each(["ltr", "rtl"] as const)(
    "%s: the accent border and the Close offset sit on the logical edges",
    async (dir) => {
      document.documentElement.dir = dir;
      try {
        const { toast } = await renderToaster();
        toast().add({ title: "Saved", type: "success", timeout: 0 });
        await expect.poll(() => toastWith("Saved")).not.toBeNull();
        const root = toastWith("Saved") as HTMLElement;
        const rootStyle = getComputedStyle(root);
        expect(dir === "rtl" ? rootStyle.borderRightWidth : rootStyle.borderLeftWidth).toBe("4px");
        expect(dir === "rtl" ? rootStyle.borderLeftWidth : rootStyle.borderRightWidth).toBe("1px");
        const closeStyle = getComputedStyle(
          root.querySelector('[data-slot="toast-close"]') as HTMLElement,
        );
        expect(dir === "rtl" ? closeStyle.marginLeft : closeStyle.marginRight).toBe("-4px");
        expect(dir === "rtl" ? closeStyle.marginRight : closeStyle.marginLeft).toBe("0px");
      } finally {
        document.documentElement.removeAttribute("dir");
      }
    },
  );
});
```

- [ ] **Run it, expect FAIL.** `npx vitest run src/components/toast/toast.test.tsx -t "Toast RTL"`. The `rtl` case fails with `expected '1px' to be '4px'` (the accent is still on the physical left); `ltr` passes.

- [ ] **Minimal fix (code).** In `src/components/toast/toast.tsx`:

```tsx
// line 94-95
// old
/** Toned types add a left accent in the tone's line colour. */
const accentClasses = "border-l-4 border-l-tone";
// new
/** Toned types add an inline-start accent in the tone's line colour. */
const accentClasses = "border-s-4 border-s-tone";

// line 196
// old
        <span data-slot="toast-close" className="-mt-1 -mr-1 flex shrink-0">
// new
        <span data-slot="toast-close" className="-mt-1 -me-1 flex shrink-0">
```

- [ ] **Minimal fix (existing assertions that name the old class).** In `src/components/toast/toast.test.tsx`:

```tsx
// line 204: title
// old
    ])("%s sets the %s tone, a left accent and a tone-coloured icon", async (type, tone) => {
// new
    ])("%s sets the %s tone, an inline-start accent and a tone-coloured icon", async (type, tone) => {

// line 207
// old
        <span data-testid="ref" className={`${tone} border-l-4 border-l-tone text-tone-ink`} />,
// new
        <span data-testid="ref" className={`${tone} border-s-4 border-s-tone text-tone-ink`} />,

// line 214
// old
      expect(root.classList.contains("border-l-4")).toBe(true);
// new
      expect(root.classList.contains("border-s-4")).toBe(true);

// lines 221-222
// old
      expect(getComputedStyle(root).borderLeftColor).toBe(getComputedStyle(ref).borderLeftColor);
      expect(getComputedStyle(root).borderLeftWidth).toBe("4px");
// new
      expect(getComputedStyle(root).borderInlineStartColor).toBe(
        getComputedStyle(ref).borderInlineStartColor,
      );
      expect(getComputedStyle(root).borderInlineStartWidth).toBe("4px");

// line 230 and line 251 (both)
// old
      expect(root.classList.contains("border-l-4")).toBe(false);      // line 230
      expect(loading.classList.contains("border-l-4")).toBe(false);   // line 251
// new
      expect(root.classList.contains("border-s-4")).toBe(false);
      expect(loading.classList.contains("border-s-4")).toBe(false);
```
  (Line 231, `borderLeftWidth` `"1px"` for the plain toast, stays: it runs in LTR and the plain toast has the uniform 1px border.)

- [ ] **Run it, expect PASS.** `npx vitest run src/components/toast/toast.test.tsx` (the whole file).

- [ ] **Commit.**
```
git add src/components/toast/toast.tsx src/components/toast/toast.test.tsx
git commit -m "fix(toast): accent border and Close offset use logical properties" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

#### 1.4 Breadcrumb separator and Accordion trigger (#14)

- [ ] **Write the failing tests.** Append to `src/components/breadcrumb/breadcrumb.test.tsx` (uses the file's `Trail`; `render`, `describe`, `expect`, `it` are imported):

```tsx
describe("Breadcrumb RTL", () => {
  it.each([
    ["ltr", "none"],
    ["rtl", "-1 1"],
  ] as const)("%s: the default separator chevron's scale is %s", async (dir, scale) => {
    const screen = await render(
      <div dir={dir}>
        <Trail />
      </div>,
    );
    const icon = screen.container.querySelector(
      '[data-slot="breadcrumb-separator"] svg',
    ) as SVGElement;
    expect(getComputedStyle(icon).scale).toBe(scale);
  });
});
```

  Append to `src/components/accordion/accordion.test.tsx` (uses the file's `Faq`):

```tsx
describe("Accordion RTL", () => {
  it.each(["ltr", "rtl"] as const)("%s: the trigger text aligns to the inline start", async (dir) => {
    const screen = await render(
      <div dir={dir}>
        <Faq />
      </div>,
    );
    const trigger = screen.container.querySelector(
      '[data-slot="accordion-trigger"]',
    ) as HTMLElement;
    expect(getComputedStyle(trigger).textAlign).toBe("start");
  });
});
```

- [ ] **Run them, expect FAIL.** `npx vitest run src/components/breadcrumb/breadcrumb.test.tsx src/components/accordion/accordion.test.tsx`. Breadcrumb `rtl` fails with `expected 'none' to be '-1 1'`; both Accordion cases fail with `expected 'left' to be 'start'`.

- [ ] **Minimal fix.** In `src/components/breadcrumb/breadcrumb.tsx` line 90:

```tsx
// old
      {children ?? <ChevronRightIcon className="size-3.5" />}
// new
      {children ?? <ChevronRightIcon className="size-3.5 rtl:-scale-x-100" />}
```
  In `src/components/accordion/accordion.tsx` line 11, inside `triggerClasses`:
```tsx
// old
  "flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-sm font-medium not-data-disabled:hover:underline underline-offset-4",
// new
  "flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-start text-sm font-medium not-data-disabled:hover:underline underline-offset-4",
```

- [ ] **Run them, expect PASS.** `npx vitest run src/components/breadcrumb/breadcrumb.test.tsx src/components/accordion/accordion.test.tsx`.

- [ ] **Commit.**
```
git add src/components/breadcrumb/breadcrumb.tsx src/components/breadcrumb/breadcrumb.test.tsx src/components/accordion/accordion.tsx src/components/accordion/accordion.test.tsx
git commit -m "fix(breadcrumb,accordion): mirror the separator chevron and align trigger text to the inline start" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

#### 1.5 Select trigger (#20)

- [ ] **Write the failing test.** Append to `src/components/select/select.test.tsx` (uses its `Fruit`, `trigger`, `render`, `afterEach` cleanup already in the file):

```tsx
describe("Select trigger text alignment", () => {
  it.each(["ltr", "rtl"] as const)("%s: the trigger's text-align is start", async (dir) => {
    await render(
      <div dir={dir}>
        <Fruit />
      </div>,
    );
    expect(getComputedStyle(trigger().element()).textAlign).toBe("start");
  });
});
```

- [ ] **Run it, expect FAIL.** `npx vitest run src/components/select/select.test.tsx -t "Select trigger text alignment"`. Both cases fail with `expected 'left' to be 'start'`.

- [ ] **Minimal fix.** In `src/components/select/select-variants.ts` line 17:

```ts
// old
  "inline-flex items-center justify-between gap-2 cursor-pointer text-left",
// new
  "inline-flex items-center justify-between gap-2 cursor-pointer text-start",
```

- [ ] **Run it, expect PASS.** `npx vitest run src/components/select/select.test.tsx` (the whole file).

- [ ] **Commit.**
```
git add src/components/select/select-variants.ts src/components/select/select.test.tsx
git commit -m "fix(select): trigger text aligns to the inline start" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

**Review focus:**
- RTL checked Switch: the thumb must end 22px from the inline-start edge, not slide off the track (1.1, the `rtl` row of the `it.each`; the `expect.poll` makes it independent of the 150ms transition).
- Toast in RTL while portalled outside the test container: only `documentElement.dir` reaches it, and the `finally` keeps a failed assertion from leaking `dir="rtl"` into later tests (1.3).
- A `BreadcrumbSeparator` with custom `children` is intentionally not mirrored (default icon only); the LTR row in 1.4 pins that the default stays unscaled (`scale: none`) so the fix cannot flip LTR.

---


### Task 2: Date and time
Spec L1 rows #3, #7, #8, #9, #10, #11. One commit per row, in this order. Every row is test-first: the RED step must fail for the reason named before the fix is written.

**Files:**
- Modify: `src/components/calendar/calendar-base.tsx` (`useFormatters`), `src/components/date-picker/date-form-control.tsx` (bound formatting), `src/components/date-picker/date-picker.tsx` (trigger formatters, `onReset`, reversed range), `src/components/field/form-control.tsx` (`onReset` option), `src/components/date-field/date-field.tsx`, `src/components/date-field/date-segments-control.tsx` (`reset`), `src/components/date-range-field/date-range-field.tsx`, `src/components/time-field/time-field.tsx`, `src/components/time-field/time-segments-control.tsx` (`reset`, composite step), `src/components/time-picker/time-picker.tsx` (forward `defaultValue`), `src/lib/date-segments.ts` (`parseDateString`), `src/lib/time-segments.ts` (`isCompositeStep`, `stepTimeOfDay`), `src/lib/time.ts` (`getTimeSlots`).
- Test: `src/components/calendar/calendar.test.tsx`, `src/components/date-field/date-field.test.tsx`, `src/components/date-range-field/date-range-field.test.tsx`, `src/components/date-picker/date-picker.test.tsx`, `src/components/time-field/time-field.test.tsx`, `src/components/time-picker/time-picker.test.tsx`, `src/lib/date-segments.test.ts`, `src/lib/time-segments.test.ts`, `src/lib/time.test.ts`.

**Interfaces:**
- `FormControlOptions.onReset?: () => void` (new, internal). Called once after the enclosing form's native `reset` event, unless that event was cancelled.
- `DateSegmentsControl.reset(date: Date | null): void` and `TimeSegmentsControl.reset(value: string | null): void` (new, internal): show the given value in every segment, drop partial input, report nothing.
- `isCompositeStep(step: number): boolean` and `stepTimeOfDay(current: number | null, direction: 1 | -1, step: number, min: string | undefined, granularity: TimeGranularity): number` in `src/lib/time-segments.ts` (internal, reached through TimeField).
- No public prop is added, removed or renamed. `parseDateString`, `getTimeSlots` keep their signatures.

**Spec corrections (verified against the code):**
- Row #3, DateField: the year segment (`src/components/date-field/date-segments-control.tsx`, the spec's `date-segments-control.tsx:328` is in `date-field/`, not `field/`) formats with `Intl.NumberFormat`, which has no calendar, and the segment order (`getDateSegmentOrder`) and the month name (`monthName`) already pass `calendar: "gregory"`. DateField segments are therefore already Gregorian and need no change; Step 1 adds a guard test that is green on its first run. The real leaks are the Calendar formatters (caption, day labels, day numbers, month and year buttons), and, under the owner's "force Gregorian everywhere" ruling, the DatePicker / DateRangePicker trigger text and the `min` / `max` bounds inside the validation messages (`date-form-control.tsx`). Those two are fixed in the same commit. A consumer `format.calendar` on a picker is overridden on purpose.
- Row #7: the audit's description holds. The hidden input is a controlled React input, so the browser's reset restores its DOM value to the current value and nothing reaches the segments. The spec lists `inputRef.current.form`; the hook must also re-read it when the `form` attribute prop changes (TimeField has one).
- Row #9: the existing test "step 5400: minutes step by 30; 01:30 is valid and 02:30 shows the step message" pins the behaviour this row removes. Step 6 rewrites it; do not leave it.
- Out of scope, unchanged (backlog "TimeField" item): a step of whole hours that does not divide 12 in 12-hour mode (e.g. `step={18000}`) still steps through the hour segment. Whole-hour steps and steps that divide a minute or an hour evenly keep the per-segment path.

---

#### Row #3: Gregorian-only formatting

- [ ] **Step 1: RED, Calendar family.** In `src/components/calendar/calendar.test.tsx`, add this block after the `"Calendar: structure"` describe (it uses the file's `render`, `d`, `Calendar`):

```tsx
describe("Calendar: Gregorian only", () => {
  const gregorian = (locale: string, options: Intl.DateTimeFormatOptions, date: Date) =>
    new Intl.DateTimeFormat(locale, { ...options, calendar: "gregory" }).format(date);
  const gregorianYear = (locale: string) =>
    new Intl.NumberFormat(locale, { useGrouping: false }).format(2026);

  it.each(["fa-IR", "th-TH", "ar-SA", "ja-JP-u-ca-japanese"])(
    "%s: caption, month and year buttons, day numbers and day labels agree with the Gregorian grid",
    async (locale) => {
      const screen = await render(<Calendar locale={locale} defaultMonth={d(2026, 9, 1)} />);
      const caption = gregorian(locale, { month: "long", year: "numeric" }, d(2026, 9, 1));
      await expect.element(screen.getByRole("grid", { name: caption })).toBeVisible();
      const slot = (name: string) =>
        screen.container.querySelector(`[data-slot="${name}"]`) as HTMLElement;
      expect(slot("calendar-caption").textContent).toBe(caption);
      expect(caption).toContain(gregorianYear(locale));
      expect(slot("calendar-month-button").textContent).toBe(
        gregorian(locale, { month: "long" }, d(2026, 9, 1)),
      );
      expect(slot("calendar-year-button").textContent).toBe(
        gregorian(locale, { year: "numeric" }, d(2026, 1, 1)),
      );
      for (const day of [1, 15, 25, 30]) {
        const date = d(2026, 9, day);
        const button = screen.container.querySelector(
          `[data-slot="calendar-day"][data-date="2026-09-${String(day).padStart(2, "0")}"]`,
        ) as HTMLButtonElement;
        expect(button.textContent).toBe(gregorian(locale, { day: "numeric" }, date));
        const label = gregorian(locale, { dateStyle: "full" }, date);
        expect(button.getAttribute("aria-label")).toBe(label);
        expect(label).toContain(gregorianYear(locale));
      }
    },
  );

  it("RangeCalendar uses the same Gregorian labels", async () => {
    const screen = await render(
      <RangeCalendar locale="th-TH" defaultMonth={d(2026, 9, 1)} />,
    );
    const label = gregorian("th-TH", { dateStyle: "full" }, d(2026, 9, 25));
    await expect
      .element(screen.getByRole("button", { name: label, exact: true }))
      .toBeInTheDocument();
  });
});
```

- [ ] **Step 2: RED, DateField family.** In `src/components/date-field/date-field.test.tsx`, add after the `"DateField: structure"` describe:

```tsx
describe("DateField: Gregorian only", () => {
  const locales = ["fa-IR", "th-TH", "ar-SA", "ja-JP-u-ca-japanese"];
  const input = () =>
    document.querySelector<HTMLInputElement>("[data-slot=date-form-control]") as HTMLInputElement;

  // Guard: green on the first run (the segments are already Gregorian, see the spec correction).
  it.each(locales)("%s: segments show the Gregorian year, month name and ISO value", async (locale) => {
    await render(<Basic locale={locale} defaultValue={d(2026, 9, 25)} />);
    expect(seg("year").textContent).toBe(
      new Intl.NumberFormat(locale, { useGrouping: false }).format(2026),
    );
    expect(seg("month").getAttribute("aria-valuetext")).toBe(
      new Intl.DateTimeFormat(locale, { month: "long", calendar: "gregory" }).format(d(2026, 9, 1)),
    );
    expect(input().value).toBe("2026-09-25");
  });

  it.each(locales)("%s: the min / max messages format the bound in the Gregorian calendar", async (locale) => {
    await render(<Basic locale={locale} min={d(2026, 9, 10)} defaultValue={d(2026, 9, 1)} />);
    const bound = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      calendar: "gregory",
    }).format(d(2026, 9, 10));
    expect(input().validationMessage).toBe(`Enter a date on or after ${bound}.`);
  });
});
```

  In `src/components/date-picker/date-picker.test.tsx`, add inside the file's first `describe` for `DatePicker` (any position; it uses the file's `Picker`, `triggerEl`, `d`):

```tsx
  it.each(["fa-IR", "th-TH", "ar-SA", "ja-JP-u-ca-japanese"])(
    "%s: the trigger shows the Gregorian date",
    async (locale) => {
      await render(<Picker locale={locale} defaultValue={d(2026, 9, 25)} />);
      const expected = new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        calendar: "gregory",
      }).format(d(2026, 9, 25));
      expect(triggerEl().textContent).toBe(expected);
      expect(expected).toContain(new Intl.NumberFormat(locale, { useGrouping: false }).format(2026));
    },
  );
```

- [ ] **Step 3: run, expect failure.** `npx vitest run src/components/calendar/calendar.test.tsx src/components/date-field/date-field.test.tsx src/components/date-picker/date-picker.test.tsx`. Expected: the Calendar cases fail (for th-TH the grid has no accessible name equal to "กันยายน 2026" because the caption is "กันยายน 2569"; fa-IR and ar-SA render Persian / Umm al-Qura captions; the Japanese tag renders "令和8年9月"); the DateField message cases and the picker trigger cases fail on the bound / trigger text. The DateField guard `segments show the Gregorian year...` passes.

- [ ] **Step 4: GREEN, minimal fix.** `src/components/calendar/calendar-base.tsx`, `useFormatters`, replace

```ts
  return useMemo(() => {
    const caption = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
    const full = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
    const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric" });
    const longWeekday = new Intl.DateTimeFormat(locale, { weekday: "long" });
    const shortWeekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const narrowWeekday = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
```
  with
```ts
  return useMemo(() => {
    // Gregorian only (Phase L ruling): the grid is Gregorian, so a locale whose default calendar
    // differs (fa-IR, th-TH, ar-SA) or a `-u-ca-` tag must not rename the month, year or day.
    const gregorian = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { ...options, calendar: "gregory" });
    const caption = gregorian({ month: "long", year: "numeric" });
    const full = gregorian({ dateStyle: "full" });
    const dayNumber = gregorian({ day: "numeric" });
    const longWeekday = gregorian({ weekday: "long" });
    const shortWeekday = gregorian({ weekday: "short" });
    const narrowWeekday = gregorian({ weekday: "narrow" });
```
  and replace
```ts
    const monthName = new Intl.DateTimeFormat(locale, { month: "long" });
    const shortMonth = new Intl.DateTimeFormat(locale, { month: "short" });
    const year = new Intl.DateTimeFormat(locale, { year: "numeric" });
```
  with
```ts
    const monthName = gregorian({ month: "long" });
    const shortMonth = gregorian({ month: "short" });
    const year = gregorian({ year: "numeric" });
```
  `src/components/date-picker/date-form-control.tsx`, replace `new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(bound);` with
```ts
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", calendar: "gregory" }).format(bound);
```
  `src/components/date-picker/date-picker.tsx`: in `DatePicker`, replace
```ts
  const formatter = new Intl.DateTimeFormat(resolvedLocale, format);
  const iso = value ? toISODate(value) : "";
```
  with
```ts
  const formatter = new Intl.DateTimeFormat(resolvedLocale, { ...format, calendar: "gregory" });
  const iso = value ? toISODate(value) : "";
```
  and in `DateRangePicker`, replace
```ts
  const formatter = new Intl.DateTimeFormat(resolvedLocale, format);

  const calendarProps = {
```
  with
```ts
  const formatter = new Intl.DateTimeFormat(resolvedLocale, { ...format, calendar: "gregory" });

  const calendarProps = {
```
  In the `PickerFields` JSDoc of `format`, replace `/** How the trigger shows the value. @default { dateStyle: "medium" } */` with `/** How the trigger shows the value; the calendar is always Gregorian. @default { dateStyle: "medium" } */`.

- [ ] **Step 5: run, expect pass.** Same command as Step 3, plus `npx vitest run src/components/calendar src/components/date-range-field src/components/date-picker`. All green.

- [ ] **Step 6: commit.**
```
git add src/components/calendar/calendar-base.tsx src/components/calendar/calendar.test.tsx src/components/date-picker/date-form-control.tsx src/components/date-picker/date-picker.tsx src/components/date-picker/date-picker.test.tsx src/components/date-field/date-field.test.tsx
git commit -m "fix(calendar): force the Gregorian calendar in the Calendar family

Calendar, the picker triggers and the min / max messages pass calendar: gregory,
so fa-IR, th-TH, ar-SA and -u-ca- tags no longer rename the month, year or day.
DateField segments were already Gregorian; a guard test pins that.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

#### Row #7: native form reset

**Semantics (decided here, binding for the steps below).** Reset target is the component's `defaultValue` prop as of the latest render (default `null`, `{start: null, end: null}` for ranges). The handler runs from a `setTimeout(0)` scheduled in the `reset` listener, so a later listener's `preventDefault()` (a React `onReset` on the `<form>` runs after ours) is seen; a cancelled reset does nothing.
- **Uncontrolled:** the internal value becomes `defaultValue`; partial segment input is discarded; `onValueChange(defaultValue)` fires once, and only if the value actually changes (resetting an already-default field with partial typing clears the typing and fires nothing).
- **Controlled:** the component never writes its own state. It calls `onValueChange(defaultValue)` once if `value` differs from `defaultValue`, and the parent decides. If the parent ignores it, the segments show the controlled `value` again (partial typing is still discarded). With no `defaultValue`, the reset target is `null`.
- Same rule for DateRangeField (a range differs if either end differs), TimePicker, and the pickers. Wrapped fields (editable DatePicker / DateRangePicker / TimePicker) receive the picker's `defaultValue` so the inner field resets to the picker's default, not to `null`. The button DatePicker / DateRangePicker use the same rule through `PickerShell`'s form control. The button DateRangePicker calls `onValueChange` on reset only when the default range is complete (its documented contract is "called only with a complete range"; changing that contract is the deferred L3 decision). An incomplete default resets the uncontrolled state silently; a controlled parent with an incomplete default is not notified, which goes in the backlog for L3.
- A disabled field resets too (a native input does). Dirty state needs no code: `useFormControl` recomputes it from the input string against the first rendered string.

- [ ] **Step 1: RED, DateField.** In `src/components/date-field/date-field.test.tsx` add:

```tsx
describe("DateField: native form reset", () => {
  const form = () => document.querySelector("form") as HTMLFormElement;
  const input = () =>
    document.querySelector<HTMLInputElement>("[data-slot=date-form-control]") as HTMLInputElement;
  /** Timers fire in order, so this runs after the reset handler's own `setTimeout(0)`. */
  const afterResetHandler = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  it("uncontrolled: restores defaultValue and reports the change once", async () => {
    const onValueChange = vi.fn();
    await render(
      <form>
        <Basic name="due" defaultValue={d(2026, 9, 1)} onValueChange={onValueChange} />
      </form>,
    );
    await userEvent.click(seg("day"));
    await userEvent.keyboard("{ArrowUp}");
    expect(texts()).toEqual(["09", "02", "2026"]);
    onValueChange.mockClear();
    form().reset();
    await expect.poll(() => texts()).toEqual(["09", "01", "2026"]);
    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenCalledWith(d(2026, 9, 1));
    expect(input().value).toBe("2026-09-01");
  });

  it("uncontrolled: clears partial typing without reporting when the value already is the default", async () => {
    const onValueChange = vi.fn();
    await render(
      <form>
        <Basic name="due" onValueChange={onValueChange} />
      </form>,
    );
    await userEvent.click(seg("month"));
    await type("09");
    expect(seg("month").hasAttribute("data-placeholder")).toBe(false);
    form().reset();
    await expect.poll(() => seg("month").hasAttribute("data-placeholder")).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("controlled: asks the parent for defaultValue, which then shows", async () => {
    const onChange = vi.fn();
    function Controlled() {
      const [value, setValue] = useState<Date | null>(d(2026, 9, 20));
      return (
        <form>
          <Basic
            value={value}
            defaultValue={d(2026, 9, 1)}
            onValueChange={(next) => {
              onChange(next);
              setValue(next);
            }}
          />
        </form>
      );
    }
    await render(<Controlled />);
    form().reset();
    await expect.poll(() => texts()).toEqual(["09", "01", "2026"]);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(d(2026, 9, 1));
  });

  it("controlled: a parent that ignores the request keeps its value on screen; no defaultValue resets to null", async () => {
    const onValueChange = vi.fn();
    await render(
      <form>
        <Basic value={d(2026, 9, 20)} onValueChange={onValueChange} />
      </form>,
    );
    await userEvent.click(seg("day"));
    await type("0");
    // Typing 0 already reports null (the day is cleared), so clear the mock: only the reset's own call may remain.
    onValueChange.mockClear();
    form().reset();
    await afterResetHandler();
    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenCalledWith(null);
    expect(texts()).toEqual(["09", "20", "2026"]);
  });

  it("a cancelled reset changes nothing", async () => {
    const onValueChange = vi.fn();
    await render(
      <form onReset={(event) => event.preventDefault()}>
        <Basic defaultValue={d(2026, 9, 1)} onValueChange={onValueChange} />
      </form>,
    );
    await userEvent.click(seg("day"));
    await userEvent.keyboard("{ArrowUp}");
    onValueChange.mockClear();
    form().reset();
    await afterResetHandler();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(texts()).toEqual(["09", "02", "2026"]);
  });
});
```

  Note on the "ignores" test: typing `0` into the day segment clears the day and already reports `null` (`commit({day:null})` calls `emit(null)`), which is why the test clears the mock before the reset. After that the only call left is the reset's own `onValueChange(null)`, so the test fails on the baseline (no reset listener, zero calls) and passes after the fix.

  In `src/components/time-field/time-field.test.tsx` add:

```tsx
describe("TimeField: native form reset", () => {
  const form = () => document.querySelector("form") as HTMLFormElement;

  it("uncontrolled: restores defaultValue and reports the change once", async () => {
    const onValueChange = vi.fn();
    await render(
      <form>
        <Basic name="at" defaultValue="09:30" onValueChange={onValueChange} />
      </form>,
    );
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{ArrowUp}");
    expect(hiddenInput().value).toBe("10:30");
    onValueChange.mockClear();
    form().reset();
    await expect.poll(() => hiddenInput().value).toBe("09:30");
    expect(texts().slice(0, 2)).toEqual(["09", "30"]);
    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenCalledWith("09:30");
  });

  it("controlled: asks the parent; a parent that ignores keeps its value", async () => {
    const onValueChange = vi.fn();
    await render(
      <form>
        <Basic value="10:30" defaultValue="09:30" onValueChange={onValueChange} />
      </form>,
    );
    form().reset();
    await expect.poll(() => onValueChange.mock.calls.length).toBe(1);
    expect(onValueChange).toHaveBeenCalledWith("09:30");
    expect(hiddenInput().value).toBe("10:30");
    expect(texts().slice(0, 2)).toEqual(["10", "30"]);
  });

  it("a field outside its form, linked with the form attribute, resets with that form", async () => {
    await render(
      <>
        <form id="late" />
        <Basic form="late" name="at" defaultValue="09:30" />
      </>,
    );
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{ArrowUp}");
    expect(hiddenInput().value).toBe("09:31");
    (document.getElementById("late") as HTMLFormElement).reset();
    await expect.poll(() => hiddenInput().value).toBe("09:30");
  });
});
```

  In `src/components/date-range-field/date-range-field.test.tsx` add (uses the file's `Half` helpers, `texts`, `seg`, `range`, `d`; check `Basic` there is the file's wrapper component name before pasting: the file defines its component helper near the top, reuse it and pass `aria-label`):

```tsx
describe("DateRangeField: native form reset", () => {
  it("restores the default range and reports the pair once", async () => {
    const onValueChange = vi.fn();
    await render(
      <form>
        <DateRangeField
          aria-label="Stay"
          locale="en-US"
          defaultValue={range(d(2026, 9, 1), d(2026, 9, 12))}
          onValueChange={onValueChange}
        />
      </form>,
    );
    await userEvent.click(seg("end", "day"));
    await userEvent.keyboard("{ArrowUp}");
    expect(texts("end")).toEqual(["09", "13", "2026"]);
    onValueChange.mockClear();
    (document.querySelector("form") as HTMLFormElement).reset();
    await expect.poll(() => texts("end")).toEqual(["09", "12", "2026"]);
    expect(texts("start")).toEqual(["09", "01", "2026"]);
    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenCalledWith(range(d(2026, 9, 1), d(2026, 9, 12)));
  });
});
```

  In `src/components/date-picker/date-picker.test.tsx` add (uses the file's `Picker`, `Range`-style wrapper inside the DateRangePicker describe is not reachable from outside, so declare these at file level after the last describe, with their own wrappers):

```tsx
describe("pickers: native form reset", () => {
  const form = () => document.querySelector("form") as HTMLFormElement;

  it("DatePicker (button): the trigger returns to the default day", async () => {
    const onValueChange = vi.fn();
    await render(
      <form>
        <Picker defaultValue={d(2026, 9, 1)} onValueChange={onValueChange} />
      </form>,
    );
    await open();
    await userEvent.click(dayButton(d(2026, 9, 10)));
    await expect.poll(() => triggerEl().textContent).toBe(medium(d(2026, 9, 10)));
    onValueChange.mockClear();
    form().reset();
    await expect.poll(() => triggerEl().textContent).toBe(medium(d(2026, 9, 1)));
    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange).toHaveBeenCalledWith(d(2026, 9, 1));
  });

  it("DatePicker (editable): the inner field resets to the picker's default, not to empty", async () => {
    await render(
      <form>
        <Picker editable defaultValue={d(2026, 9, 1)} />
      </form>,
    );
    const day = document.querySelector(
      "[data-slot=date-field-segment][data-type=day]",
    ) as HTMLElement;
    await userEvent.click(day);
    await userEvent.keyboard("{ArrowUp}");
    expect(day.textContent).toBe("02");
    form().reset();
    await expect.poll(() => day.textContent).toBe("01");
  });

  it("DateRangePicker (button): the trigger returns to the default range", async () => {
    const stay = { start: d(2026, 9, 1), end: d(2026, 9, 12) };
    await render(
      <form>
        <div className="p-16">
          <DateRangePicker aria-label="Stay" locale="en-US" defaultValue={stay} />
        </div>
      </form>,
    );
    const rangeText = (start: Date, end: Date) =>
      new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).formatRange(start, end);
    await open();
    await userEvent.click(dayButton(d(2026, 9, 14)));
    await userEvent.click(dayButton(d(2026, 9, 20)));
    await expect.poll(() => triggerEl().textContent).toBe(rangeText(d(2026, 9, 14), d(2026, 9, 20)));
    form().reset();
    await expect.poll(() => triggerEl().textContent).toBe(rangeText(stay.start, stay.end));
  });
});
```

  In `src/components/time-picker/time-picker.test.tsx` add:

```tsx
describe("TimePicker: native form reset", () => {
  it("the inner TimeField resets to the picker's default", async () => {
    await render(
      <form>
        <TimePicker aria-label="Start" locale="en-US" name="at" defaultValue="09:00" />
      </form>,
    );
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{ArrowUp}");
    expect(texts().slice(0, 2)).toEqual(["10", "00"]);
    (document.querySelector("form") as HTMLFormElement).reset();
    await expect.poll(() => texts().slice(0, 2)).toEqual(["09", "00"]);
  });
});
```

- [ ] **Step 2: run, expect failure.** `npx vitest run src/components/date-field/date-field.test.tsx src/components/time-field/time-field.test.tsx src/components/date-range-field/date-range-field.test.tsx src/components/date-picker/date-picker.test.tsx src/components/time-picker/time-picker.test.tsx`. Expected: every new reset case fails on its first `expect.poll` (the text stays "02" / "10:30" / the picked day: nothing listens to `reset`; the controlled cases never see `onValueChange`). The "cancelled reset" case passes now (nothing happens either way) and is the regression guard for the fix.

- [ ] **Step 3: GREEN, the hook.** `src/components/field/form-control.tsx`:
  - Add `useEffect` is already imported. In `FormControlOptions`, after `customValidity: string;` add
```ts
  /**
   * Called after the enclosing form's native `reset` event (the form the input belongs to, also
   * through the `form` attribute) unless that event was cancelled. The caller restores its own
   * default value; the hidden input itself only mirrors it.
   */
  onReset?: () => void;
```
  - Destructure `onReset,` in `useFormControl`'s parameters (after `customValidity,`), and after the `setRef` callback add:
```ts
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `form` (the form attribute) can move the input to another form, so the owner is re-read when it changes.
  useEffect(() => {
    const owner = inputRef.current?.form;
    if (!owner) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handleReset = (event: Event) => {
      clearTimeout(timer);
      // After the whole dispatch: a later listener (a React `onReset` on the form) may still
      // cancel the reset, and the browser restores the native inputs only if it did not.
      timer = setTimeout(() => {
        if (!event.defaultPrevented) onResetRef.current?.();
      }, 0);
    };
    owner.addEventListener("reset", handleReset);
    return () => {
      owner.removeEventListener("reset", handleReset);
      clearTimeout(timer);
    };
  }, [form]);
```
  - `src/components/date-field/date-segments-control.tsx`: in `DateSegmentsControl` add after the `fill` member
```ts
  /** Shows `date` in every segment and drops partial input, reporting nothing (a form reset). */
  reset: (date: Date | null) => void;
```
  In `useDateSegments`, after the `fill` function add
```ts
  const reset = (date: Date | null) => {
    setEntry(null);
    heldRef.current = false;
    setHeld(false);
    setSegments(dateToSegments(date));
    setSynced(date);
  };
```
  and change `return { segments: rendered, partial, fill };` to `return { segments: rendered, partial, fill, reset };`.
  - `src/components/date-field/date-field.tsx`: change the import to `import { type DateSegmentLabels, sameDate, segmentSelector, useDateSegments } from "./date-segments-control";` (keep the file's existing import list, adding `sameDate`), and in the `useDateFormControl({...})` call add after `controlRef: firstSegmentRef,`
```ts
    onReset: () => {
      control.reset(defaultValue);
      if (!sameDate(value, defaultValue)) {
        setValue(defaultValue);
        onValueChange?.(defaultValue);
      }
    },
```
  - `src/components/date-range-field/date-range-field.tsx`: in its `useDateFormControl({...})` call add after `controlRef: firstSegmentRef,`
```ts
    onReset: () => {
      startControl.reset(defaultValue.start);
      endControl.reset(defaultValue.end);
      if (
        !sameDate(latestRef.current.start, defaultValue.start) ||
        !sameDate(latestRef.current.end, defaultValue.end)
      ) {
        emit(defaultValue);
      }
    },
```
  - `src/components/time-field/time-segments-control.tsx`: change `import type { HourCycle, TimeGranularity } from "../../lib/time";` handling later in Row #9; for now in `TimeSegmentsControl` add after `fill`
```ts
  /** Shows `value` in every segment and drops partial input, reporting nothing (a form reset). */
  reset: (value: string | null) => void;
```
  In `useTimeSegments`, after the `fill` function add
```ts
  const reset = (next: string | null) => {
    setEntry(null);
    heldRef.current = false;
    setSegments(timeValueToSegments(next, hourCycle));
    setSynced({ value: next, hourCycle });
  };
```
  and find the hook's final `return { segments: ..., partial, fill };` (the last statement of `useTimeSegments`) and add `reset` to the object.
  - `src/components/time-field/time-field.tsx`: in the `useFormControl({...})` call add after `controlRef: firstSegmentRef,`
```ts
    onReset: () => {
      const initial = normalizeTime(defaultValue, granularity);
      control.reset(initial);
      if (initial !== value) {
        setValue(initial);
        onValueChange?.(initial);
      }
    },
```
  - `src/components/date-picker/date-picker.tsx`: add `import { sameDate } from "../date-field/date-segments-control";` after the `date-field` import. In `DatePicker`'s editable branch, add `defaultValue={defaultValue}` to `<DateField` (after `value={value}`). In its button branch's `formControl={{ ... }}` add after `customValidity: rangeMessage,`
```ts
        onReset: () => {
          if (sameDate(value, defaultValue)) return;
          setValue(defaultValue);
          onValueChange?.(defaultValue);
        },
```
  In `DateRangePicker`'s editable branch add `defaultValue={defaultValue}` to `<DateRangeField` (after `value={value}`), and in its button branch's `formControl={{ ... }}` add after `customValidity,`
```ts
        onReset: () => {
          if (sameDate(value.start, defaultValue.start) && sameDate(value.end, defaultValue.end)) {
            return;
          }
          setValue(defaultValue);
          // The documented contract is "called only with a complete range" (date-picker.tsx ~418-423); the
          // contract decision is deferred to L3, so an incomplete default resets the state silently.
          if (defaultValue.start && defaultValue.end) onValueChange?.(defaultValue);
        },
```
  - `src/components/time-picker/time-picker.tsx`: add `defaultValue={defaultValue}` to `<TimeField` in `renderField` (after `value={value}`).

- [ ] **Step 4: run, expect pass.** Same command as Step 2, then `npx vitest run src/components/form src/components/field src/components/color-picker src/components/tags-input src/components/file-upload` (the other `useFormControl` callers, unchanged by an optional option). All green.

- [ ] **Step 5: commit.**
```
git add src/components/field/form-control.tsx src/components/date-field/date-segments-control.tsx src/components/date-field/date-field.tsx src/components/date-field/date-field.test.tsx src/components/date-range-field/date-range-field.tsx src/components/date-range-field/date-range-field.test.tsx src/components/time-field/time-segments-control.tsx src/components/time-field/time-field.tsx src/components/time-field/time-field.test.tsx src/components/date-picker/date-picker.tsx src/components/date-picker/date-picker.test.tsx src/components/time-picker/time-picker.tsx src/components/time-picker/time-picker.test.tsx
git commit -m "fix(date-field): native form reset restores defaultValue

useFormControl takes onReset and listens on the input's form (also through the form
attribute). DateField, DateRangeField, TimeField and the pickers restore defaultValue;
controlled fields call onValueChange(defaultValue). Cancelled resets are ignored.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

#### Row #8: `parseDateString`

- [ ] **Step 1: RED.** In `src/lib/date-segments.test.ts`, inside `describe("parseDateString", ...)`, add:

```ts
  const early = (year: number, month: number, day: number) => {
    const date = new Date(2000, 0, 1);
    date.setFullYear(year, month - 1, day); // the constructor would map 0–99 to 1900–1999
    return date;
  };

  it.each([
    ["2026-9-5", "en-US", d(2026, 9, 5)],
    ["2026/09/25", "en-US", d(2026, 9, 25)],
    ["2026/9/5", "de-DE", d(2026, 9, 5)],
    [" 2026-09-5 ", "en-GB", d(2026, 9, 5)],
    ["2024/2/29", "en-US", d(2024, 2, 29)],
    ["٢٠٢٦/٩/٥", "ar-EG", d(2026, 9, 5)],
    ["9/25/0100", "en-US", early(100, 9, 25)],
  ] as const)("%j in %s → a date (non-padded or slashed ISO, year-first)", (text, locale, expected) => {
    expect(parseDateString(text, locale)).toEqual(expected);
  });

  it.each([
    ["9/25/26", "en-US"], // a two-digit year is ambiguous: no pivot is guessed
    ["9/25/0026", "en-US"],
    ["9/25/0099", "en-US"],
    ["25.09.99", "de-DE"],
    ["0026-09-25", "en-US"],
    ["0099-12-31", "de-DE"],
    ["2026/2/29", "en-US"], // not a leap year
    ["2026-9/5", "en-US"], // mixed separators are not ISO, and month 2026 is no month
    ["2026-13-01", "en-US"],
  ])("%j in %s → null (year below 100, impossible day or malformed)", (text, locale) => {
    expect(parseDateString(text, locale)).toBeNull();
  });
```

- [ ] **Step 2: run, expect failure.** `npx vitest run src/lib/date-segments.test.ts`. Expected failures: `"2026-9-5"`, `"2026/09/25"` (en-US reads month 2026 and returns `null`, expected a Date), `"2026/9/5"` de-DE, `"٢٠٢٦/٩/٥"` ar-EG; and `"9/25/26"`, `"9/25/0026"`, `"25.09.99"`, `"0026-09-25"`, `"0099-12-31"` return a Date (year 26 / 99), expected `null`.

- [ ] **Step 3: GREEN.** In `src/lib/date-segments.ts` replace the whole body of `parseDateString` (keep its signature) and update the doc comment:

```ts
/**
 * A pasted date: year-first ISO with one separator, `-` or `/`, padded or not ("2026-09-25",
 * "2026-9-5", "2026/09/25"), else three digit groups (ASCII or the locale's digits) read in the
 * locale's segment order ("9/25/2026" in en-US, "25.09.2026" in de-DE). `null` unless it forms a
 * real day in a year of 100 or later: a year below 100 ("9/25/26") is ambiguous and no century
 * pivot is guessed.
 */
export function parseDateString(text: string, locale?: string): Date | null {
  const digits = getLocaleDigits(locale);
  const ascii = text.trim().replace(/./gu, (char) => {
    const digit = parseDigit(char, digits);
    return digit === null ? char : String(digit);
  });
  const segments: DateSegments = { ...emptySegments };
  const iso = /^(\d{4})([-/])(\d{1,2})\2(\d{1,2})$/.exec(ascii);
  if (iso) {
    segments.year = Number(iso[1]);
    segments.month = Number(iso[3]);
    segments.day = Number(iso[4]);
  } else {
    const groups = ascii.match(/\d+/g);
    if (groups?.length !== 3) return null;
    const types = getDateSegmentOrder(locale)
      .filter((part) => part.type !== "literal")
      .map((part) => part.type as DateSegmentType);
    types.forEach((type, index) => {
      segments[type] = Number(groups[index]);
    });
  }
  if (segments.year === null || segments.year < 100) return null;
  return segmentsToDate(segments);
}
```
  If `parseISODate` becomes unused in this file, remove it from the file's import list.

- [ ] **Step 4: run, expect pass.** `npx vitest run src/lib/date-segments.test.ts src/components/date-field src/components/date-range-field` (paste handlers and `parseDateRangeString` go through this function). All green.

- [ ] **Step 5: commit.**
```
git add src/lib/date-segments.ts src/lib/date-segments.test.ts
git commit -m "fix(date-segments): parseDateString rejects years below 100, accepts non-padded ISO

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

#### Row #9: TimeField step that is not a whole hour or a divisor of an hour

Rule: `isCompositeStep(step)` is true when the step is neither whole hours, nor whole minutes that divide 60, nor seconds that divide 60. For those, ↑ / ↓ / PageUp / PageDown on any numeric segment move the whole time to the next / previous value on the grid `offset + k × step` (the offset is `min` modulo the step) and re-split it; Home / End jump to the first / last grid value. Wraps at midnight. At minute granularity only grid values on a whole minute are used. Other steps keep the per-segment path.

- [ ] **Step 1: RED, helpers.** In `src/lib/time-segments.test.ts`, add `isCompositeStep` and `stepTimeOfDay` to the import list from `"./time-segments"`, then append:

```ts
describe("isCompositeStep", () => {
  it.each([
    [60, false],
    [1, false],
    [30, false],
    [120, false],
    [900, false],
    [3600, false],
    [7200, false],
    [18000, false], // whole hours stay on the hour segment (backlog: 12-hour limit)
    [5400, true], // 90 minutes
    [420, true], // 7 minutes
    [90, true], // 90 seconds
    [45, true],
    [0.4, false], // rounds to 1 second
    [Number.NaN, false], // an invalid step behaves as 60
  ])("step %s → %s", (step, expected) => {
    expect(isCompositeStep(step)).toBe(expected);
  });
});

describe("stepTimeOfDay", () => {
  it("steps whole times on the grid from midnight (step 5400: 00:00, 01:30, 03:00, …)", () => {
    expect(stepTimeOfDay(3600, 1, 5400, undefined, "minute")).toBe(5400); // 01:00 → 01:30
    expect(stepTimeOfDay(3600, -1, 5400, undefined, "minute")).toBe(0);
    expect(stepTimeOfDay(5400, 1, 5400, undefined, "minute")).toBe(10800);
    expect(stepTimeOfDay(10800, -1, 5400, undefined, "minute")).toBe(5400);
  });

  it("wraps at midnight (the last grid value of step 5400 is 22:30)", () => {
    expect(stepTimeOfDay(81000, 1, 5400, undefined, "minute")).toBe(0);
    expect(stepTimeOfDay(0, -1, 5400, undefined, "minute")).toBe(81000);
  });

  it("counts the grid from min (09:10 with step 5400: 07:40, 09:10, 10:40)", () => {
    expect(stepTimeOfDay(33000, 1, 5400, "09:10", "minute")).toBe(38400);
    expect(stepTimeOfDay(33000, -1, 5400, "09:10", "minute")).toBe(27600);
  });

  it("an empty time goes to the first grid value up, the last down", () => {
    expect(stepTimeOfDay(null, 1, 420, undefined, "minute")).toBe(0);
    expect(stepTimeOfDay(null, -1, 420, undefined, "minute")).toBe(86100 - (86100 % 420));
  });

  it("at minute granularity skips grid values that are not on a whole minute (step 90 s)", () => {
    expect(stepTimeOfDay(0, 1, 90, undefined, "minute")).toBe(180);
    expect(stepTimeOfDay(0, 1, 90, undefined, "second")).toBe(90);
  });
});
```

- [ ] **Step 2: RED, component.** In `src/components/time-field/time-field.test.tsx` replace the existing test titled `"step 5400: minutes step by 30; 01:30 is valid and 02:30 shows the step message"` (the whole `it(...)` block) with:

```tsx
  it("step 5400 (90 minutes): any segment's arrow steps the whole time on the 00:00, 01:30, 03:00 grid", async () => {
    await render(<Basic hourCycle={24} step={5400} defaultValue="01:00" />);
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{ArrowUp}");
    expect(hiddenInput().value).toBe("01:30");
    expect(root().hasAttribute("data-invalid")).toBe(false);
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{ArrowUp}");
    expect(hiddenInput().value).toBe("03:00");
    expect(root().hasAttribute("data-invalid")).toBe(false);
    await userEvent.keyboard("{ArrowDown}");
    expect(hiddenInput().value).toBe("01:30");
  });

  it("step 5400: an off-grid typed value is still reported invalid with the step message", async () => {
    await render(<Basic hourCycle={24} step={5400} defaultValue="02:30" />);
    expect(root().hasAttribute("data-invalid")).toBe(true);
    expect(hiddenInput().validationMessage).toBe("Enter a time in 90-minute steps.");
  });

  it("step 420 (7 minutes) from 07:00: ↑ lands on 07:07, 07:14 and ↓ comes back", async () => {
    await render(<Basic hourCycle={24} step={420} defaultValue="07:00" />);
    await userEvent.click(seg("minute"));
    await userEvent.keyboard("{ArrowUp}");
    expect(hiddenInput().value).toBe("07:07");
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{ArrowUp}");
    expect(hiddenInput().value).toBe("07:14");
    expect(root().hasAttribute("data-invalid")).toBe(false);
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{ArrowDown}");
    expect(hiddenInput().value).toBe("07:00");
  });

  it("step 5400: Home / End jump to the first and last grid value; ↑ from 22:30 wraps to 00:00", async () => {
    await render(<Basic hourCycle={24} step={5400} defaultValue="03:00" />);
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{End}");
    expect(hiddenInput().value).toBe("22:30");
    await userEvent.keyboard("{ArrowUp}");
    expect(hiddenInput().value).toBe("00:00");
    await userEvent.keyboard("{Home}");
    expect(hiddenInput().value).toBe("00:00");
  });

  it("an empty step-5400 field: ↑ fills 00:00 and ↓ fills 22:30", async () => {
    const { rerender } = await render(<Basic hourCycle={24} step={5400} />);
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{ArrowUp}");
    expect(hiddenInput().value).toBe("00:00");
    await rerender(<Basic key="b" hourCycle={24} step={5400} />);
    await userEvent.click(seg("hour"));
    await userEvent.keyboard("{ArrowDown}");
    expect(hiddenInput().value).toBe("22:30");
  });
```

- [ ] **Step 3: run, expect failure.** `npx vitest run src/lib/time-segments.test.ts src/components/time-field/time-field.test.tsx`. Expected: the lib suite fails to import (`isCompositeStep` / `stepTimeOfDay` are not exported: "is not a function"); the component cases fail (`"02:30"` instead of `"03:00"` after the hour ↑, `"07:01"` instead of `"07:07"`, `End` gives `"23:00"`-style per-segment values).

- [ ] **Step 4: GREEN, helpers.** `src/lib/time-segments.ts`: change the import `import { formatTimeValue, type HourCycle, parseTime, type TimeGranularity } from "./time";` to
```ts
import {
  formatTimeValue,
  type HourCycle,
  parseTime,
  type TimeGranularity,
  timeToSeconds,
} from "./time";
```
  and add after `timeSegmentSteps`:
```ts
/**
 * Whether arrow keys must step the whole time on the `step` grid instead of one segment at a time.
 * Per-segment stepping is exact for whole hours, for whole minutes that divide 60 and for seconds
 * that divide 60; any other step (90 minutes, 7 minutes, 45 seconds) is composite. An invalid
 * step behaves as 60.
 */
export function isCompositeStep(step: number): boolean {
  const seconds = Number.isFinite(step) && step > 0 ? Math.max(1, Math.round(step)) : 60;
  if (seconds % 3600 === 0) return false;
  if (seconds % 60 === 0) return 60 % (seconds / 60) !== 0;
  return 60 % seconds !== 0;
}

/**
 * The time of day (seconds since midnight) one grid step from `current` in `direction`, on the
 * grid `offset + k × step` where `offset` is `min` modulo the step (default midnight). Wraps at
 * midnight; `null` (no time yet) goes to the first grid value up and the last down. At minute
 * granularity only grid values on a whole minute count.
 */
export function stepTimeOfDay(
  current: number | null,
  direction: 1 | -1,
  step: number,
  min: string | undefined,
  granularity: TimeGranularity,
): number {
  const size = Number.isFinite(step) && step > 0 ? Math.max(1, Math.round(step)) : 60;
  const base = (min === undefined ? null : timeToSeconds(min)) ?? 0;
  const grid: number[] = [];
  for (let seconds = ((base % size) + size) % size; seconds < 86400; seconds += size) {
    if (granularity === "second" || seconds % 60 === 0) grid.push(seconds);
  }
  if (grid.length === 0) return current ?? 0;
  if (current === null) return (direction > 0 ? grid[0] : grid[grid.length - 1]) as number;
  const next =
    direction > 0
      ? grid.find((seconds) => seconds > current)
      : grid.findLast((seconds) => seconds < current);
  return (next ?? (direction > 0 ? grid[0] : grid[grid.length - 1])) as number;
}
```
  Also fix the empty-time unit test expectation if it does not hold: for step 420 the last grid value below 86400 is `420 * 205 = 86100`; the test line `86100 - (86100 % 420)` equals 86100 since 86100 is a multiple of 420, so it passes as written.

  `src/components/time-field/time-segments-control.tsx`: replace `import type { HourCycle, TimeGranularity } from "../../lib/time";` with
```ts
import {
  type HourCycle,
  secondsToTimeValue,
  type TimeGranularity,
  timeToSeconds,
} from "../../lib/time";
```
  add `isCompositeStep,` and `stepTimeOfDay,` to the `../../lib/time-segments` import list (alphabetical: `isCompositeStep` after `hasDayPeriod`, `stepTimeOfDay` after `stepTimeSegment`... keep the list sorted as Biome requires). In `handleKeyDown`, replace
```ts
    const stepBy = (delta: number) => {
      if (type === "dayPeriod") return set(current === null ? (delta > 0 ? 0 : 1) : 1 - current);
      const { step: size, offset } = steps[type];
      return set(stepTimeSegment(current, delta, bounds, size, offset));
    };
```
  with
```ts
    // A step that is not whole hours nor divides a minute or an hour evenly (90 minutes, 7
    // minutes) cannot be walked one segment at a time: step the whole time on the grid, re-split.
    const composite = isCompositeStep(step) && type !== "dayPeriod";
    const stepTime = (direction: 1 | -1, from: number | null) => {
      const next = stepTimeOfDay(from, direction, step, min, granularity);
      setEntry(null);
      commit(timeValueToSegments(secondsToTimeValue(next, granularity), hourCycle));
    };
    const stepBy = (delta: number) => {
      if (type === "dayPeriod") return set(current === null ? (delta > 0 ? 0 : 1) : 1 - current);
      if (composite) {
        const shown = timeSegmentsToValue(segments, hourCycle, granularity);
        return stepTime(delta > 0 ? 1 : -1, shown === null ? null : timeToSeconds(shown));
      }
      const { step: size, offset } = steps[type];
      return set(stepTimeSegment(current, delta, bounds, size, offset));
    };
```
  and replace the `Home` and `End` cases
```ts
      case "Home":
        if (type === "dayPeriod") return set(bounds.min);
        return set(stepTimeSegment(null, 1, bounds, steps[type].step, steps[type].offset));
      case "End":
        if (type === "dayPeriod") return set(bounds.max);
        return set(stepTimeSegment(null, -1, bounds, steps[type].step, steps[type].offset));
```
  with
```ts
      case "Home":
        if (type === "dayPeriod") return set(bounds.min);
        if (composite) return stepTime(1, null);
        return set(stepTimeSegment(null, 1, bounds, steps[type].step, steps[type].offset));
      case "End":
        if (type === "dayPeriod") return set(bounds.max);
        if (composite) return stepTime(-1, null);
        return set(stepTimeSegment(null, -1, bounds, steps[type].step, steps[type].offset));
```
  (`timeSegmentsToValue` and `timeValueToSegments` are already imported in that file.)

- [ ] **Step 5: run, expect pass.** `npx vitest run src/lib/time-segments.test.ts src/components/time-field src/components/time-picker`. All green; the other step tests (900, 3600, 30 s, Home / End on 900) keep the per-segment path and still pass.

- [ ] **Step 6: commit.**
```
git add src/lib/time-segments.ts src/lib/time-segments.test.ts src/components/time-field/time-segments-control.tsx src/components/time-field/time-field.test.tsx
git commit -m "fix(time-field): step the whole time for steps that are not whole hours or divisors of 60 minutes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

#### Row #10: `getTimeSlots`

Decisions: a `slotStep` of 1 or more is rounded to the nearest whole minute (`22.5` → 23, `7.4` → 7); below 1 still returns `[]` with the dev warning (checked before rounding). At minute granularity the seconds of `min` are ignored for the start and for the step grid.

- [ ] **Step 1: RED.** In `src/lib/time.test.ts`, inside `describe("getTimeSlots", ...)`, add (and add `0.5` to the existing `it.each([0, -15, Number.NaN, Number.POSITIVE_INFINITY])` list):

```ts
  it.each([
    [22.5, ["08:00", "08:23", "08:46", "09:09"]],
    [7.4, ["08:00", "08:07", "08:14", "08:21", "08:28"]],
    [1.5, ["08:00", "08:02", "08:04", "08:06", "08:08", "08:10"]],
  ] as const)("rounds a fractional slotStep (%s) to whole minutes", (slotStep, expected) => {
    const max = slotStep === 22.5 ? "09:30" : slotStep === 7.4 ? "08:30" : "08:10";
    expect(getTimeSlots({ slotStep, min: "08:00", max })).toEqual(expected);
  });

  it("ignores the seconds of min at minute granularity", () => {
    expect(getTimeSlots({ slotStep: 30, min: "09:00:30", max: "10:30" })).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
    ]);
  });

  it("keeps the seconds of min at second granularity (every slot shares them)", () => {
    expect(
      getTimeSlots({ slotStep: 30, min: "09:00:30", max: "10:00", granularity: "second" }),
    ).toEqual(["09:00:30", "09:30:30"]);
  });
```

- [ ] **Step 2: run, expect failure.** `npx vitest run src/lib/time.test.ts`. Expected: the fractional cases return values such as `"08:22"` / `"08:45"` (the 22.5-minute increments truncated by the formatter); the `min: "09:00:30"` case returns `[]` (every `HH:mm` slot mismatches the 60 s grid counted from 09:00:30); the new `0.5` case already passes. The second-granularity case passes (it pins existing behaviour).

- [ ] **Step 3: GREEN.** In `src/lib/time.ts`, `getTimeSlots`, replace

```ts
  const start = (min === undefined ? null : timeToSeconds(min)) ?? 0;
  const end = (max === undefined ? null : timeToSeconds(max)) ?? timeToSeconds("23:59") ?? 0;
  const slots: string[] = [];
  for (let seconds = start; seconds <= end; seconds += slotStep * 60) {
    const value = secondsToTimeValue(seconds, granularity);
    if (!timeStepMismatch(value, { step, min })) slots.push(value);
  }
  return slots;
```
  with
```ts
  const minutes = Math.round(slotStep);
  // At minute granularity a slot has no seconds, so the seconds of `min` neither shift the first
  // slot nor the step grid (counted from `min`).
  const minSeconds = (min === undefined ? null : timeToSeconds(min)) ?? 0;
  const start = granularity === "minute" ? Math.floor(minSeconds / 60) * 60 : minSeconds;
  const gridMin = secondsToTimeValue(start, "second");
  const end = (max === undefined ? null : timeToSeconds(max)) ?? timeToSeconds("23:59") ?? 0;
  const slots: string[] = [];
  for (let seconds = start; seconds <= end; seconds += minutes * 60) {
    const value = secondsToTimeValue(seconds, granularity);
    if (!timeStepMismatch(value, { step, min: gridMin })) slots.push(value);
  }
  return slots;
```
  and change the doc comment line `every `slotStep` minutes` to `every `slotStep` minutes (a fractional step is rounded)`.

- [ ] **Step 4: run, expect pass.** `npx vitest run src/lib/time.test.ts src/components/time-picker`. All green (TimePicker passes `min` / `step` through this function).

- [ ] **Step 5: commit.**
```
git add src/lib/time.ts src/lib/time.test.ts
git commit -m "fix(time): getTimeSlots rounds a fractional slotStep and ignores min seconds at minute granularity

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

#### Row #11: button DateRangePicker with a reversed controlled range

Decision (consistent with DateRangeField): the trigger shows the range sorted (earlier day first), is `data-invalid` / `aria-invalid`, and its hidden input carries the "end must be on or after the start" validity message (blocking submit, `labels.rangeReversed` overrides). The submitted values are not swapped (as typed, as DateRangeField). The popup's calendar draws no band for it (as the editable picker).

- [ ] **Step 1: RED.** In `src/components/date-picker/date-picker.test.tsx`, inside `describe("DateRangePicker", ...)` (it has `Range`, `rangeText`, `d`, `open`, `popup`, `triggerEl`), add:

```tsx
  it("a reversed controlled range shows sorted and invalid, with the DateRangeField message", async () => {
    await render(<Range value={{ start: d(2026, 9, 12), end: d(2026, 9, 1) }} />);
    expect(triggerEl().textContent).toBe(rangeText(d(2026, 9, 1), d(2026, 9, 12)));
    expect(triggerEl().textContent).toBe("Sep 1 – 12, 2026");
    expect(triggerEl().hasAttribute("data-invalid")).toBe(true);
    expect(triggerEl().getAttribute("aria-invalid")).toBe("true");
    const input = document.querySelector<HTMLInputElement>(
      "[data-slot=date-form-control]",
    ) as HTMLInputElement;
    expect(input.validationMessage).toBe("The end date must be on or after the start date.");
    expect(input.validity.valid).toBe(false);
  });

  it("labels.rangeReversed replaces the message; a forward range is valid; the calendar draws no band", async () => {
    const { rerender } = await render(
      <Range
        value={{ start: d(2026, 9, 12), end: d(2026, 9, 1) }}
        labels={{ rangeReversed: "Backwards" }}
      />,
    );
    const input = () =>
      document.querySelector<HTMLInputElement>("[data-slot=date-form-control]") as HTMLInputElement;
    expect(input().validationMessage).toBe("Backwards");
    const element = await open();
    expect(element.querySelectorAll("[data-selected], [data-range-middle]")).toHaveLength(0);
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await rerender(<Range value={{ start: d(2026, 9, 1), end: d(2026, 9, 12) }} />);
    expect(triggerEl().hasAttribute("data-invalid")).toBe(false);
    expect(input().validationMessage).toBe("");
  });
```

- [ ] **Step 2: run, expect failure.** `npx vitest run src/components/date-picker/date-picker.test.tsx`. Expected: the trigger text is `"Sep 12 – 1, 2026"` (Intl's `formatRange` does not throw on a reversed pair, it prints it as given); `data-invalid` is absent, `validationMessage` is `""`, and the calendar draws a band.

- [ ] **Step 3: GREEN.** `src/components/date-picker/date-picker.tsx`, `DateRangePicker`:
  - Right after `const formatter = new Intl.DateTimeFormat(resolvedLocale, { ...format, calendar: "gregory" });` (from Row #3) and before `const calendarProps = {`, add
```ts
  // An end before the start (a controlled value, or a typed one) is invalid and shows sorted; the
  // calendar draws no band for it, so it must not look like a valid selection.
  const reversed =
    !!value.start && !!value.end && compareDay(value.end, value.start) < 0;
  const calendarValue = reversed ? emptyRange : value;
```
  - In the editable branch, delete the two lines
```ts
    const reversed = !!value.start && !!value.end && compareDay(value.end, value.start) < 0;
    const calendarValue = reversed ? emptyRange : value;
```
    (keep the comment above them) so the branch uses the hoisted constants.
  - In the button branch replace
```ts
  const { start, end } = value;
  const text =
    start && end ? formatter.formatRange(start, end) : start ? formatter.format(start) : null;
```
    with
```ts
  const { start, end } = value;
  const [first, last] = reversed ? [end, start] : [start, end];
  const text =
    first && last ? formatter.formatRange(first, last) : first ? formatter.format(first) : null;
```
  - Replace
```ts
  const customValidity =
    (start && !end) || (!start && end)
      ? (labels?.incomplete ?? "Choose both a start and an end date.")
      : rangeMessage;
```
    with
```ts
  const customValidity =
    (start && !end) || (!start && end)
      ? (labels?.incomplete ?? "Choose both a start and an end date.")
      : rangeMessage ||
        (reversed
          ? (labels?.rangeReversed ?? "The end date must be on or after the start date.")
          : "");
```
  - Replace `outOfRange={rangeMessage !== ""}` in the button branch's `<PickerShell` with `outOfRange={rangeMessage !== "" || reversed}`.
  - In the button branch's `renderCalendar`, replace `value={value}` (inside `<RangePickerCalendar`) with `value={calendarValue}`.

- [ ] **Step 4: run, expect pass.** `npx vitest run src/components/date-picker` (button and editable suites; the editable reversed-range test still passes with the hoisted constants). All green.

- [ ] **Step 5: commit.**
```
git add src/components/date-picker/date-picker.tsx src/components/date-picker/date-picker.test.tsx
git commit -m "fix(date-picker): a reversed controlled DateRangePicker range shows sorted and invalid

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

- [ ] **Task gate.** `npm run format && npm run check`. If the formatter changes files, `git add` exactly those files and commit `style: format Task 2` with the trailer line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Hand-off to Task 8 (docs): README / backlog record "non-Gregorian calendars unsupported" and the unchanged 12-hour whole-hour step limit.

**Review focus**
- **Two-digit and early years (row #8):** `"9/25/26"`, `"25.09.99"`, `"0026-09-25"` must stay `null` and `"9/25/0100"` must parse. Pinned by the `parseDateString` tables in `src/lib/date-segments.test.ts` (Row #8, Step 1). Leap day: `"2024/2/29"` accepted, `"2026/2/29"` rejected, same step.
- **Grid wrap and off-grid start (row #9):** ↑ from 22:30 with `step={5400}` wraps to 00:00; an off-grid `defaultValue` (01:00) snaps to 01:30 on the first ↑; a `min` of 09:10 moves the grid. Pinned by the `stepTimeOfDay` unit tests and the "Home / End ... wraps" and "step 5400" component tests (Row #9, Steps 1 and 2). Times are wall-clock strings, so DST cannot shift them; no DST case exists by design.
- **Reset when nothing changed, and a cancelled reset (row #7):** a field with only partial typing resets to placeholders without calling `onValueChange`, a controlled parent that ignores the request keeps its value on screen, and `onReset` preventDefault leaves everything alone. Pinned by the DateField reset tests "clears partial typing without reporting", "a parent that ignores the request keeps its value on screen" and "a cancelled reset changes nothing" (Row #7, Step 1).

### Task 3: DataTable, ColorInput and file size

Spec rows #4, #5 (a, b, c) and #19. Five fixes, five commits, each test-first.

**Files:**
- Modify: `src/components/color-picker/color-picker.tsx` (`ColorInput.commit`), `src/components/color-picker/color-picker.test.tsx`
- Modify: `src/lib/data-table.ts` (export `isSortable`, doc of `sortable`), `src/lib/data-table.test.ts`
- Modify: `src/components/data-table/use-data-table.ts`, `src/components/data-table/use-data-table.test.tsx`
- Modify: `src/lib/file.ts` (`formatFileSize`), `src/lib/file.test.ts`

**Interfaces:**
- `isSortable<TData>(column: DataTableColumn<TData>, options?: { manual?: boolean }): boolean`, exported from `src/lib/data-table.ts` (a module export, not added to `src/index.ts`; `use-data-table.ts` imports it).
- `UseDataTableOptions.getRowId` keeps its type. It is read through a ref, so a new function identity never invalidates the sorted rows.
- `formatFileSize(bytes: number, locale?: string): string` keeps its signature.

**Spec corrections (decided while reading the code):**
- Row #5(b): the lib's rule is `(sortable ?? true) && (accessor || compare)`. Applying it to `canSort` verbatim would make a server-side column (`sortable: true`, `cell` only, in `manual` mode) unsortable, and `manual` mode is the documented use of such columns. So the shared rule is one function with a `manual` option: outside `manual` mode it is exactly the lib's rule; with `manual: true` an explicit `sortable: true` also counts. `sortRows` is never called in `manual` mode, so it uses the default.
- Row #5(c): only `getRowId` goes into a ref. `columns` stays an invalidation key of the sort memo, because an accessor or `compare` may close over component state (a currency, a locale) and a stale one would sort wrongly. Step 15 pins this on purpose. Consequence for DataTable users, documented in the step: hoist or memoise `columns` to avoid re-sorting on each render; an inline `getRowId` is now free.
- Row #5(a) hides only through `toggleColumn`. A parent that sets `columnVisibility` itself (controlled) or `defaultColumnVisibility` is the parent's responsibility; the engine does not rewrite `sorting` behind a controlled prop.

---

#### Row #4: ColorInput no-op edit

- [ ] **Step 1: Write the failing tests.** In `src/components/color-picker/color-picker.test.tsx`, inside `describe("ColorPicker input", …)`, directly after the test `"ColorInput's own format pins its display format"` (it ends with `toHaveValue("rgb(255 0 0)");` then `});`), add:

```tsx
  it("a no-op edit in hsl display commits nothing and keeps the value", async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();
    await render(
      <ColorPicker
        defaultValue="#1d4ed8"
        defaultFormat="hsl"
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      />,
    );
    const shown = (textInput().element() as HTMLInputElement).value;
    expect(shown).toMatch(/^hsl\(/);
    // Type something else, then restore the shown text: the draft equals the display again.
    await userEvent.fill(textInput(), `${shown}0`);
    await userEvent.fill(textInput(), shown);
    await userEvent.keyboard("{Enter}");
    await expect.element(textInput()).toHaveValue(shown);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommitted).not.toHaveBeenCalled();
  });

  it("text that re-parses to the current colour commits nothing", async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();
    await render(
      <ColorPicker
        defaultValue="#1d4ed8"
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      />,
    );
    await userEvent.fill(textInput(), "#1D4ED8");
    await userEvent.keyboard("{Enter}");
    await expect.element(textInput()).toHaveValue("#1d4ed8");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommitted).not.toHaveBeenCalled();
    // A real change still commits.
    await userEvent.fill(textInput(), "#ff0000");
    await userEvent.keyboard("{Enter}");
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
    expect(onValueCommitted).toHaveBeenLastCalledWith("#ff0000");
  });
```

- [ ] **Step 2: Run and see both fail.** `npx vitest run src/components/color-picker/color-picker.test.tsx -t "no-op edit|re-parses"`. Expected: both fail on `expect(onValueCommitted).not.toHaveBeenCalled()` (`commitColor` always calls `update(…, true)`; in the hsl case the lossy round trip through a rounded `hsl()` string can also move the hex, so `onValueChange` fires too).

- [ ] **Step 3: Fix.** In `src/components/color-picker/color-picker.tsx`, `ColorInput`, replace

```tsx
  const commit = () => {
    if (draft === null) return;
    const rgba = parseColor(draft);
    if (!rgba) return;
    setDraft(null);
    picker.commitColor(rgba);
  };
```

with

```tsx
  const commit = () => {
    if (draft === null) return;
    const rgba = parseColor(draft);
    if (!rgba) return;
    setDraft(null);
    // A no-op edit (the shown text, or text that formats to it) commits nothing. Re-committing
    // would round-trip the colour through the display format, which is lossy for hsl() and rgb().
    if (draft === display || formatColor(rgba, formatProp ?? picker.format) === display) return;
    picker.commitColor(rgba);
  };
```

(`formatColor` is already imported and used for `display` above.)

- [ ] **Step 4: Run the colour-picker suite, expect pass.** `npx vitest run src/components/color-picker`.

- [ ] **Step 5: Commit.**

```
git add src/components/color-picker/color-picker.tsx src/components/color-picker/color-picker.test.tsx
git commit -m "fix(color-input): a no-op edit does not commit

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

#### Row #5(a): hiding a sorted column drops it from the sorting

- [ ] **Step 6: Write the failing tests.** In `src/components/data-table/use-data-table.test.tsx`, add a block before `describe("useDataTable: labels and memoisation", …)`:

```tsx
describe("useDataTable: hiding a sorted column", () => {
  const bySortedTwo: SortingState = [
    { id: "title", desc: false },
    { id: "attendees", desc: true },
  ];

  it("removes the hidden column from the sorting (and reports it); showing it again does not restore it", async () => {
    const onSortingChange = vi.fn();
    const { result, act } = await setup({
      getRowId,
      defaultSorting: bySortedTwo,
      onSortingChange,
    });
    await act(() => result.current.toggleColumn("attendees"));
    expect(result.current.state.columnVisibility).toEqual({ attendees: false });
    expect(result.current.state.sorting).toEqual([{ id: "title", desc: false }]);
    expect(onSortingChange).toHaveBeenLastCalledWith([{ id: "title", desc: false }]);
    expect(result.current.getSort("attendees")).toEqual({ direction: null, priority: null });
    await act(() => result.current.toggleColumn("attendees"));
    expect(result.current.state.sorting).toEqual([{ id: "title", desc: false }]);
    await act(() => result.current.toggleColumn("title"));
    expect(result.current.state.sorting).toEqual([]);
    expect(result.current.primarySortId).toBeNull();
  });

  it("hiding an unsorted column leaves the sorting alone", async () => {
    const onSortingChange = vi.fn();
    const { result, act } = await setup({
      getRowId,
      defaultSorting: [{ id: "title", desc: false }],
      onSortingChange,
    });
    await act(() => result.current.toggleColumn("attendees"));
    expect(result.current.state.columnVisibility).toEqual({ attendees: false });
    expect(result.current.state.sorting).toEqual([{ id: "title", desc: false }]);
    // "actions" is hideable: false, so the toggle is refused and changes nothing.
    await act(() => result.current.toggleColumn("actions"));
    expect(result.current.state.sorting).toEqual([{ id: "title", desc: false }]);
    expect(onSortingChange).not.toHaveBeenCalled();
  });

  it("controlled sorting: reports the removal and shows what the parent keeps", async () => {
    const onSortingChange = vi.fn();
    const { result, act } = await setup({ getRowId, sorting: bySortedTwo, onSortingChange });
    await act(() => result.current.toggleColumn("attendees"));
    expect(onSortingChange).toHaveBeenCalledTimes(1);
    expect(onSortingChange).toHaveBeenLastCalledWith([{ id: "title", desc: false }]);
    expect(result.current.state.sorting).toEqual(bySortedTwo);
  });

  it("a hidden-column removal resets to the first page, like any sort change", async () => {
    const { result, act } = await setup({
      getRowId,
      defaultSorting: bySortedTwo,
      defaultPagination: { pageIndex: 1, pageSize: 5 },
    });
    expect(result.current.state.pagination.pageIndex).toBe(1);
    await act(() => result.current.toggleColumn("attendees"));
    expect(result.current.state.pagination).toEqual({ pageIndex: 0, pageSize: 5 });
  });
});
```

- [ ] **Step 7: Run and see them fail.** `npx vitest run src/components/data-table/use-data-table.test.tsx -t "hiding a sorted column"`. Expected: the first, third and fourth fail (sorting still contains the hidden column; `onSortingChange` is never called). The second ("hiding an unsorted column leaves the sorting alone") is a guard and passes before and after.

- [ ] **Step 8: Fix.** In `src/components/data-table/use-data-table.ts`, replace

```ts
    toggleColumn: (id) => {
      const next = toggleColumnVisibility(columnVisibility, id, columns);
      if (!sameVisibility(next, columnVisibility)) setColumnVisibilityState(next);
    },
```

with

```ts
    toggleColumn: (id) => {
      const next = toggleColumnVisibility(columnVisibility, id, columns);
      if (sameVisibility(next, columnVisibility)) return;
      setColumnVisibilityState(next);
      // A hidden column must not keep sorting rows the user can no longer see a header for.
      if (next[id] === false && sorting.some((entry) => entry.id === id)) {
        setSorting(sorting.filter((entry) => entry.id !== id));
      }
    },
```

`setSorting` (defined above the `return`) also resets the page to the first one, which the fourth test pins. Also extend the JSDoc of `toggleColumn` in `DataTableInstance`: change `toggleColumn: (id: string) => void;` to be preceded by `/** Shows or hides a column. Hiding a sorted column removes it from the sorting. */`.

- [ ] **Step 9: Run both data-table suites, expect pass.** `npx vitest run src/components/data-table src/lib/data-table.test.ts`. The memoisation test (`"does not re-sort on a re-render with the same inputs"`) still passes: hiding the sorted column empties the sorting, so `compare` is not called by the toggle, and the final `setSorting` still sorts.

- [ ] **Step 10: Commit.**

```
git add src/components/data-table/use-data-table.ts src/components/data-table/use-data-table.test.tsx
git commit -m "fix(data-table): hiding a sorted column removes it from the sorting

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

#### Row #5(b): one shared `isSortable` rule

- [ ] **Step 11: Write the failing tests.**

In `src/lib/data-table.test.ts`, add `isSortable,` to the import list from `"./data-table"` (alphabetical, between `getVisibleColumns` and `nextSorting`), and append at the end of the file:

```ts
describe("isSortable", () => {
  interface Row {
    n: number;
  }
  const accessor = (row: Row) => row.n;
  const compare = (a: Row, b: Row) => a.n - b.n;
  const column = (extra: Partial<DataTableColumn<Row>>): DataTableColumn<Row> => ({
    id: "c",
    header: "C",
    ...extra,
  });

  it.each<[string, Partial<DataTableColumn<Row>>, boolean, boolean]>([
    // [case, column, client, manual]
    ["an accessor", { accessor }, true, true],
    ["a compare", { compare }, true, true],
    ["nothing to sort by", {}, false, false],
    ["sortable: false with an accessor", { accessor, sortable: false }, false, false],
    ["sortable: false with a compare", { compare, sortable: false }, false, false],
    ["sortable: true with an accessor", { accessor, sortable: true }, true, true],
    // Only a server-side table sorts by something the client does not have.
    ["sortable: true and nothing to sort by", { sortable: true }, false, true],
    ["sortable: false and nothing to sort by", { sortable: false }, false, false],
  ])("%s", (_, partial, client, manual) => {
    expect(isSortable(column(partial))).toBe(client);
    expect(isSortable(column(partial), { manual: false })).toBe(client);
    expect(isSortable(column(partial), { manual: true })).toBe(manual);
  });
});
```

In `src/components/data-table/use-data-table.test.tsx`, in the existing test `"canSort follows toggleSort's rule; enableMultiSort is on the instance"` replace

```tsx
    expect(table.canSort("server")).toBe(true);
```

with

```tsx
    // `sortable: true` with nothing to sort by sorts only server-side (see the manual test below).
    expect(table.canSort("server")).toBe(false);
```

and add this test right after it:

```tsx
  it("canSort and the sort itself share one rule; manual mode also accepts sortable: true alone", async () => {
    const server: DataTableColumn<Event>[] = [{ id: "server", header: "Server", sortable: true }];
    const client = await setup({ columns: server, getRowId });
    expect(client.result.current.canSort("server")).toBe(false);
    await client.act(() => client.result.current.toggleSort("server"));
    expect(client.result.current.state.sorting).toEqual([]);

    const manual = await setup({ columns: server, getRowId, manual: true });
    expect(manual.result.current.canSort("server")).toBe(true);
    await manual.act(() => manual.result.current.toggleSort("server"));
    expect(manual.result.current.state.sorting).toEqual([{ id: "server", desc: false }]);
  });
```

- [ ] **Step 12: Run and see them fail.** `npx vitest run src/lib/data-table.test.ts src/components/data-table/use-data-table.test.tsx -t "isSortable|canSort"`. Expected: `isSortable is not a function` (not exported yet) and, in the hook, `canSort("server")` is `true` on a client table (the rules disagree today).

- [ ] **Step 13: Fix.**

In `src/lib/data-table.ts` replace

```ts
const isSortable = <TData>(column: DataTableColumn<TData>) =>
  (column.sortable ?? true) && (column.accessor !== undefined || column.compare !== undefined);
```

with

```ts
/**
 * Whether a header sorts the column: not `sortable: false`, and something to sort by (an
 * `accessor` or a `compare`). The one rule of `sortRows` and `useDataTable`'s `canSort`.
 * With `manual` (the server sorts), `sortable: true` alone is enough: there is nothing to sort by
 * on the client, the header only reports the state.
 */
export function isSortable<TData>(
  column: DataTableColumn<TData>,
  { manual = false }: { manual?: boolean } = {},
): boolean {
  if (column.sortable === false) return false;
  return (
    column.accessor !== undefined ||
    column.compare !== undefined ||
    (manual && column.sortable === true)
  );
}
```

and in the `DataTableColumn.sortable` doc replace `/** @default accessor !== undefined || compare !== undefined */` with `/** @default accessor !== undefined || compare !== undefined. `true` without either sorts only in `manual` mode. */`.

In `src/components/data-table/use-data-table.ts`:
1. Add `isSortable,` to the import list from `"../../lib/data-table"` (between `getVisibleColumns` and `nextSorting`).
2. Delete the local helper

```ts
const canSort = <TData>(column: DataTableColumn<TData> | undefined) =>
  !!column && (column.sortable ?? (column.accessor !== undefined || column.compare !== undefined));
```

3. In the returned object replace

```ts
    toggleSort: (id, { multi = false } = {}) => {
      if (!canSort(columns.find((column) => column.id === id))) return;
```

with

```ts
    toggleSort: (id, { multi = false } = {}) => {
      if (!canSortColumn(id)) return;
```

and replace `canSort: (id) => canSort(columns.find((column) => column.id === id)),` with `canSort: canSortColumn,`.

4. Directly above `const setPagination = …` add:

```ts
  const canSortColumn = (id: string) => {
    const column = columns.find((candidate) => candidate.id === id);
    return column !== undefined && isSortable(column, { manual });
  };
```

5. Update the JSDoc of `canSort` in `DataTableInstance` to: `/** Whether \`toggleSort(id)\` acts: \`isSortable\` (not \`sortable: false\`, and an \`accessor\` or \`compare\`; \`manual\` also accepts \`sortable: true\` alone). */`.

- [ ] **Step 14: Run both data-table suites, expect pass.** `npx vitest run src/components/data-table src/lib/data-table.test.ts`. If a DataTable test used a `sortable: true` column with no accessor in client mode, it now has no sort button; the grep for `sortable` in `src` shows none other than the lines changed here.

- [ ] **Step 15: Commit.**

```
git add src/lib/data-table.ts src/lib/data-table.test.ts src/components/data-table/use-data-table.ts src/components/data-table/use-data-table.test.tsx
git commit -m "fix(data-table): canSort and sortRows share one isSortable rule

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

#### Row #5(c): `getRowId` in a ref

- [ ] **Step 16: Write the failing tests.** In `src/components/data-table/use-data-table.test.tsx`, inside `describe("useDataTable: labels and memoisation", …)` after the test `"does not re-sort on a re-render with the same inputs"`, add:

```tsx
  it("an inline getRowId does not re-sort on a re-render", async () => {
    const compare = vi.fn((a: Event, b: Event) => a.attendees - b.attendees);
    const spied: DataTableColumn<Event>[] = [{ id: "attendees", header: "Attendees", compare }];
    const options = (): Options => ({
      columns: spied,
      // A new function on every render, as written inline in a component.
      getRowId: (row) => row.id,
      defaultSorting: [{ id: "attendees", desc: true }],
    });
    const { result, rerender } = await setup(options());
    expect(compare).toHaveBeenCalled();
    compare.mockClear();
    await rerender(options());
    await rerender(options());
    expect(compare).not.toHaveBeenCalled();
    expect(ids(result.current.rows)[0]).toBe("e12");
  });

  it("the latest getRowId names the rows when the data changes", async () => {
    const { result, rerender } = await setup({ getRowId: (row) => `a-${row.id}` });
    expect(result.current.rows[0]?.id).toBe("a-e1");
    await rerender({ getRowId: (row) => `b-${row.id}` });
    // Same data: the ids are not recomputed (that is what keeps the sorted rows stable).
    expect(result.current.rows[0]?.id).toBe("a-e1");
    await rerender({ getRowId: (row) => `b-${row.id}`, data: events.slice(0, 3) });
    expect(result.current.rows.map((row) => row.id)).toEqual(["b-e1", "b-e2", "b-e3"]);
  });

  it("adding or removing getRowId recomputes the ids", async () => {
    const { result, rerender } = await setup({});
    expect(result.current.rows[0]?.id).toBe("0");
    await rerender({ getRowId });
    expect(result.current.rows[0]?.id).toBe("e1");
    await rerender({});
    expect(result.current.rows[0]?.id).toBe("0");
  });

  it("a new columns array still re-sorts (an accessor may close over state)", async () => {
    const compare = vi.fn((a: Event, b: Event) => a.attendees - b.attendees);
    const options = (): Options => ({
      columns: [{ id: "attendees", header: "Attendees", compare }],
      getRowId,
      defaultSorting: [{ id: "attendees", desc: false }],
    });
    const { rerender } = await setup(options());
    compare.mockClear();
    await rerender(options());
    expect(compare).toHaveBeenCalled();
  });
```

The second test pins the trade-off of the ref: the ids follow `data`, not the function identity. The fourth documents the `columns` ruling in "Spec corrections" above: it passes before and after the fix.

- [ ] **Step 17: Run and see the first fail.** `npx vitest run src/components/data-table/use-data-table.test.tsx -t "getRowId|new columns"`. Expected: `"an inline getRowId does not re-sort on a re-render"` fails (`compare` is called again: `entries` depends on the `getRowId` identity, so every render rebuilds the entries and re-sorts). The second test also fails (`rows[0].id` is `"b-e1"` after the same-data rerender). The third and fourth pass.

- [ ] **Step 18: Fix.** In `src/components/data-table/use-data-table.ts`, replace

```ts
  const entries = useMemo(
    () =>
      data.map(
        (original, index): Entry<TData> => ({
          id: getRowId ? getRowId(original, index) : String(index),
          original,
          index,
        }),
      ),
    [data, getRowId],
  );
```

with

```ts
  // The latest getRowId, read through a ref: an inline function is a new identity on every render
  // and must not rebuild the entries (and with them the sorted rows). Only `data`, or getRowId
  // appearing or disappearing, recomputes the ids.
  const getRowIdRef = useRef(getRowId);
  getRowIdRef.current = getRowId;
  const hasRowId = getRowId !== undefined;
  const entries = useMemo(() => {
    const rowId = hasRowId ? getRowIdRef.current : undefined;
    return data.map(
      (original, index): Entry<TData> => ({
        id: rowId ? rowId(original, index) : String(index),
        original,
        index,
      }),
    );
  }, [data, hasRowId]);
```

Also extend the `getRowId` option's JSDoc in `UseDataTableOptions` with one sentence: `The latest function is used whenever \`data\` changes; a new function identity alone does not recompute the ids.`

- [ ] **Step 19: Run both suites, expect pass.** `npx vitest run src/components/data-table src/lib/data-table.test.ts`. The warning effect still depends on `getRowId` (unchanged).

- [ ] **Step 20: Commit.**

```
git add src/components/data-table/use-data-table.ts src/components/data-table/use-data-table.test.tsx
git commit -m "fix(data-table): getRowId is held in a ref so inline functions do not re-sort

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

#### Row #19: `formatFileSize` rounds first, then picks the unit

- [ ] **Step 21: Write the failing test.** In `src/lib/file.test.ts`, inside `describe("formatFileSize", …)`, after the `it.each` table, add:

```ts
  it.each([
    // [bytes, value, unit]: the value is what Intl shows after rounding to one decimal.
    [999_949, 999.9, "kilobyte"],
    [999_950, 1, "megabyte"],
    [999_999, 1, "megabyte"],
    [1_000_000, 1, "megabyte"],
    [999_949_999, 999.9, "megabyte"],
    [999_950_000, 1, "gigabyte"],
    [999_999_999, 1, "gigabyte"],
    [1_000_000_000, 1, "gigabyte"],
    // Fractional sizes carry too.
    [999.96, 1, "kilobyte"],
    // GB is the largest unit: nothing to carry into.
    [999_999_999_999, 1000, "gigabyte"],
  ])("%d bytes rounds first, then picks the unit: Intl's %d %s", (bytes, value, unit) => {
    expect(formatFileSize(bytes, "en-US")).toBe(intl(value, unit, "en-US"));
  });

  it("never prints 1,000 of a unit that has a larger one", () => {
    for (const bytes of [999_950, 999_999, 999_950_000, 999_999_999, 999.96]) {
      expect(formatFileSize(bytes, "en-US")).not.toMatch(/1,000/);
    }
  });

  it("a size that is not a number stays in bytes", () => {
    expect(formatFileSize(Number.NaN, "en-US")).toBe(intl(Number.NaN, "byte", "en-US"));
  });
```

- [ ] **Step 22: Run and see failures.** `npx vitest run src/lib/file.test.ts -t formatFileSize`. Expected: `999950`, `999999`, `999950000`, `999999999`, `999.96` fail (they print `1,000 kB` / `1,000 MB` / `1,000 byte`); the `NaN` test and the rest pass.

- [ ] **Step 23: Fix.** In `src/lib/file.ts` replace

```ts
const sizeUnits = [
  ["gigabyte", 1e9],
  ["megabyte", 1e6],
  ["kilobyte", 1e3],
] as const;

/**
 * A file size in SI units (1 kB = 1000 B) with `Intl`'s unit names, in the largest unit whose value
 * is at least 1, to one decimal: 1536 → "1.5 kB", 999 → "999 byte" (as `Intl` prints it).
 */
export function formatFileSize(bytes: number, locale?: string): string {
  const [unit, divisor] = sizeUnits.find(([, size]) => bytes >= size) ?? ["byte", 1];
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(bytes / divisor);
}
```

with

```ts
const sizeUnits = [
  ["byte", 1],
  ["kilobyte", 1e3],
  ["megabyte", 1e6],
  ["gigabyte", 1e9],
] as const;

/** The rounding `formatFileSize` shows (one decimal), as a number; the rule is the same in every locale. */
const sizeRounding = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  useGrouping: false,
});

/**
 * A file size in SI units (1 kB = 1000 B) with `Intl`'s unit names, in the largest unit whose value
 * is at least 1, to one decimal: 1536 → "1.5 kB", 999 → "999 byte" (as `Intl` prints it). The
 * value is rounded first: 999 950 B is "1 MB", not "1,000 kB". GB is the largest unit, so a
 * terabyte prints as "1,000 GB".
 */
export function formatFileSize(bytes: number, locale?: string): string {
  let picked: (typeof sizeUnits)[number] = sizeUnits[0];
  for (const candidate of sizeUnits) {
    if (!(bytes >= candidate[1])) break;
    picked = candidate;
  }
  const next = sizeUnits[sizeUnits.indexOf(picked) + 1];
  if (next !== undefined && Number(sizeRounding.format(bytes / picked[1])) >= 1000) picked = next;
  const [unit, divisor] = picked;
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(bytes / divisor);
}
```

- [ ] **Step 24: Run, expect pass.** `npx vitest run src/lib/file.test.ts src/components/file-upload` (FileUpload prints sizes through this helper; its suite must stay green).

- [ ] **Step 25: Commit.**

```
git add src/lib/file.ts src/lib/file.test.ts
git commit -m "fix(file): formatFileSize rounds first, then picks the unit

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 26: Gate.** `npm run format && npm run check`. Green before Task 4. Update `docs/backlog.md` only if a spec row names it (none here).

**Review focus:**
- A no-op edit that only differs by case or spacing (`#1D4ED8` over `#1d4ed8`, hsl restored after a detour): Step 1 pins both arms of the early return and that a real change still commits.
- A sorted column hidden while it is the only sort, a multi-sort, a controlled `sorting`, or on page 2: Step 6 pins each (sorting `[]`, one entry left, only a report, page reset to 0).
- `sortable: true` with no accessor on a client table versus a `manual` table, and an inline `getRowId` whose identity changes every render: Step 11 pins the first (`canSort` and `toggleSort` agree with `sortRows` outside `manual`), Step 16 the second plus the "ids follow `data`" trade-off.
- Size boundaries 999 949 / 999 950 / 999 999 and the 1e9 edge, a fractional 999.96 B, and `NaN`: Step 21.

---


### Task 4: Sidebar, Dialog and display components

Spec L1 rows #6, #12, #15, #16, #17, #18. Six independent commits, one per row, each test-first.

**Spec correction (#12).** `dialogHeaderClasses` in `dialog-variants.ts:46` is shared by `AlertDialog` (`alert-dialog.tsx:14,93`), which has no Close button and whose test pins the exact class string (`alert-dialog.test.tsx:172`). Adding `pe-8` to the shared constant would shrink every AlertDialog header for nothing. The fix therefore adds a Dialog-only constant, `dialogHeaderWithCloseClasses`, in the same file and leaves `dialogHeaderClasses` untouched. Numbers: the Close wrapper sits at `end-4` with `size-8`, so it covers 16-48px from the inline end; the popup padding is 24px, so the header needs at least 24px extra (`pe-6` touches exactly); `pe-8` leaves an 8px gap. (Drawer's `pe-12` is for its `p-4` header.) The header cannot know whether `showCloseButton` is on, so the padding is unconditional; that is the same trade-off Drawer makes.

**Spec correction (#17).** Confirmed by running the helper: `getPaginationRange({ page: NaN, pageCount: 20 })` returns `[1, 20]`, `pageCount: NaN` returns `[1]`, `pageCount: Infinity` returns an unbounded list ending without a last page, and `page: 5.5` / `pageCount: 20.5` / `siblings: 1.5` return fractional page numbers (`[1,"ellipsis-start",4.5,5.5,6.5,"ellipsis-end",20]`). The ruling implemented here: non-finite `pageCount` means no pages (`[]`); a non-finite `page` means page 1; non-finite `siblings`/`boundaries` fall back to their defaults; everything is floored; negative `siblings`/`boundaries` clamp to 0.

**Spec correction (#15).** `Children.toArray` drops `null`, `undefined` and booleans only. A `<></>` fragment or an empty string child still counts as a child, so it still renders the header. That is the rule the spec states and is kept.

**Risk flagged by plan review (#16), verify before keeping `h-full`.** In a flex row whose height is auto, `h-full` (a percentage of an indefinite height) may stop `self-stretch` from stretching the separator, which would collapse it to 0 in toolbars, including the repo's own `InAToolbar` story. Step 1 therefore adds a second test, a flex row with no fixed height containing a 32px Button and a vertical Separator, asserting the separator's height equals the row's height. If that test fails with `h-full`, do NOT ship `h-full`: instead leave the class list unchanged, document in the Separator JSDoc that a vertical separator in a block parent needs an explicit `h-*`, and record the deviation from the spec (row #16) in the report as `deferred: documented`.

**Spec correction (#16).** `h-full` is added to the vertical branch alongside `self-stretch`. `cn` (tailwind-merge) lets a caller's `h-4` or `h-6` replace `h-full`, so explicit heights keep working.

**Files:**
- Modify: `src/components/sidebar/sidebar-context.tsx:1-14` (imports), `:90-108` (`SidebarInternalValue`, `useSidebar`), `:171-189` (provider id and registry state), `:207-225` (shortcut handler), `:227-247` (memo value)
- Modify: `src/components/sidebar/sidebar.tsx:3-11` (imports), `:63-95` (`Sidebar` head), `:104-175` (the three `id={sidebarId}` sites)
- Test: `src/components/sidebar/sidebar.test.tsx`
- Modify: `src/components/dialog/dialog-variants.ts:46`, `src/components/dialog/dialog.tsx:16,117`
- Test: `src/components/dialog/dialog.test.tsx` (new geometry test; line 270 and the `afterEach` at ~65)
- Modify: `src/components/meter/meter.tsx:3,58`, `src/components/progress/progress.tsx:3,48`
- Test: `src/components/meter/meter.test.tsx`, `src/components/progress/progress.test.tsx`
- Modify: `src/components/separator/separator.tsx:26`
- Test: `src/components/separator/separator.test.tsx`
- Modify: `src/components/pagination/pagination.tsx:69-107`, `src/components/pagination/pagination-range.ts:23-39`
- Test: `src/components/pagination/pagination.test.tsx`, `src/components/pagination/pagination-range.test.ts`
- Modify: `src/components/otp-field/otp-field.tsx:68-82` (`fitGroups`)
- Modify: `src/components/rating/rating.tsx:178`
- Test: `src/components/otp-field/otp-field.test.tsx`, `src/components/rating/rating.test.tsx`

**Interfaces:**
- Consumes: `useId` from React; the sidebar test helpers (`aside`, `trigger`, `Shell`, `pressShortcut`, `setupSidebarTests`) from `sidebar.test-fixtures.tsx`; `Children` from React; `cn` from `src/lib/cn.ts`.
- Produces (internal only, no public API change): `SidebarInternalValue.registerSidebar(entry: { id: string; fixed: boolean }) => () => void` replaces `registerSidebar(fixed)` and `setSidebarId` is removed; `sidebarId` becomes `string | undefined`. `dialogHeaderWithCloseClasses` exported from `dialog-variants.ts` (server-safe constant). `getPaginationRange` keeps its signature and return type.

---

#### 4.1 Sidebar ids and the repeating shortcut (#6)

- [ ] **Write the failing tests.** Append to `src/components/sidebar/sidebar.test.tsx` (it already imports `Sidebar`, `SidebarInset`, `SidebarProvider`, `SidebarTrigger`, `vi`, `page`, `userEvent`, `render` and the fixtures `aside`, `trigger`, `pressShortcut`, `Shell`). Add the helper and two `describe` blocks at the end of the file:

```tsx
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

describe("sidebar ids", () => {
  const byLabel = (label: string) =>
    document.querySelector<HTMLElement>(`aside[aria-label=${label}]`) as HTMLElement;

  it("gives every Sidebar its own id and points the trigger at the first collapsible one", async () => {
    await render(
      <SidebarProvider>
        <Sidebar collapsible="none" aria-label="Fixed">
          <p>fixed</p>
        </Sidebar>
        <Sidebar side="right" aria-label="Panel">
          <p>panel</p>
        </Sidebar>
        <SidebarInset>
          <SidebarTrigger />
        </SidebarInset>
      </SidebarProvider>,
    );
    const fixed = byLabel("Fixed");
    const panel = byLabel("Panel");
    expect(fixed.id).toBeTruthy();
    expect(panel.id).toBeTruthy();
    expect(fixed.id).not.toBe(panel.id);
    await expect.poll(() => trigger().element().getAttribute("aria-controls")).toBe(panel.id);
  });

  it("an explicit id on the collapsible Sidebar is honoured by the trigger", async () => {
    await render(
      <SidebarProvider>
        <Sidebar collapsible="none" aria-label="Fixed">
          <p>fixed</p>
        </Sidebar>
        <Sidebar id="nav-panel" side="right" aria-label="Panel">
          <p>panel</p>
        </Sidebar>
        <SidebarInset>
          <SidebarTrigger />
        </SidebarInset>
      </SidebarProvider>,
    );
    expect(byLabel("Panel").id).toBe("nav-panel");
    await expect.poll(() => trigger().element().getAttribute("aria-controls")).toBe("nav-panel");
  });

  it("with only static Sidebars the trigger points at the first one", async () => {
    await render(
      <SidebarProvider>
        <Sidebar collapsible="none" aria-label="One">
          <p>one</p>
        </Sidebar>
        <Sidebar collapsible="none" aria-label="Two">
          <p>two</p>
        </Sidebar>
        <SidebarInset>
          <SidebarTrigger />
        </SidebarInset>
      </SidebarProvider>,
    );
    expect(byLabel("One").id).not.toBe(byLabel("Two").id);
    await expect.poll(() => trigger().element().getAttribute("aria-controls")).toBe(byLabel("One").id);
  });
});

describe("keyboard shortcut auto-repeat", () => {
  it("toggles once per press: a held key's repeated keydown events are ignored", async () => {
    const onOpenChange = vi.fn();
    await render(<Shell provider={{ onOpenChange }} />);
    const keydown = (repeat: boolean) =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          ctrlKey: true,
          repeat,
          bubbles: true,
          cancelable: true,
        }),
      );
    keydown(false);
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("collapsed");
    keydown(true);
    await nextFrame();
    keydown(true);
    await nextFrame();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(aside()?.getAttribute("data-state")).toBe("collapsed");
    keydown(false);
    await expect.poll(() => aside()?.getAttribute("data-state")).toBe("expanded");
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Run them, expect FAIL.** `npx vitest run src/components/sidebar/sidebar.test.tsx -t "sidebar ids|auto-repeat"`. "own id" fails with `expected '«r1»' not to be '«r1»'` (both asides share the provider's one id); "only static" fails the same way; the repeat test fails at `toHaveBeenCalledTimes(1)` with `expected 3`. The explicit-id test already passes (it pins behaviour that must survive).

- [ ] **Minimal fix, part 1: the provider (`src/components/sidebar/sidebar-context.tsx`).**

  Imports (lines 3-14): drop `useId`.
```tsx
// old
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
// new
  useContext,
  useEffect,
  useLayoutEffect,
```
  `SidebarInternalValue` (lines ~90-108):
```tsx
// old
interface SidebarInternalValue {
  /** The id the trigger's `aria-controls` points at: the aside, or the open mobile Drawer. */
  sidebarId: string;
  setSidebarId: (id: string | undefined) => void;
  /**
   * Every mounted Sidebar is `collapsible="none"` (and there is at least one): there is nothing to
   * toggle. With any collapsible Sidebar mounted it is `false`.
   */
  isStatic: boolean;
  /** A Sidebar registers itself while mounted (`fixed`: it is `collapsible="none"`); returns the unregister. */
  registerSidebar: (fixed: boolean) => () => void;
// new
interface SidebarInternalValue {
  /**
   * The id the trigger's `aria-controls` points at: the first collapsible Sidebar's (in
   * registration order), else the first Sidebar's; `undefined` while none is mounted.
   */
  sidebarId: string | undefined;
  /**
   * Every mounted Sidebar is `collapsible="none"` (and there is at least one): there is nothing to
   * toggle. With any collapsible Sidebar mounted it is `false`.
   */
  isStatic: boolean;
  /** A Sidebar registers its `id` while mounted (`fixed`: it is `collapsible="none"`); returns the unregister. */
  registerSidebar: (entry: { id: string; fixed: boolean }) => () => void;
```
  `useSidebar` (destructure): remove the `setSidebarId: _setId,` line.

  Provider state (replace the `generatedId` … `registerSidebar` block, lines ~171-189):
```tsx
// old
  const generatedId = useId();
  const [customId, setSidebarId] = useState<string | undefined>(undefined);
  const sidebarId = customId ?? generatedId;
  // The mounted Sidebars, counted: a static one must not hide a collapsible one, or the reverse.
  const [sidebars, setSidebars] = useState({ total: 0, fixed: 0 });
  const isStatic = sidebars.total > 0 && sidebars.fixed === sidebars.total;
  const registerSidebar = useCallback((fixed: boolean) => {
    const step = fixed ? 1 : 0;
    setSidebars((current) => ({ total: current.total + 1, fixed: current.fixed + step }));
    return () =>
      setSidebars((current) => ({ total: current.total - 1, fixed: current.fixed - step }));
  }, []);
// new
  // The mounted Sidebars in registration order: a static one must not hide a collapsible one, or
  // the reverse, and each keeps its own id.
  const [sidebars, setSidebars] = useState<{ id: string; fixed: boolean }[]>([]);
  const isStatic = sidebars.length > 0 && sidebars.every((sidebar) => sidebar.fixed);
  const sidebarId = (sidebars.find((sidebar) => !sidebar.fixed) ?? sidebars[0])?.id;
  const registerSidebar = useCallback((entry: { id: string; fixed: boolean }) => {
    const registered = { ...entry };
    setSidebars((current) => [...current, registered]);
    return () => setSidebars((current) => current.filter((sidebar) => sidebar !== registered));
  }, []);
```
  Shortcut handler: ignore repeats.
```tsx
// old
      if (event.altKey || event.shiftKey || event.defaultPrevented) return;
// new
      if (event.altKey || event.shiftKey || event.defaultPrevented) return;
      // A held key repeats keydown; one press toggles once.
      if (event.repeat) return;
```
  The `useMemo` value object: remove the `setSidebarId,` line (it is not in the dependency array).

- [ ] **Minimal fix, part 2: the Sidebar (`src/components/sidebar/sidebar.tsx`).**

  Imports: replace the react import list with
```tsx
import {
  type ComponentProps,
  type MouseEvent,
  type ReactElement,
  type Ref,
  useContext,
  useId,
  useLayoutEffect,
  useState,
} from "react";
```
  (`useEffect` is no longer used in this file.) Head of `Sidebar`:
```tsx
// old
  collapsible = sidebarDefaults.collapsible,
  id,
  className,
...
  const {
    state,
    isMobile,
    openMobile,
    setOpenMobile,
    sidebarId,
    setSidebarId,
    registerSidebar,
    rtl,
  } = useSidebarInternal();
  const [railHost, setRailHost] = useState<HTMLDivElement | null>(null);
  const edge = physicalSide(side, rtl);

  useEffect(() => {
    setSidebarId(id);
    return () => setSidebarId(undefined);
  }, [id, setSidebarId]);

  // A layout effect: the provider's `isStatic` (and so `state` and the trigger's `aria-expanded`)
  // is settled before the first paint, not one frame later.
  useLayoutEffect(() => registerSidebar(collapsible === "none"), [collapsible, registerSidebar]);
// new
  collapsible = sidebarDefaults.collapsible,
  id: idProp,
  className,
...
  const { state, isMobile, openMobile, setOpenMobile, registerSidebar, rtl } =
    useSidebarInternal();
  const [railHost, setRailHost] = useState<HTMLDivElement | null>(null);
  const edge = physicalSide(side, rtl);
  // Every instance owns its id (two Sidebars never share one); the trigger points at the first
  // collapsible one through the provider's registry.
  const generatedId = useId();
  const id = idProp ?? generatedId;

  // A layout effect: the provider's `isStatic` (and so `state` and the trigger's `aria-expanded`)
  // is settled before the first paint, not one frame later.
  useLayoutEffect(
    () => registerSidebar({ id, fixed: collapsible === "none" }),
    [collapsible, id, registerSidebar],
  );
```
  Then replace the three `id={sidebarId}` uses (static `<aside>`, `<DrawerContent>`, desktop `<aside>`) with `id={id}`.

- [ ] **Run them, expect PASS.** `npx vitest run src/components/sidebar` (both sidebar test files plus the stories test; the existing "static state is per Sidebar" and mobile `aria-controls` cases must stay green).

- [ ] **Commit.**
```
git add src/components/sidebar/sidebar.tsx src/components/sidebar/sidebar-context.tsx src/components/sidebar/sidebar.test.tsx
git commit -m "fix(sidebar): unique id per Sidebar and ignore auto-repeat on the shortcut" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

#### 4.2 Dialog header clears the Close button (#12)

- [ ] **Write the failing test.** In `src/components/dialog/dialog.test.tsx`, extend the existing `afterEach` (line ~65) so a `dir` set by a test never leaks:
```tsx
// old
afterEach(() => {
  document.documentElement.classList.remove("dark");
});
// new
afterEach(() => {
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("dir");
});
```
  Then, inside `describe("Dialog", …)` after the "sets data-slots and part classes" test, add (the popup is portalled, so the direction comes from the document):
```tsx
  it.each(["ltr", "rtl"] as const)(
    "%s: the header's title and description stay clear of the Close button",
    async (dir) => {
      document.documentElement.dir = dir;
      await render(
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>Edit profile</DialogTrigger>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>A rather long title that wraps onto several lines in a small dialog</DialogTitle>
              <DialogDescription>Update your display name and the other profile fields.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );
      const popup = await openByClick();
      const close = (
        popup.querySelector("[data-slot=dialog-close-button]") as HTMLElement
      ).getBoundingClientRect();
      for (const slot of ["dialog-title", "dialog-description"]) {
        const rect = (popup.querySelector(`[data-slot=${slot}]`) as HTMLElement).getBoundingClientRect();
        const intersects =
          rect.left < close.right &&
          close.left < rect.right &&
          rect.top < close.bottom &&
          close.top < rect.bottom;
        expect(intersects, `${slot} (${dir})`).toBe(false);
      }
    },
  );
```
  Also change the pinned header class at line 270:
```tsx
// old
    expect(part("dialog-header").className).toBe("flex flex-col gap-1.5");
// new
    expect(part("dialog-header").className).toBe("flex flex-col gap-1.5 pe-8");
```
  (Leave `alert-dialog.test.tsx:172` as is: AlertDialog's header does not change.)

- [ ] **Run it, expect FAIL.** `npx vitest run src/components/dialog/dialog.test.tsx`. The geometry cases fail with `dialog-title (ltr): expected true to be false` (and `rtl`); the class-string test fails with the missing ` pe-8`.

- [ ] **Minimal fix.** In `src/components/dialog/dialog-variants.ts` after line 46:
```ts
// old
export const dialogHeaderClasses = "flex flex-col gap-1.5";
// new
export const dialogHeaderClasses = "flex flex-col gap-1.5";
/**
 * Dialog's own header: `pe-8` clears the Close button (`end-4` + `size-8` covers 1rem-3rem from the
 * inline end, past the popup's 1.5rem padding). AlertDialog has no Close button and keeps
 * `dialogHeaderClasses`.
 */
export const dialogHeaderWithCloseClasses = `${dialogHeaderClasses} pe-8`;
```
  In `src/components/dialog/dialog.tsx`: in the import list on line 16 replace `dialogHeaderClasses,` with `dialogHeaderWithCloseClasses,`, and line 117:
```tsx
// old
    <div {...props} data-slot="dialog-header" className={cn(dialogHeaderClasses, className)} />
// new
    <div
      {...props}
      data-slot="dialog-header"
      className={cn(dialogHeaderWithCloseClasses, className)}
    />
```

- [ ] **Run it, expect PASS.** `npx vitest run src/components/dialog src/components/alert-dialog` (AlertDialog's pinned class string must still pass).

- [ ] **Commit.**
```
git add src/components/dialog/dialog-variants.ts src/components/dialog/dialog.tsx src/components/dialog/dialog.test.tsx
git commit -m "fix(dialog): header reserves end padding for the Close button" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

#### 4.3 Meter and Progress render no empty header (#15)

- [ ] **Write the failing tests.** Append to `src/components/meter/meter.test.tsx` (imports `Meter`, `MeterLabel`, `MeterValue`, `render`; `trackOf` exists):
```tsx
describe("Meter header", () => {
  const headerOf = (meter: Element) => meter.querySelector('[data-slot="meter-header"]');

  it.each([
    ["false", false],
    ["null", null],
    ["an empty array", []],
    ["nulls and booleans", [null, false, undefined]],
  ] as const)("renders no header (or its gap) when children are %s", async (_name, children) => {
    const screen = await render(
      <Meter value={40} aria-label="Disk usage">
        {children}
      </Meter>,
    );
    const meter = screen.getByRole("meter", { name: "Disk usage" }).element();
    expect(headerOf(meter)).toBeNull();
    expect(trackOf(meter).getBoundingClientRect().top).toBe(meter.getBoundingClientRect().top);
  });

  it("still renders the header around real children, also behind a true conditional", async () => {
    const show = true;
    const screen = await render(
      <Meter value={40}>
        {show && <MeterLabel>Disk usage</MeterLabel>}
        {!show && <MeterValue />}
      </Meter>,
    );
    const meter = screen.getByRole("meter", { name: "Disk usage" }).element();
    expect(headerOf(meter)?.textContent).toContain("Disk usage");
  });
});
```
  Append to `src/components/progress/progress.test.tsx` (imports `Progress`, `ProgressLabel`, `ProgressValue`, `render`; `trackOf` exists) the same block with `Progress`/`progressbar`/`progress-header`:
```tsx
describe("Progress header", () => {
  const headerOf = (bar: Element) => bar.querySelector('[data-slot="progress-header"]');

  it.each([
    ["false", false],
    ["null", null],
    ["an empty array", []],
    ["nulls and booleans", [null, false, undefined]],
  ] as const)("renders no header (or its gap) when children are %s", async (_name, children) => {
    const screen = await render(
      <Progress value={40} aria-label="Upload">
        {children}
      </Progress>,
    );
    const bar = screen.getByRole("progressbar", { name: "Upload" }).element();
    expect(headerOf(bar)).toBeNull();
    expect(trackOf(bar).getBoundingClientRect().top).toBe(bar.getBoundingClientRect().top);
  });

  it("still renders the header around real children, also behind a true conditional", async () => {
    const show = true;
    const screen = await render(
      <Progress value={40}>
        {show && <ProgressLabel>Upload</ProgressLabel>}
        {!show && <ProgressValue />}
      </Progress>,
    );
    const bar = screen.getByRole("progressbar", { name: "Upload" }).element();
    expect(headerOf(bar)?.textContent).toContain("Upload");
  });
});
```

- [ ] **Run them, expect FAIL.** `npx vitest run src/components/meter/meter.test.tsx src/components/progress/progress.test.tsx`. The `false`, `an empty array` and `nulls and booleans` rows fail with `expected <div …> to be null` (the `null` row already passes, which is why the audit missed it); the track offset assertion would also read 8px.

- [ ] **Minimal fix.** In `src/components/meter/meter.tsx` add `Children` to a new react import under the Base UI import and change line 58:
```tsx
// add after line 3
import { Children } from "react";
// old
      {children != null && (
// new
      {Children.toArray(children).length > 0 && (
```
  The same two edits in `src/components/progress/progress.tsx` (`import { Children } from "react";` after line 3; line 48 `{children != null && (` becomes `{Children.toArray(children).length > 0 && (`). Keep the import order that Biome expects: `react` before `@base-ui/react/...` is sorted by the repo's `npm run format`, so run `npx biome check --write src/components/meter/meter.tsx src/components/progress/progress.tsx` after the edit.

- [ ] **Run them, expect PASS.** `npx vitest run src/components/meter src/components/progress`.

- [ ] **Commit.**
```
git add src/components/meter/meter.tsx src/components/meter/meter.test.tsx src/components/progress/progress.tsx src/components/progress/progress.test.tsx
git commit -m "fix(meter,progress): render the header only when there are real children" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

#### 4.4 Vertical Separator has height in a block parent (#16)

- [ ] **Write the failing test.** In `src/components/separator/separator.test.tsx`, after the "stretches vertically inside a flex row" test (line 56), add:
```tsx
  it("fills a block parent's height (no flex row to stretch it)", async () => {
    const screen = await render(
      <div style={{ height: 40 }}>
        <Separator data-testid="sep" orientation="vertical" />
      </div>,
    );
    const rect = screen.getByTestId("sep").element().getBoundingClientRect();
    expect(rect.width).toBe(1);
    expect(rect.height).toBe(40);
  });

  it("still stretches in a flex row with no fixed height", async () => {
    const screen = await render(
      <div data-testid="row" style={{ display: "flex", alignItems: "stretch" }}>
        <button type="button" style={{ height: 32 }}>
          A
        </button>
        <Separator data-testid="sep" orientation="vertical" />
      </div>,
    );
    const sep = screen.getByTestId("sep").element().getBoundingClientRect().height;
    const row = screen.getByTestId("row").element().getBoundingClientRect().height;
    expect(sep).toBe(row);
    expect(sep).toBe(32);
  });

  it("lets an explicit height class replace h-full", async () => {
    const screen = await render(
      <div style={{ height: 40 }}>
        <Separator data-testid="sep" orientation="vertical" className="h-4" />
      </div>,
    );
    expect(screen.getByTestId("sep").element().getBoundingClientRect().height).toBe(16);
  });
```

- [ ] **Run it, expect FAIL.** `npx vitest run src/components/separator/separator.test.tsx`. The first new test fails with `expected 0 to be 40`; the `h-4` override test already passes and guards the merge.

- [ ] **Minimal fix.** In `src/components/separator/separator.tsx` line 26:
```tsx
// old
      orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch",
// new
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px self-stretch",
```

- [ ] **Run it, expect PASS.** `npx vitest run src/components/separator/separator.test.tsx` (the parametrised class-list table at lines 25-43 still passes: it checks `w-px` and `self-stretch` only).

- [ ] **Commit.**
```
git add src/components/separator/separator.tsx src/components/separator/separator.test.tsx
git commit -m "fix(separator): vertical separator fills its parent's height" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

#### 4.5 Pagination: handler-only links and range inputs (#17)

Two sub-fixes, one row, one commit.

- [ ] **Write the failing range tests.** Append to `src/components/pagination/pagination-range.test.ts` (imports `describe`, `expect`, `it`, `getPaginationRange` already there):
```ts
describe("getPaginationRange input guards", () => {
  const standard = [1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 20];

  it.each([
    ["NaN page", { page: Number.NaN, pageCount: 20 }, [1, 2, "ellipsis-end", 20]],
    ["fractional page", { page: 5.5, pageCount: 20 }, standard],
    ["fractional pageCount", { page: 5, pageCount: 20.5 }, standard],
    ["fractional siblings", { page: 5, pageCount: 20, siblings: 1.5 }, standard],
    ["NaN siblings", { page: 5, pageCount: 20, siblings: Number.NaN }, standard],
    ["NaN boundaries", { page: 5, pageCount: 20, boundaries: Number.NaN }, standard],
    [
      "negative siblings (treated as 0)",
      { page: 5, pageCount: 20, siblings: -1 },
      [1, "ellipsis-start", 5, "ellipsis-end", 20],
    ],
  ] as const)("%s", (_name, options, expected) => {
    expect(getPaginationRange(options)).toEqual(expected);
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["a fraction below 1", 0.5],
  ])("pageCount %s yields no pages", (_name, pageCount) => {
    expect(getPaginationRange({ page: 1, pageCount })).toEqual([]);
  });
});
```

- [ ] **Write the failing link tests.** Append to `src/components/pagination/pagination.test.tsx` (imports `vi`, `userEvent`, `render`, `Pagination*` already there):
```tsx
describe("PaginationLink without an href", () => {
  function Single(props: Partial<React.ComponentProps<typeof PaginationLink>>) {
    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink {...props}>3</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  }

  it("is a focusable button: Tab reaches it; Enter, Space and click each fire onClick once", async () => {
    const onClick = vi.fn();
    const screen = await render(<Single onClick={onClick} />);
    const button = screen.getByRole("button", { name: "3" });
    await expect.element(button).toHaveAttribute("tabindex", "0");
    await userEvent.tab();
    expect(document.activeElement).toBe(button.element());
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("keeps a caller's onKeyDown and lets it cancel the activation", async () => {
    const onClick = vi.fn();
    const screen = await render(
      <Single
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
      />,
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
    await expect.element(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });

  it("stays a plain link with an href, and stays inert when disabled or rendered", async () => {
    const withHref = await render(<Single href="#3" />);
    const link = withHref.getByRole("link", { name: "3" }).element();
    expect(link.hasAttribute("role")).toBe(false);
    expect(link.hasAttribute("tabindex")).toBe(false);
    await withHref.unmount();

    const disabled = await render(<Single disabled />);
    const dead = disabled.container.querySelector('[data-slot="pagination-link"]') as HTMLElement;
    expect(dead.hasAttribute("role")).toBe(false);
    expect(dead.hasAttribute("tabindex")).toBe(false);
    await disabled.unmount();

    const rendered = await render(<Single render={<button type="button" />} />);
    const native = rendered.getByRole("button", { name: "3" }).element();
    expect(native.tagName).toBe("BUTTON");
    expect(native.hasAttribute("role")).toBe(false);
  });
});
```
  (If `React` is not in scope as a namespace in this test file, import the type: `import type { ComponentProps } from "react";` and use `Partial<ComponentProps<typeof PaginationLink>>`.)

- [ ] **Run them, expect FAIL.** `npx vitest run src/components/pagination`. Range rows fail, for example `NaN page: expected [ 1, 20 ] to deeply equal [ 1, 2, 'ellipsis-end', 20 ]` and `fractional page: expected [ 1, 'ellipsis-start', 4.5, 5.5, 6.5, … ]`, `pageCount NaN: expected [ 1 ] to deeply equal []`. The link test fails at `getByRole("button", { name: "3" })` (an `<a>` without `href` has no role).

- [ ] **Minimal fix, part 1: the range (`src/components/pagination/pagination-range.ts`).** Replace the function head (lines 23-39) with:
```ts
/** A finite number floored to a whole number, else `fallback`. */
function toWhole(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.floor(value) : fallback;
}

/**
 * Pure: the list of page numbers and ellipsis markers for a pager, e.g.
 * `1 … 4 5 [6] 7 8 … 20`. Never shows an ellipsis over a single hidden page — the page itself
 * takes its place instead, since collapsing one page saves no space.
 *
 * Inputs are normalised to whole numbers: a non-finite `pageCount` means no pages, a non-finite
 * `page` means page 1, non-finite `siblings` / `boundaries` take their defaults, fractions are
 * floored and negatives clamp to 0.
 */
export function getPaginationRange(options: PaginationRangeOptions): PaginationRangeItem[] {
  const pageCount = toWhole(options.pageCount, 0);
  const siblings = Math.max(0, toWhole(options.siblings ?? 1, 1));
  const boundaries = Math.max(0, toWhole(options.boundaries ?? 1, 1));
  if (pageCount <= 0) return [];

  // Every page fits without a gap: boundaries on both ends + siblings on both ends + the
  // current page + the two ellipsis slots they'd otherwise occupy.
  const totalVisible = boundaries * 2 + siblings * 2 + 3;
  if (pageCount <= totalVisible) return range(1, pageCount);

  const current = Math.min(Math.max(toWhole(options.page, 1), 1), pageCount);
```
  The rest of the function (from `const leftSibling = …`) is unchanged.

- [ ] **Minimal fix, part 2: the link (`src/components/pagination/pagination.tsx`).** In `PaginationLink`, after the `shared` constant and the `if (render) { … }` block, replace the final `return <a … />` (line 107):
```tsx
// old
  return <a {...shared} data-slot={dataSlot} className={classes} />;
// new
  if (!disabled && href === undefined) {
    // An `<a>` with no `href` is neither focusable nor a link: expose the handler-only link as a
    // button (Enter on keydown, Space on keyup, like a native one).
    const { onKeyDown, onKeyUp } = props;
    return (
      // biome-ignore lint/a11y/useSemanticElements: an anchor-styled control that only has a click handler (client-side paging); `render={<button />}` is the native alternative.
      <a
        role="button"
        tabIndex={0}
        {...shared}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.click();
          } else if (event.key === " ") {
            event.preventDefault();
          }
        }}
        onKeyUp={(event) => {
          onKeyUp?.(event);
          if (event.defaultPrevented) return;
          if (event.key === " ") {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
        data-slot={dataSlot}
        className={classes}
      />
    );
  }
  return <a {...shared} data-slot={dataSlot} className={classes} />;
```
  (`render` was already handled by the earlier return, `disabled` and `href` are in scope.) Update the `disabled` JSDoc neighbour: add one sentence to the `PaginationLinkProps` doc, "With no `href` and no `render`, the link is exposed as a button (`role="button"`, `tabIndex={0}`, Enter and Space activate `onClick`)."

- [ ] **Run them, expect PASS.** `npx vitest run src/components/pagination src/components/data-table` (DataTable's pager uses `render={<button />}` and must be unaffected).

- [ ] **Commit.**
```
git add src/components/pagination/pagination.tsx src/components/pagination/pagination-range.ts src/components/pagination/pagination.test.tsx src/components/pagination/pagination-range.test.ts
git commit -m "fix(pagination): handler-only links are buttons; range guards NaN and fractions" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

#### 4.6 OTPField groups and read-only Rating label (#18)

- [ ] **Write the failing OTP test.** In `src/components/otp-field/otp-field.test.tsx`, after the "does not warn when groups add up to length" test (line ~114), add (`vi`, `render`, `slots`, `roots` are in scope):
```tsx
  it.each([
    ["a single zero group", [0]],
    ["only zero groups", [0, 0]],
    ["only negative groups", [-1, -2]],
    ["NaN groups", [Number.NaN]],
  ] as const)("renders `length` inputs in one group when the groups are %s", async (_name, groups) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const screen = await render(<OTPField length={4} groups={[...groups]} aria-label="Code" />);
      expect(slots(screen.container)).toHaveLength(4);
      expect(
        screen.container.querySelectorAll('[data-slot="otp-field-separator"]'),
      ).toHaveLength(0);
    } finally {
      warn.mockRestore();
    }
  });
```

- [ ] **Write the failing Rating test.** In `src/components/rating/rating.test.tsx`, after the "valueLabel overrides; null reads No rating" test (line ~611), add:
```tsx
  it("a caller's aria-label names the read-only display; without one the value label does", async () => {
    await render(
      <>
        <Rating readOnly value={4} aria-label="Service quality" />
        <Rating readOnly value={3} />
      </>,
    );
    await expect.element(page.getByRole("img", { name: "Service quality" })).toBeInTheDocument();
    await expect.element(page.getByRole("img", { name: "3 out of 5 stars" })).toBeInTheDocument();
  });
```

- [ ] **Run them, expect FAIL.** `npx vitest run src/components/otp-field/otp-field.test.tsx src/components/rating/rating.test.tsx`. The OTP rows fail with `expected 0 to have a length of 4` (`fitGroups` returns `[]`, having written to `fitted[-1]`). The Rating test fails because no `img` named "Service quality" exists (the caller's label was overwritten by "4 out of 5 stars").

- [ ] **Minimal fix.** In `src/components/otp-field/otp-field.tsx` `fitGroups` (lines 68-82):
```tsx
// old
    remaining -= take;
  }
  if (remaining > 0) fitted[fitted.length - 1] = (fitted[fitted.length - 1] ?? 0) + remaining;
  return fitted;
// new
    remaining -= take;
  }
  // Every group was 0, negative or NaN: nothing to attach the leftover slots to.
  if (fitted.length === 0) return [length];
  if (remaining > 0) fitted[fitted.length - 1] = (fitted[fitted.length - 1] ?? 0) + remaining;
  return fitted;
```
  In `src/components/rating/rating.tsx` line 178 (the read-only `<span>`):
```tsx
// old
        aria-label={valueLabel(value, max)}
// new
        aria-label={props["aria-label"] ?? valueLabel(value, max)}
```
  and extend the read-only JSDoc on the `readOnly` prop (line ~47) with: "A caller's `aria-label` replaces the value label as the display's name."

- [ ] **Run them, expect PASS.** `npx vitest run src/components/otp-field src/components/rating`.

- [ ] **Commit.**
```
git add src/components/otp-field/otp-field.tsx src/components/otp-field/otp-field.test.tsx src/components/rating/rating.tsx src/components/rating/rating.test.tsx
git commit -m "fix(otp-field,rating): all-empty groups fall back to one group; read-only Rating honours aria-label" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Task gate.** `npm run format && npm run check` green (Task 1 and Task 4 touch no stories; no Storybook build is needed for these commits unless `npm run check` includes it).

**Review focus:**
- Two Sidebars of mixed kinds (static first, collapsible second): the trigger must point at the collapsible one's id and the ids must differ (4.1, "own id" test); a held Ctrl+B must toggle exactly once (4.1, `onOpenChange` called 1 then 2 times). Known limit: "first collapsible" means first in registration order, so a Sidebar whose `collapsible` or `id` changes re-registers at the end; SSR markup has no trigger `aria-controls` until the layout effect runs after hydration.
- A long wrapping Dialog title in both directions, where the description and title rects must not intersect the Close button's rect, and AlertDialog's header class string is untouched (4.2, the `it.each` geometry test plus `alert-dialog.test.tsx:172` staying green).
- `getPaginationRange` with NaN, Infinity and fractional inputs, and a handler-only `PaginationLink` that is not a link, a render element or disabled (4.5, the guard table and the three-way "stays inert" test); empty `children` shapes (`false`, `[]`, `[null, false]`) on Meter and Progress (4.3, the `it.each` plus the track-offset assertion); `groups` that are all zero, negative or NaN for OTPField (4.6, the four-row `it.each`).

### Task 5: Test-gap backfill and packaging hardening

Spec "Also in L1 (hardening, no behaviour change)". No component code changes in this task. Every backfill test pins existing behaviour, so it must pass on the first run. A test that fails is a new bug: do not fix it here, record it under "Found bugs" at the end of this task (with the test name, the observed value and the expected one) and leave that single `it` as `it.skip` with a `// Found bug: …` comment so the gate stays green.

The cross-component suites live in `test/` (next to `forced-colors-focus.test.tsx`), and import from `../src/components/<name>`.

**Files:**
- Create: `test/display-forwarding.test.tsx`, `test/controlled-mode.test.tsx`, `test/rtl-layout.test.tsx`
- Modify: `scripts/verify-consumer.mjs`, `package.json`, `package-lock.json`, `README.md`

**Interfaces:** none (no exported surface changes). `package.json` gains `"tailwindcss": "^4.0.0"` in `peerDependencies`.

**Out of scope here (other tasks add them):** the RTL tests for Switch, NumberField, Toast, Breadcrumb and Accordion (Task 1) and the geometry tests of Task 4. Do not duplicate them.

---

#### (i) `ref` / `className` / `data-slot` forwarding for the display components

- [ ] **Step 1: Write `test/display-forwarding.test.tsx`.** One table, one test body. Each case renders its component with a callback `ref`, a `className` and a `data-testid`, and expects all three to land on the element that carries the part's `data-slot`.

```tsx
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "../src/components/accordion";
import { Badge } from "../src/components/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "../src/components/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../src/components/card";
import { Carousel, CarouselContent, CarouselItem } from "../src/components/carousel";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../src/components/collapsible";
import { Kbd, KbdGroup, KbdShortcut } from "../src/components/kbd";
import { Meter, MeterLabel, MeterValue } from "../src/components/meter";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "../src/components/pagination";
import { Progress, ProgressLabel, ProgressValue } from "../src/components/progress";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../src/components/resizable";
import { Skeleton } from "../src/components/skeleton";
import { Stepper, StepperItem, StepperTitle } from "../src/components/stepper";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../src/components/table";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "../src/components/toolbar";
import { Tree, TreeItem, TreeItemContent } from "../src/components/tree";

/** What every case spreads onto the part under test. */
interface Forwarded {
  ref: (node: HTMLElement | null) => void;
  className: string;
  "data-testid": string;
}

interface Case {
  name: string;
  /** The element's tag name. */
  tag: string;
  /** The `data-slot` the part sets on that element. */
  slot: string;
  ui: (p: Forwarded) => ReactElement;
}

const cases: Case[] = [
  // Accordion
  {
    name: "Accordion",
    tag: "div",
    slot: "accordion",
    ui: (p) => (
      <Accordion {...p}>
        <AccordionItem value="a">
          <AccordionTrigger>T</AccordionTrigger>
          <AccordionPanel>P</AccordionPanel>
        </AccordionItem>
      </Accordion>
    ),
  },
  {
    name: "AccordionItem",
    tag: "div",
    slot: "accordion-item",
    ui: (p) => (
      <Accordion>
        <AccordionItem value="a" {...p}>
          <AccordionTrigger>T</AccordionTrigger>
          <AccordionPanel>P</AccordionPanel>
        </AccordionItem>
      </Accordion>
    ),
  },
  {
    name: "AccordionTrigger",
    tag: "button",
    slot: "accordion-trigger",
    ui: (p) => (
      <Accordion>
        <AccordionItem value="a">
          <AccordionTrigger {...p}>T</AccordionTrigger>
          <AccordionPanel>P</AccordionPanel>
        </AccordionItem>
      </Accordion>
    ),
  },
  {
    name: "AccordionPanel",
    tag: "div",
    slot: "accordion-panel",
    ui: (p) => (
      <Accordion defaultValue={["a"]}>
        <AccordionItem value="a">
          <AccordionTrigger>T</AccordionTrigger>
          <AccordionPanel {...p}>P</AccordionPanel>
        </AccordionItem>
      </Accordion>
    ),
  },
  // Collapsible
  {
    name: "Collapsible",
    tag: "div",
    slot: "collapsible",
    ui: (p) => (
      <Collapsible {...p}>
        <CollapsibleTrigger>T</CollapsibleTrigger>
        <CollapsiblePanel>P</CollapsiblePanel>
      </Collapsible>
    ),
  },
  {
    name: "CollapsibleTrigger",
    tag: "button",
    slot: "collapsible-trigger",
    ui: (p) => (
      <Collapsible>
        <CollapsibleTrigger {...p}>T</CollapsibleTrigger>
        <CollapsiblePanel>P</CollapsiblePanel>
      </Collapsible>
    ),
  },
  {
    name: "CollapsiblePanel",
    tag: "div",
    slot: "collapsible-panel",
    ui: (p) => (
      <Collapsible defaultOpen>
        <CollapsibleTrigger>T</CollapsibleTrigger>
        <CollapsiblePanel {...p}>P</CollapsiblePanel>
      </Collapsible>
    ),
  },
  // Breadcrumb
  {
    name: "Breadcrumb",
    tag: "nav",
    slot: "breadcrumb",
    ui: (p) => (
      <Breadcrumb {...p}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ),
  },
  {
    name: "BreadcrumbList",
    tag: "ol",
    slot: "breadcrumb-list",
    ui: (p) => (
      <Breadcrumb>
        <BreadcrumbList {...p}>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ),
  },
  {
    name: "BreadcrumbItem",
    tag: "li",
    slot: "breadcrumb-item",
    ui: (p) => (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem {...p}>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ),
  },
  {
    name: "BreadcrumbLink",
    tag: "a",
    slot: "breadcrumb-link",
    ui: (p) => (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/" {...p}>
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ),
  },
  // Pagination
  {
    name: "Pagination",
    tag: "nav",
    slot: "pagination",
    ui: (p) => (
      <Pagination {...p}>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#1">1</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    ),
  },
  {
    name: "PaginationContent",
    tag: "ul",
    slot: "pagination-content",
    ui: (p) => (
      <Pagination>
        <PaginationContent {...p}>
          <PaginationItem>
            <PaginationLink href="#1">1</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    ),
  },
  {
    name: "PaginationItem",
    tag: "li",
    slot: "pagination-item",
    ui: (p) => (
      <Pagination>
        <PaginationContent>
          <PaginationItem {...p}>
            <PaginationLink href="#1">1</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    ),
  },
  {
    name: "PaginationLink",
    tag: "a",
    slot: "pagination-link",
    ui: (p) => (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#1" {...p}>
              1
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    ),
  },
  // Tree
  {
    name: "Tree",
    tag: "ul",
    slot: "tree",
    ui: (p) => (
      <Tree aria-label="Files" {...p}>
        <TreeItem value="a">
          <TreeItemContent>A</TreeItemContent>
        </TreeItem>
      </Tree>
    ),
  },
  {
    name: "TreeItem",
    tag: "li",
    slot: "tree-item",
    ui: (p) => (
      <Tree aria-label="Files">
        <TreeItem value="a" {...p}>
          <TreeItemContent>A</TreeItemContent>
        </TreeItem>
      </Tree>
    ),
  },
  // Carousel
  {
    name: "Carousel",
    tag: "section",
    slot: "carousel",
    ui: (p) => (
      <Carousel aria-label="Photos" {...p}>
        <CarouselContent>
          <CarouselItem>1</CarouselItem>
        </CarouselContent>
      </Carousel>
    ),
  },
  {
    name: "CarouselContent",
    tag: "div",
    slot: "carousel-content",
    ui: (p) => (
      <Carousel aria-label="Photos">
        <CarouselContent {...p}>
          <CarouselItem>1</CarouselItem>
        </CarouselContent>
      </Carousel>
    ),
  },
  {
    name: "CarouselItem",
    tag: "div",
    slot: "carousel-item",
    ui: (p) => (
      <Carousel aria-label="Photos">
        <CarouselContent>
          <CarouselItem {...p}>1</CarouselItem>
        </CarouselContent>
      </Carousel>
    ),
  },
  // Resizable
  {
    name: "ResizablePanelGroup",
    tag: "div",
    slot: "resizable-panel-group",
    ui: (p) => (
      <ResizablePanelGroup {...p}>
        <ResizablePanel>A</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>B</ResizablePanel>
      </ResizablePanelGroup>
    ),
  },
  {
    name: "ResizablePanel",
    tag: "div",
    slot: "resizable-panel",
    ui: (p) => (
      <ResizablePanelGroup>
        <ResizablePanel {...p}>A</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>B</ResizablePanel>
      </ResizablePanelGroup>
    ),
  },
  {
    name: "ResizableHandle",
    tag: "div",
    slot: "resizable-handle",
    ui: (p) => (
      <ResizablePanelGroup>
        <ResizablePanel>A</ResizablePanel>
        <ResizableHandle {...p} />
        <ResizablePanel>B</ResizablePanel>
      </ResizablePanelGroup>
    ),
  },
  // Toolbar
  {
    name: "Toolbar",
    tag: "div",
    slot: "toolbar",
    ui: (p) => (
      <Toolbar aria-label="Format" {...p}>
        <ToolbarButton>B</ToolbarButton>
      </Toolbar>
    ),
  },
  {
    name: "ToolbarGroup",
    tag: "div",
    slot: "toolbar-group",
    ui: (p) => (
      <Toolbar aria-label="Format">
        <ToolbarGroup {...p}>
          <ToolbarButton>B</ToolbarButton>
        </ToolbarGroup>
      </Toolbar>
    ),
  },
  {
    name: "ToolbarButton",
    tag: "button",
    slot: "toolbar-button",
    ui: (p) => (
      <Toolbar aria-label="Format">
        <ToolbarButton {...p}>B</ToolbarButton>
      </Toolbar>
    ),
  },
  {
    name: "ToolbarSeparator",
    tag: "div",
    slot: "toolbar-separator",
    ui: (p) => (
      <Toolbar aria-label="Format">
        <ToolbarButton>B</ToolbarButton>
        <ToolbarSeparator {...p} />
        <ToolbarButton>I</ToolbarButton>
      </Toolbar>
    ),
  },
  // Badge, Card, Kbd, Skeleton
  { name: "Badge", tag: "span", slot: "badge", ui: (p) => <Badge {...p}>New</Badge> },
  { name: "Card", tag: "div", slot: "card", ui: (p) => <Card {...p}>c</Card> },
  {
    name: "CardHeader",
    tag: "div",
    slot: "card-header",
    ui: (p) => (
      <Card>
        <CardHeader {...p}>h</CardHeader>
      </Card>
    ),
  },
  {
    name: "CardTitle",
    tag: "div",
    slot: "card-title",
    ui: (p) => (
      <Card>
        <CardTitle {...p}>t</CardTitle>
      </Card>
    ),
  },
  {
    name: "CardDescription",
    tag: "div",
    slot: "card-description",
    ui: (p) => (
      <Card>
        <CardDescription {...p}>d</CardDescription>
      </Card>
    ),
  },
  {
    name: "CardContent",
    tag: "div",
    slot: "card-content",
    ui: (p) => (
      <Card>
        <CardContent {...p}>c</CardContent>
      </Card>
    ),
  },
  {
    name: "CardFooter",
    tag: "div",
    slot: "card-footer",
    ui: (p) => (
      <Card>
        <CardFooter {...p}>f</CardFooter>
      </Card>
    ),
  },
  { name: "Kbd", tag: "kbd", slot: "kbd", ui: (p) => <Kbd {...p}>K</Kbd> },
  {
    name: "KbdGroup",
    tag: "kbd",
    slot: "kbd-group",
    ui: (p) => (
      <KbdGroup {...p}>
        <Kbd>A</Kbd>
        <Kbd>B</Kbd>
      </KbdGroup>
    ),
  },
  {
    name: "KbdShortcut",
    tag: "kbd",
    slot: "kbd-shortcut",
    ui: (p) => <KbdShortcut shortcut="mod+k" {...p} />,
  },
  { name: "Skeleton", tag: "div", slot: "skeleton", ui: (p) => <Skeleton {...p} /> },
  // Meter and Progress
  {
    name: "Meter",
    tag: "div",
    slot: "meter",
    ui: (p) => <Meter value={40} aria-label="Disk" {...p} />,
  },
  {
    name: "MeterLabel",
    tag: "span",
    slot: "meter-label",
    ui: (p) => (
      <Meter value={40}>
        <MeterLabel {...p}>Disk</MeterLabel>
      </Meter>
    ),
  },
  {
    name: "MeterValue",
    tag: "span",
    slot: "meter-value",
    ui: (p) => (
      <Meter value={40} aria-label="Disk">
        <MeterValue {...p} />
      </Meter>
    ),
  },
  {
    name: "Progress",
    tag: "div",
    slot: "progress",
    ui: (p) => <Progress value={40} aria-label="Upload" {...p} />,
  },
  {
    name: "ProgressLabel",
    tag: "span",
    slot: "progress-label",
    ui: (p) => (
      <Progress value={40}>
        <ProgressLabel {...p}>Upload</ProgressLabel>
      </Progress>
    ),
  },
  {
    name: "ProgressValue",
    tag: "span",
    slot: "progress-value",
    ui: (p) => (
      <Progress value={40} aria-label="Upload">
        <ProgressValue {...p} />
      </Progress>
    ),
  },
  // Stepper
  {
    name: "Stepper",
    tag: "ol",
    slot: "stepper",
    ui: (p) => (
      <Stepper {...p}>
        <StepperItem step={0}>
          <StepperTitle>One</StepperTitle>
        </StepperItem>
      </Stepper>
    ),
  },
  {
    name: "StepperItem",
    tag: "li",
    slot: "stepper-item",
    ui: (p) => (
      <Stepper>
        <StepperItem step={0} {...p}>
          <StepperTitle>One</StepperTitle>
        </StepperItem>
      </Stepper>
    ),
  },
  // Table (ref and className go to the <table>, containerClassName to the wrapper)
  {
    name: "Table",
    tag: "table",
    slot: "table",
    ui: (p) => (
      <Table {...p}>
        <TableBody>
          <TableRow>
            <TableCell>c</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    ),
  },
  {
    name: "TableCaption",
    tag: "caption",
    slot: "table-caption",
    ui: (p) => (
      <Table>
        <TableCaption {...p}>cap</TableCaption>
        <TableBody>
          <TableRow>
            <TableCell>c</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    ),
  },
  {
    name: "TableHeader",
    tag: "thead",
    slot: "table-header",
    ui: (p) => (
      <Table>
        <TableHeader {...p}>
          <TableRow>
            <TableHead>h</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    ),
  },
  {
    name: "TableHead",
    tag: "th",
    slot: "table-head",
    ui: (p) => (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead {...p}>h</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    ),
  },
  {
    name: "TableBody",
    tag: "tbody",
    slot: "table-body",
    ui: (p) => (
      <Table>
        <TableBody {...p}>
          <TableRow>
            <TableCell>c</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    ),
  },
  {
    name: "TableRow",
    tag: "tr",
    slot: "table-row",
    ui: (p) => (
      <Table>
        <TableBody>
          <TableRow {...p}>
            <TableCell>c</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    ),
  },
  {
    name: "TableCell",
    tag: "td",
    slot: "table-cell",
    ui: (p) => (
      <Table>
        <TableBody>
          <TableRow>
            <TableCell {...p}>c</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    ),
  },
  {
    name: "TableFooter",
    tag: "tfoot",
    slot: "table-footer",
    ui: (p) => (
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>c</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter {...p}>
          <TableRow>
            <TableCell>f</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    ),
  },
];

describe("display components forward ref, className and props", () => {
  it.each(cases)("$name: ref, className and data-testid reach the <$tag> with data-slot $slot", async ({
    ui,
    tag,
    slot,
  }) => {
    let node: HTMLElement | null = null;
    await render(
      ui({
        ref: (instance) => {
          if (instance) node = instance;
        },
        className: "fwd-class",
        "data-testid": "fwd",
      }),
    );
    const element = document.querySelector<HTMLElement>('[data-testid="fwd"]');
    expect(element).not.toBeNull();
    expect(node).toBe(element);
    expect(element?.tagName.toLowerCase()).toBe(tag);
    expect(element?.dataset.slot).toBe(slot);
    expect(element?.classList.contains("fwd-class")).toBe(true);
  });

  it("every case names a distinct part", () => {
    const keys = cases.map((entry) => entry.name);
    expect(new Set(keys).size).toBe(keys.length);
    expect(cases.length).toBeGreaterThanOrEqual(50);
  });
});
```

- [ ] **Step 2: Run, expect pass.** `npx vitest run test/display-forwarding.test.tsx`. Expected: every case passes (they pin what the source already does: `{...props}` first, then `data-slot`, className through `cn` / `mergeClassName`). A failure is a new bug: note it under "Found bugs" and `it.skip` only that case by filtering it out of `cases` with a `// Found bug: …` comment on the removed entry. Run `npm run format` afterwards: Biome sorts the imports and wraps the long `it.each` title.

- [ ] **Step 3: Commit.**

```
git add test/display-forwarding.test.tsx
git commit -m "test(display): ref, className and data-slot forwarding for the display components

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

#### (ii) Controlled-mode tests for the form controls

- [ ] **Step 4: Write `test/controlled-mode.test.tsx`.** The same three beats for each control: (1) the parent's value is what shows, (2) a user change calls the handler once with the proposed value but the display stays on the parent's value (the parent ignores it), (3) a new parent value updates the display.

```tsx
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "../src/components/autocomplete";
import { Checkbox } from "../src/components/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "../src/components/combobox";
import { Input } from "../src/components/input";
import { NumberField, NumberFieldGroup, NumberFieldInput } from "../src/components/number-field";
import { Radio, RadioGroup } from "../src/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../src/components/select";
import { Slider } from "../src/components/slider";
import { Switch } from "../src/components/switch";
import { Textarea } from "../src/components/textarea";
import { Toggle } from "../src/components/toggle";
import { waitForPopupSettled } from "./overlay";

/** The first argument of the handler's only call (Base UI passes `(value, details)`). */
const firstArgOfOnlyCall = (handler: ReturnType<typeof vi.fn>) => {
  expect(handler).toHaveBeenCalledTimes(1);
  return handler.mock.calls[0]?.[0];
};

describe("controlled mode: the parent owns the value", () => {
  it("Input", async () => {
    const onValueChange = vi.fn();
    const ui = (value: string) => (
      <Input aria-label="Name" value={value} onValueChange={onValueChange} />
    );
    const screen = await render(ui("Ada"));
    const field = screen.getByRole("textbox", { name: "Name" });
    await expect.element(field).toHaveValue("Ada");
    await userEvent.fill(field, "Zed");
    expect(firstArgOfOnlyCall(onValueChange)).toBe("Zed");
    await expect.element(field).toHaveValue("Ada");
    await screen.rerender(ui("Grace"));
    await expect.element(field).toHaveValue("Grace");
  });

  it("Textarea", async () => {
    const onValueChange = vi.fn();
    const ui = (value: string) => (
      <Textarea aria-label="Bio" value={value} onValueChange={onValueChange} />
    );
    const screen = await render(ui("Hello"));
    const field = screen.getByRole("textbox", { name: "Bio" });
    await expect.element(field).toHaveValue("Hello");
    await userEvent.fill(field, "Bye");
    expect(firstArgOfOnlyCall(onValueChange)).toBe("Bye");
    await expect.element(field).toHaveValue("Hello");
    await screen.rerender(ui("Again"));
    await expect.element(field).toHaveValue("Again");
  });

  it("Switch", async () => {
    const onCheckedChange = vi.fn();
    const ui = (checked: boolean) => (
      <Switch aria-label="Wifi" checked={checked} onCheckedChange={onCheckedChange} />
    );
    const screen = await render(ui(false));
    const control = screen.getByRole("switch", { name: "Wifi" });
    await expect.element(control).toHaveAttribute("aria-checked", "false");
    await userEvent.click(control);
    expect(firstArgOfOnlyCall(onCheckedChange)).toBe(true);
    await expect.element(control).toHaveAttribute("aria-checked", "false");
    await screen.rerender(ui(true));
    await expect.element(control).toHaveAttribute("aria-checked", "true");
  });

  it("Checkbox", async () => {
    const onCheckedChange = vi.fn();
    const ui = (checked: boolean) => (
      <Checkbox aria-label="Terms" checked={checked} onCheckedChange={onCheckedChange} />
    );
    const screen = await render(ui(true));
    const control = screen.getByRole("checkbox", { name: "Terms" });
    await expect.element(control).toHaveAttribute("aria-checked", "true");
    await userEvent.click(control);
    expect(firstArgOfOnlyCall(onCheckedChange)).toBe(false);
    await expect.element(control).toHaveAttribute("aria-checked", "true");
    await screen.rerender(ui(false));
    await expect.element(control).toHaveAttribute("aria-checked", "false");
  });

  it("Toggle", async () => {
    const onPressedChange = vi.fn();
    const ui = (pressed: boolean) => (
      <Toggle aria-label="Bold" pressed={pressed} onPressedChange={onPressedChange} />
    );
    const screen = await render(ui(false));
    const control = screen.getByRole("button", { name: "Bold" });
    await expect.element(control).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(control);
    expect(firstArgOfOnlyCall(onPressedChange)).toBe(true);
    await expect.element(control).toHaveAttribute("aria-pressed", "false");
    await screen.rerender(ui(true));
    await expect.element(control).toHaveAttribute("aria-pressed", "true");
  });

  it("RadioGroup", async () => {
    const onValueChange = vi.fn();
    const ui = (value: string) => (
      <RadioGroup aria-label="Plan" value={value} onValueChange={onValueChange}>
        <Radio value="free" aria-label="Free" />
        <Radio value="pro" aria-label="Pro" />
      </RadioGroup>
    );
    const screen = await render(ui("free"));
    const free = screen.getByRole("radio", { name: "Free" });
    const pro = screen.getByRole("radio", { name: "Pro" });
    await expect.element(free).toHaveAttribute("aria-checked", "true");
    await userEvent.click(pro);
    expect(firstArgOfOnlyCall(onValueChange)).toBe("pro");
    await expect.element(free).toHaveAttribute("aria-checked", "true");
    await expect.element(pro).toHaveAttribute("aria-checked", "false");
    await screen.rerender(ui("pro"));
    await expect.element(pro).toHaveAttribute("aria-checked", "true");
    await expect.element(free).toHaveAttribute("aria-checked", "false");
  });

  it("NumberField", async () => {
    const onValueChange = vi.fn();
    const ui = (value: number) => (
      <NumberField aria-label="Quantity" value={value} onValueChange={onValueChange} />
    );
    const screen = await render(ui(5));
    const field = screen.getByRole("textbox", { name: "Quantity" });
    await expect.element(field).toHaveValue("5");
    await userEvent.click(screen.getByRole("button", { name: "Increase" }));
    expect(firstArgOfOnlyCall(onValueChange)).toBe(6);
    await expect.element(field).toHaveValue("5");
    await screen.rerender(ui(9));
    await expect.element(field).toHaveValue("9");
  });

  it("NumberField with its parts", async () => {
    const onValueChange = vi.fn();
    const ui = (value: number | null) => (
      <NumberField value={value} onValueChange={onValueChange}>
        <NumberFieldGroup>
          <NumberFieldInput aria-label="Amount" />
        </NumberFieldGroup>
      </NumberField>
    );
    const screen = await render(ui(null));
    const field = screen.getByRole("textbox", { name: "Amount" });
    await expect.element(field).toHaveValue("");
    await userEvent.fill(field, "12");
    await userEvent.keyboard("{Tab}");
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe(12);
    await expect.element(field).toHaveValue("");
    await screen.rerender(ui(7));
    await expect.element(field).toHaveValue("7");
  });

  it("Slider", async () => {
    const onValueChange = vi.fn();
    const ui = (value: number) => (
      <Slider aria-label="Level" value={value} onValueChange={onValueChange} />
    );
    const screen = await render(ui(30));
    const thumb = screen.getByRole("slider", { name: "Level" });
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "30");
    (thumb.element() as HTMLElement).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(firstArgOfOnlyCall(onValueChange)).toBe(31);
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "30");
    await screen.rerender(ui(60));
    await expect.element(thumb).toHaveAttribute("aria-valuenow", "60");
  });

  it("Select", async () => {
    const onValueChange = vi.fn();
    const fruits = { apple: "Apple", banana: "Banana" };
    const ui = (value: string) => (
      <div className="p-16">
        <Select items={fruits} value={value} onValueChange={onValueChange}>
          <SelectTrigger aria-label="Fruit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
    const screen = await render(ui("apple"));
    const trigger = screen.getByRole("combobox", { name: "Fruit" });
    await expect.element(trigger).toHaveTextContent("Apple");
    await userEvent.click(trigger);
    await expect.element(page.getByRole("listbox")).toBeVisible();
    await waitForPopupSettled(document.querySelector("[data-slot=select-content]") as Element);
    await userEvent.click(page.getByRole("option", { name: "Banana", exact: true }));
    expect(firstArgOfOnlyCall(onValueChange)).toBe("banana");
    await expect.element(trigger).toHaveTextContent("Apple");
    await screen.rerender(ui("banana"));
    await expect.element(trigger).toHaveTextContent("Banana");
  });

  it("Combobox", async () => {
    const onValueChange = vi.fn();
    const fruits = ["Apple", "Banana", "Cherry"];
    const ui = (value: string) => (
      <div className="p-16">
        <Combobox items={fruits} value={value} onValueChange={onValueChange}>
          <ComboboxInput aria-label="Fruit" />
          <ComboboxContent>
            <ComboboxEmpty>No fruit found.</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    );
    const screen = await render(ui("Apple"));
    const input = screen.getByRole("combobox", { name: "Fruit" });
    await expect.element(input).toHaveValue("Apple");
    await userEvent.click(input);
    await expect.element(page.getByRole("listbox")).toBeVisible();
    await waitForPopupSettled(document.querySelector("[data-slot=combobox-content]") as Element);
    await userEvent.click(page.getByRole("option", { name: "Banana", exact: true }));
    expect(firstArgOfOnlyCall(onValueChange)).toBe("Banana");
    await expect.element(input).toHaveValue("Apple");
    await screen.rerender(ui("Banana"));
    await expect.element(input).toHaveValue("Banana");
  });

  it("Autocomplete (the value is the input text)", async () => {
    const onValueChange = vi.fn();
    const cities = ["Amsterdam", "Berlin", "Lisbon"];
    const ui = (value: string) => (
      <div className="p-16">
        <Autocomplete items={cities} value={value} onValueChange={onValueChange}>
          <AutocompleteInput aria-label="City" />
          <AutocompleteContent>
            <AutocompleteList>
              {(item: string) => (
                <AutocompleteItem key={item} value={item}>
                  {item}
                </AutocompleteItem>
              )}
            </AutocompleteList>
          </AutocompleteContent>
        </Autocomplete>
      </div>
    );
    const screen = await render(ui("Ber"));
    const input = screen.getByRole("combobox", { name: "City" });
    await expect.element(input).toHaveValue("Ber");
    await userEvent.fill(input, "Lis");
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe("Lis");
    await expect.element(input).toHaveValue("Ber");
    await screen.rerender(ui("Ams"));
    await expect.element(input).toHaveValue("Ams");
  });
});
```

- [ ] **Step 5: Run, expect pass.** `npx vitest run test/controlled-mode.test.tsx`. Expected: all pass. If a Base UI control reports differently than assumed (for example Slider's handler argument, or the Combobox closing before the assertion), read the failing assertion first: adjust the test only when the control behaves correctly and the assumption was wrong (record the learned contract in a one-line comment); if the control shows the proposed value instead of the parent's, that is a controlled-mode bug: "Found bugs".

- [ ] **Step 6: Commit.**

```
git add test/controlled-mode.test.tsx
git commit -m "test(forms): controlled-mode tests for Input, Textarea, Switch, Checkbox, Toggle, RadioGroup, NumberField, Slider, Select, Combobox and Autocomplete

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

#### (iii) RTL tests (Input, Textarea, Checkbox, Field, Collapsible, Badge, Card, Meter, Progress, Skeleton, Avatar)

None of these use a physical direction class today (`rtl:` appears in other components). The tests are geometry guards: in `dir="rtl"` the start of a row is on the right, a bar fills from the right, a text aligns right. They fail the day someone adds `text-left`, `ml-*`, `left-0` or a physical `translate`.

- [ ] **Step 7: Write `test/rtl-layout.test.tsx`.**

```tsx
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { Avatar, AvatarFallback, AvatarGroup } from "../src/components/avatar";
import { Badge } from "../src/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../src/components/card";
import { Checkbox } from "../src/components/checkbox";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../src/components/collapsible";
import { Field, FieldDescription, FieldError, FieldLabel } from "../src/components/field";
import { Input } from "../src/components/input";
import { Meter, MeterLabel, MeterValue } from "../src/components/meter";
import { Progress, ProgressLabel, ProgressValue } from "../src/components/progress";
import { Skeleton } from "../src/components/skeleton";
import { Textarea } from "../src/components/textarea";
import { textRect } from "./overlay";

const dirs = ["ltr", "rtl"] as const;
type Dir = (typeof dirs)[number];

/** A fixed-width frame, so "the start side" is a measurable half. */
function Frame({ dir, children }: { dir: Dir; children: ReactNode }) {
  return (
    <div dir={dir} style={{ width: 400 }}>
      {children}
    </div>
  );
}

const near = (a: number, b: number, tolerance = 1) => Math.abs(a - b) <= tolerance;
const startSide = (dir: Dir) => (dir === "rtl" ? "right" : "left");

/** Which half of `container` the text node `text` sits in. */
function sideOf(container: Element, text: string): "left" | "right" {
  const box = textRect(container, text);
  const frame = container.getBoundingClientRect();
  return box.left + box.width / 2 < frame.left + frame.width / 2 ? "left" : "right";
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector(selector) as T;

describe("RTL: text controls", () => {
  it.each(dirs)("Input follows %s: logical alignment, symmetric padding", async (dir) => {
    const screen = await render(
      <Frame dir={dir}>
        <Input aria-label="Name" defaultValue="Ada" />
      </Frame>,
    );
    const style = getComputedStyle(screen.getByRole("textbox", { name: "Name" }).element());
    expect(style.direction).toBe(dir);
    // `start` follows the direction; a physical `left` is only acceptable in LTR.
    expect(["start", startSide(dir)]).toContain(style.textAlign);
    expect(style.paddingLeft).toBe(style.paddingRight);
  });

  it.each(dirs)("Textarea follows %s: logical alignment, symmetric padding", async (dir) => {
    const screen = await render(
      <Frame dir={dir}>
        <Textarea aria-label="Bio" defaultValue="Hello" />
      </Frame>,
    );
    const style = getComputedStyle(screen.getByRole("textbox", { name: "Bio" }).element());
    expect(style.direction).toBe(dir);
    expect(["start", startSide(dir)]).toContain(style.textAlign);
    expect(style.paddingLeft).toBe(style.paddingRight);
  });
});

describe("RTL: Checkbox", () => {
  it.each(dirs)("%s: the box leads its label and the check stays centred", async (dir) => {
    await render(
      <Frame dir={dir}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Checkbox defaultChecked aria-label="Terms" />
          <span data-testid="text">Accept</span>
        </label>
      </Frame>,
    );
    const box = q('[data-slot="checkbox"]').getBoundingClientRect();
    const text = q('[data-testid="text"]').getBoundingClientRect();
    if (dir === "ltr") expect(box.right).toBeLessThanOrEqual(text.left + 1);
    else expect(box.left).toBeGreaterThanOrEqual(text.right - 1);
    const mark = q('[data-slot="checkbox-indicator"]').getBoundingClientRect();
    expect(near(mark.left + mark.width / 2, box.left + box.width / 2)).toBe(true);
    expect(near(mark.top + mark.height / 2, box.top + box.height / 2)).toBe(true);
  });
});

describe("RTL: Field", () => {
  it.each(dirs)("%s: label, description and error align to the start", async (dir) => {
    await render(
      <Frame dir={dir}>
        <Field>
          <FieldLabel>Email</FieldLabel>
          <Input aria-label="Email address" />
          <FieldDescription>We never share it</FieldDescription>
          <FieldError match>Required</FieldError>
        </Field>
      </Frame>,
    );
    const field = q('[data-slot="field"]');
    expect(sideOf(field, "Email")).toBe(startSide(dir));
    expect(sideOf(field, "We never share it")).toBe(startSide(dir));
    expect(sideOf(field, "Required")).toBe(startSide(dir));
  });
});

describe("RTL: Collapsible", () => {
  it.each(dirs)("%s: the open panel's text aligns to the start", async (dir) => {
    await render(
      <Frame dir={dir}>
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Details</CollapsibleTrigger>
          <CollapsiblePanel>
            <p>Body text</p>
          </CollapsiblePanel>
        </Collapsible>
      </Frame>,
    );
    expect(sideOf(q('[data-slot="collapsible"]'), "Body text")).toBe(startSide(dir));
  });
});

describe("RTL: Badge", () => {
  it.each(dirs)("%s: a leading icon sits at the inline start", async (dir) => {
    await render(
      <Frame dir={dir}>
        <Badge>
          <svg data-testid="icon" width="12" height="12" aria-hidden="true" />
          <span data-testid="text">New</span>
        </Badge>
      </Frame>,
    );
    const icon = q('[data-testid="icon"]').getBoundingClientRect();
    const text = q('[data-testid="text"]').getBoundingClientRect();
    if (dir === "ltr") expect(icon.right).toBeLessThanOrEqual(text.left + 1);
    else expect(icon.left).toBeGreaterThanOrEqual(text.right - 1);
  });
});

describe("RTL: Card", () => {
  it.each(dirs)("%s: header text aligns to the start and footer actions run from it", async (dir) => {
    await render(
      <Frame dir={dir}>
        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
            <CardDescription>Billing</CardDescription>
          </CardHeader>
          <CardContent>Body</CardContent>
          <CardFooter>
            <button type="button" data-testid="first">
              Cancel
            </button>
            <button type="button" data-testid="second">
              Save
            </button>
          </CardFooter>
        </Card>
      </Frame>,
    );
    const card = q('[data-slot="card"]');
    expect(sideOf(card, "Plan")).toBe(startSide(dir));
    expect(sideOf(card, "Billing")).toBe(startSide(dir));
    expect(sideOf(card, "Body")).toBe(startSide(dir));
    const first = q('[data-testid="first"]').getBoundingClientRect();
    const second = q('[data-testid="second"]').getBoundingClientRect();
    if (dir === "ltr") expect(first.left).toBeLessThan(second.left);
    else expect(first.left).toBeGreaterThan(second.left);
  });
});

describe("RTL: Meter and Progress", () => {
  it.each(dirs)("Meter %s: the fill starts at the inline start, the label leads the value", async (dir) => {
    await render(
      <Frame dir={dir}>
        <Meter value={50}>
          <MeterLabel>Disk</MeterLabel>
          <MeterValue />
        </Meter>
      </Frame>,
    );
    const track = q('[data-slot="meter-track"]').getBoundingClientRect();
    const fill = q('[data-slot="meter-indicator"]').getBoundingClientRect();
    expect(near(fill.width, track.width / 2)).toBe(true);
    if (dir === "ltr") expect(near(fill.left, track.left)).toBe(true);
    else expect(near(fill.right, track.right)).toBe(true);
    const label = q('[data-slot="meter-label"]').getBoundingClientRect();
    const value = q('[data-slot="meter-value"]').getBoundingClientRect();
    if (dir === "ltr") expect(label.left).toBeLessThan(value.left);
    else expect(label.left).toBeGreaterThan(value.left);
  });

  it.each(dirs)("Progress %s: the fill starts at the inline start, the label leads the value", async (dir) => {
    await render(
      <Frame dir={dir}>
        <Progress value={50}>
          <ProgressLabel>Upload</ProgressLabel>
          <ProgressValue />
        </Progress>
      </Frame>,
    );
    const track = q('[data-slot="progress-track"]').getBoundingClientRect();
    const fill = q('[data-slot="progress-indicator"]').getBoundingClientRect();
    expect(near(fill.width, track.width / 2)).toBe(true);
    if (dir === "ltr") expect(near(fill.left, track.left)).toBe(true);
    else expect(near(fill.right, track.right)).toBe(true);
    const label = q('[data-slot="progress-label"]').getBoundingClientRect();
    const value = q('[data-slot="progress-value"]').getBoundingClientRect();
    if (dir === "ltr") expect(label.left).toBeLessThan(value.left);
    else expect(label.left).toBeGreaterThan(value.left);
  });
});

describe("RTL: Skeleton", () => {
  it.each(dirs)("%s: placeholders flow from the start and carry no physical margin", async (dir) => {
    await render(
      <Frame dir={dir}>
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton data-testid="a" style={{ width: 40, height: 16 }} />
          <Skeleton data-testid="b" style={{ width: 40, height: 16 }} />
        </div>
      </Frame>,
    );
    const a = q('[data-testid="a"]');
    const b = q('[data-testid="b"]');
    if (dir === "ltr") expect(a.getBoundingClientRect().left).toBeLessThan(b.getBoundingClientRect().left);
    else expect(a.getBoundingClientRect().left).toBeGreaterThan(b.getBoundingClientRect().left);
    const style = getComputedStyle(a);
    expect(style.marginInlineStart).toBe("0px");
    expect(style.marginInlineEnd).toBe("0px");
  });
});

describe("RTL: Avatar", () => {
  it.each(dirs)("%s: the fallback is centred", async (dir) => {
    await render(
      <Frame dir={dir}>
        <Avatar>
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>
      </Frame>,
    );
    const avatar = q('[data-slot="avatar"]');
    const frame = avatar.getBoundingClientRect();
    const text = textRect(avatar, "AB");
    expect(near(text.left + text.width / 2, frame.left + frame.width / 2)).toBe(true);
  });

  it.each(dirs)("AvatarGroup %s: later avatars overlap towards the end by 8px", async (dir) => {
    await render(
      <Frame dir={dir}>
        <AvatarGroup>
          <Avatar>
            <AvatarFallback>A</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>B</AvatarFallback>
          </Avatar>
        </AvatarGroup>
      </Frame>,
    );
    const [first, second] = [...document.querySelectorAll('[data-slot="avatar"]')].map((element) =>
      element.getBoundingClientRect(),
    );
    if (!first || !second) throw new Error("expected two avatars");
    // size-10 (40px) minus the 8px overlap: the second one starts 32px after the first.
    if (dir === "ltr") expect(near(second.left - first.left, 32)).toBe(true);
    else expect(near(first.left - second.left, 32)).toBe(true);
  });
});
```

- [ ] **Step 8: Run, expect pass.** `npx vitest run test/rtl-layout.test.tsx`. Expected: all pass. Possible measurement-only adjustments (not bugs): if `textAlign` computes to a value other than `start`/the start side for a native control, print `style.textAlign` and widen the allowed set only when the value is genuinely direction-following. A real physical-direction defect (for example `AvatarGroup` overlapping the wrong way, or a fill anchored to `left`) is a "Found bug": do not touch the component.

- [ ] **Step 9: Format and commit.** `npm run format` (Biome re-wraps the long `it.each` titles), then:

```
git add test/rtl-layout.test.tsx
git commit -m "test(rtl): layout guards for Input, Textarea, Checkbox, Field, Collapsible, Badge, Card, Meter, Progress, Skeleton and Avatar

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

#### (iv) `verify-consumer` CSS needles for the Phase J / K classes

The needles below were taken from a real Tailwind CLI build of the current `dist/` (the same recipe `verify-consumer` runs: `@import "tailwindcss" source(none)` plus the package stylesheet, whose `@source "../"` scans `dist/`); each was matched against that output before being written here. Notes on what is deliberately not a needle:
- The ColorPicker area, hue and alpha gradients are inline `style` values in the JS, not CSS, so a consumer build cannot contain them. The ColorPicker gradient needles are therefore the two Tailwind utilities that carry a gradient into the stylesheet: the checkerboard `bg-[conic-gradient(…)]` and its `bg-[length:8px_8px]`.
- Tailwind v4 emits `rtl:` as `.rtl\:x:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)`; the needles stop at `:where(:dir(rtl)` so they do not depend on the list after it.
- Needles are classes the library already uses and the other tasks do not remove (Task 1 adds more `rtl:` classes; it does not drop these).

- [ ] **Step 10: Add the needle group.** In `scripts/verify-consumer.mjs`, replace

```js
      ".forced-colors\\:not-data-disabled\\:hover\\:bg-\\[Highlight\\]:not([data-disabled]):hover",
    ],
  },
];
```

with

```js
      ".forced-colors\\:not-data-disabled\\:hover\\:bg-\\[Highlight\\]:not([data-disabled]):hover",
    ],
  },
  {
    // Phases J/K: the `rtl:` variant compiles to `:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)`.
    // Pagination/Carousel/Tree/Calendar chevrons, ColorInput, Rating's fill clip, Sidebar's slide.
    reason: "rtl: variants (chevron mirroring, ColorInput alignment, Rating, Sidebar) missing",
    needles: [
      ".rtl\\:-scale-x-100:where(:dir(rtl)",
      ".rtl\\:text-right:where(:dir(rtl)",
      ".rtl\\:\\[clip-path\\:inset",
      ".group-data-\\[collapsible\\=offcanvas\\]\\/sidebar\\:group-data-\\[side\\=left\\]\\/sidebar\\:rtl\\:translate-x-full",
    ],
  },
  {
    // Phase J ColorPicker + Phase K FileUpload/Resizable: forced-colors affordances, and the
    // `data-dragging` state (grab cursor, drop-target colours) set by the components.
    reason: "forced-colors: or data-dragging variants (ColorPicker, FileUpload, Resizable) missing",
    needles: [
      ".forced-colors\\:border-\\[CanvasText\\]",
      ".forced-colors\\:outline-\\[CanvasText\\]",
      ".forced-color-adjust-none",
      ".forced-colors\\:data-dragging\\:border-\\[Highlight\\][data-dragging]",
      ".forced-colors\\:data-dragging\\:bg-\\[Highlight\\][data-dragging]",
      ".data-dragging\\:cursor-grabbing[data-dragging]",
      ".data-dragging\\:border-primary[data-dragging]",
    ],
  },
  {
    // The only gradient CSS ColorPicker's classes carry: the alpha checkerboard (the area and
    // slider gradients are inline styles, so they cannot appear in a consumer's stylesheet).
    reason: "ColorPicker checkerboard utilities (conic-gradient, 8px size) missing",
    needles: [
      /background-image:\s*conic-gradient\(#d4d4d4 25%,#fff 0 50%,#d4d4d4 0 75%,#fff 0\)/,
      ".bg-\\[length\\:8px_8px\\]",
    ],
  },
];
```

- [ ] **Step 11: Build and verify, expect pass.** `npm run build && npm run verify:consumer`. Expected: the `✓ consumer Tailwind build from … generates Tessera classes via @source` line, then `✓ consumer verification complete`.

- [ ] **Step 12: Mutation check (proves the needles can fail).** In `scripts/verify-consumer.mjs`, temporarily change the first rtl needle to a class that does not exist (`".rtl\\:-scale-x-1000:where(:dir(rtl)"`), run `node scripts/verify-consumer.mjs`, and expect `✗ consumer CSS is missing .rtl\:-scale-x-1000:where(:dir(rtl) — rtl: variants …` with exit code 1. Undo the edit with the Edit tool and run `node scripts/verify-consumer.mjs` again to see it green.

- [ ] **Step 13: Commit.**

```
git add scripts/verify-consumer.mjs
git commit -m "test(consumer): verify-consumer needles for rtl, forced-colors, data-dragging and the checkerboard

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

#### (v) `tailwindcss` ^4 as a documented peer dependency

- [ ] **Step 14: Write the failing check.** In `scripts/verify-consumer.mjs`, directly after the line `const stylesDistPath = stylesExport.replace(/^\.\/dist\//, "");` add:

```js

// Tailwind v4 is a peer: the consumer's own build generates the classes from Tessera's sources
// (the package ships class names and a stylesheet, not compiled CSS for every utility).
if (!/^\^4(\.|$)/.test(pkgJson.peerDependencies?.tailwindcss ?? ""))
  fail('package.json must declare "tailwindcss": "^4.x" in peerDependencies');
```

(`fail` is a hoisted function declaration, and `fixture` is already defined above this line.)

- [ ] **Step 15: Run and see it fail.** `node scripts/verify-consumer.mjs`. Expected: `✗ package.json must declare "tailwindcss": "^4.x" in peerDependencies`, exit code 1.

- [ ] **Step 16: Fix.** In `package.json` replace

```json
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
```

with

```json
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0"
  },
```

Then refresh the lockfile's root entry: `npm install --package-lock-only`, and check `git diff --stat package-lock.json` shows only the root package's `peerDependencies` block (no resolved-version churn; if more changes appear, restore the lockfile with `git checkout -- package-lock.json` and add only that one line by hand with Edit). The devDependency `tailwindcss` (`^4.3.3`) already satisfies the range.

In `README.md` replace the line

```
Requirements: React 19, Tailwind CSS v4.
```

with

```
Requirements: React 19 and Tailwind CSS v4. `react`, `react-dom` and `tailwindcss` (`^4`) are **peer dependencies**: your app installs them (`npm install tailwindcss`, plus `@tailwindcss/vite` or `@tailwindcss/cli`). Tessera ships class names and a stylesheet, not precompiled CSS: your own Tailwind build generates the utilities, scanning the installed package through the `@source` in `@tessera/ui/styles.css`.
```

- [ ] **Step 17: Run, expect pass.** `npm run build && npm run verify:consumer`. Expected: all `✓` lines, including the pack-and-install check (the tarball's `package.json` now carries the peer).

- [ ] **Step 18: Commit.**

```
git add package.json package-lock.json scripts/verify-consumer.mjs README.md
git commit -m "build: declare tailwindcss ^4 as a documented peer dependency

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 19: Gate.** `npm run format && npm run check`. Green. The `Found bugs` list below is copied into the Task 8 report (each entry becomes "fixed in a follow-up task" or "deferred, with the reason").

**Found bugs (filled in during execution):**
- None known when this plan was written. For each backfill test that fails against current code, add a line: `<file> › <test name>: observed <value>, expected <value>; skipped with it.skip, not fixed here.` Candidates the reading flagged as worth watching: the Slider handler argument shape in a controlled single-thumb slider (Step 4), and `AvatarGroup`'s overlap direction in RTL (Step 7).

**Review focus:**
- A component that swallows `ref` (a wrapper that spreads `props` after setting its own `ref`) or puts `className` on the wrapper instead of the part: Step 1 (the `Table` row also pins that `ref` and `className` land on the `<table>`, not the scroll container).
- A controlled control that shows the user's proposed value instead of the parent's, or ignores a later parent value: Step 4, beat 2 and beat 3 for each of the eleven controls.
- A physical-direction regression (`text-left`, `ml-*`, a left-anchored fill) in the eleven RTL components: Step 7, each describe fails only in its `rtl` row.
- A removed or renamed Phase J/K class, or `rtl:` / `forced-colors:` variants dropped from the consumer build: Steps 10 and 12 (the mutation check proves the new needles can fail).
- A package whose `tailwindcss` peer is missing or on the wrong major: Steps 14 to 15 (the check fails before the `package.json` edit).

### Task 6: Spinner, Alert, InputGroup

Spec L2. Three hand-built components on Tailwind + CVA (no new dependencies), one commit each, in this order: Spinner (Button is refactored onto it), Alert (also gives `FieldError` its live-region role), InputGroup. All paths are relative to the repo root; create and edit files only with the Write/Edit tools (Windows absolute paths), never with shell redirection.

**Files:**
- Create: `src/components/spinner/{spinner.tsx, spinner-variants.ts, spinner.test.tsx, spinner.stories.tsx, index.ts}`
- Create: `src/components/button/button-spinner.test.tsx` (the extraction regression suite)
- Modify: `src/components/button/button.tsx` (use `Spinner`, delete the private `ButtonSpinner`)
- Create: `src/lib/live-region.ts`, `src/lib/live-region.test.ts`
- Create: `src/components/alert/{alert.tsx, alert-variants.ts, alert.test.tsx, alert.stories.tsx, index.ts}`
- Modify: `src/lib/icons.tsx` (+`InfoIcon`, `CircleCheckIcon`, `TriangleAlertIcon`, `CircleXIcon`), `src/lib/icons.test.tsx`
- Modify: `src/components/field/field.tsx` (`FieldError` gets `role="alert"`); create `src/components/field/field-error-live-region.test.tsx`
- Create: `src/components/input-group/{input-group.tsx, input-group-variants.ts, input-group.test.tsx, input-group.stories.tsx, index.ts}`
- Modify: `src/index.ts` (three export blocks)

**Interfaces:**

```ts
// src/components/spinner
export interface SpinnerProps extends Omit<ComponentProps<"svg">, "children">, SpinnerVariantProps {
  "data-slot"?: string; // lets Button keep its legacy "button-spinner" slot
}
export function Spinner(props: SpinnerProps): JSX.Element;
export const spinnerDefaults: { readonly size: "md" };
export type SpinnerVariantProps = { size?: "xs" | "sm" | "md" | "lg" | "inherit" | null };
export function spinnerVariants(options?: SpinnerVariantProps & { className?: string }): string;
// size: xs 12px, sm 14px, md 16px (default), lg 24px, inherit = no size class (the parent sizes the svg, as Button does).
// No aria-label/aria-labelledby: decorative, aria-hidden="true". With one: role="img" (override with `role`, e.g. "status").

// src/components/alert
export type AlertTone = "info" | "success" | "warning" | "danger" | "neutral";
export const alertTones: readonly ["info", "success", "warning", "danger", "neutral"];
export const alertDefaults: { readonly tone: "neutral" };
export interface AlertProps extends ComponentProps<"div">, AlertVariantProps {
  tone?: AlertTone;
  icon?: ReactNode;        // undefined = the tone's icon; null/false = no icon; any node replaces it
  onDismiss?: () => void;  // renders the dismiss button
  dismissLabel?: string;   // aria-label of the dismiss button, default "Dismiss"
}
export function Alert(props: AlertProps): JSX.Element;            // data-slot="alert", data-tone, role "alert" (danger) | "status" (others); `role` prop overrides
export function AlertTitle(props: ComponentProps<"div">): JSX.Element;        // data-slot="alert-title"
export function AlertDescription(props: ComponentProps<"div">): JSX.Element;  // data-slot="alert-description"
export function AlertAction(props: ComponentProps<"div">): JSX.Element;       // data-slot="alert-action", a button row under the text
export function alertVariants(options?: AlertVariantProps & { className?: string }): string;
// src/lib/live-region.ts (internal, reached through Alert and FieldError)
export function liveRegionRole(tone: ToneColor): "alert" | "status";

// src/components/input-group
export interface InputGroupProps extends ComponentProps<"div">, InputGroupVariantProps {
  disabled?: boolean; // disables the InputGroupInput and InputGroupButtons inside (a disabled Field does this too)
  invalid?: boolean;  // for use without a Field; inside a Field, `Field invalid` / validity drives it
}
export function InputGroup(props: InputGroupProps): JSX.Element;       // role="group", data-slot="input-group", data-size, data-invalid, data-disabled
export interface InputGroupAddonProps extends Omit<ComponentProps<"div">, "align"> {
  align?: "start" | "end"; // styling only: DOM order decides the side (put "end" addons after the input)
  bordered?: boolean;      // a muted, divided addon ("https://") instead of a bare one
}
export function InputGroupAddon(props: InputGroupAddonProps): JSX.Element;    // data-slot="input-group-addon", data-align
export type InputGroupInputProps = BaseInput.Props;
export function InputGroupInput(props: InputGroupInputProps): JSX.Element;    // data-slot="input-group-input", borderless Base UI Input
export type InputGroupButtonProps = ButtonProps;
export function InputGroupButton(props: InputGroupButtonProps): JSX.Element;  // Button (ghost, neutral, xs; sm in a lg group) in a data-slot="input-group-button" span
export const inputGroupDefaults: { readonly size: "md" };
export function inputGroupVariants(options?: InputGroupVariantProps & { className?: string }): string;
// size: "sm" (h-8) | "md" (h-10, default) | "lg" (h-12): the same heights as Input.
```

#### 6A: Spinner

- [ ] **Step 1: Write the Button extraction regression suite first (characterization test).** Create `src/components/button/button-spinner.test.tsx`. It pins the exact markup, order, sizing and animation of the spinner `Button loading` renders today, so it must pass on the unmodified tree and keep passing after the refactor.

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { emulateReducedMotion, resetEmulatedMedia } from "../../../test/emulation";
import { Button } from "./button";

/*
 * Characterization suite for the Spinner extraction (Phase L, Task 6A): every expectation here was
 * true of the private `ButtonSpinner` before `Spinner` existed, and must stay true after.
 */

/** The exact markup the private ButtonSpinner rendered. */
const LEGACY_SPINNER_HTML =
  '<svg aria-hidden="true" data-slot="button-spinner" viewBox="0 0 24 24" fill="none" class="animate-spin">' +
  '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3"></circle>' +
  '<path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>' +
  "</svg>";

afterEach(async () => {
  await resetEmulatedMedia();
});

describe("Button loading spinner (Spinner extraction regression)", () => {
  it("renders exactly the markup the private ButtonSpinner rendered", async () => {
    const screen = await render(<Button loading>Saving</Button>);
    const spinner = screen.container.querySelector('[data-slot="button-spinner"]');
    expect(spinner?.outerHTML).toBe(LEGACY_SPINNER_HTML);
  });

  it("renders the spinner as the button's first child, before the label", async () => {
    const screen = await render(<Button loading>Saving</Button>);
    const button = screen.getByRole("button", { name: "Saving" }).element();
    expect(button.firstElementChild?.getAttribute("data-slot")).toBe("button-spinner");
    expect(button.childNodes).toHaveLength(2);
    expect(button.lastChild?.textContent).toBe("Saving");
  });

  it("renders no spinner when not loading", async () => {
    const screen = await render(<Button>Save</Button>);
    expect(screen.container.querySelector('[data-slot="button-spinner"]')).toBeNull();
  });

  it("is the only child of an icon-only loading button", async () => {
    const screen = await render(
      <Button loading size="icon" aria-label="Refresh">
        <svg data-testid="icon" aria-hidden="true" />
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Refresh" }).element();
    expect(button.children).toHaveLength(1);
    expect(button.firstElementChild?.getAttribute("data-slot")).toBe("button-spinner");
  });

  it.each([
    ["xs", 14],
    ["sm", 16],
    ["md", 16],
    ["lg", 20],
    ["icon-xs", 14],
    ["icon-sm", 16],
    ["icon", 16],
    ["icon-lg", 20],
  ] as const)("sizes the spinner by the button size (%s -> %ipx)", async (size, px) => {
    const screen = await render(
      <Button loading size={size} aria-label="Busy">
        Busy
      </Button>,
    );
    const spinner = screen.container.querySelector('[data-slot="button-spinner"]') as SVGElement;
    const box = spinner.getBoundingClientRect();
    expect(box.width).toBe(px);
    expect(box.height).toBe(px);
  });

  it("spins, and keeps spinning under reduced motion (essential status motion)", async () => {
    const screen = await render(<Button loading>Saving</Button>);
    const spinner = screen.container.querySelector('[data-slot="button-spinner"]') as SVGElement;
    expect(getComputedStyle(spinner).animationName).toBe("spin");
    await emulateReducedMotion(true);
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    expect(getComputedStyle(spinner).animationName).toBe("spin");
  });
});
```

- [ ] **Step 2: Run it on the unmodified tree.** `npx vitest run src/components/button/button-spinner.test.tsx`. Expected: `Test Files  1 passed`, 13 tests passed. If the first test fails only because of attribute order or serialisation, replace `LEGACY_SPINNER_HTML` with the actual `outerHTML` printed in the diff: the unmodified tree is the baseline by definition. Any other failure means the expectation misdescribes today's Button: fix the test, not Button.
- [ ] **Step 3: Write the Spinner RED tests.** Create `src/components/spinner/spinner.test.tsx`:

```tsx
import axe from "axe-core";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
} from "../../../test/emulation";
import { Spinner } from "./spinner";
import { spinnerVariants } from "./spinner-variants";

afterEach(async () => {
  await resetEmulatedMedia();
});

const svgOf = (container: Element) => container.querySelector("svg") as SVGSVGElement;

describe("Spinner", () => {
  it("is a decorative, aria-hidden svg by default (no role)", async () => {
    const screen = await render(<Spinner />);
    const svg = svgOf(screen.container);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.hasAttribute("role")).toBe(false);
    expect(svg.getAttribute("data-slot")).toBe("spinner");
    expect(svg.getAttribute("data-size")).toBe("md");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.classList.contains("animate-spin")).toBe(true);
    expect(screen.container.querySelector('[role="status"]')).toBeNull();
  });

  it("with an aria-label becomes a named image and is no longer aria-hidden", async () => {
    const screen = await render(<Spinner aria-label="Loading" />);
    const image = screen.getByRole("img", { name: "Loading" });
    await expect.element(image).toBeInTheDocument();
    expect(svgOf(screen.container).hasAttribute("aria-hidden")).toBe(false);
  });

  it("with aria-labelledby becomes a named image", async () => {
    const screen = await render(
      <div>
        <span id="spinner-name">Fetching orders</span>
        <Spinner aria-labelledby="spinner-name" />
      </div>,
    );
    await expect.element(screen.getByRole("img", { name: "Fetching orders" })).toBeInTheDocument();
  });

  it("lets the caller choose the role (role=status for a live region)", async () => {
    const screen = await render(<Spinner role="status" aria-label="Saving" />);
    await expect.element(screen.getByRole("status", { name: "Saving" })).toBeInTheDocument();
    expect(screen.container.querySelector('[role="img"]')).toBeNull();
  });

  it.each([
    ["xs", "size-3", 12],
    ["sm", "size-3.5", 14],
    ["md", "size-4", 16],
    ["lg", "size-6", 24],
  ] as const)("size %s applies %s (%ipx)", async (size, className, px) => {
    const screen = await render(<Spinner size={size} />);
    const svg = svgOf(screen.container);
    expect(svg.classList.contains(className)).toBe(true);
    expect(svg.getAttribute("data-size")).toBe(size);
    expect(svg.getBoundingClientRect().width).toBe(px);
  });

  it("size=inherit adds no size class and no data-size: the parent sizes the svg", async () => {
    const screen = await render(
      <div className="[&_svg]:size-6">
        <Spinner size="inherit" />
      </div>,
    );
    const svg = svgOf(screen.container);
    expect(svg.getAttribute("class")).toBe("animate-spin");
    expect(svg.hasAttribute("data-size")).toBe(false);
    expect(svg.getBoundingClientRect().width).toBe(24);
  });

  it("merges className last so the caller wins", async () => {
    const screen = await render(<Spinner className="size-8 text-danger" />);
    const svg = svgOf(screen.container);
    expect(svg.classList.contains("size-8")).toBe(true);
    expect(svg.classList.contains("size-4")).toBe(false);
    expect(svg.classList.contains("text-danger")).toBe(true);
    expect(svg.classList.contains("animate-spin")).toBe(true);
  });

  it("forwards ref and svg props, and lets data-slot be overridden", async () => {
    const ref = createRef<SVGSVGElement>();
    const screen = await render(<Spinner ref={ref} id="s1" data-slot="my-spinner" />);
    expect(ref.current).toBe(svgOf(screen.container));
    expect(ref.current?.id).toBe("s1");
    expect(ref.current?.getAttribute("data-slot")).toBe("my-spinner");
  });

  it("draws with currentColor, so it takes the surrounding text colour", async () => {
    const screen = await render(
      <div data-testid="wrap" className="text-danger">
        <Spinner />
      </div>,
    );
    const wrap = screen.getByTestId("wrap").element();
    const path = wrap.querySelector("path") as SVGPathElement;
    const circle = wrap.querySelector("circle") as SVGCircleElement;
    expect(path.getAttribute("stroke")).toBe("currentColor");
    expect(circle.getAttribute("stroke")).toBe("currentColor");
    expect(getComputedStyle(path).stroke).toBe(getComputedStyle(wrap).color);
  });

  it("animates with the spin keyframes", async () => {
    const screen = await render(<Spinner />);
    expect(getComputedStyle(svgOf(screen.container)).animationName).toBe("spin");
  });

  it("keeps spinning under reduced motion (essential status motion, like Button and Toast)", async () => {
    const screen = await render(<Spinner />);
    await emulateReducedMotion(true);
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    expect(getComputedStyle(svgOf(screen.container)).animationName).toBe("spin");
  });

  it("in forced colors still strokes with the (forced) text colour", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(
      <div data-testid="wrap">
        <Spinner />
      </div>,
    );
    const wrap = screen.getByTestId("wrap").element();
    const path = wrap.querySelector("path") as SVGPathElement;
    expect(getComputedStyle(path).stroke).toBe(getComputedStyle(wrap).color);
    expect(getComputedStyle(path).stroke).not.toBe("none");
  });

  it("is direction-neutral: the same animation and no rtl: variants under dir=rtl", async () => {
    const screen = await render(
      <div dir="rtl">
        <Spinner />
      </div>,
    );
    const svg = svgOf(screen.container);
    expect(getComputedStyle(svg).animationName).toBe("spin");
    expect(svg.getAttribute("class")).not.toContain("rtl:");
  });

  it("spinnerVariants returns the classes for other elements", () => {
    expect(spinnerVariants({ size: "lg", className: "text-primary" })).toBe(
      "animate-spin size-6 text-primary",
    );
    expect(spinnerVariants({ size: "inherit" })).toBe("animate-spin");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Spinner />
        <Spinner aria-label="Loading" />
        <Spinner role="status" aria-label="Saving" className="text-primary" />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
```

- [ ] **Step 4: Run it RED.** `npx vitest run src/components/spinner`. Expected: the suite fails to load, `Failed to resolve import "./spinner"`.
- [ ] **Step 5: Create `src/components/spinner/spinner-variants.ts`** (server-safe):

```ts
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/** Defaults: shared by cva and the Spinner's data attributes. */
export const spinnerDefaults = { size: "md" } as const;

/*
 * `inherit` adds no size class: the parent sizes the svg (Button's `[&_svg:not([class*='size-'])]`
 * rule). Any `size-*` class, even a default, would switch that rule off.
 *
 * There is deliberately no `motion-reduce:` variant: the spinner is essential status motion and
 * keeps spinning under reduced motion, like Button's loading state and Toast's.
 */
const spinnerCva = cva("animate-spin", {
  variants: {
    size: {
      xs: "size-3",
      sm: "size-3.5",
      md: "size-4",
      lg: "size-6",
      inherit: "",
    },
  },
  defaultVariants: spinnerDefaults,
});

export type SpinnerVariantProps = VariantProps<typeof spinnerCva>;

/** Spinner classes for any element. */
export function spinnerVariants(options: SpinnerVariantProps & { className?: string } = {}): string {
  const { className, ...variants } = options;
  return cn(spinnerCva(variants), className);
}
```

- [ ] **Step 6: Create `src/components/spinner/spinner.tsx`.** The attribute order (`aria-hidden`, `data-slot`, `viewBox`, `fill`, `class`) is what makes Button's markup identical, so keep it.

```tsx
import type { ComponentProps } from "react";
import { type SpinnerVariantProps, spinnerDefaults, spinnerVariants } from "./spinner-variants";

export interface SpinnerProps
  extends Omit<ComponentProps<"svg">, "children">,
    SpinnerVariantProps {
  /** Overrides the slot name; Button passes `button-spinner` to keep its markup unchanged. */
  "data-slot"?: string;
}

/**
 * A spinning ring that draws with `currentColor`. Decorative by default (`aria-hidden`, no role):
 * the surrounding control or text says what is happening. Give it an `aria-label` (or
 * `aria-labelledby`) to make it a named `role="img"`, or add `role="status"` as well to use it as a
 * live region on its own. Server-safe: no hooks, no state.
 */
export function Spinner({ size, className, "data-slot": dataSlot, ...props }: SpinnerProps) {
  const labelled = props["aria-label"] != null || props["aria-labelledby"] != null;
  const resolvedSize = size ?? spinnerDefaults.size;
  return (
    <svg
      {...props}
      aria-hidden={labelled ? undefined : "true"}
      role={props.role ?? (labelled ? "img" : undefined)}
      data-slot={dataSlot ?? "spinner"}
      data-size={resolvedSize === "inherit" ? undefined : resolvedSize}
      viewBox="0 0 24 24"
      fill="none"
      className={spinnerVariants({ size, className })}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 7: Create `src/components/spinner/index.ts`:**

```ts
export { Spinner, type SpinnerProps } from "./spinner";
export { type SpinnerVariantProps, spinnerDefaults, spinnerVariants } from "./spinner-variants";
```

- [ ] **Step 8: Run GREEN.** `npx vitest run src/components/spinner`. Expected: `Test Files  1 passed`, 22 tests passed (the `it.each` rows count individually).
- [ ] **Step 9: Refactor Button onto Spinner.** In `src/components/button/button.tsx`: add `import { Spinner } from "../spinner";` after the `button-variants` import, replace `{loading && <ButtonSpinner />}` with the line below, and delete the whole `function ButtonSpinner() { ... }` at the bottom of the file.

```tsx
      {loading && <Spinner size="inherit" data-slot="button-spinner" />}
```

- [ ] **Step 10: Prove the extraction changed nothing.** `npx vitest run src/components/button`. Expected: `Test Files  3 passed` (button, button-spinner, button.contrast), no changes to any pre-existing assertion. `button-spinner.test.tsx` passing unchanged after Step 9 is the proof of identical DOM, sizing, order and animation.
- [ ] **Step 11: Write the stories.** Create `src/components/spinner/spinner.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { Spinner } from "./spinner";

const sizes = ["xs", "sm", "md", "lg"] as const;

const meta = {
  title: "Components/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: [...sizes, "inherit"] },
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { "aria-label": "Loading" } };

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {sizes.map((size) => (
        <Spinner key={size} size={size} />
      ))}
    </div>
  ),
};

/** It draws with `currentColor`: set the text colour on the spinner or any ancestor. */
export const Colors: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner className="text-primary" />
      <Spinner className="text-success" />
      <Spinner className="text-warning" />
      <Spinner className="text-danger" />
      <Spinner className="text-muted-foreground" />
    </div>
  ),
};

/** Decorative by default; a label makes it a named image, `role="status"` a live region. */
export const Labelled: Story = {
  render: () => (
    <div className="flex items-center gap-3 text-sm">
      <Spinner role="status" aria-label="Loading orders" />
      <span aria-hidden="true">Loading orders</span>
    </div>
  ),
};

/** `size="inherit"` leaves sizing to the parent, which is how Button sizes its own spinner. */
export const InheritsSize: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="[&_svg]:size-5">
        <Spinner size="inherit" />
      </div>
      <div className="[&_svg]:size-8">
        <Spinner size="inherit" />
      </div>
    </div>
  ),
};

/** `Button loading` renders a Spinner. */
export const InButton: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button loading>Saving…</Button>
      <Button loading variant="outline" color="neutral">
        Saving…
      </Button>
      <Button loading size="icon" aria-label="Refreshing" />
    </div>
  ),
};

export const RTL: Story = {
  render: () => (
    <div dir="rtl" className="flex items-center gap-3 text-sm">
      <Spinner role="status" aria-label="جارٍ التحميل" />
      <span aria-hidden="true">جارٍ التحميل</span>
    </div>
  ),
};
```

- [ ] **Step 12: Export from `src/index.ts`.** Edit anchor `} from "./components/slider";` and append directly after it:

```ts
export {
  Spinner,
  type SpinnerProps,
  type SpinnerVariantProps,
  spinnerDefaults,
  spinnerVariants,
} from "./components/spinner";
```

- [ ] **Step 13: Run the gate.** `npm run format && npm run check && npm run build:storybook`. Expected: Biome writes no remaining diagnostics, all tests pass, `verify:consumer` prints its `✓` lines (including the new `spinner` module and its `.d.ts`), Storybook builds.
- [ ] **Step 14: Commit.**

```bash
git add src/components/spinner src/components/button/button.tsx src/components/button/button-spinner.test.tsx src/index.ts
git commit -m "$(cat <<'EOF'
feat(spinner): Spinner, extracted from Button loading

Button renders the same markup through Spinner (size inherit, legacy
button-spinner slot); button-spinner.test.tsx pins the DOM, sizes and
animation. Closes the backlog item "assert the loading spinner renders
before the children".

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

#### 6B: Alert

- [ ] **Step 1: RED test for the shared role rule.** Create `src/lib/live-region.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toneColors } from "./tone";
import { liveRegionRole } from "./live-region";

describe("liveRegionRole", () => {
  it("makes danger urgent (role=alert)", () => {
    expect(liveRegionRole("danger")).toBe("alert");
  });

  it.each(toneColors.filter((tone) => tone !== "danger"))("makes %s polite (role=status)", (tone) => {
    expect(liveRegionRole(tone)).toBe("status");
  });
});
```

- [ ] **Step 2: Run RED.** `npx vitest run src/lib/live-region.test.ts`. Expected: fails with `Failed to resolve import "./live-region"`.
- [ ] **Step 3: Create `src/lib/live-region.ts`** (server-safe):

```ts
import type { ToneColor } from "./tone";

/**
 * The live-region role for a message of this tone. Only `danger` is urgent (`alert`, assertive: it
 * interrupts); every other tone waits its turn (`status`, polite). Alert and FieldError share this
 * rule so an error reads the same wherever it appears.
 */
export function liveRegionRole(tone: ToneColor): "alert" | "status" {
  return tone === "danger" ? "alert" : "status";
}
```

- [ ] **Step 4: Run GREEN.** `npx vitest run src/lib/live-region.test.ts`. Expected: `1 passed` file, 7 tests passed. (The module is not reachable from `src/index.ts` yet: do not run `verify:consumer` until Step 14.)
- [ ] **Step 5: Add the four tone icons to `src/lib/icons.tsx`.** Edit anchor `export function CalendarIcon(props: ComponentProps<"svg">) {` and insert before it (the paths are Toast's own tone icons, so Alert and Toast read the same):

```tsx
/** A circle with "i": information (Alert info and neutral). */
export function InfoIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </StrokeIcon>
  );
}

/** A circle with a check: success. */
export function CircleCheckIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </StrokeIcon>
  );
}

/** A triangle with "!": a warning. */
export function TriangleAlertIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </StrokeIcon>
  );
}

/** A circle with a cross: danger. */
export function CircleXIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </StrokeIcon>
  );
}

```

- [ ] **Step 6: Register them in `src/lib/icons.test.tsx`.** Edit anchor `  UploadIcon,\n} from "./icons";` to add `CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon` (the format step sorts the import), and edit anchor `  UploadIcon,\n};` (the `icons` object) to add the same four names. Run `npx vitest run src/lib/icons.test.tsx`. Expected: passes, each new icon gets its three generated tests (aria-hidden + viewBox, className forwarding, prop forwarding).
- [ ] **Step 7: Write the Alert RED tests.** Create `src/components/alert/alert.test.tsx`:

```tsx
import axe from "axe-core";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
} from "../../../test/emulation";
import { Button } from "../button";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "./alert";
import { alertTones, alertVariants } from "./alert-variants";

afterEach(async () => {
  await resetEmulatedMedia();
});

const slot = (root: Element, name: string) =>
  root.querySelector(`[data-slot="${name}"]`) as HTMLElement;

function Full({ tone }: { tone?: (typeof alertTones)[number] }) {
  return (
    <Alert tone={tone} onDismiss={() => {}}>
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>Your plan renews tomorrow.</AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" color="neutral">
          Manage plan
        </Button>
      </AlertAction>
    </Alert>
  );
}

describe("Alert", () => {
  it("renders its title and description in a polite status region by default", async () => {
    const screen = await render(
      <Alert>
        <AlertTitle>Saved</AlertTitle>
        <AlertDescription>Your changes are live.</AlertDescription>
      </Alert>,
    );
    const alert = screen.getByRole("status");
    await expect.element(alert).toHaveAttribute("data-slot", "alert");
    await expect.element(alert).toHaveAttribute("data-tone", "neutral");
    await expect.element(alert).toHaveTextContent("Saved");
    await expect.element(alert).toHaveTextContent("Your changes are live.");
    expect(slot(screen.container, "alert-title").textContent).toBe("Saved");
    expect(slot(screen.container, "alert-description").textContent).toBe("Your changes are live.");
  });

  it.each(alertTones)("%s: carries its tone class and data-tone", async (tone) => {
    const screen = await render(<Alert tone={tone}>Message</Alert>);
    const alert = screen.container.querySelector('[data-slot="alert"]') as HTMLElement;
    expect(alert.getAttribute("data-tone")).toBe(tone);
    expect(alert.classList.contains(`tone-${tone}`)).toBe(true);
  });

  it.each([
    ["info", "status"],
    ["success", "status"],
    ["warning", "status"],
    ["neutral", "status"],
    ["danger", "alert"],
  ] as const)("%s uses role=%s (the same rule as FieldError)", async (tone, role) => {
    const screen = await render(<Alert tone={tone}>Message</Alert>);
    await expect.element(screen.getByRole(role)).toBeInTheDocument();
  });

  it("lets the caller override the role", async () => {
    const screen = await render(
      <Alert tone="danger" role="note">
        Message
      </Alert>,
    );
    await expect.element(screen.getByRole("note")).toBeInTheDocument();
    expect(screen.container.querySelector('[role="alert"]')).toBeNull();
  });

  it("announces when a danger Alert is mounted after the page loaded", async () => {
    function Reveal() {
      const [shown, setShown] = useState(false);
      return (
        <div>
          <Button onClick={() => setShown(true)}>Pay</Button>
          {shown && (
            <Alert tone="danger">
              <AlertTitle>Payment failed</AlertTitle>
            </Alert>
          )}
        </div>
      );
    }
    const screen = await render(<Reveal />);
    expect(screen.container.querySelector('[role="alert"]')).toBeNull();
    await screen.getByRole("button", { name: "Pay" }).click();
    await expect.element(screen.getByRole("alert")).toHaveTextContent("Payment failed");
  });

  it("shows an aria-hidden icon per tone, and the icons differ so tone never relies on colour", async () => {
    const shapes = new Set<string>();
    for (const tone of ["info", "success", "warning", "danger"] as const) {
      const screen = await render(<Alert tone={tone}>Message</Alert>);
      const icon = slot(screen.container, "alert-icon");
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.querySelectorAll("svg")).toHaveLength(1);
      shapes.add(icon.innerHTML);
      await screen.unmount();
    }
    expect(shapes.size).toBe(4);
  });

  it("neutral shows the info icon", async () => {
    const info = await render(<Alert tone="info">Message</Alert>);
    const infoHtml = slot(info.container, "alert-icon").innerHTML;
    await info.unmount();
    const neutral = await render(<Alert tone="neutral">Message</Alert>);
    expect(slot(neutral.container, "alert-icon").innerHTML).toBe(infoHtml);
  });

  it("replaces the default icon with `icon`, and hides it for null and false", async () => {
    const custom = await render(
      <Alert icon={<svg data-testid="custom-icon" />}>Message</Alert>,
    );
    expect(slot(custom.container, "alert-icon").querySelector('[data-testid="custom-icon"]')).not.toBeNull();
    expect(slot(custom.container, "alert-icon").querySelectorAll("svg")).toHaveLength(1);
    await custom.unmount();

    const none = await render(<Alert icon={null}>Message</Alert>);
    expect(none.container.querySelector('[data-slot="alert-icon"]')).toBeNull();
    await none.unmount();

    const off = await render(<Alert icon={false}>Message</Alert>);
    expect(off.container.querySelector('[data-slot="alert-icon"]')).toBeNull();
  });

  it("has no dismiss button without onDismiss", async () => {
    const screen = await render(<Alert>Message</Alert>);
    expect(screen.container.querySelector("button")).toBeNull();
  });

  it("dismisses through a named button, by click and by keyboard", async () => {
    const onDismiss = vi.fn();
    const screen = await render(<Alert onDismiss={onDismiss}>Message</Alert>);
    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    await dismiss.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    (dismiss.element() as HTMLButtonElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(onDismiss).toHaveBeenCalledTimes(2);
    await userEvent.keyboard(" ");
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });

  it("names the dismiss button from dismissLabel", async () => {
    const screen = await render(
      <Alert onDismiss={() => {}} dismissLabel="Zamknij">
        Message
      </Alert>,
    );
    await expect.element(screen.getByRole("button", { name: "Zamknij" })).toBeInTheDocument();
  });

  it("Tab order is the action buttons, then dismiss", async () => {
    const screen = await render(<Full />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Manage plan" }).element());
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Dismiss" }).element());
  });

  it("stacks title, description and actions in one column, actions last", async () => {
    const screen = await render(<Full />);
    const title = slot(screen.container, "alert-title").getBoundingClientRect();
    const description = slot(screen.container, "alert-description").getBoundingClientRect();
    const action = slot(screen.container, "alert-action").getBoundingClientRect();
    expect(description.top).toBeGreaterThanOrEqual(title.bottom);
    expect(action.top).toBeGreaterThanOrEqual(description.bottom);
  });

  it("wraps long unbroken text instead of overflowing", async () => {
    const screen = await render(
      <div style={{ width: 220 }}>
        <Alert onDismiss={() => {}}>
          <AlertDescription>{"x".repeat(120)}</AlertDescription>
        </Alert>
      </div>,
    );
    const alert = slot(screen.container, "alert");
    expect(alert.scrollWidth).toBeLessThanOrEqual(alert.clientWidth);
    const dismiss = alert.querySelector("button") as HTMLElement;
    expect(dismiss.getBoundingClientRect().right).toBeLessThanOrEqual(alert.getBoundingClientRect().right);
  });

  it("merges className last, and forwards ref and div props", async () => {
    const ref = createRef<HTMLDivElement>();
    const screen = await render(
      <Alert ref={ref} id="a1" data-testid="alert" className="rounded-none p-2">
        Message
      </Alert>,
    );
    const alert = screen.getByTestId("alert");
    expect(ref.current).toBe(alert.element());
    await expect.element(alert).toHaveAttribute("id", "a1");
    await expect.element(alert).toHaveClass("rounded-none", "p-2");
    await expect.element(alert).not.toHaveClass("rounded-lg", "p-4");
  });

  it("alertVariants returns the classes for other elements", () => {
    const classes = alertVariants({ tone: "success", className: "mt-2" });
    expect(classes).toContain("tone-success");
    expect(classes).toContain("bg-tone-soft");
    expect(classes).toContain("mt-2");
  });

  it("puts the icon at the inline start and the dismiss button at the inline end in RTL", async () => {
    const screen = await render(
      <div dir="rtl">
        <Full />
      </div>,
    );
    const icon = slot(screen.container, "alert-icon").getBoundingClientRect();
    const content = slot(screen.container, "alert-content").getBoundingClientRect();
    const dismiss = slot(screen.container, "alert-dismiss").getBoundingClientRect();
    expect(icon.left).toBeGreaterThanOrEqual(content.right - 1);
    expect(dismiss.right).toBeLessThanOrEqual(content.left + 1);
  });

  it("puts the icon at the inline start and the dismiss button at the inline end in LTR", async () => {
    const screen = await render(<Full />);
    const icon = slot(screen.container, "alert-icon").getBoundingClientRect();
    const content = slot(screen.container, "alert-content").getBoundingClientRect();
    const dismiss = slot(screen.container, "alert-dismiss").getBoundingClientRect();
    expect(icon.right).toBeLessThanOrEqual(content.left + 1);
    expect(dismiss.left).toBeGreaterThanOrEqual(content.right - 1);
  });

  it("in forced colors keeps a solid 1px border and the tone icon (tone never relies on colour)", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(<Full tone="danger" />);
    const style = getComputedStyle(slot(screen.container, "alert"));
    expect(style.borderTopStyle).toBe("solid");
    expect(style.borderTopWidth).toBe("1px");
    expect(slot(screen.container, "alert-icon").querySelector("svg")).not.toBeNull();
  });

  it("has no transitions of its own and its dismiss button stops animating under reduced motion", async () => {
    await emulateReducedMotion(true);
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    const screen = await render(<Full />);
    expect(getComputedStyle(slot(screen.container, "alert")).transitionProperty).toBe("all");
    const dismiss = slot(screen.container, "alert-dismiss").querySelector("button") as HTMLElement;
    expect(getComputedStyle(dismiss).transitionProperty).toBe("none");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        {alertTones.map((tone) => (
          <Alert key={tone} tone={tone} onDismiss={() => {}} className="mb-3">
            <AlertTitle>{tone} title</AlertTitle>
            <AlertDescription>The {tone} description text.</AlertDescription>
            <AlertAction>
              <Button size="sm" variant="outline" color="neutral">
                Action
              </Button>
            </AlertAction>
          </Alert>
        ))}
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
```

Note for the implementer: the `transitionProperty` of a plain `div` with no transition utility is the CSS initial value `all`, which is what the "no transitions of its own" assertion pins (nothing animates because `transition-duration` is `0s`); if Chromium reports a different initial value in this environment, assert `transitionDuration` is `"0s"` instead.

- [ ] **Step 8: Run RED.** `npx vitest run src/components/alert`. Expected: `Failed to resolve import "./alert"`.
- [ ] **Step 9: Create `src/components/alert/alert-variants.ts`** (server-safe):

```ts
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { type ToneColor, toneClass } from "../../lib/tone";

/** The tones an Alert accepts: the feedback roles plus neutral (no `primary`). */
export const alertTones = ["info", "success", "warning", "danger", "neutral"] as const satisfies
  readonly ToneColor[];
export type AlertTone = (typeof alertTones)[number];

/** Defaults: shared by cva and the Alert's data attributes. */
export const alertDefaults = { tone: "neutral" } as const;

const alertCva = cva(
  [
    "relative flex w-full items-start gap-3 rounded-lg border border-tone-line bg-tone-soft p-4",
    "text-sm text-tone-soft-foreground",
  ],
  {
    variants: {
      tone: {
        info: toneClass.info,
        success: toneClass.success,
        warning: toneClass.warning,
        danger: toneClass.danger,
        neutral: toneClass.neutral,
      },
    },
    defaultVariants: alertDefaults,
  },
);

export type AlertVariantProps = VariantProps<typeof alertCva>;

/** Alert classes for any element. */
export function alertVariants(options: AlertVariantProps & { className?: string } = {}): string {
  const { className, ...variants } = options;
  return cn(alertCva(variants), className);
}
```

- [ ] **Step 10: Create `src/components/alert/alert.tsx`:**

```tsx
"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn";
import {
  CircleCheckIcon,
  CircleXIcon,
  CloseIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "../../lib/icons";
import { liveRegionRole } from "../../lib/live-region";
import { Button } from "../button";
import {
  type AlertTone,
  type AlertVariantProps,
  alertDefaults,
  alertVariants,
} from "./alert-variants";

const toneIcons = {
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  danger: CircleXIcon,
  neutral: InfoIcon,
} satisfies Record<AlertTone, typeof InfoIcon>;

export interface AlertProps extends ComponentProps<"div">, AlertVariantProps {
  /**
   * The icon in front of the text: `undefined` shows the tone's icon, `null` or `false` shows
   * none, any node replaces it. The slot is `aria-hidden`: it never carries meaning on its own.
   */
  icon?: ReactNode;
  /** Shows a dismiss button that calls this. The Alert does not unmount itself. */
  onDismiss?: () => void;
  /** Accessible name of the dismiss button. @default "Dismiss" */
  dismissLabel?: string;
}

/**
 * An inline message that stays in the page flow. It is a live region: `role="alert"` for `danger`
 * (assertive) and `role="status"` for every other tone (polite), the same rule `FieldError` uses.
 * A live region announces changes, so render a new Alert when the message appears (a conditionally
 * mounted `danger` Alert is announced at once); a `status` that is already on screen when the page
 * loads is not announced. Pass `role` to opt out (e.g. `role="note"` for static content).
 */
export function Alert({
  tone,
  icon,
  onDismiss,
  dismissLabel = "Dismiss",
  role,
  className,
  children,
  ...props
}: AlertProps) {
  const resolvedTone = tone ?? alertDefaults.tone;
  const DefaultIcon = toneIcons[resolvedTone];
  const iconNode = icon === undefined ? <DefaultIcon /> : icon;
  return (
    <div
      {...props}
      role={role ?? liveRegionRole(resolvedTone)}
      data-slot="alert"
      data-tone={resolvedTone}
      className={alertVariants({ tone, className })}
    >
      {iconNode !== null && iconNode !== false && (
        <span
          data-slot="alert-icon"
          aria-hidden="true"
          className="mt-0.5 flex shrink-0 text-tone-ink [&_svg]:size-4"
        >
          {iconNode}
        </span>
      )}
      <div data-slot="alert-content" className="flex min-w-0 flex-1 flex-col gap-1 break-words">
        {children}
      </div>
      {/* Button always sets its own `data-slot="button"`, so the slot lives on a wrapper (as Toast's). */}
      {onDismiss && (
        <span data-slot="alert-dismiss" className="-me-1 -mt-1 flex shrink-0">
          <Button
            variant="ghost"
            color="neutral"
            size="icon-xs"
            aria-label={dismissLabel}
            onClick={onDismiss}
          >
            <CloseIcon />
          </Button>
        </span>
      )}
    </div>
  );
}

export type AlertTitleProps = ComponentProps<"div">;

/**
 * The Alert's headline. A plain `div`: add `role="heading" aria-level={3}` when it should be a
 * heading in the page outline (the same pattern as CardTitle).
 */
export function AlertTitle({ className, ...props }: AlertTitleProps) {
  return (
    <div
      {...props}
      data-slot="alert-title"
      className={cn("font-medium leading-snug", className)}
    />
  );
}

export type AlertDescriptionProps = ComponentProps<"div">;

/** The Alert's body text. */
export function AlertDescription({ className, ...props }: AlertDescriptionProps) {
  return (
    <div
      {...props}
      data-slot="alert-description"
      className={cn("leading-relaxed", className)}
    />
  );
}

export type AlertActionProps = ComponentProps<"div">;

/** A row of actions (Buttons, links) under the text. */
export function AlertAction({ className, ...props }: AlertActionProps) {
  return (
    <div
      {...props}
      data-slot="alert-action"
      className={cn("mt-1 flex flex-wrap items-center gap-2", className)}
    />
  );
}
```

- [ ] **Step 11: Create `src/components/alert/index.ts`:**

```ts
export {
  Alert,
  AlertAction,
  type AlertActionProps,
  AlertDescription,
  type AlertDescriptionProps,
  type AlertProps,
  AlertTitle,
  type AlertTitleProps,
} from "./alert";
export {
  type AlertTone,
  type AlertVariantProps,
  alertDefaults,
  alertTones,
  alertVariants,
} from "./alert-variants";
```

- [ ] **Step 12: Run GREEN.** `npx vitest run src/components/alert`. Expected: `Test Files  1 passed`, 33 tests passed. Investigate any axe `color-contrast` hit on a tone before touching the test: the fix belongs in the class strings (for example `text-foreground` for the description), never in an `axe` rule exclusion.
- [ ] **Step 13: RED for the FieldError live region.** Create `src/components/field/field-error-live-region.test.tsx` (closes the backlog item "FieldError has no live region"):

```tsx
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Form } from "../form";
import { Input } from "../input";
import { Field, FieldError, FieldLabel } from "./field";

describe("FieldError live region", () => {
  it("is role=alert while the Field is invalid", async () => {
    const screen = await render(
      <Field invalid>
        <FieldLabel>Email</FieldLabel>
        <Input />
        <FieldError>Enter a valid email.</FieldError>
      </Field>,
    );
    await expect.element(screen.getByRole("alert")).toHaveTextContent("Enter a valid email.");
  });

  it("renders no alert while the Field is valid", async () => {
    const screen = await render(
      <Field>
        <FieldLabel>Email</FieldLabel>
        <Input />
        <FieldError>Enter a valid email.</FieldError>
      </Field>,
    );
    expect(screen.container.querySelector('[role="alert"]')).toBeNull();
  });

  it("appears as an alert after a blur validation, without refocusing the control", async () => {
    const screen = await render(
      <div>
        <Field validationMode="onBlur" validate={(value) => (value ? null : "Required.")}>
          <FieldLabel>Name</FieldLabel>
          <Input />
          <FieldError />
        </Field>
        <button type="button">Elsewhere</button>
      </div>,
    );
    expect(screen.container.querySelector('[role="alert"]')).toBeNull();
    await userEvent.click(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.tab();
    await expect.element(screen.getByRole("alert")).toHaveTextContent("Required.");
  });

  it("appears as an alert after a failed Form submit", async () => {
    const screen = await render(
      <Form onSubmit={(event) => event.preventDefault()}>
        <Field name="email">
          <FieldLabel>Email</FieldLabel>
          <Input required />
          <FieldError match="valueMissing">Email is required.</FieldError>
        </Field>
        <button type="submit">Send</button>
      </Form>,
    );
    await screen.getByRole("button", { name: "Send" }).click();
    await expect.element(screen.getByRole("alert")).toHaveTextContent("Email is required.");
  });

  it("lets the caller override the role", async () => {
    const screen = await render(
      <Field invalid>
        <FieldLabel>Email</FieldLabel>
        <Input />
        <FieldError role="status">Enter a valid email.</FieldError>
      </Field>,
    );
    await expect.element(screen.getByRole("status")).toHaveTextContent("Enter a valid email.");
    expect(screen.container.querySelector('[role="alert"]')).toBeNull();
  });
});
```

- [ ] **Step 14: Run it RED.** `npx vitest run src/components/field/field-error-live-region.test.tsx`. Expected: the role assertions fail (`Unable to find role="alert"`), the "renders no alert" test passes.
- [ ] **Step 15: Give `FieldError` the role.** In `src/components/field/field.tsx` add `import { liveRegionRole } from "../../lib/live-region";` after the `merge-class-name` import, then edit `FieldError`'s `BaseField.Error` so `role` precedes `{...props}` (a caller can still override it):

```tsx
    <BaseField.Error
      role={liveRegionRole("danger")}
      {...props}
      match={match ?? (fieldInvalid && hasContent(props.children) ? true : undefined)}
      data-slot="field-error"
      className={mergeClassName("text-sm text-danger", className)}
    />
```

  Also extend its doc comment with one sentence: `Renders as role="alert" (the Alert rule for danger), so an error that appears after a blur or a submit is announced without refocusing the control.`
- [ ] **Step 16: Run GREEN, then the whole suite for collateral.** `npx vitest run src/components/field` then `npm test`. Expected: Field passes (5 new tests); the full suite passes. If an existing test in another component now finds two `role="alert"` nodes (a strict-mode locator), narrow that test's locator (for example `getByText`), never remove the role.
- [ ] **Step 17: Write the stories.** Create `src/components/alert/alert.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Rocket } from "lucide-react";
import { useState } from "react";
import { Button } from "../button";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "./alert";
import { alertTones } from "./alert-variants";

const meta = {
  title: "Components/Alert",
  component: Alert,
  tags: ["autodocs"],
  args: { tone: "info" },
  argTypes: {
    tone: { control: "select", options: alertTones },
    icon: { control: false },
    onDismiss: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-[28rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>Your plan renews tomorrow. You can change it any time.</AlertDescription>
    </Alert>
  ),
};

/** `danger` is `role="alert"` (assertive); every other tone is `role="status"` (polite). */
export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {alertTones.map((tone) => (
        <Alert key={tone} tone={tone}>
          <AlertTitle>{tone[0]?.toUpperCase() + tone.slice(1)}</AlertTitle>
          <AlertDescription>The {tone} tone with its own icon.</AlertDescription>
        </Alert>
      ))}
    </div>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Alert tone="warning">
      <AlertTitle>Storage almost full</AlertTitle>
      <AlertDescription>You have used 96% of your 10 GB.</AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" color="neutral">
          Upgrade
        </Button>
        <Button size="sm" variant="ghost" color="neutral">
          Review files
        </Button>
      </AlertAction>
    </Alert>
  ),
};

/** `onDismiss` shows the dismiss button; the Alert does not unmount itself. */
export const Dismissible: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return open ? (
      <Alert tone="success" onDismiss={() => setOpen(false)}>
        <AlertTitle>Invite sent</AlertTitle>
        <AlertDescription>Ada will get an email shortly.</AlertDescription>
      </Alert>
    ) : (
      <Button size="sm" variant="outline" color="neutral" onClick={() => setOpen(true)}>
        Show again
      </Button>
    );
  },
};

/** Mount a `danger` Alert when the error happens: it is announced at once. */
export const LiveError: Story = {
  render: () => {
    const [failed, setFailed] = useState(false);
    return (
      <div className="flex flex-col gap-3">
        <Button onClick={() => setFailed(true)}>Charge card</Button>
        {failed && (
          <Alert tone="danger" onDismiss={() => setFailed(false)}>
            <AlertTitle>Payment failed</AlertTitle>
            <AlertDescription>Your card was declined. Try another card.</AlertDescription>
          </Alert>
        )}
      </div>
    );
  },
};

export const CustomIcon: Story = {
  render: () => (
    <Alert tone="info" icon={<Rocket />}>
      <AlertTitle>New release</AlertTitle>
      <AlertDescription>Version 2.0 is out.</AlertDescription>
    </Alert>
  ),
};

export const NoIcon: Story = {
  render: () => (
    <Alert tone="neutral" icon={null}>
      <AlertDescription>A plain message without an icon.</AlertDescription>
    </Alert>
  ),
};

/** Static content that is not an update: opt out of the live region with `role="note"`. */
export const StaticNote: Story = {
  render: () => (
    <Alert tone="info" role="note">
      <AlertDescription>Prices include VAT.</AlertDescription>
    </Alert>
  ),
};

export const RTL: Story = {
  render: () => (
    <div dir="rtl" lang="ar">
      <Alert tone="warning" onDismiss={() => {}} dismissLabel="إغلاق">
        <AlertTitle>تنبيه</AlertTitle>
        <AlertDescription>سينتهي اشتراكك غدًا.</AlertDescription>
      </Alert>
    </div>
  ),
};
```

- [ ] **Step 18: Export from `src/index.ts`.** Edit anchor `export {\n  AlertDialog,` and insert this block before it:

```ts
export {
  Alert,
  AlertAction,
  type AlertActionProps,
  AlertDescription,
  type AlertDescriptionProps,
  type AlertProps,
  AlertTitle,
  type AlertTitleProps,
  type AlertTone,
  type AlertVariantProps,
  alertDefaults,
  alertTones,
  alertVariants,
} from "./components/alert";
```

- [ ] **Step 19: Run the gate.** `npm run format && npm run check && npm run build:storybook`. Expected: all green; `verify:consumer` now finds `lib/live-region` and the alert modules reachable from the index.
- [ ] **Step 20: Commit.**

```bash
git add src/components/alert src/lib/live-region.ts src/lib/live-region.test.ts src/lib/icons.tsx src/lib/icons.test.tsx src/components/field/field.tsx src/components/field/field-error-live-region.test.tsx src/index.ts
git commit -m "$(cat <<'EOF'
feat(alert): Alert, and a live-region role for FieldError

Alert (AlertTitle, AlertDescription, AlertAction): five tones, role
alert for danger and status for the rest, tone icons, optional dismiss.
FieldError reuses the same role rule, which closes the backlog item
"FieldError has no live region".

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

#### 6C: InputGroup

- [ ] **Step 1: Write the InputGroup RED tests.** Create `src/components/input-group/input-group.test.tsx`:

```tsx
import axe from "axe-core";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
  systemColor,
} from "../../../test/emulation";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { Input } from "../input";
import { NumberField, NumberFieldInput } from "../number-field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./input-group";

afterEach(async () => {
  await resetEmulatedMedia();
});

const groupOf = (root: Element) => root.querySelector('[data-slot="input-group"]') as HTMLElement;

function Website(props: { disabled?: boolean; invalid?: boolean }) {
  return (
    <Field {...props}>
      <FieldLabel>Website</FieldLabel>
      <InputGroup>
        <InputGroupAddon>https://</InputGroupAddon>
        <InputGroupInput placeholder="example.com" />
        <InputGroupAddon align="end">
          <InputGroupButton aria-label="Clear">x</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription>Without a trailing slash.</FieldDescription>
      <FieldError>Enter a valid address.</FieldError>
    </Field>
  );
}

describe("InputGroup", () => {
  it("renders a labelled group around a textbox named by its FieldLabel", async () => {
    const screen = await render(<Website />);
    const group = groupOf(screen.container);
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("data-size")).toBe("md");
    const input = screen.getByRole("textbox", { name: "Website" });
    await expect.element(input).toHaveAttribute("data-slot", "input-group-input");
    await expect.element(input).toHaveAttribute("aria-describedby");
    expect(group.contains(input.element())).toBe(true);
  });

  it("clicking the FieldLabel focuses the input", async () => {
    await render(<Website />);
    await page.getByText("Website", { exact: true }).click();
    expect(document.activeElement).toBe(page.getByRole("textbox").element());
  });

  it("clicking a bare addon focuses the input", async () => {
    await render(<Website />);
    await page.getByText("https://").click();
    expect(document.activeElement).toBe(page.getByRole("textbox").element());
  });

  it("clicking an InputGroupButton acts on the button and keeps focus on it", async () => {
    const onClick = vi.fn();
    await render(
      <InputGroup>
        <InputGroupInput aria-label="Search" />
        <InputGroupAddon align="end">
          <InputGroupButton aria-label="Go" onClick={onClick} />
        </InputGroupAddon>
      </InputGroup>,
    );
    await page.getByRole("button", { name: "Go" }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(page.getByRole("button", { name: "Go" }).element());
  });

  it.each([
    ["sm", 32],
    ["md", 40],
    ["lg", 48],
  ] as const)("group height at size %s matches Input's height (%ipx)", async (size, height) => {
    const screen = await render(
      <div className="flex flex-col gap-2">
        <InputGroup size={size}>
          <InputGroupInput aria-label="Grouped" />
        </InputGroup>
        <Input size={size} aria-label="Plain" />
      </div>,
    );
    expect(groupOf(screen.container).getBoundingClientRect().height).toBe(height);
    const plain = page.getByRole("textbox", { name: "Plain" }).element();
    expect(plain.getBoundingClientRect().height).toBe(height);
    expect(groupOf(screen.container).getAttribute("data-size")).toBe(size);
  });

  it("the inner input is borderless and transparent: the group owns the border", async () => {
    const screen = await render(
      <InputGroup>
        <InputGroupInput aria-label="Plain text" />
      </InputGroup>,
    );
    const input = getComputedStyle(page.getByRole("textbox").element());
    expect(input.borderTopWidth).toBe("0px");
    expect(input.boxShadow).toBe("none");
    expect(input.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(groupOf(screen.container)).borderTopWidth).toBe("1px");
  });

  it("shows the 1px solid focus ring on the group (not the input) on Tab focus", async () => {
    const screen = await render(
      <div>
        <InputGroup>
          <InputGroupInput aria-label="First" />
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Second" />
        </InputGroup>
      </div>,
    );
    const [first, second] = Array.from(
      screen.container.querySelectorAll('[data-slot="input-group"]'),
    ) as HTMLElement[];
    expect(getComputedStyle(first as HTMLElement).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("textbox", { name: "First" }).element());
    const ring = getComputedStyle(first as HTMLElement);
    expect(ring.outlineStyle).toBe("solid");
    expect(ring.outlineWidth).toBe("1px");
    expect(getComputedStyle(second as HTMLElement).outlineStyle).toBe("none");
    expect(getComputedStyle(page.getByRole("textbox", { name: "First" }).element()).outlineStyle).toBe(
      "none",
    );
  });

  it("an InputGroupButton's focus ring is drawn inside the group, so overflow-hidden cannot clip it", async () => {
    const screen = await render(
      <InputGroup>
        <InputGroupInput aria-label="Search" />
        <InputGroupButton aria-label="Go" />
      </InputGroup>,
    );
    await userEvent.tab();
    await userEvent.tab();
    const button = page.getByRole("button", { name: "Go" }).element() as HTMLElement;
    expect(document.activeElement).toBe(button);
    const style = getComputedStyle(button);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineOffset).toBe("-2px");
    const group = groupOf(screen.container).getBoundingClientRect();
    const box = button.getBoundingClientRect();
    expect(box.left).toBeGreaterThanOrEqual(group.left);
    expect(box.right).toBeLessThanOrEqual(group.right);
  });

  describe("states from the surrounding Field", () => {
    it("invalid: the group gets data-invalid and the same danger border as an invalid Input", async () => {
      const screen = await render(
        <div className="flex flex-col gap-4">
          <Field invalid>
            <FieldLabel>Plain</FieldLabel>
            <Input />
          </Field>
          <Website invalid />
        </div>,
      );
      const group = groupOf(screen.container);
      expect(group.hasAttribute("data-invalid")).toBe(true);
      await expect.element(page.getByRole("textbox", { name: "Website" })).toHaveAttribute("aria-invalid", "true");
      const plain = page.getByRole("textbox", { name: "Plain" }).element();
      expect(getComputedStyle(group).borderTopColor).toBe(getComputedStyle(plain).borderTopColor);
      await expect.element(page.getByRole("alert")).toHaveTextContent("Enter a valid address.");
    });

    it("valid: no data-invalid, no alert", async () => {
      const screen = await render(<Website />);
      expect(groupOf(screen.container).hasAttribute("data-invalid")).toBe(false);
      expect(screen.container.querySelector('[role="alert"]')).toBeNull();
    });

    it("disabled: the group dims, shows not-allowed, and disables the input and the button", async () => {
      const screen = await render(<Website disabled />);
      const group = groupOf(screen.container);
      expect(group.hasAttribute("data-disabled")).toBe(true);
      const style = getComputedStyle(group);
      expect(style.opacity).toBe("0.5");
      expect(style.cursor).toBe("not-allowed");
      await expect.element(page.getByRole("textbox", { name: "Website" })).toBeDisabled();
      await expect.element(page.getByRole("button", { name: "Clear" })).toBeDisabled();
    });

    it("a disabled group whose Field is not disabled: the prop disables the input and buttons", async () => {
      const screen = await render(
        <InputGroup disabled>
          <InputGroupInput aria-label="Name" />
          <InputGroupButton aria-label="Go" />
        </InputGroup>,
      );
      expect(groupOf(screen.container).hasAttribute("data-disabled")).toBe(true);
      await expect.element(page.getByRole("textbox", { name: "Name" })).toBeDisabled();
      await expect.element(page.getByRole("button", { name: "Go" })).toBeDisabled();
    });

    it("the invalid prop works without a Field: data-invalid and aria-invalid on the input", async () => {
      const screen = await render(
        <InputGroup invalid>
          <InputGroupInput aria-label="Name" />
        </InputGroup>,
      );
      expect(groupOf(screen.container).hasAttribute("data-invalid")).toBe(true);
      await expect.element(page.getByRole("textbox", { name: "Name" })).toHaveAttribute("aria-invalid", "true");
    });

    it("a bare aria-invalid input outside a Field still gives the group the danger border", async () => {
      const screen = await render(
        <div className="flex flex-col gap-2">
          <InputGroup>
            <InputGroupInput aria-label="Bare" aria-invalid />
          </InputGroup>
          <Input aria-label="Reference" aria-invalid />
        </div>,
      );
      expect(getComputedStyle(groupOf(screen.container)).borderTopColor).toBe(
        getComputedStyle(page.getByRole("textbox", { name: "Reference" }).element()).borderTopColor,
      );
    });

    it("a failed Form submit marks the group invalid and announces the FieldError", async () => {
      const screen = await render(
        <Form onSubmit={(event) => event.preventDefault()}>
          <Field name="email">
            <FieldLabel>Email</FieldLabel>
            <InputGroup>
              <InputGroupInput type="email" required />
            </InputGroup>
            <FieldError match="valueMissing">Email is required.</FieldError>
          </Field>
          <button type="submit">Send</button>
        </Form>,
      );
      expect(groupOf(screen.container).hasAttribute("data-invalid")).toBe(false);
      await page.getByRole("button", { name: "Send" }).click();
      await expect.poll(() => groupOf(screen.container).hasAttribute("data-invalid")).toBe(true);
      await expect.element(page.getByRole("alert")).toHaveTextContent("Email is required.");
    });
  });

  it("read-only input: the group shows the muted background", async () => {
    const screen = await render(
      <div className="flex flex-col gap-2">
        <InputGroup>
          <InputGroupInput aria-label="Editable" />
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Fixed" readOnly defaultValue="x" />
        </InputGroup>
      </div>,
    );
    const [editable, fixed] = Array.from(
      screen.container.querySelectorAll('[data-slot="input-group"]'),
    ) as HTMLElement[];
    expect(getComputedStyle(fixed as HTMLElement).backgroundColor).not.toBe(
      getComputedStyle(editable as HTMLElement).backgroundColor,
    );
  });

  it("types into the input and reports onValueChange", async () => {
    const onValueChange = vi.fn();
    await render(
      <InputGroup>
        <InputGroupInput aria-label="Handle" onValueChange={onValueChange} />
      </InputGroup>,
    );
    const input = page.getByRole("textbox", { name: "Handle" });
    await userEvent.type(input, "ada");
    await expect.element(input).toHaveValue("ada");
    expect(onValueChange).toHaveBeenLastCalledWith("ada", expect.anything());
  });

  it("works with a NumberField input: typing, the group ring and the invalid state", async () => {
    const screen = await render(
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel>Price</FieldLabel>
          <InputGroup>
            <InputGroupAddon>$</InputGroupAddon>
            <NumberField className="flex min-w-0 flex-1 self-stretch">
              <NumberFieldInput className="text-start" />
            </NumberField>
          </InputGroup>
        </Field>
        <Field invalid>
          <FieldLabel>Weight</FieldLabel>
          <InputGroup>
            <NumberField className="flex min-w-0 flex-1 self-stretch">
              <NumberFieldInput className="text-start" />
            </NumberField>
            <InputGroupAddon align="end">kg</InputGroupAddon>
          </InputGroup>
        </Field>
      </div>,
    );
    const price = page.getByRole("textbox", { name: "Price" });
    await userEvent.type(price, "12");
    await expect.element(price).toHaveValue("12");
    const [priceGroup, weightGroup] = Array.from(
      screen.container.querySelectorAll('[data-slot="input-group"]'),
    ) as HTMLElement[];
    (price.element() as HTMLElement).focus();
    expect(getComputedStyle(priceGroup as HTMLElement).outlineStyle).toBe("solid");
    expect((weightGroup as HTMLElement).hasAttribute("data-invalid")).toBe(true);
    // The NumberField input has no border of its own, so the group draws the only one.
    expect(getComputedStyle(price.element()).borderTopWidth).toBe("0px");
  });

  it("bordered addons are divided from the input with inline-logical borders", async () => {
    const screen = await render(
      <InputGroup>
        <InputGroupAddon bordered>https://</InputGroupAddon>
        <InputGroupInput aria-label="Host" />
        <InputGroupAddon align="end" bordered>
          .com
        </InputGroupAddon>
      </InputGroup>,
    );
    const [start, end] = Array.from(
      screen.container.querySelectorAll('[data-slot="input-group-addon"]'),
    ) as HTMLElement[];
    expect(getComputedStyle(start as HTMLElement).borderRightWidth).toBe("1px");
    expect(getComputedStyle(start as HTMLElement).borderLeftWidth).toBe("0px");
    expect(getComputedStyle(end as HTMLElement).borderLeftWidth).toBe("1px");
    expect(getComputedStyle(end as HTMLElement).borderRightWidth).toBe("0px");
  });

  it("RTL: the start addon sits at the right, the end addon at the left, and the borders flip", async () => {
    const screen = await render(
      <div dir="rtl">
        <InputGroup>
          <InputGroupAddon bordered>@</InputGroupAddon>
          <InputGroupInput aria-label="User" />
          <InputGroupAddon align="end" bordered>
            .com
          </InputGroupAddon>
        </InputGroup>
      </div>,
    );
    const [start, end] = Array.from(
      screen.container.querySelectorAll('[data-slot="input-group-addon"]'),
    ) as HTMLElement[];
    const input = page.getByRole("textbox", { name: "User" }).element().getBoundingClientRect();
    expect((start as HTMLElement).getBoundingClientRect().left).toBeGreaterThanOrEqual(input.right - 1);
    expect((end as HTMLElement).getBoundingClientRect().right).toBeLessThanOrEqual(input.left + 1);
    expect(getComputedStyle(start as HTMLElement).borderLeftWidth).toBe("1px");
    expect(getComputedStyle(start as HTMLElement).borderRightWidth).toBe("0px");
  });

  it("shrinks the input in a narrow container instead of overflowing", async () => {
    const screen = await render(
      <div style={{ width: 170 }}>
        <InputGroup>
          <InputGroupAddon>https://</InputGroupAddon>
          <InputGroupInput aria-label="Host" />
          <InputGroupAddon align="end">.example.com</InputGroupAddon>
        </InputGroup>
      </div>,
    );
    const group = groupOf(screen.container);
    expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth);
    expect(page.getByRole("textbox", { name: "Host" }).element().getBoundingClientRect().width).toBeGreaterThan(0);
  });

  it("in forced colors the focused group rings Highlight, also when invalid", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(
      <div className="flex flex-col gap-3">
        <InputGroup>
          <InputGroupInput aria-label="Valid" />
        </InputGroup>
        <InputGroup invalid>
          <InputGroupInput aria-label="Invalid" />
        </InputGroup>
      </div>,
    );
    const [valid, invalid] = Array.from(
      screen.container.querySelectorAll('[data-slot="input-group"]'),
    ) as HTMLElement[];
    for (const [name, group] of [
      ["Valid", valid],
      ["Invalid", invalid],
    ] as const) {
      (page.getByRole("textbox", { name }).element() as HTMLElement).focus();
      const style = getComputedStyle(group as HTMLElement);
      expect(style.outlineStyle).toBe("solid");
      expect(style.outlineColor).toBe(systemColor("Highlight"));
    }
  });

  it("under reduced motion the group does not transition", async () => {
    await emulateReducedMotion(true);
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    const screen = await render(
      <InputGroup>
        <InputGroupInput aria-label="Name" />
      </InputGroup>,
    );
    expect(getComputedStyle(groupOf(screen.container)).transitionProperty).toBe("none");
  });

  it("merges className last, forwards ref and div props, and lets the role be overridden", async () => {
    const ref = createRef<HTMLDivElement>();
    const screen = await render(
      <InputGroup ref={ref} id="g1" role="presentation" className="rounded-full">
        <InputGroupInput aria-label="Name" />
      </InputGroup>,
    );
    const group = groupOf(screen.container);
    expect(ref.current).toBe(group);
    expect(group.id).toBe("g1");
    expect(group.getAttribute("role")).toBe("presentation");
    expect(group.classList.contains("rounded-full")).toBe(true);
    expect(group.classList.contains("rounded-md")).toBe(false);
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Website />
        <Website invalid />
        <Website disabled />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run RED.** `npx vitest run src/components/input-group`. Expected: `Failed to resolve import "./input-group"`.
- [ ] **Step 3: Create `src/components/input-group/input-group-variants.ts`** (server-safe):

```ts
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { textFieldGroupBase } from "../input/input-variants";

/** Defaults: shared by cva and the InputGroup's data attributes. */
export const inputGroupDefaults = { size: "md" } as const;

/** Heights and text size, matching `textFieldSizes` (Input) without the inline padding. */
export const inputGroupSizes = {
  sm: "h-8 text-sm",
  md: "h-10 text-sm",
  lg: "h-12 text-base",
} as const;

/*
 * `textFieldGroupBase` is the look NumberField's group and Combobox's input group share: the
 * `focus-within` ring, hover, invalid (`data-invalid` / `has-aria-invalid`), disabled, forced
 * colors and motion. Two more `has-` states cover an `<input>` that is disabled or read-only
 * without a Field around the group (a `div` never matches `:disabled` / `:read-only` itself).
 */
const inputGroupCva = cva(
  [
    ...textFieldGroupBase,
    "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50 has-[input[readonly]]:bg-muted",
  ],
  {
    variants: { size: inputGroupSizes },
    defaultVariants: inputGroupDefaults,
  },
);

export type InputGroupVariantProps = VariantProps<typeof inputGroupCva>;

/** InputGroup classes for any element. */
export function inputGroupVariants(
  options: InputGroupVariantProps & { className?: string } = {},
): string {
  const { className, ...variants } = options;
  return cn(inputGroupCva(variants), className);
}
```

- [ ] **Step 4: Create `src/components/input-group/input-group.tsx`:**

```tsx
"use client";

import { Input as BaseInput } from "@base-ui/react/input";
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { type ComponentProps, createContext, type MouseEvent, useContext } from "react";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";
import { Button, type ButtonProps } from "../button";
import {
  type InputGroupVariantProps,
  inputGroupDefaults,
  inputGroupVariants,
} from "./input-group-variants";

interface InputGroupState {
  /** The group's own `disabled` prop, or a disabled Field around it. */
  disabled: boolean;
  /** The group's own `invalid` prop only: a Field's invalid state reaches the input by itself. */
  invalid: boolean;
  size: NonNullable<InputGroupVariantProps["size"]>;
}

const InputGroupContext = createContext<InputGroupState>({
  disabled: false,
  invalid: false,
  size: inputGroupDefaults.size,
});

export interface InputGroupProps extends ComponentProps<"div">, InputGroupVariantProps {
  /** Disables the `InputGroupInput` and `InputGroupButton`s inside. A disabled Field does the same. */
  disabled?: boolean;
  /** Marks the group invalid when it is used without a Field (inside one, the Field decides). */
  invalid?: boolean;
}

/**
 * One bordered control that holds an input with addons and buttons around it (a unit, a protocol,
 * an icon, a clear button). The group owns the border and the `focus-within` ring; the
 * `InputGroupInput` inside is borderless. Inside a `Field` it follows the Field's `invalid` and
 * `disabled` state, like NumberField's group. Put end addons after the input in the DOM.
 */
export function InputGroup({
  size,
  disabled = false,
  invalid = false,
  className,
  ...props
}: InputGroupProps) {
  const field = useFieldRootContext();
  const isDisabled = disabled || !!field.state.disabled;
  const isInvalid = invalid || field.state.valid === false;
  const resolvedSize = size ?? inputGroupDefaults.size;
  return (
    <InputGroupContext.Provider value={{ disabled: isDisabled, invalid, size: resolvedSize }}>
      <div
        role="group"
        {...props}
        data-slot="input-group"
        data-size={resolvedSize}
        data-disabled={isDisabled ? "" : undefined}
        data-invalid={isInvalid ? "" : undefined}
        className={inputGroupVariants({ size, className })}
      />
    </InputGroupContext.Provider>
  );
}

export interface InputGroupAddonProps extends Omit<ComponentProps<"div">, "align"> {
  /** Styling only (which side the padding or divider is on); DOM order decides the position. @default "start" */
  align?: "start" | "end";
  /** A muted, divided addon (like "https://") instead of a bare one. @default false */
  bordered?: boolean;
}

const addonBase =
  "flex shrink-0 cursor-text items-center gap-2 text-sm text-muted-foreground select-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

/**
 * Text or an icon beside the input. Pressing it (anywhere but on a control inside it) focuses the
 * group's input, as pressing the padding of an Input does.
 */
export function InputGroupAddon({
  align = "start",
  bordered = false,
  className,
  onMouseDown,
  ...props
}: InputGroupAddonProps) {
  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    onMouseDown?.(event);
    if (event.defaultPrevented) return;
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea, [role='button']")) {
      return;
    }
    const input = event.currentTarget.parentElement?.querySelector<HTMLInputElement>(
      "input:not(:disabled)",
    );
    if (!input) return;
    // Keep the press from moving focus to <body>, then focus the input ourselves.
    event.preventDefault();
    input.focus();
  }
  const placement = bordered
    ? align === "end"
      ? "border-s border-field-border bg-muted px-3"
      : "border-e border-field-border bg-muted px-3"
    : align === "end"
      ? "pe-3"
      : "ps-3";
  return (
    <div
      {...props}
      data-slot="input-group-addon"
      data-align={align}
      data-bordered={bordered ? "" : undefined}
      onMouseDown={handleMouseDown}
      className={cn(addonBase, placement, className)}
    />
  );
}

export type InputGroupInputProps = BaseInput.Props;

/**
 * The group's text input: a Base UI Input without a border, shadow or background of its own, so
 * it still joins the surrounding Field (id, label, `aria-describedby`, validation).
 */
export function InputGroupInput({
  className,
  disabled,
  "aria-invalid": ariaInvalid,
  ...props
}: InputGroupInputProps) {
  const group = useContext(InputGroupContext);
  return (
    <BaseInput
      {...props}
      disabled={disabled || group.disabled || undefined}
      aria-invalid={ariaInvalid ?? (group.invalid ? true : undefined)}
      data-slot="input-group-input"
      className={mergeClassName(
        "h-full min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
        className,
      )}
    />
  );
}

export type InputGroupButtonProps = ButtonProps;

/**
 * A ghost Button for the group (clear, reveal, copy). `xs` in `sm` and `md` groups, `sm` in `lg`.
 * Its focus ring is drawn inside the button (`outline-offset: -2px`) because the group clips its
 * overflow. Button always sets its own `data-slot`, so the slot lives on a wrapper.
 */
export function InputGroupButton({
  variant = "ghost",
  color = "neutral",
  size,
  disabled,
  ...props
}: InputGroupButtonProps) {
  const group = useContext(InputGroupContext);
  return (
    <span
      data-slot="input-group-button"
      className="flex shrink-0 items-center px-1 [&_button]:outline-offset-[-2px]"
    >
      <Button
        {...props}
        variant={variant}
        color={color}
        size={size ?? (group.size === "lg" ? "sm" : "xs")}
        disabled={disabled || group.disabled}
      />
    </span>
  );
}
```

- [ ] **Step 5: Create `src/components/input-group/index.ts`:**

```ts
export {
  InputGroup,
  InputGroupAddon,
  type InputGroupAddonProps,
  InputGroupButton,
  type InputGroupButtonProps,
  InputGroupInput,
  type InputGroupInputProps,
  type InputGroupProps,
} from "./input-group";
export {
  type InputGroupVariantProps,
  inputGroupDefaults,
  inputGroupVariants,
} from "./input-group-variants";
```

- [ ] **Step 6: Run GREEN.** `npx vitest run src/components/input-group`. Expected: `Test Files  1 passed`, 28 tests passed. If `userEvent.type` into the NumberField reports a different formatted value, assert `toHaveValue("12")` after the documented NumberField formatting (no grouping below 1 000) before changing the component.
- [ ] **Step 7: Add `@base-ui/react/input` check.** `vitest.config.ts` already pre-bundles `@base-ui/react/input` and `field-root-context`; confirm with `git diff --stat vitest.config.ts` that the file is untouched. Expected: no output.
- [ ] **Step 8: Write the stories.** Create `src/components/input-group/input-group.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Eye, Mail, Search, X } from "lucide-react";
import { useState } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { NumberField, NumberFieldInput } from "../number-field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./input-group";

const meta = {
  title: "Components/InputGroup",
  component: InputGroup,
  tags: ["autodocs"],
  args: { size: "md", disabled: false, invalid: false },
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg"] },
    disabled: { control: "boolean" },
    invalid: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InputGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <InputGroup {...args}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput aria-label="Search" placeholder="Search…" />
    </InputGroup>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <InputGroup>
      <InputGroupAddon>
        <Mail />
      </InputGroupAddon>
      <InputGroupInput aria-label="Email" type="email" placeholder="you@example.com" />
    </InputGroup>
  ),
};

/** `bordered` makes a muted addon divided from the input by a logical border. */
export const BorderedAddons: Story = {
  render: () => (
    <InputGroup>
      <InputGroupAddon bordered>https://</InputGroupAddon>
      <InputGroupInput aria-label="Domain" placeholder="example" />
      <InputGroupAddon align="end" bordered>
        .com
      </InputGroupAddon>
    </InputGroup>
  ),
};

export const WithButtons: Story = {
  render: () => {
    const [value, setValue] = useState("ada@example.com");
    return (
      <InputGroup>
        <InputGroupInput
          aria-label="Email"
          value={value}
          onValueChange={(next) => setValue(next)}
        />
        {value && (
          <InputGroupButton aria-label="Clear" onClick={() => setValue("")}>
            <X />
          </InputGroupButton>
        )}
        <InputGroupButton aria-label="Reveal">
          <Eye />
        </InputGroupButton>
      </InputGroup>
    );
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <InputGroup key={size} size={size}>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput aria-label={`Search (${size})`} placeholder={size} />
          <InputGroupButton aria-label={`Go (${size})`}>Go</InputGroupButton>
        </InputGroup>
      ))}
    </div>
  ),
};

/** Inside a `Field` the group follows `invalid` and `disabled`; toggle them in the controls. */
export const InField: Story = {
  args: { invalid: true },
  render: (args) => (
    <Field invalid={args.invalid} disabled={args.disabled}>
      <FieldLabel>Website</FieldLabel>
      <InputGroup size={args.size}>
        <InputGroupAddon bordered>https://</InputGroupAddon>
        <InputGroupInput placeholder="example.com" />
      </InputGroup>
      <FieldDescription>Without a trailing slash.</FieldDescription>
      <FieldError>Enter a valid address.</FieldError>
    </Field>
  ),
};

export const Disabled: Story = {
  render: () => (
    <InputGroup disabled>
      <InputGroupAddon>
        <Mail />
      </InputGroupAddon>
      <InputGroupInput aria-label="Email" defaultValue="locked@example.com" />
      <InputGroupButton aria-label="Copy">Copy</InputGroupButton>
    </InputGroup>
  ),
};

/** A NumberField input works in a group: the group draws the only border. */
export const WithNumberField: Story = {
  render: () => (
    <Field>
      <FieldLabel>Price</FieldLabel>
      <InputGroup>
        <InputGroupAddon>$</InputGroupAddon>
        <NumberField className="flex min-w-0 flex-1 self-stretch" min={0} step={0.5}>
          <NumberFieldInput className="text-start" />
        </NumberField>
        <InputGroupAddon align="end">USD</InputGroupAddon>
      </InputGroup>
    </Field>
  ),
};

export const RTL: Story = {
  render: () => (
    <div dir="rtl" lang="ar">
      <InputGroup>
        <InputGroupAddon bordered>https://</InputGroupAddon>
        <InputGroupInput aria-label="النطاق" placeholder="example" />
        <InputGroupAddon align="end" bordered>
          .com
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};
```

- [ ] **Step 9: Export from `src/index.ts`.** Edit anchor `} from "./components/input";` and append after it:

```ts
export {
  InputGroup,
  InputGroupAddon,
  type InputGroupAddonProps,
  InputGroupButton,
  type InputGroupButtonProps,
  InputGroupInput,
  type InputGroupInputProps,
  type InputGroupProps,
  type InputGroupVariantProps,
  inputGroupDefaults,
  inputGroupVariants,
} from "./components/input-group";
```

- [ ] **Step 10: Run the gate.** `npm run format && npm run check && npm run build:storybook`. Expected: all green.
- [ ] **Step 11: Visual check on a private port.** `npx storybook dev -p 6107 --ci --no-open` (never 8080), then in the browser check `Components/InputGroup`: bordered addons, the focus ring on the group, an invalid Field, the disabled group, the clear button's inset focus ring, the RTL story, and a 390px viewport (the input shrinks, nothing overflows). Stop only the PID you started (`netstat -ano | grep :6107 | grep LISTEN`, then `taskkill //PID <pid> //T //F`).
- [ ] **Step 12: Commit.**

```bash
git add src/components/input-group src/index.ts
git commit -m "$(cat <<'EOF'
feat(input-group): InputGroup with addons and buttons

InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton: one
bordered control that owns the focus-within ring, with a borderless
input inside. Invalid and disabled come from the surrounding Field (or
props), and it works with a NumberField input.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

**Review focus:**
- A `Button loading` whose DOM, sizes or animation drifted from the old private spinner: pinned by `button-spinner.test.tsx` (6A Steps 1-2 on the unmodified tree, Step 10 after the refactor).
- A `danger` Alert or `FieldError` that is silent to screen readers, or two competing alerts after a refactor: pinned by 6B Step 7 ("announces when a danger Alert is mounted after the page loaded", the role table) and 6B Steps 13-16 (blur validation, failed Form submit, role override, full-suite collateral run).
- InputGroup edge states: a focus ring clipped by `overflow-hidden` (6C Step 1, "an InputGroupButton's focus ring is drawn inside the group"), an addon press that steals focus from a button (the "clicking an InputGroupButton" test), invalid or disabled coming only from the Field (the "states from the surrounding Field" block, including the Form failed-submit and NumberField cases), and RTL or 170px overflow (the RTL and narrow-container tests).

---

### Task 7: CI workflow and canary

Spec L2 "CI". Two workflows under `.github/workflows/`, plus a `.nvmrc` so both read one Node version. `package.json` has `engines.node: ">=22"` but no `.nvmrc`, so the workflows read the new `.nvmrc` (`24`, the Node the repo is developed on) with `actions/setup-node`'s `node-version-file`. Nothing here changes library code.

**Files:**
- Create: `.nvmrc`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/base-ui-canary.yml`

**Interfaces:**
- Workflow `CI` (`ci.yml`): triggers `push` to `main`, `pull_request`, `workflow_dispatch`; one job `check` on `ubuntu-latest`; runs `npm ci`, `npx playwright install --with-deps chromium`, `npm run check`, `npm run build:storybook`; uploads Vitest browser screenshots only on failure.
- Workflow `Base UI canary` (`base-ui-canary.yml`): triggers weekly (`cron: "17 5 * * 1"`, Monday 05:17 UTC) and `workflow_dispatch`; one job `canary`; installs `@base-ui/react@latest` with `npm install --no-save` (package.json and the lockfile stay untouched), then runs the typecheck and the Form, Field and date and time control tests, each step `continue-on-error: true`, and writes the installed version and each outcome to the job summary plus a `::warning::` annotation on a problem. The run never goes red because of a canary finding.

- [ ] **Step 1: Verify the pieces the workflows depend on exist.** Run:

```bash
node -e "const s=require('./package.json').scripts; for (const k of ['check','build:storybook','test','typecheck']) { if (!s[k]) throw new Error('missing script '+k); } console.log('scripts ok:', s.check)"
node -e "const p=require('./package.json'); console.log('engines', p.engines.node, '| base-ui', p.dependencies['@base-ui/react'])"
ls -d src/components/form src/components/field src/components/date-field src/components/date-range-field src/components/date-picker src/components/time-field src/components/time-picker src/components/calendar
git ls-files package-lock.json
```

  Expected: `scripts ok: npm run palettes:check && npm run lint && npm run typecheck && npm run test && npm run build && npm run verify:consumer`, `engines >=22 | base-ui ~1.8.0`, the eight directories listed, and `package-lock.json` (so `npm ci` works).
- [ ] **Step 2: Check the lockfile is in sync, as `npm ci` will require.** `npm ci --dry-run`. Expected: exit code 0 and `up to date` or a `added N packages` dry-run summary, with no `npm error` lines. (A lockfile out of sync with package.json fails here and would fail on GitHub.)
- [ ] **Step 3: Create `.nvmrc`** with exactly one line:

```
24
```

- [ ] **Step 4: Create `.github/workflows/ci.yml`:**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    name: Check (palettes, lint, types, tests, build, consumer, storybook)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Check out
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium

      - name: Run npm run check
        run: npm run check

      - name: Build Storybook
        run: npm run build:storybook

      - name: Upload test screenshots
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: vitest-screenshots
          path: |
            **/__screenshots__/
            test-results/
          if-no-files-found: ignore
          retention-days: 7
```

- [ ] **Step 5: Create `.github/workflows/base-ui-canary.yml`:**

```yaml
name: Base UI canary

# Tessera pins @base-ui/react to ~1.8.0 and reaches into three Base UI internals
# (field-root-context, field-register-control, form-context). This weekly run installs the newest
# release WITHOUT committing it and runs the tests that depend on those internals, so a breaking
# release shows up as a warning before anyone upgrades. It never fails the workflow.

on:
  schedule:
    - cron: "17 5 * * 1"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  canary:
    name: "@base-ui/react@latest"
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Check out
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium

      - name: Install @base-ui/react@latest (not saved)
        id: install
        run: |
          npm install --no-save --no-audit --no-fund @base-ui/react@latest
          echo "version=$(node -p "JSON.parse(fs.readFileSync('node_modules/@base-ui/react/package.json','utf8')).version")" >> "$GITHUB_OUTPUT"

      - name: Typecheck
        id: types
        continue-on-error: true
        run: npx tsc --noEmit

      - name: Run Form, Field, date and time control tests
        id: tests
        continue-on-error: true
        run: >
          npx vitest run
          src/components/form
          src/components/field
          src/components/date-field
          src/components/date-range-field
          src/components/date-picker
          src/components/time-field
          src/components/time-picker
          src/components/calendar

      - name: Report
        if: always()
        run: |
          PINNED=$(node -p "JSON.parse(fs.readFileSync('package.json','utf8')).dependencies['@base-ui/react']")
          {
            echo "## Base UI canary"
            echo ""
            echo "- Pinned in package.json: \`@base-ui/react@${PINNED}\`"
            echo "- Installed for this run: \`@base-ui/react@${{ steps.install.outputs.version }}\`"
            echo "- Typecheck: **${{ steps.types.outcome }}**"
            echo "- Form, Field, date and time tests: **${{ steps.tests.outcome }}**"
          } >> "$GITHUB_STEP_SUMMARY"
          if [ "${{ steps.types.outcome }}" != "success" ] || [ "${{ steps.tests.outcome }}" != "success" ]; then
            echo "::warning title=Base UI canary::@base-ui/react@${{ steps.install.outputs.version }} breaks typecheck or the Form and date-control tests (see the run summary). Not blocking."
          fi
```

- [ ] **Step 6: Lint both files as YAML.** Run (the parser is fetched on demand by `npx`; it is not added to the repo):

```bash
npx --yes js-yaml .github/workflows/ci.yml > /dev/null && echo "ci.yml: valid YAML"
npx --yes js-yaml .github/workflows/base-ui-canary.yml > /dev/null && echo "base-ui-canary.yml: valid YAML"
```

  Expected: `ci.yml: valid YAML` and `base-ui-canary.yml: valid YAML`. Then check the structure with a node one-liner over the parsed JSON:

```bash
npx --yes js-yaml .github/workflows/ci.yml | node -e "const w=JSON.parse(require('fs').readFileSync(0,'utf8')); const steps=w.jobs.check.steps.map(s=>s.run||s.uses); if(!steps.includes('npm run check')||!steps.includes('npm ci')) throw new Error('ci steps missing'); if(!w.on.push||!w.on.pull_request) throw new Error('triggers missing'); console.log('ci.yml structure ok:', steps.length, 'steps')"
npx --yes js-yaml .github/workflows/base-ui-canary.yml | node -e "const w=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!w.on.schedule||!w.on.workflow_dispatch) throw new Error('canary triggers missing'); const t=w.jobs.canary.steps.filter(s=>s.id==='types'||s.id==='tests'); if(t.length!==2||!t.every(s=>s['continue-on-error']===true)) throw new Error('canary steps must be continue-on-error'); console.log('canary structure ok')"
```

  Expected: `ci.yml structure ok: 8 steps` and `canary structure ok`.
- [ ] **Step 7: Dry-run the canary's test command locally on the pinned version.** `npx vitest run src/components/form src/components/field src/components/date-field src/components/date-range-field src/components/date-picker src/components/time-field src/components/time-picker src/components/calendar`. Expected: every file passes (the canary is green against the pinned version, so any red on GitHub is attributable to the new Base UI release), and the filters match all eight directories (the run lists their test files).
- [ ] **Step 8: Run the CI commands in CI order locally.** `npm run check && npm run build:storybook`. Expected: all green. This proves the commands, not the runner.
- [ ] **Step 9: Commit.**

```bash
git add .nvmrc .github/workflows/ci.yml .github/workflows/base-ui-canary.yml
git commit -m "$(cat <<'EOF'
ci: CI workflow and a weekly Base UI canary

ci.yml runs npm ci, installs Playwright Chromium and runs npm run check
plus the Storybook build on push to main and on pull requests. The
canary installs @base-ui/react@latest without saving it and runs the
typecheck and the Form and date-control tests, reporting through the job
summary and a warning without ever failing the run. .nvmrc (24) feeds
both.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: Record what only runs on GitHub (in the final report, and in Task 8's backlog entry).** Local verification covers the YAML syntax and structure, the existence of every script and test directory, lockfile sync and the exact commands. It cannot cover: the `ubuntu-latest` runner itself, `playwright install --with-deps` (it needs `apt`), the `actions/*@v4` versions resolving, the `cache: npm` cache, `concurrency` cancellation, the `schedule` trigger (GitHub runs `cron` workflows only from the default branch and disables them after 60 days without repository activity), and `$GITHUB_STEP_SUMMARY` and `::warning::` rendering. Expect the first CI run on Linux to expose environment differences from the Windows development machine (fonts, `Intl` data, scrollbar widths in the geometry tests); fix those in follow-up commits and do not loosen assertions.

**Review focus:**
- `npm ci` failing because the lockfile drifted from `package.json`: pinned by Step 2.
- A canary that goes red or silently commits the new Base UI: the first is pinned by the structure check in Step 6 (both `types` and `tests` steps `continue-on-error: true`), the second by `--no-save` in the install step (confirmed by reading the workflow in Step 5; it can only be exercised on GitHub, where the runner's checkout is discarded after the run).
- A canary filter that matches nothing (a renamed directory) and "passes": pinned by Step 1's `ls -d` over all eight directories and Step 7's listing of the matched files.

---

### Task 8: Docs, backlog update and final re-audit

Everything is committed before this task starts (Tasks 1-7). This task documents Phase L, moves the backlog, and ends with a read-only re-audit of the fixed tree whose results go into a report. The re-audit writes only the report file and docs; it touches no source.

**Files:**
- Modify: `README.md` (CI section, component list, phase status, roadmap)
- Modify: `docs/backlog.md` (header, resolved items removed, "Needs a ruling" and Phase L follow-ups added, "Next components")
- Create: `docs/superpowers/reports/2026-10-14-phase-l-audit-report.md`

**Interfaces:**
- README component entries for exactly: `Spinner`, `Alert` (`AlertTitle`, `AlertDescription`, `AlertAction`), `InputGroup` (`InputGroupAddon`, `InputGroupInput`, `InputGroupButton`), with the prop names from Task 6's Interfaces.
- Report file: one table row for each of the 20 spec rows (`L1-01` to `L1-20`), the three hardening items (`H-1` to `H-3`), the eight "needs a ruling" items (`R-1` to `R-8`), the L2 additions (`A-1` to `A-4`) and the deferred L3 items (`D-1`, `D-2`); status vocabulary exactly `fixed`, `deferred`, `rejected`.

- [ ] **Step 1: Add a CI section to the README.** Edit `README.md`, anchor `## Stack\n`, and replace it with:

```markdown
## Continuous integration

`.github/workflows/ci.yml` runs `npm ci`, installs Playwright Chromium, then `npm run check` and
`npm run build:storybook` on every push to `main` and every pull request (Node from `.nvmrc`).
`.github/workflows/base-ui-canary.yml` runs weekly (and on demand): it installs
`@base-ui/react@latest` without saving it and runs the typecheck and the Form, Field, date and
time tests, reporting in the run summary and a warning. It is informational and never fails the
run; Tessera stays pinned to `@base-ui/react ~1.8.0` until a release is verified by hand.

## Stack
```

- [ ] **Step 2: Add the three component entries to the list.** Edit `README.md`, anchor `Phase A (foundation), Phase B (forms), Phase C (overlays), Phase D (navigation and feedback),` (the paragraph right after the Stepper entry), and insert before it:

```markdown
- [x] Spinner (a spinning ring drawn with `currentColor`, extracted from `Button loading`, which now renders
  it with `size="inherit"` and no change to its markup. Decorative by default: `aria-hidden`, no role. An
  `aria-label` / `aria-labelledby` makes it a named `role="img"`; add `role="status"` to use it as a live
  region on its own. `size` is `xs` / `sm` / `md` (default, 16px) / `lg` / `inherit` (no size class: the
  parent sizes the svg). It keeps spinning under reduced motion, like Button's and Toast's. Server-safe)
- [x] Alert, AlertTitle, AlertDescription, AlertAction (an inline message in the page flow. `tone` is
  `info` / `success` / `warning` / `danger` / `neutral` (default), from the tone tokens. It is a live
  region: `role="alert"` for `danger` and `role="status"` for the others (override with `role`; use
  `role="note"` for static content), the rule `FieldError` now shares, so an error that appears after a
  blur or a submit is announced. `icon` defaults to the tone's icon, `null` / `false` hides it, any node
  replaces it; the icon slot is `aria-hidden` and the icons differ per tone, so state never relies on
  colour. `onDismiss` shows a dismiss button named by `dismissLabel` ("Dismiss"); the Alert does not
  unmount itself. `AlertAction` is a button row under the text, `AlertTitle` a plain `div` (add
  `role="heading" aria-level={3}` for the outline). Client component)
- [x] InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton (one bordered control around an
  input with addons and buttons, `size` `sm` / `md` / `lg` at the Input heights. The group owns the border
  and the 1px `focus-within` ring (Highlight in forced colors); `InputGroupInput` is a borderless Base UI
  Input that still joins the surrounding `Field` (label, description, validation). Inside a `Field` the
  group follows its `invalid` and `disabled` state; `invalid` / `disabled` props cover use without a
  Field, and `disabled` also disables the input and buttons. `InputGroupAddon` takes `align`
  (`start` / `end`, styling only: put end addons after the input) and `bordered` (a muted, divided addon);
  pressing a bare addon focuses the input. `InputGroupButton` is a ghost Button (`xs`, or `sm` in a `lg`
  group) whose focus ring is drawn inside it. A `NumberField` input works inside it
  (`<NumberField className="flex min-w-0 flex-1 self-stretch"><NumberFieldInput className="text-start" />`).
  Pickers are not supported inside the group. Client component)

```

- [ ] **Step 3: Update the phase status paragraph.** Edit `README.md`, anchor `DataTableColumnsMenu and DataTablePagination, and the Events admin example.` (the end of the Phase K sentence) and replace it with:

```markdown
DataTableColumnsMenu and DataTablePagination, and the Events admin example. Phase L is complete: a
read-only audit of every component produced a non-breaking fix wave (logical-property and RTL fixes,
Gregorian-only calendar formatting, date and time edge cases, DataTable sorting, Sidebar ids, and more;
see `docs/superpowers/reports/2026-10-14-phase-l-audit-report.md`), then Spinner, Alert, InputGroup, and
CI with a weekly Base UI canary. Non-Gregorian calendars are unsupported: the Calendar family and the
date fields always format with the Gregorian calendar.
```

- [ ] **Step 4: Update the roadmap.** Edit `README.md`, anchor `Phase K is complete. Next is Phase L; candidates:` and replace it with:

```markdown
Phase L is complete. Next is L3, the breaking label and API pass, which waits for owner rulings:
`labels` normalisation (`addedLabel`, `labels.open` vs `openCalendar`, the DataTablePagination
Previous / Next strings, the Toast Close label) and the DateRangePicker `onValueChange` contract.
Other candidates:
```

  Then, in the same list, delete the bullet `- the DateRangePicker `onValueChange` contract decision (complete ranges from the button picker, partial\n  pairs from the editable one; deferred from Phase K);` with another Edit (it now lives in the L3 sentence above).
- [ ] **Step 5: Update the backlog header and remove the resolved items.** Edit `docs/backlog.md`: replace `Phase J (2026-10-07) and Phase K (2026-10-08) reviews.` with `Phase J (2026-10-07), Phase K (2026-10-08) and Phase L (2026-10-14) reviews.`, then replace this block with nothing (both items are fixed in Phase L: the first by `button-spinner.test.tsx`, the second by the FieldError `role="alert"`):

```markdown
- Button test: assert the loading spinner renders before the children.
- FieldError has no live region — `onBlur` errors are not announced until the control is refocused
  (consider an optional `aria-live`).
```

- [ ] **Step 6: Add the "needs a ruling" section and the Phase L follow-ups.** Edit `docs/backlog.md`, anchor `## Next components\nFollow the phases in the design-system spec §6`, and insert before it:

```markdown
## Needs a ruling (Phase L audit)
Findings the audit raised that Phase L deliberately did not change, because each changes behaviour the
owner should choose. Each is also a `deferred` row in `docs/superpowers/reports/2026-10-14-phase-l-audit-report.md`.
- Resizable: what `End` and `Enter` do on a handle whose *following* panel is collapsible (today they act on
  the preceding panel only). Rule whether the handle may collapse or restore the following panel.
- `SidebarMenuButton`: whether a menu button (not a link) may carry `aria-current`, and what marks the
  active item then.
- Toast: it is reachable by Tab while a modal Dialog is open. Rule whether a modal should make the toast
  region inert or whether toasts stay reachable on purpose.
- Command: `Ctrl/Cmd+K` still opens the palette over another modal. Rule whether it should be suppressed
  while a modal is open.
- `CommandEmpty`: it shows "No results" while an async list is still loading. Rule how a loading state is
  expressed (a `loading` prop, or `CommandEmpty` hidden by the consumer).
- Drawer: `vh` vs `dvh` for its height on mobile browsers whose toolbar changes the viewport.
- Tooltip: `aria-describedby` is set when the popup opens, not before; whether that is acceptable needs a
  screen-reader pass (NVDA, VoiceOver), listed with the other manual checks.
- FileUpload: the order `validate` runs in for the `too-many` reason (per file before the cap, or after).
- Date fields: the two-digit-year pivot beyond Phase L's rejection of years below 100 (what `26` means).

## Phase L follow-ups
- InputGroup: pickers (DatePicker, TimePicker, Select) are not supported inside the group; revisit with the
  editable shells' `slotPrefix` / `icon` parts.
- Toast's loading spinner and its tone icons are inline SVGs; they could use `Spinner` and the shared tone
  icons (`InfoIcon`, `CircleCheckIcon`, `TriangleAlertIcon`, `CircleXIcon`) that Alert introduced.
- Alert and Toast use different dismiss names ("Dismiss" vs "Close"); settle it with the L3 labels pass.
- CI: the first runs on `ubuntu-latest` may expose Linux-only differences from the Windows development
  machine (fonts, `Intl` data, scrollbar widths); cache the Playwright browsers if the install step is slow.
  The canary only runs from the default branch and GitHub pauses scheduled workflows after 60 days of
  repository inactivity.
- ButtonGroup, EmptyState, ThemeProvider / ModeToggle, Link / Typography, the SSR `today` prop and fixture,
  visual regression, a screen-reader session and react-hook-form recipes were deferred out of Phase L.

```

- [ ] **Step 7: Update "Next components".** Edit `docs/backlog.md`, anchor `DataTableColumnsMenu and DataTablePagination, and the Events admin example). Next is Phase L;\ncandidates:\n- a Calendar events view (month and week agenda; deferred from Phase K);\n- the DateRangePicker `onValueChange` contract decision (deferred from Phase K; see the Phase I notes);` and replace it with:

```markdown
DataTableColumnsMenu and DataTablePagination, and the Events admin example). Phase L is done (the
audit fix wave, Spinner, Alert, InputGroup, CI and the Base UI canary). Next is L3, which waits for
owner rulings; candidates:
- L3, the breaking pass: `labels` normalisation (`addedLabel(tags: string[])`, `labels.open` vs
  `openCalendar`, DataTablePagination Previous / Next, Toast Close) and the DateRangePicker
  `onValueChange` contract (deferred from Phase K; see the Phase I notes);
- a Calendar events view (month and week agenda; deferred from Phase K);
```

- [ ] **Step 8: Create the report with every row, before the re-audit.** Create `docs/superpowers/reports/2026-10-14-phase-l-audit-report.md` (the folder is new; the Write tool creates it). The Status column starts as `pending` and is replaced row by row in Step 10:

```markdown
# Phase L audit report (2026-10-14)

Spec: `docs/superpowers/specs/2026-10-14-tessera-phase-l-audit-fixes-and-foundations.md`.
Baseline: `2ac9c54` (spec commit; `npm run check` green). Re-audit: run against the fixed tree, read-only
(no source files edited while auditing).

Status vocabulary: **fixed** (the failing-first test exists and passes on the fixed tree, and fails on the
baseline), **deferred** (not changed in Phase L; the reason names the ruling or phase it waits for),
**rejected** (judged not a defect; the reason says why).

## L1 bug-fix wave (the 20 spec rows)

| ID | Area | Finding | Re-audit command (fixed tree) | Status | Evidence / reason |
|---|---|---|---|---|---|
| L1-01 | Switch | Checked thumb translate did not flip in RTL | `npx vitest run src/components/switch` | pending | |
| L1-02 | NumberField | `border-l` / `border-r` on Increment / Decrement | `npx vitest run src/components/number-field` | pending | |
| L1-03 | Calendar family | Non-Gregorian locales (`fa-IR`, `th-TH`, `ar-SA`, `-u-ca-`) formatted with another calendar | `npx vitest run src/components/calendar src/components/date-field src/components/date-picker src/components/date-range-field` | pending | |
| L1-04 | ColorInput | No-op edit in hsl display fired a change | `npx vitest run src/components/color-picker` | pending | |
| L1-05 | DataTable | Hidden sorted column stayed sorted; `canSort` / `sortRows` rules differed; inline `getRowId` re-sorted | `npx vitest run src/components/data-table src/lib/data-table.test.ts` | pending | |
| L1-06 | Sidebar | Shared `<aside>` id, `aria-controls` target, repeated Ctrl/Cmd+B | `npx vitest run src/components/sidebar` | pending | |
| L1-07 | DateField / TimeField family | Native form `reset` did not restore `defaultValue` | `npx vitest run src/components/date-field src/components/time-field src/components/date-range-field src/components/time-picker src/components/form` | pending | |
| L1-08 | `parseDateString` | Years below 100 accepted; non-padded ISO rejected | `npx vitest run src/lib/date-segments.test.ts` | pending | |
| L1-09 | TimeField step | Steps that are not whole hours or a divisor of 60 min stepped wrongly | `npx vitest run src/lib/time-segments.test.ts src/components/time-field` | pending | |
| L1-10 | `getTimeSlots` | Fractional `slotStep`; seconds in `min` at minute granularity | `npx vitest run src/lib/time.test.ts` | pending | |
| L1-11 | DateRangePicker (button) | Reversed controlled range not flagged or sorted | `npx vitest run src/components/date-picker` | pending | |
| L1-12 | Dialog | Header text overlapped the Close button | `npx vitest run src/components/dialog` | pending | |
| L1-13 | Toast | `border-l-4` and `-mr-1` physical in RTL | `npx vitest run src/components/toast` | pending | |
| L1-14 | Breadcrumb / Accordion | Separator chevron did not flip; trigger `text-left` | `npx vitest run src/components/breadcrumb src/components/accordion` | pending | |
| L1-15 | Meter / Progress | Empty header rendered | `npx vitest run src/components/meter src/components/progress` | pending | |
| L1-16 | Separator | Vertical separator had no height in a block parent | `npx vitest run src/components/separator` | pending | |
| L1-17 | Pagination | Href-less `PaginationLink` not keyboard-operable; `NaN` / fractional range | `npx vitest run src/components/pagination` | pending | |
| L1-18 | OTPField / Rating | `fitGroups` with groups <= 0; read-only Rating ignored `aria-label` | `npx vitest run src/components/otp-field src/components/rating` | pending | |
| L1-19 | `formatFileSize` | Unit chosen before rounding (999 999, 999 950, 1e9 edges) | `npx vitest run src/lib/file.test.ts` | pending | |
| L1-20 | Select | Trigger `text-left` | `npx vitest run src/components/select` | pending | |

## L1 hardening (plausible items from the spec)

| ID | Area | Finding | Re-audit command (fixed tree) | Status | Evidence / reason |
|---|---|---|---|---|---|
| H-1 | `verify-consumer` | CSS needles for Phase J / K classes (`rtl:`, `forced-colors:`, ColorPicker gradients, `data-dragging`) | `npm run build && npm run verify:consumer` | pending | |
| H-2 | package.json / README | `tailwindcss` ^4 declared as a documented peer dependency | `node -p "require('./package.json').peerDependencies.tailwindcss"` and `grep -n "tailwindcss" README.md` | pending | |
| H-3 | Test coverage | `ref` / `className` forwarding (display components), controlled-mode tests (form controls), RTL tests (Input, Textarea, Checkbox, Field, accordion, collapsible, badge, card, meter, progress, skeleton, avatar) | `npx vitest run src/components/input src/components/textarea src/components/checkbox src/components/field src/components/accordion src/components/collapsible src/components/badge src/components/card src/components/meter src/components/progress src/components/skeleton src/components/avatar` | pending | |

## Needs a ruling (deferred by design, recorded in `docs/backlog.md`)

Re-audit for these rows: confirm the behaviour is unchanged from the baseline and that the backlog entry under
"Needs a ruling (Phase L audit)" exists (`grep -n "Needs a ruling" docs/backlog.md`).

| ID | Area | Finding | Status | Evidence / reason |
|---|---|---|---|---|
| R-1 | Resizable | `End` / `Enter` on a collapsible following panel | pending | |
| R-2 | Sidebar | `SidebarMenuButton` `aria-current` on buttons | pending | |
| R-3 | Toast | Reachable by Tab under a modal | pending | |
| R-4 | Command | `Ctrl/Cmd+K` over another modal | pending | |
| R-5 | Command | `CommandEmpty` while an async list loads | pending | |
| R-6 | Drawer | `vh` vs `dvh` | pending | |
| R-7 | Tooltip | `aria-describedby` timing (needs a screen-reader pass) | pending | |
| R-8 | FileUpload / date fields | `validate` call order for `too-many`; two-digit-year pivot beyond rejection | pending | |

## L2 additions and deferred L3 items

| ID | Item | Re-audit command (fixed tree) | Status | Evidence / reason |
|---|---|---|---|---|
| A-1 | Spinner (Button uses it, no DOM change) | `npx vitest run src/components/spinner src/components/button` | pending | |
| A-2 | Alert (and the FieldError live region) | `npx vitest run src/components/alert src/components/field src/lib/live-region.test.ts` | pending | |
| A-3 | InputGroup | `npx vitest run src/components/input-group` | pending | |
| A-4 | CI and the Base UI canary | `ls .github/workflows` and the Task 7 YAML checks; the runner-side behaviour only runs on GitHub | pending | |
| D-1 | `labels` normalisation (`addedLabel`, `labels.open` vs `openCalendar`, DataTablePagination Previous / Next, Toast Close) | L3, awaiting owner rulings | pending | |
| D-2 | DateRangePicker `onValueChange` contract | L3, awaiting owner rulings | pending | |

## Re-audit summary

Counts, new findings, and the reviewer pass are filled in at the end of the re-audit.
```

- [ ] **Step 9: Format check on the docs.** `npm run format` (Biome ignores Markdown, so this must report nothing for the new files), then `git status --short`. Expected: only `README.md`, `docs/backlog.md` and the new report are modified or untracked.
- [ ] **Step 10: Re-audit the L1 rows against the fixed tree (read-only).** Run each row's command from the report, one table section at a time, plus the whole gate once:

```bash
npm run check
```

  Expected: green. For each L1-NN row run its command (for example `npx vitest run src/components/switch`) and confirm `Test Files  N passed`. Then record the result by editing the report: replace `pending` with `fixed` and write the commit hash and test name in the evidence cell, found with `git log --oneline --grep "<area>" 2ac9c54..HEAD` and `grep -rn "<keyword>" <dir>/*.test.tsx`. A row whose test does not exist, or fails, is not `fixed`: stop and report it as a Task 1-5 defect instead of editing the report.
- [ ] **Step 11: Prove the failing-first claim for the L1 rows on the baseline.** Using a throwaway worktree so the main tree stays untouched:

Run this as ONE Bash command (the working directory resets between calls), from the main working tree on the `phase-l` branch. It names the branch tip by commit, not by `main`, because the work lives on `phase-l`:

```bash
TIP=$(git rev-parse HEAD)
git worktree add ../tessera-reaudit 2ac9c54
cd ../tessera-reaudit && npm ci
git checkout "$TIP" -- $(git diff --name-only 2ac9c54 "$TIP" -- 'src/**/*.test.ts' 'src/**/*.test.tsx' 'test/**/*.test.tsx')
npx vitest run 2>&1 | tail -n 40
cd ../tessera && git worktree remove --force ../tessera-reaudit
```

  Expected: failures in the test files of the L1 rows (the new tests run against the old sources and fail), with each L1 area appearing in the failing list; the three L2 component suites fail at import because the components do not exist at the baseline. For each L1 row, write in its evidence cell `fails on baseline: <test name>`. A row with no failing test on the baseline gets `fixed (no failing-first proof)` and is listed in the summary.
- [ ] **Step 12: Re-audit the hardening, ruling and L2 rows.** Run the commands in the H-n and A-n rows. For H-2 expect `^4` (or the range Task 5 chose) printed and a README match. For each R-n row confirm both that the behaviour is unchanged (`git diff 2ac9c54..HEAD --stat -- <source file>` shows no behavioural change for the file the finding names) and that the backlog entry exists; set the status to `deferred` with the reason `needs an owner ruling`. For D-1 and D-2 set `deferred` with the reason `L3 awaits owner rulings`. For A-1 to A-3 set `fixed` with the suite counts; for A-4 set `fixed` with the note `workflow YAML validated locally; runner behaviour verified on first GitHub run`.
- [ ] **Step 13: Record rejected findings, if any.** If the re-audit judges any row not a defect (for example a row whose "bug" turned out to be intended and documented), set it to `rejected` and write the reason and the doc or test that shows the intent. The 20 spec rows were approved by the owner, so a rejection here is an exception that must be called out in the final message.
- [ ] **Step 14: Independent reviewer pass.** Dispatch `oh-my-claudecode:code-reviewer` (not the author of Tasks 1-8) over `git diff 2ac9c54..HEAD`, with the prompt "Review the Phase L diff against the spec at docs/superpowers/specs/2026-10-14-tessera-phase-l-audit-fixes-and-foundations.md: spec fidelity, test-first evidence, RTL and forced-colors coverage, no public prop removed or renamed." Record its findings under "Re-audit summary" in the report. Fix any Critical or High finding in a follow-up commit before Step 15; list the rest in `docs/backlog.md`.
- [ ] **Step 15: Fill the summary and finish the report.** Replace the "Counts, new findings, and the reviewer pass are filled in at the end of the re-audit." line with a real summary: counts of fixed, deferred and rejected rows (must total 20 + 3 + 8 + 6 = 37), any new finding discovered during the re-audit (each with its proposed owner phase), and the reviewer's verdict. Verify the table has no `pending` left: `grep -c "pending" docs/superpowers/reports/2026-10-14-phase-l-audit-report.md`. Expected: `0`.
- [ ] **Step 16: Run the gate one last time.** `npm run format && npm run check && npm run build:storybook`. Expected: green.
- [ ] **Step 17: Commit.**

```bash
git add README.md docs/backlog.md docs/superpowers/reports/2026-10-14-phase-l-audit-report.md
git commit -m "$(cat <<'EOF'
docs: Phase L status, backlog and audit report

README: CI section, Spinner / Alert / InputGroup entries, Phase L
status, roadmap (L3 next). Backlog: resolved items removed, the audit's
"needs a ruling" items and Phase L follow-ups added. The report lists
every audit finding as fixed, deferred or rejected, with the
baseline failing-first proof.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

**Review focus:**
- A report row left `pending`, or marked `fixed` without a passing test: pinned by Step 10 (stop on a missing or failing test) and Step 15's `grep -c "pending"` returning `0`.
- A "failing-first" claim that was never true (a test that passes on the old source): pinned by Step 11's baseline worktree run, which must fail in each L1 area.
- A README or backlog edit that leaves a stale statement ("Next is Phase L", the resolved Button-spinner and FieldError backlog items): pinned by Steps 4, 5 and 7, checked with `grep -n "Next is Phase L" README.md docs/backlog.md` (expected: no output) and `grep -n "FieldError has no live region" docs/backlog.md` (expected: no output).
