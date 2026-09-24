# Tessera Phase E — Data Entry & Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix forced-colors focus visibility library-wide, then add Skeleton, Breadcrumb, Pagination, Table, Slider, NumberField, Combobox and Drawer, plus an Orders example — on Base UI where a primitive exists, with the established Tessera patterns and full keyboard/a11y tests.

**Architecture:** Same as Phases B–D: `src/components/<name>/{<name>.tsx, <name>-variants.ts?, <name>.test.tsx, <name>.stories.tsx, index.ts}`; overlay parts reuse `src/lib/overlay-classes.ts`; className/style via `src/lib/merge-class-name.ts`; overlay roots wrap `onOpenChange` with `useLayeredEscape` (`src/lib/tooltip-escape.ts`); tests in real Chromium with `test/overlay.ts` helpers.

**Tech Stack:** as before. New Base UI subpaths: `slider, number-field, combobox, drawer` (add each to `vitest.config.ts` optimizeDeps when first imported). Skeleton, Breadcrumb, Pagination, Table are plain markup and server-safe.

**Spec:** `docs/superpowers/specs/2026-09-24-tessera-phase-e-data-entry-display.md` (binding) + Phase D spec (layered Escape) + Phase C spec (overlay pattern) + Phase B §3 + v2 §4.

## Global Constraints

