# Tessera Phase D — Navigation & Feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the Tooltip Escape carry-over, then add Separator, Avatar, Progress, Tabs, Accordion, Select and Toast, plus a Settings example — all on Base UI with the established Tessera patterns and full keyboard/a11y tests.

**Architecture:** Same as Phases B–C: `src/components/<name>/{<name>.tsx, <name>-variants.ts?, <name>.test.tsx, <name>.stories.tsx, index.ts}`; overlay parts reuse `src/lib/overlay-classes.ts`; className/style via `src/lib/merge-class-name.ts`; tests in real Chromium with `test/overlay.ts` helpers.

**Tech Stack:** as before. Base UI subpaths: `tabs, select, accordion, toast, avatar, progress` (add each to `vitest.config.ts` optimizeDeps when first imported; `separator` not needed — plain markup).

**Spec:** `docs/superpowers/specs/2026-09-24-tessera-phase-d-navigation-feedback.md` (binding) + Phase C spec (overlay pattern) + Phase B §3 + v2 §4.

## Global Constraints

- Repo `C:\Users\Filip\Desktop\projects\tessera`; Windows 11; Node 24; Bash tool. Work on the branch the controller names.
- **Never start anything on port 8080 and never kill the process there (the user's own Storybook).** Smoke tests only on `-p 6107 --ci --no-open`, stopped afterwards (verify port free).
- Markdown/source edits keep LF (repo has `.gitattributes eol=lf`); don't write files through Python text mode.
- Class strings exactly as the Phase D spec; adapt only with evidence (and amend the spec in the same commit, noting why).
- `{...props}` first, then `data-slot`/className (`mergeClassName`). Every part sets `data-slot` (`<component>` / `<component>-<part>` kebab-case).
- `"use client"` on files importing Base UI; Separator and AvatarGroup are server-safe (no directive) — verify-consumer checks parity.
- Exports per component in `src/index.ts`: components + `*Props` types (+ `xVariants`/`XVariantProps`/`xDefaults` where cva is used).
- Tests: `vitest-browser-react` + `userEvent` from `vitest/browser`; portalled parts queried via `document.body`; `waitForPopupSettled` instead of sleeps; axe via `auditOpenOverlay` for overlays or `axe.run(container)` otherwise; violations + incomplete both `[]`; light + dark (html `.dark` with cleanup in `finally`/afterEach).
- Stories: `title: "Components/<Name>"`, `tags: ["autodocs"]`, realistic content, triggers composed with Tessera `Button`.
- `npm run format && npm run check && npm run build:storybook` green at each task end. Commits end with blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `.omc/`, `.superpowers/`, `dist/`, `storybook-static/`, `.tmp-consumer/`, `*.tgz`, `.vitest/`.
- Plan style: contracts + mandatory tests (spec §3); implementers read `node_modules/@base-ui/react/<part>/**/*.d.ts` (and `.js` for behavior) first.

---

### Task 0: Tooltip Escape carry-over
Spec §0. Files: `src/components/tooltip/*`, `src/components/{dialog,alert-dialog,popover,menu}/*.tsx` (roots' onOpenChange), `README.md`, `docs/backlog.md`, Phase C spec §2 note.
- [ ] Tests first (some exist in `src/components/dialog/dialog-nested.test.tsx`): Escape with hover tooltip open inside Dialog / Popover / Menu closes only the tooltip; second Escape closes the outer overlay; a `document.addEventListener("keydown")` app listener receives the first Escape (new requirement — RED against current impl); tooltip onOpenChange reason is `"escape-key"`.
- [ ] Implement the registry + `eventDetails.cancel()` approach (spec §0). If it can't satisfy all tests, keep the best-passing approach and document exactly which trade-off remains (README + backlog + spec).
- [ ] Gate; commit `fix(tooltip): layered Escape without swallowing the event`.

### Task 1: Separator, Avatar (+Group), Progress
Spec §1 rows + §3. Keyframes `tsr-indeterminate` in `src/styles/theme.css` (outside color layers; `@keyframes` inside `@theme` if Tailwind v4 requires for `animate-[…]` — verify generation).
- [ ] Tests per spec §3 (Separator role matrix; Avatar image/fallback/delay with a tiny data-URI PNG and a broken URL; Progress determinate/indeterminate ARIA, width, label naming, tone color class, sizes).
- [ ] Implement; stories (Separator in a toolbar + vertical; Avatar sizes, fallback, group; Progress values, indeterminate, colors, with label/value); exports; README; gate; commit `feat: Separator, Avatar and Progress`.

### Task 2: Tabs
Spec §2 Tabs + §3. Variants in `tabs-variants.ts`.
- [ ] Tests per spec §3 Tabs (keyboard incl. Home/End/loop, manual vs activateOnFocus, ARIA wiring, disabled skipped, indicator geometry within 1px after settle, vertical, segmented variant active styles, focus ring on tab and panel, axe light/dark).
- [ ] Implement; stories (Underline, Segmented, Vertical, WithIcons+Badge counts, Disabled); exports; README; gate; commit `feat(tabs): Tabs with underline and segmented variants`.

### Task 3: Accordion
Spec §2 Accordion + §3.
- [ ] Tests per spec §3 Accordion (keyboard toggles, single vs multiple, height animation settles to content height and back to 0, hiddenUntilFound attribute, heading level prop, focus ring, disabled item, axe light/dark).
- [ ] Implement; stories (FAQ, Multiple, Disabled item, HiddenUntilFound); exports; README; gate; commit `feat(accordion): Accordion`.

### Task 4: Select
Spec §2 Select + §3. Reuse `textFieldBase` + input sizes for the trigger (import from input-variants), `popupSurface`, `popupMotion`, `menuItemBase`.
- [ ] Tests per spec §3 Select (open via click/keyboard, typeahead, select + close + focus return, aria-selected + indicator, disabled item, multiple, Field label/invalid, placeholder color, inside Dialog Escape layering, FormData, z 50, portal, container scope, axe open light/dark).
- [ ] Implement; stories (Default, WithGroups, Multiple, InField (invalid + description), Sizes next to Input/Button, InDialog); exports; README; gate; commit `feat(select): Select`.

### Task 5: Toast
Spec §2 Toast + §3. Token `--z-toast: 70` in theme.css + verify-consumer needle.
- [ ] Tests per spec §3 Toast (add/show/live region, close, timeout auto-dismiss with short timeout, timeout 0 persists, action onClick, limit → data-limited, type → tone/icon, priority behavior verified against Base UI, createToaster outside React, z 70, axe light/dark).
- [ ] Implement; stories (Types, WithAction, Promise (loading→success), Positions, Stacked); exports; README; gate; commit `feat(toast): Toaster and useToast`.

### Task 6: Settings example + docs
Spec §4. Files `src/docs/examples/settings-page.{tsx,test.tsx,stories.tsx}`; README, backlog, intro mdx.
- [ ] Test: keyboard-only flow — Tab to tabs, ArrowRight to Notifications, expand an accordion channel, toggle a Switch, open the language Select and choose a value, Save → success toast appears with the title "Settings saved"; axe light/dark on each tab panel.
- [ ] Implement; README (Phase D complete; roadmap next: Phase E candidates — Combobox, Slider, NumberField, DatePicker, Table, Breadcrumb, Pagination, Skeleton, Sheet/Drawer); backlog; intro; gate; visual check on 6107 (screenshots `settings-*.png` light/dark per tab + toast) → stop server; commit `docs(examples): settings page composing Phase D components`.
