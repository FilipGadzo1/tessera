# Tessera Phase H: DateField, Form-ready Pickers and App Shell (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Phase G carry-overs, then add date segment utilities, a typed DateField, real Form/Field participation for all date controls, DatePicker typed entry, a Sidebar app-shell family and a Dashboard example.

**Architecture:** As in Phases B–G: `src/components/<name>/{<name>.tsx, <name>-variants.ts?, <name>.test.tsx, <name>.stories.tsx, index.ts}`. Shared helpers live in `src/lib` (cn, merge-class-name, overlay-classes, tone, tooltip-escape, icons, clone-render, focus-classes, bar-classes, panel-height-classes, use-controllable-state, date; new: date-segments). Tests run in real Chromium with `test/overlay.ts`, `test/emulation.ts` and `test/pointer.ts`.

**Tech Stack:** As before. Base UI stays pinned `~1.8.0`. New internal subpath: `internals/field-register-control`. New public subpath: `unstable-use-media-query` (add to optimizeDeps when first imported). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-30-tessera-phase-h-date-field-and-app-shell.md` (binding), plus design-system-v2 §4 and the earlier phase specs it references.

## Global Constraints

- Repo `C:\Users\Filip\Desktop\projects\tessera`; Windows 11; Node 24; Bash tool. Branch `phase-h`.
- **Ports and processes:**
  - Never start anything on port 8080, and never kill the process there (the owner's Storybook).
  - Smoke tests run only on `-p 6107 --ci --no-open`.
  - Stop only the exact PID you started (`netstat -ano | grep :6107 | grep LISTEN` → `taskkill //PID <pid> //T //F`).
  - Never kill processes by name.
- **Never edit or write repo files with Python, sed -i, or shell redirection into source files.** Use the Edit/Write tools only. A Python text-mode edit corrupted files once.
- Markdown and source edits keep LF line endings.
- Class strings follow the spec. Adapt one only with evidence, and amend the spec in the same commit as an *Amended in Task N* bullet noting why.
- Spread `{...props}` first, then set `data-slot` and className (`mergeClassName`). Every part sets `data-slot`.
- `"use client"` goes on files importing Base UI or using hooks. `src/lib/*` non-hook modules and `*-variants.ts` stay server-safe.
- Interactive controls: `outline-none` + `toggleFocusClasses` + `forced-colors:focus-visible:outline-[Highlight]`. Selected/active Highlight/HighlightText states add `forced-color-adjust-none`. Disabled → `cursor-not-allowed`.
- Shared icons come only from `src/lib/icons.tsx`.
- Exports per component go in `src/index.ts`.
- **Tests:**
  - Use `vitest-browser-react` + `userEvent` from `vitest/browser`.
  - Wait on state (`expect.poll`, `waitForPopupSettled`), never on fixed sleeps. Send one key at a time when focus moves between keys.
  - axe runs violations + incomplete, both `[]`, in light and dark.
  - Forced colors and reduced motion use `test/emulation.ts`.
- Stories: `title: "Components/<Name>"`, `tags: ["autodocs"]`.
- **Commits:**
  - `npm run format && npm run check && npm run build:storybook` must be green at each task end.
  - Commit messages end with a blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Never commit `.omc/`, `.superpowers/`, `dist/`, `storybook-static/`, `.tmp-consumer/`, `*.tgz` or `.vitest/`.

---

### Task 0: Phase G carry-overs
Spec §0.
- [ ] Tests first: a composing Enter is ignored; closing the promo panel during pending keeps the one-shot (focus lands on the promo input after a rejected result); Enter-to-Apply during pending is ignored.
- [ ] Implement, including the bar-classes `translate`. Update the backlog. Run the gate. Commit `fix: Phase G carry-overs`.

### Task 1: date segment utilities and DateField
Spec §1, §2.
- [ ] Write the `date-segments.ts` table-driven tests first (locales, digit typing, bounds, wrap, the valid/invalid date assembly).
- [ ] Write the DateField tests. Cover typing, auto-advance, arrows, Home/End/PageUp/PageDown, Backspace, the literal key, paste, RTL, locales, min/max/isDateDisabled invalid, controlled/uncontrolled, the onValueChange contract, in Field, spinbutton ARIA, sizes, forced colors, and axe in light/dark.
- [ ] Implement. Add the stories (§6), exports and README. Run the gate. Commit `feat(date-field): DateField`. Form participation comes in Task 2; `name` may be a no-op until then, with a TODO test skipped only if needed, and removed in Task 2.

### Task 2: Form participation for the date controls
Spec §3 and the Field-participation ruling.
- [ ] Tests first. Replace form.test.tsx's "documents current behaviour" test. Cover required, `validate`, errors by name, onFormSubmit values, focus-first-invalid on the visible control, and native FormData, each for DateField, DatePicker and DateRangePicker.
- [ ] Implement the shared DateFormControl, mirroring SelectRoot's recipe. Update the backlog and the README. Run the gate. Commit `feat(date-picker): Form and Field participation`.

### Task 3: DatePicker typed entry
Spec §4.
- [ ] Tests, the Editable story, the implementation, the README, and a visual check on 6107. Run the gate. Commit `feat(date-picker): editable typed entry`.

### Task 4: Sidebar
Spec §5.
- [ ] Tests per spec §5.
- [ ] Implement. Add the stories, exports and README. Do a visual check on 6107: expanded, icon, floating/inset, mobile drawer, forced colors, light/dark. Run the gate. Commit `feat(sidebar): Sidebar app shell`.

### Task 5: Dashboard example and docs
Spec §6. Files: `src/docs/examples/dashboard-page.{tsx,test.tsx,stories.tsx}`. Keep the page file under ~400 lines using local sub-components.
- [ ] Test the keyboard flow: Ctrl+B collapses to icons and the nav keeps its names (tooltips); navigate to Orders (`aria-current`); open the workspace Menu; type a date in the editable DatePicker, then submit the filter Form (values contain the ISO date); at a mobile viewport the trigger opens the Drawer and Escape returns focus; axe light/dark, expanded and collapsed.
- [ ] Implement. Update the README (Phase H complete; roadmap next is Phase I), the backlog and the intro. Run the gate. Do a visual check on 6107 (`dashboard-*.png`: light, dark, icon-collapsed, mobile drawer open, forced colors, 390px), then stop only your PID. Commit `docs(examples): dashboard composing the app shell`.