- Repo `C:\Users\Filip\Desktop\projects\tessera`; Windows 11; Node 24; Bash tool. Branch `phase-e`.
- **Never start anything on port 8080 and never kill the process there (the user's own Storybook).** Smoke tests only on `-p 6107 --ci --no-open`, stopped afterwards (verify port free).
- Markdown/source edits keep LF (repo has `.gitattributes eol=lf`); don't write files through Python text mode.
- Class strings exactly as the Phase E spec; adapt only with evidence (and amend the spec in the same commit, noting why, as an *Amended in Task N* bullet).
- `{...props}` first, then `data-slot`/className (`mergeClassName`). Every part sets `data-slot` (`<component>` / `<component>-<part>` kebab-case).
- `"use client"` on files importing Base UI or using hooks; Skeleton, Breadcrumb, Pagination, Table have no directive — verify-consumer checks server-safe parity (add them to its server-safe list).
- Interactive controls use `outline-none` (not `outline-hidden`) after Task 0; surfaces keep `outline-hidden` (spec §0).
- Exports per component in `src/index.ts`: components + `*Props` types (+ `xVariants`/`XVariantProps`/`xDefaults` where cva is used).
- Tests: `vitest-browser-react` + `userEvent` from `vitest/browser`; portalled parts queried via `document.body`; `waitForPopupSettled` instead of sleeps; axe via `auditOpenOverlay` for overlays or `axe.run(container)` otherwise; violations + incomplete both `[]`; light + dark (html `.dark` with cleanup in `finally`/afterEach). Forced colors / reduced motion via CDP emulation helpers in `test/`.
- Stories: `title: "Components/<Name>"`, `tags: ["autodocs"]`, realistic content, triggers composed with Tessera `Button`.
- `npm run format && npm run check && npm run build:storybook` green at each task end. Commits end with blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `.omc/`, `.superpowers/`, `dist/`, `storybook-static/`, `.tmp-consumer/`, `*.tgz`, `.vitest/`.
- Plan style: contracts + mandatory tests (spec §3); implementers read `node_modules/@base-ui/react/<part>/**/*.d.ts` (and `.js` for behavior) first.

---

### Task 0: Forced-colors focus visibility
Spec §0. Files: every `outline-hidden` use in `src/components/**` and `src/lib/overlay-classes.ts`; `test/` (new `emulateForcedColors` helper, reusing/extracting whatever Progress/Tabs tests already do); the Phase D Progress/Tabs forced-colors tests may move onto the helper; design-system-v2 §4; backlog (remove the resolved item); README if it states the old rule.
- [ ] Tests first (RED against current code): per control family (Button, Checkbox, Switch, Radio, Tabs tab + panel, both tab variants, Accordion trigger, Input, Textarea, Select trigger, Menu item, Select item) — in forced colors, unfocused computed `outline-style` is `none`; Tab-focused is `solid` with width ≥ 1px. Segmented active tab hovered in forced colors has `HighlightText` text colour. Toast root focus is distinguishable in forced colors.
- [ ] Implement per spec §0; normal-mode focus tests unchanged and green.
- [ ] Gate; commit `fix(a11y): visible focus in forced-colors mode`.

### Task 1: Skeleton, Breadcrumb, Pagination
Spec §1–§3 rows. Server-safe; add to verify-consumer's server-safe checks.
- [ ] Tests per spec §3 (Skeleton aria-hidden + reduced motion; Breadcrumb landmark/structure/current/separators/focus; `getPaginationRange` table cases + Pagination ARIA/disabled ends/names/ellipsis/focus; axe light/dark).
- [ ] Implement; stories (Skeleton card/list/avatar shapes; Breadcrumb basic, with ellipsis in a Menu, custom separator; Pagination controlled story with state in the story, many pages); exports; README; gate; commit `feat: Skeleton, Breadcrumb and Pagination`.

### Task 2: Table
Spec §2 Table + §3.
- [ ] Tests per spec §3 Table.
- [ ] Implement; stories (Basic with caption + footer, Sortable (state in the story), Selectable rows with Checkbox, Wide table scrolling, Empty state); exports; README; gate; commit `feat(table): Table`.

### Task 3: Slider
Spec §2 Slider + §3.
- [ ] Tests per spec §3 Slider (+ focus ring on the thumb, forced colors, reduced motion if any transition, axe light/dark).
- [ ] Implement; stories (Default with label/value, Range, Colors, Sizes, Step marks via value formatting, Disabled, InField, Vertical); exports; README; gate; commit `feat(slider): Slider`.

### Task 4: NumberField
Spec §2 NumberField + §3.
- [ ] Tests per spec §3 NumberField (+ sizes line up with Input heights, axe light/dark).
- [ ] Implement; stories (Default, Currency format, Min/Max/Step, Sizes next to Input, InField invalid, ScrubArea label, Disabled/ReadOnly); exports; README; gate; commit `feat(number-field): NumberField`.

### Task 5: Combobox
Spec §2 Combobox + §3. Reuse `textFieldBase`/`textFieldSizes`, `popupSurface`, `popupMotion`, `menuItemBase`, `useLayeredEscape`.
- [ ] Tests per spec §3 Combobox (+ z 50, portal, `container` scope, axe open light/dark).
- [ ] Implement; stories (Default, Objects with labels, Groups, Multiple with chips, Async with status, InField, InDialog); exports; README; gate; commit `feat(combobox): Combobox`.

### Task 6: Drawer
Spec §2 Drawer + §3. Reuse `backdropMotion`, Dialog's close-button pattern, `useLayeredEscape`.
- [ ] Tests per spec §3 Drawer (+ z 50, `container`, axe open light/dark, nested Dialog inside a Drawer layered Escape).
- [ ] Implement; stories (Right with form, Left navigation, Bottom sheet with handle, Top, Nested dialog); exports; README; gate; commit `feat(drawer): Drawer`.

### Task 7: Orders example + docs
Spec §4. Files `src/docs/examples/orders-page.{tsx,test.tsx,stories.tsx}`; README, backlog, intro mdx.
- [ ] Test: keyboard-only flow — filter by customer via Combobox, sort by Total (aria-sort flips), go to page 2 via Pagination, open a row's Drawer, change quantity with NumberField ArrowUp, close with Escape (focus returns to the row's View button); loading state renders Skeletons and `aria-busy` on the table region; axe light/dark with the drawer open and closed.
- [ ] Implement; README (Phase E complete; roadmap next Phase F per spec §4); backlog; intro; gate; visual check on 6107 (screenshots `orders-*.png` light/dark, drawer open, forced colors) → stop server; commit `docs(examples): orders page composing Phase E components`.
