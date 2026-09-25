# Tessera Phase F — Dates, Toolbars and Surfaces — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract shared icons and render cloning, then add Meter, ScrollArea, Toggle/ToggleGroup, Toolbar, PreviewCard, ContextMenu, Calendar/RangeCalendar, DatePicker/DateRangePicker and an Editor example — on Base UI where a primitive exists, hand-built (no date library) for the calendar.

**Architecture:** Same as Phases B–E: `src/components/<name>/{<name>.tsx, <name>-variants.ts?, <name>.test.tsx, <name>.stories.tsx, index.ts}`; overlay parts reuse `src/lib/overlay-classes.ts`; className via `src/lib/merge-class-name.ts`; overlay roots wrap `onOpenChange` with `useLayeredEscape`; tests in real Chromium with `test/overlay.ts` / `test/emulation.ts` helpers. New internal libs: `src/lib/icons.tsx`, `src/lib/clone-render.ts`, `src/lib/date.ts`.

**Tech Stack:** as before. New Base UI subpaths: `meter, scroll-area, toggle, toggle-group, toolbar, preview-card, context-menu` (add each to `vitest.config.ts` optimizeDeps when first imported). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-25-tessera-phase-f-dates-toolbars-surfaces.md` (binding) + Phase E spec §0/§3 + Phase D (layered Escape) + Phase C (overlay pattern) + Phase B §3 + v2 §4.

## Global Constraints

- Repo `C:\Users\Filip\Desktop\projects\tessera`; Windows 11; Node 24; Bash tool. Branch `phase-f`.
- **Never start anything on port 8080 and never kill the process there (the user's own Storybook).** Smoke tests only on `-p 6107 --ci --no-open`, stopped afterwards (verify port free).
- Markdown/source edits keep LF; don't write files through Python text mode.
- Class strings as the Phase F spec; adapt only with evidence (amend the spec in the same commit as an *Amended in Task N* bullet, noting why).
- `{...props}` first, then `data-slot`/className (`mergeClassName`). Every part sets `data-slot`.
- `"use client"` on files importing Base UI or using hooks; `src/lib/icons.tsx`, `clone-render.ts`, `date.ts` and `*-variants.ts` are server-safe (no directive).
- Interactive controls `outline-none` + toggle focus pattern; surfaces `outline-hidden`.
- Exports per component in `src/index.ts`: components + `*Props` types (+ `xVariants`/`XVariantProps`/`xDefaults` where cva is used). Internal libs are not exported.
- Tests: `vitest-browser-react` + `userEvent` from `vitest/browser`; portalled parts via `document.body`; `waitForPopupSettled` not sleeps; axe via `auditOpenOverlay` for overlays or `axe.run(container)`; violations + incomplete both `[]`; light + dark; forced colors / reduced motion via `test/emulation.ts`. Tests that depend on "today" freeze it (pass explicit `defaultMonth` / use `vi.setSystemTime` only if it works in browser mode — verify; otherwise inject a `today` via an internal prop or compute expectations from `new Date()`).
- Stories: `title: "Components/<Name>"`, `tags: ["autodocs"]`, realistic content.
- `npm run format && npm run check && npm run build:storybook` green at each task end. Commits end with blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `.omc/`, `.superpowers/`, `dist/`, `storybook-static/`, `.tmp-consumer/`, `*.tgz`, `.vitest/`.
- Implementers read `node_modules/@base-ui/react/<part>/**/*.d.ts` (and `.js` for behaviour, `docs/react/components/<part>.md` if present) first.

---

### Task 0: Shared icons and render cloning
Spec §0.
- [ ] Unit tests for `icons.tsx` (aria-hidden, viewBox, className) and `clone-render.ts` (props merge, data-slot kept, className merged with later utilities winning).
- [ ] Replace every copied icon and both clone implementations; existing suites green unchanged; backlog items removed; gate; commit `refactor: shared icons and render cloning`.

### Task 1: Meter and ScrollArea
Spec §2 Meter / ScrollArea + §4.
- [ ] Tests per spec §4.
- [ ] Implement (Progress/Meter shared class strings); stories (Meter: Default, Colors, Sizes, Formatted value, Password strength; ScrollArea: Vertical list, Horizontal gallery, Both, In Card); exports; README; gate; commit `feat: Meter and ScrollArea`.

### Task 2: Toggle, ToggleGroup and Toolbar
Spec §2 Toggle / ToggleGroup / Toolbar + §4.
- [ ] Tests per spec §4 (incl. the nested ToggleGroup roving-focus test and Menu trigger inside Toolbar).
- [ ] Implement; stories (Toggle: Default, Outline, Sizes, Icon with label, Disabled; ToggleGroup: Single, Multiple, Outline attached, Vertical; Toolbar: Text formatting, With input and link, Vertical); exports; README; gate; commit `feat: Toggle, ToggleGroup and Toolbar`.

### Task 3: PreviewCard and ContextMenu
Spec §2 PreviewCard / ContextMenu + §4.
- [ ] Tests per spec §4 (incl. Menu item reuse inside ContextMenu, pointer position, keyboard opening as supported).
- [ ] Implement; stories (PreviewCard: User link, Link preview, In text; ContextMenu: Basic, With checkbox/radio items, With submenu, Danger item); exports; README; gate; commit `feat: PreviewCard and ContextMenu`.

### Task 4: Date utilities and Calendar
Spec §3 date.ts / Calendar / RangeCalendar + §4.
- [ ] `date.ts` table-driven tests first (DST, leap years, week starts, grid always 6 weeks, ISO round trip).
- [ ] Calendar tests per spec §4 (full APG key table, min/max, disabled days, roving tabindex, live caption, RTL, locales, range selection and preview, two months, forced colors, axe light/dark).
- [ ] Implement; stories per spec §5; exports; README; gate; commit `feat(calendar): Calendar and RangeCalendar`.

### Task 5: DatePicker and DateRangePicker
Spec §3 DatePicker / DateRangePicker + §4.
- [ ] Tests per spec §4.
- [ ] Implement on Tessera Popover + Calendar; stories per spec §5; exports; README; gate; commit `feat(date-picker): DatePicker and DateRangePicker`.

### Task 6: Editor example + docs
Spec §5. Files `src/docs/examples/editor-page.{tsx,test.tsx,stories.tsx}`; README, backlog, intro mdx.
- [ ] Test: keyboard-only flow — Tab into the toolbar, toggle Bold with Space (`aria-pressed`), arrow to alignment and pick Center, open Insert menu; open the editor's context menu (pointer), pick Format → a submenu item; hover/focus the author link to open the PreviewCard; pick a Publish date with the keyboard (open, arrow, Enter → trigger text); pick an embargo range; the Meter's value text; axe light/dark with and without an overlay open.
- [ ] Implement; README (Phase F complete; roadmap next Phase G per spec §5); backlog; intro; gate; visual check on 6107 (screenshots `editor-*.png` light/dark, calendar open, forced colors) → stop server; commit `docs(examples): editor page composing Phase F components`.

### Task 7: Owner follow-ups — Tooltip theme tokens, palette tooltips, week-start data
Spec §6.1 and §6.3.
- [ ] Tests first: tooltip computed colours per theme × surface palette + contrast ≥ 4.5:1 (RED in dark: near-white); corrected region table rows (RED for SA/YE/AE/MA/TN).
- [ ] Implement tokens (`--tooltip*` + Tailwind colour exposure, generator contrast gate if it owns theme.css), TooltipContent classes, palette tiles on Tessera Tooltip, date.ts region sets; README/theme docs mention the tokens; gate; commits `fix(tooltip): theme-following tooltip tokens`, `docs(palettes): tile tooltips`, `fix(date): CLDR region week starts`.

### Task 8: Calendar month and year views
Spec §6.2.
- [ ] Tests per §6.2 (views by click/keyboard, focus clamping, paging, min/max, Escape steps back inside an open DatePicker, RTL, two-month range pane, forced colors, axe per view light/dark, stable footprint).
- [ ] Implement in CalendarBase (views state, caption buttons, month/year grids, labels), keep calendar-base.tsx focused (split views into calendar-views.tsx if large); stories "Month and year views" + DatePicker "Birthday"; README; backlog (remove the dropdowns item); gate; visual check on 6107 (screenshots of each view, light/dark, inside an open DatePicker) → stop server; commit `feat(calendar): month and year views`.
