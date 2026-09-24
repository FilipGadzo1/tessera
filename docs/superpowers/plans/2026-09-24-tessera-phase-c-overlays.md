# Tessera Phase C — Overlays — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tooltip, Popover, Dialog, AlertDialog and Menu as styled Base UI wrappers with portal/theming/z-index foundations, fully keyboard- and screen-reader-tested, plus a composed example.

**Architecture:** Per overlay one folder `src/components/<name>/` with `<name>.tsx` (`"use client"`; pass-through Root/Trigger/Close, a `*Content` that wraps Portal→Positioner→Popup, styled text parts), tests, stories, barrel. Shared popup class strings live in `src/lib/overlay-classes.ts` (server-safe constants). Z-index tokens in `src/styles/theme.css`.

**Tech Stack:** as before; Base UI `@base-ui/react/{tooltip,popover,dialog,alert-dialog,menu}` (tooltip/popover/dialog/menu already in vitest optimizeDeps; add `alert-dialog`).

**Spec:** `docs/superpowers/specs/2026-09-24-tessera-phase-c-overlays.md` (binding) + Phase B §3 composition rule + design-system-v2 §4.

## Global Constraints

- Repo `C:\Users\Filip\Desktop\projects\tessera`; Windows 11; Node 24; Bash tool. Work on the branch the controller names.
- **Never start anything on port 8080 and never kill the process there (the user's own Storybook).** Smoke tests use `npx storybook dev -p 6107 --ci --no-open`, stopped afterwards (verify with PowerShell `Get-NetTCPConnection -LocalPort 6107`).
- Class strings exactly as spec §2–§3; adapt only with evidence.
- Triggers/Close/Root are pass-through with NO base classes (composition rule). `*Content` props split: positioning props → Positioner, `container` → Portal, rest → Popup.
- Use `mergeClassName` / `mergeStyle` from `src/lib/merge-class-name.ts` for className/style state functions (no hand-rolled copies).
- `{...props}` first, then `data-slot` and className. Every part sets its `data-slot` (spec §3).
- `"use client"` on every file importing Base UI; pure-markup parts (e.g. `MenuShortcut`, `DialogHeader`, `DialogFooter`) may live in the same client file — that's fine; if you split them into a server-safe file, verify-consumer checks parity.
- Tests: real Chromium via `vitest-browser-react`; `userEvent` from `vitest/browser`; popups are portalled → query with `page`/`document` (e.g. `screen.baseElement` or `document.body`) not the render container. Tooltip tests pass `delay={0}` (and `closeDelay={0}`). Wait for open/close with `expect.poll`/`expect.element(...)` (Base UI animates; data-starting-style/ending-style). Axe on the open overlay (`axe.run(document.body)` scoped as needed), violations + incomplete both `[]`, light and dark (dark: `document.documentElement.classList.add("dark")` inside the test, removed in `finally`/afterEach).
- Each test file cleans up anything it adds to `<html>`/`<body>`.
- Stories: `title: "Components/<Name>"`, `tags: ["autodocs"]`; overlays shown open-able via real triggers composed with Tessera `Button`.
- `npm run format && npm run check && npm run build:storybook` green at each task end. Commits end with blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `.omc/`, `.superpowers/`, `dist/`, `storybook-static/`, `.tmp-consumer/`, `*.tgz`, `.vitest/`.
- Plan style (ruling carried from Phase B): contracts + mandatory tests; implementers read `node_modules/@base-ui/react/<part>/**/*.d.ts` first.

---

### Task 1: Overlay foundations + Tooltip

**Files:** create `src/lib/overlay-classes.ts` (+ `overlay-classes.test.ts`), `src/components/tooltip/{tooltip.tsx,tooltip.test.tsx,tooltip.stories.tsx,index.ts}`; modify `src/styles/theme.css` (z tokens), `vitest.config.ts` (add `@base-ui/react/alert-dialog`), `src/index.ts`, README.

**Interfaces:** `overlay-classes.ts` exports `popupMotion` (anchored, spec §2), `dialogMotion` (no origin), `backdropMotion`, `popupSurface` (spec §3 surface base), `menuItemBase` (spec §3 item string) as `string` constants. Theme: `:root { --z-overlay: 50; --z-tooltip: 60; }` outside color layers + `@theme inline { --z-index-overlay: var(--z-overlay); --z-index-tooltip: var(--z-tooltip); }` only if Tailwind v4 needs it for `z-(--z-overlay)` — verify which form generates `z-index: var(--z-overlay)` and use that. Tooltip exports: `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent` (`side` default "top", `align`, `sideOffset` default 6, `container`, …Popup props), Props types.

- [ ] Tests (RED): overlay-classes contains the spec strings; Tooltip: hover trigger (delay 0) → `role="tooltip"` visible with text, trigger `aria-describedby` references it; keyboard focus (Tab) opens it; Escape closes; unhover closes; content is portalled to body; `data-slot="tooltip-content"`; computed background equals `bg-neutral` reference; z-index computes to `60`; with `.dark` on html, background equals dark neutral (reference element also inside dark scope); `container` inside `<div data-primary="lapis">`… (tooltip is neutral, so instead assert the popup DOM lives inside the given container); composition `<TooltipTrigger render={<Button size="icon" aria-label="Add"/>}>` renders a single button named "Add" with the tooltip description; axe light + dark while open.
- [ ] Implement; exports; stories (Default on a Button, IconButton, Sides (top/right/bottom/left), WithProvider (group delay)); README (component list + "Overlays: theme on <html>; nested scopes need `container`; add `isolation: isolate` to your app root"); gate; commit `feat(tooltip): overlay foundations and Tooltip`.

### Task 2: Popover

**Files:** `src/components/popover/{popover.tsx,popover.test.tsx,popover.stories.tsx,index.ts}`; modify `src/index.ts`, README.

**Interfaces:** `Popover` (Root), `PopoverTrigger`, `PopoverContent` (Portal→Positioner(`side` "bottom", `align` "center", `sideOffset` 6, z overlay)→Popup with `popupSurface` + `w-72 p-4 flex flex-col gap-2` + `popupMotion`), `PopoverTitle` (`text-base font-semibold leading-snug`), `PopoverDescription` (`text-sm text-muted-foreground`), `PopoverClose`; Props types.

- [ ] Tests (RED): click trigger (composed `render={<Button variant="outline"/>}`) opens `role="dialog"` named by PopoverTitle and described by PopoverDescription; Escape closes and focus returns to trigger; outside click closes; PopoverClose closes; Enter on focused trigger opens; `initialFocus` default moves focus into the popup (first tabbable) — assert per Base UI default behavior (read docs/source; document what you assert); portalled; background equals `bg-popover` reference in light and dark (html.dark); `container` inside `data-primary="lapis"` scope → a `bg-primary` element inside the popup equals lapis reference; z-index 50; axe light + dark open (with an Input + Label inside to verify form content).
- [ ] Implement; exports; stories (Default, WithForm (dimensions editor: two Inputs), Sides, Controlled); README; gate; commit `feat(popover): Popover`.

### Task 3: Dialog + AlertDialog

**Files:** `src/components/dialog/{dialog.tsx,dialog-variants.ts,dialog.test.tsx,dialog.stories.tsx,index.ts}`, `src/components/alert-dialog/{alert-dialog.tsx,alert-dialog.test.tsx,alert-dialog.stories.tsx,index.ts}`; modify `src/index.ts`, README.

**Interfaces:** Dialog exports per spec §1; `DialogContent` props: `size?: "sm"|"md"|"lg"` (default md), `showCloseButton?: boolean` (default true), `container?`, rest → Popup; `dialogVariants({ size, className })` + `dialogDefaults` in `dialog-variants.ts` (server-safe). Close button: `DialogClose render={<Button variant="ghost" color="neutral" size="icon-sm" aria-label="Close" />}` with inline X SVG, `data-slot="dialog-close-button"`, `absolute right-4 top-4`. AlertDialog: same styling via shared classes, no close button prop.

- [ ] Tests (RED) Dialog: trigger opens `role="dialog"` with `aria-modal`/name/description; focus moves inside (first tabbable or the popup) — assert; Tab cycles within (tab past last → first); Escape closes and focus returns to trigger; backdrop click closes; close button (named "Close") closes; `showCloseButton={false}` omits it; sizes map to max-w classes (sm/md/lg); scroll lock: `getComputedStyle(document.documentElement).overflow` or body overflow is `hidden` while open (read Base UI to know which element; assert that one) and restored after close; backdrop & popup z-index 50; dark background equals dark `--popover` reference; axe light + dark open. AlertDialog: `role="alertdialog"`; backdrop click does NOT close; Escape behavior per Base UI (read source; assert actual documented behavior); footer actions: cancel (AlertDialogClose composed with Button outline neutral) closes; confirm Button with onClick runs handler; axe light + dark.
- [ ] Implement; exports; stories (Dialog: Default (edit profile form), Sizes, WithoutCloseButton, ScrollableContent (long text; popup `max-h-[calc(100dvh-2rem)] overflow-y-auto` — add this to the popup classes and spec if long content overflows; justify); AlertDialog: DeleteProject (danger confirm)); README; gate; commit `feat(dialog): Dialog and AlertDialog`.

### Task 4: Menu

**Files:** `src/components/menu/{menu.tsx,menu.test.tsx,menu.stories.tsx,index.ts}`; modify `src/index.ts`, README.

**Interfaces:** per spec §1/§3. `MenuContent` (Portal→Positioner(`side` bottom, `align` "start", `sideOffset` 6, z overlay)→Popup `popupSurface` + menu extras + `popupMotion`); `MenuSubContent` = same but positioner defaults from Base UI for submenus (side inline-end, align start) with `sideOffset` 0 and `alignOffset` -4 (so the submenu's first item aligns with the trigger item); `MenuItem` `variant: "default" | "danger"` (default "default"); `MenuCheckboxItem`/`MenuRadioItem` with indicator slot (check / dot SVG, `data-slot` `menu-item-indicator`); `MenuSubTrigger` with trailing chevron; `MenuShortcut` `<span>`.

- [ ] Tests (RED): trigger (composed Button) click opens `role="menu"`; items `menuitem` named; ArrowDown/ArrowUp move highlight (`data-highlighted` + computed bg equals `bg-accent` reference); disabled item skipped by arrows and has cursor not-allowed; Enter on highlighted item fires onClick and closes; Escape closes, focus returns to trigger; checkbox item: click toggles `aria-checked`, menu stays open, indicator shown only when checked; radio group: selecting item B sets `aria-checked` true on B, false on A; `onValueChange` called; submenu: highlight SubTrigger, ArrowRight opens submenu (second `role="menu"`), ArrowLeft closes it; danger item computed color equals `text-danger` reference; highlighted item has transparent 2px solid outline (forced-colors affordance) — assert outlineStyle solid + outlineColor transparent/`rgba(0, 0, 0, 0)`; cursor pointer on items; portalled; z 50; axe light + dark open (incl. open submenu).
- [ ] Implement; exports; stories (Default "Project actions": Edit ⌘E, Duplicate ⌘D, separator, Archive, Delete (danger)); WithCheckboxItems (view options); WithRadioGroup (sort by); WithSubmenu (Share → Email/Copy link); README; gate; commit `feat(menu): Menu with checkbox, radio and submenu items`.

### Task 5: Composed example + docs

**Files:** `src/docs/examples/project-card.{tsx,test.tsx,stories.tsx}`; modify README, `docs/backlog.md`, `src/docs/introduction.mdx`, `scripts/verify-consumer.mjs` (add a scan needle for an overlay class, e.g. `.bg-popover` if not already present, and `.z-\(--z-overlay\)` escaped properly — verify the exact CSS selector Tailwind emits and match it).

- [ ] Story `Tessera/Examples/Project card`: a `Card` for a project with a `Badge` status, icon Buttons with Tooltips (Star, Share), a `Menu` (Rename → opens Dialog with Field+Input to rename; Delete → opens AlertDialog confirming, danger), a `Popover` "Members" listing avatars-as-initials (plain divs) with an Input to invite. Renaming updates the card title; deleting shows an "Project deleted" empty state (Card content replaced) with an "Undo" Button.
- [ ] Test: rename flow via keyboard only (open menu with Enter, ArrowDown to Rename, Enter, type, Enter submits → title updated, focus returns to the menu trigger); delete flow (AlertDialog confirm → empty state; Undo restores); axe light + dark on the resting card.
- [ ] README: components complete for Phase C; Next up → Phase D (Tabs, Select, Accordion, Toast, Avatar, Separator, Progress). Backlog: add any deferred items. Intro mdx: mention overlays + theming note.
- [ ] Gate; visual check on port 6107 (screenshots of: open menu, rename dialog, delete alert dialog — light and dark) saved to scratchpad `project-*.png`; stop server; commit `docs(examples): project card composing overlays`.
