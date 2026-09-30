# Tessera Phase I: Typed Ranges, Command, Tree and Carousel (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Phase H carry-overs, then add DateRangeField, an editable DateRangePicker, Command, Tree, Carousel and a Files example.

**Architecture:** The same layout as Phases B–H: `src/components/<name>/{<name>.tsx, <name>-variants.ts?, <name>.test.tsx, <name>.stories.tsx, index.ts}`. Shared helpers live in `src/lib`. Tests run in real Chromium with the helpers in `test/overlay.ts`, `test/emulation.ts` and `test/pointer.ts`.

**Tech stack:** Unchanged. Base UI stays pinned `~1.8.0`, and there are no new dependencies. Tree and Carousel are hand-built.

**Spec:** `docs/superpowers/specs/2026-10-01-tessera-phase-i-ranges-command-tree-carousel.md` is binding. It builds on design-system-v2 §4 and the earlier phase specs it references.

## Global Constraints

- **Environment:** repo `C:\Users\Filip\Desktop\projects\tessera`, Windows 11, Node 24, the Bash tool. Branch `phase-i`.
- **Ports and processes:**
  - Never start anything on 8080, and never kill the process there.
  - Smoke-test only on `-p 6107 --ci --no-open`.
  - Stop only the exact PID you started (`netstat -ano | grep :6107 | grep LISTEN` → `taskkill //PID <pid> //T //F`).
  - Never kill processes by name.
- **Editing files:**
  - Edit or create files ONLY with the Edit/Write tools, including throwaway debug files. Never use Python, `sed -i`, heredocs, or shell redirection into repo files.
  - Keep LF line endings.
- **Spec fidelity:** use the class strings from the spec. Adapt only with evidence, and amend the spec in the same commit as an *Amended in Task N* bullet.
- **Component code:**
  - Spread `{...props}` first, then `data-slot`/className (`mergeClassName`). Every part sets `data-slot`.
  - `"use client"` goes on files that import Base UI or use hooks. `src/lib/*` non-hook modules and `*-variants.ts` stay server-safe.
  - Interactive controls: `outline-none` + `toggleFocusClasses` + `forced-colors:focus-visible:outline-[Highlight]`. Selected/active Highlight/HighlightText + `forced-color-adjust-none`. Disabled → `cursor-not-allowed`.
  - Import shared icons only from `src/lib/icons.tsx`. Merge refs only with `src/lib/merge-refs.ts` (from Task 0).
  - Export each component from `src/index.ts`.
- **Tests:**
  - Use `vitest-browser-react` + `userEvent` from `vitest/browser`.
  - Wait on state, never on time. Send one key at a time when focus moves. Use injectable timers for autoplay or timeouts.
  - Run axe with violations and incomplete both `[]`, in light and dark. Emulate forced colors and reduced motion with `test/emulation.ts`.
- **Stories:** `title: "Components/<Name>"`, `tags: ["autodocs"]`. Alignment-check stories label their reference controls as references.
- **Gate:** `npm run format && npm run check && npm run build:storybook` must be green at the end of each task.
- **Commits:** end every message with a blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `.omc/`, `.superpowers/`, `dist/`, `storybook-static/`, `.tmp-consumer/`, `*.tgz` or `.vitest/`.

---

### Task 0: Phase H carry-overs
Spec §0.
- [ ] Tests first (RED):
  - default-button helper cases;
  - mergeRefs with a cleanup;
  - Drawer RTL close button and `start`/`end`;
  - Sidebar per-sidebar static state and `useSidebar` state;
  - DateField and editable picker RTL geometry.
- [ ] Implement:
  - replace the ad-hoc ref merges;
  - drop the Sidebar's Drawer workarounds;
  - update the backlog.
  Run the gate. Commits: `fix(date-field): HTML default submit button`, `refactor: shared mergeRefs with cleanup`, `fix(drawer): logical RTL`, `fix(sidebar): per-sidebar static state`, `test: RTL geometry for date fields`.

### Task 1: DateRangeField and the editable DateRangePicker
Spec §1.
- [ ] Tests per spec §1: segments across both halves, boundary arrows, RTL, auto-advance into the end half, paste formats, reversed-range invalid, the onValueChange contract, Form participation (one control, `{start,end}`, Enter submit, IME guard, blur scope), sizes aligned with Input, forced colors, axe light and dark. For the editable picker: typing updates the calendar, picking fills and returns focus.
- [ ] Implement. Share the segment internals with DateField (extract if needed, with no DateField behaviour change). Stories, exports, README. Visual check on 6107. Run the gate. Commits: `feat(date-range-field): DateRangeField`, `feat(date-picker): editable DateRangePicker`.

### Task 2: Command
Spec §2.
- [ ] Tests per spec §2.
- [ ] Implement on Base UI Autocomplete. Add CommandDialog on Tessera Dialog. Point the Autocomplete palette story at Command. Stories, exports, README. Visual check (inline, dialog light and dark, forced colors). Run the gate. Commit `feat(command): Command palette`.

### Task 3: Tree
Spec §3.
- [ ] Tests per spec §3 (the full APG key table).
- [ ] Implement. Stories, exports, README. Visual check (file tree light and dark, multi-select, forced colors, RTL). Run the gate. Commit `feat(tree): Tree`.

### Task 4: Carousel
Spec §4.
- [ ] Tests per spec §4 (with an injectable autoplay timer).
- [ ] Implement with scroll-snap. Stories, exports, README. Visual check (basic, multi per view, vertical, autoplay controls, forced colors, 390px). Run the gate. Commit `feat(carousel): Carousel`.

### Task 5: Files example and docs
Spec §5. Files: `src/docs/examples/files-page.{tsx,test.tsx,stories.tsx}`. Keep the page under ~450 lines by using local sub-components.
- [ ] Test the keyboard flow:
  - Tab into the Tree; arrows and → expand a folder; Enter opens it, so the inset heading and Table change.
  - ⌘K opens Command; "Go to folder…" plus typing plus Enter navigates.
  - The image preview Carousel moves on Next, with correct `aria-label`s.
  - Type a Modified range in the editable DateRangePicker and submit the filter Form; the values contain `{start, end}`.
  - axe in light and dark, with and without an overlay open.
- [ ] Implement. Update the README (Phase I complete; roadmap next Phase J), the backlog and the intro. Run the gate. Visual check on 6107 (`files-*.png`: light, dark, command open, carousel, mobile drawer, forced colors, 390px). Stop only your own PID. Commit `docs(examples): files page composing Phase I components`.
