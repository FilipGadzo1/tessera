# Tessera Phase J: Kbd, Resizable, Stepper, Rating and ColorPicker (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Phase I carry-overs (Kbd and platform-aware shortcut labels, the forced-colors double border, three small fixes, `useElementDirection`), then add `color.ts`, ColorPicker and ColorPickerPopover, Rating, Stepper, Resizable and a Theme Studio example, and finish with the direction fix for the older Base UI composites.

**Architecture:** The same layout as Phases B–I: `src/components/<name>/{<name>.tsx, <name>-classes.ts?, <name>.test.tsx, <name>.stories.tsx, index.ts}`. Shared helpers live in `src/lib`. Tests run in real Chromium with the helpers in `test/overlay.ts`, `test/emulation.ts` and `test/pointer.ts`.

**Tech stack:** Unchanged. Base UI stays pinned `~1.8.0`, and there are no new dependencies. Resizable, Stepper and the ColorPicker's area and channel sliders are hand-built; Rating sits on Base UI RadioGroup; the ColorPicker's swatches and format chooser on Base UI ToggleGroup.

**Spec:** `docs/superpowers/specs/2026-10-01-tessera-phase-j-kbd-resizable-stepper-rating-color.md` is binding. It builds on design-system-v2 §4 and the earlier phase specs it references.

## Global Constraints

- **Environment:** repo `C:\Users\Filip\Desktop\projects\tessera`, Windows 11, Node 24, the Bash tool. Branch `phase-j`.
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
  - Spread `{...props}` first, then `data-slot`/className. Base UI parts merge with `mergeClassName` (their `className` can be a function); plain-element parts use `cn`, as `CommandShortcut` and `MenuShortcut` do. Every part sets `data-slot`.
  - `"use client"` goes on files that import Base UI or use hooks. `src/lib/*` non-hook modules (`color.ts`, `modifier-key.ts`), `*-classes.ts` / `*-variants.ts` and the `Kbd` / `KbdGroup` file stay server-safe.
  - Interactive controls: `outline-none` + `toggleFocusClasses` + `forced-colors:focus-visible:outline-[Highlight]`. Selected/current Highlight/HighlightText + `forced-color-adjust-none`. Disabled → `cursor-not-allowed`; a disabled control that stays focusable uses `text-muted-foreground` (GrayText in forced colors) at opacity 1.
  - Strings: a per-part `aria-label` with an English default plus label functions (design-system-v2 §4 conventions); no `labels` object or label maps outside the date family.
  - Direction: the DOM `dir` is the source of truth. Read it with `useElementDirection` (Task 1) on the component's own element (an overlay root: its trigger's), and wrap direction-reading Base UI parts in Base UI's `DirectionProvider` fed by it. Never detect a consumer's provider.
  - Import shared icons only from `src/lib/icons.tsx`. Merge refs only with `src/lib/merge-refs.ts` / `use-merged-refs.ts`.
  - Export each component from `src/index.ts`.
- **Tests:**
  - Use `vitest-browser-react` + `userEvent` from `vitest/browser`.
  - Wait on state, never on time (`expect.poll`, no sleeps). Send one key at a time when focus moves. No component in this phase has a timer; if one becomes necessary, make it injectable (the Carousel `carouselTimer` pattern).
  - Pointer drags: `userEvent.dragAndDrop(locator, locator, { force, sourcePosition, targetPosition, steps } as Parameters<typeof userEvent.dragAndDrop>[2])` with a `MutationObserver` for mid-drag attributes (`drawer.test.tsx` ~795–815). Touch: the Phase I `tap()` pattern (dispatched `PointerEvent`s with `pointerType: "touch"`, `carousel.test.tsx` ~875) or CDP `Input.dispatchTouchEvent`.
  - Run axe with violations and incomplete both `[]`, in light and dark. Emulate forced colors and reduced motion with `test/emulation.ts`.
  - Platform stubs (`navigator.userAgentData`, `window.EyeDropper`) are restored in `afterEach`.
- **Stories:** `title: "Components/<Name>"`, `tags: ["autodocs"]`. Alignment-check stories label their reference controls as references.
- **Gate:** `npm run format && npm run check && npm run build:storybook` must be green at the end of each task.
- **Commits:** end every message with a blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `.omc/`, `.superpowers/`, `dist/`, `storybook-static/`, `.tmp-consumer/`, `*.tgz` or `.vitest/`.

## Pre-flight

- **Order.** Task 0 (shortcuts and Kbd) → 1 (small carry-overs) → 2 (color.ts and the shared form control) → 3 (inline ColorPicker) → 4 (ColorPickerPopover) → 5 (Rating) → 6 (Stepper) → 7 (Resizable) → 8 (Theme Studio and docs) → 9 (direction for the older Base UI composites, spec §7). This is the controller's order with Task 0 and the ColorPicker split (revision 2); no dependency forces a reorder. Task 9 runs last because it touches many older components.
- **Task 0 provides** `Kbd` / `KbdShortcut`, `useModifierKeyLabel` and `src/lib/modifier-key.ts` (`matchesShortcut`, `ariaKeyShortcuts`, `isEditable`): Task 8 uses them for its shortcuts and hints.
- **Task 1 provides** `useElementDirection` (Tasks 3, 5, 7 and 9) and the FieldError fix (Tasks 3–5's Field stories). Do not start Task 2 before Tasks 0 and 1 are committed.
- **Task 2 provides** `color.ts` (Tasks 3, 4 and 8) and `src/components/field/form-control.tsx` (`useFormControl` / `useFocusScope`, moved from `date-form-control.tsx`; Tasks 3 and 4).
- **Task 3 provides** the inline ColorPicker and its internal `ColorPickerHostContext` / `ColorPickerFormControl` split, which Task 4 relies on.
- **New icons** go into `src/lib/icons.tsx` with the task that needs them: `PipetteIcon` (Task 3), `StarIcon` (Task 5), `AlertIcon` (Task 6), `GripVerticalIcon` (Task 7). Each adds a line to `icons.test.tsx` if that file enumerates icons.
- **Shared files are edited sequentially, one task at a time:** `src/index.ts`, `README.md` (component list), `docs/backlog.md`, `src/lib/icons.tsx`. Tasks run in order, so append; never reorder or reformat other entries.
- **Spec amendments** go into the spec in the same commit as the change (*Amended in Task N*).

---

### Task 0: Shortcuts and Kbd
Spec §0.1.
- [ ] RED: `src/lib/modifier-key.test.ts`: `isApplePlatform` (stubbed navigators, `userAgentData` present and absent, no navigator), `parseShortcut` pinned to today's tokens, `matchesShortcut`, `isEditable`'s table, `shortcutKeys` (glyph and name) / `formatShortcut` key tables for both platforms, `ariaKeyShortcuts`.
- [ ] GREEN: `src/lib/modifier-key.ts`; move `parseShortcut`, `isApplePlatform`, `matchesShortcut` and `isEditable` out of `command.tsx` (Command's suite unchanged and green). Run the gate. Commit `refactor(command): shortcut helpers in modifier-key`.
- [ ] RED: `src/components/kbd/kbd.test.tsx`: `Kbd` / `KbdGroup` rendering and `data-slot`s; `KbdShortcut` with each inner `kbd` checked on its own and no "+" (Windows: "Ctrl", "K"; macOS stub: glyph "⌘", sr-only "Command", `title` "Command"); `keyName` localises; the SSR + hydration test (server HTML "Ctrl", no recoverable error, "⌘" after hydration); forced-colors border CanvasText; axe light and dark including a standalone `KbdShortcut` under the macOS stub.
- [ ] GREEN: `src/components/kbd/{kbd.tsx, kbd-shortcut.tsx, kbd.stories.tsx, index.ts}`, `src/lib/use-modifier-key-label.ts`. Stories per spec §6. Exports, README entry for Kbd. Run the gate. Commit `feat(kbd): Kbd, KbdGroup and KbdShortcut`.
- [ ] RED: `CommandShortcut` / `MenuShortcut` `shortcut="mod+b"` read "Ctrl+B" / "⌘B" by platform stub; the Files and Dashboard buttons have `aria-keyshortcuts` "Control+K" (default) / "Meta+K" (stub), an `aria-hidden` `KbdShortcut`, and no "Ctrl" in their names; Files and Project card hints read "Ctrl+B" / "Ctrl+L" under the default platform and ⌘ under the stub.
- [ ] GREEN: the `shortcut` prop on both; rewire the Files, Dashboard and Project card examples (`aria("mod+k")` replaces the hard-coded `"Control+K Meta+K"`) and the Menu / Menubar / Command stories. Backlog: remove the ⌘-everywhere entry. Run the gate. Commit `feat: platform-aware shortcut hints in menus, commands and examples`.

### Task 1: Small carry-overs
Spec §0.2.
- [ ] RED: `src/lib/use-element-direction.test.tsx`: `"ltr"` before mount, `"rtl"` after mount under `dir="rtl"`; an ancestor `dir` change seen (`expect.poll`); a re-render with no `dir` change performs no `getComputedStyle` call (spy); the shared observer disconnects after the last unmount.
- [ ] GREEN: `src/lib/use-element-direction.ts` (mount read + one shared `MutationObserver` on `dir`; state set only on change); amend `isRtl`'s doc in `src/lib/direction.ts`. Run the gate. Commit `feat(lib): useElementDirection`.
- [ ] RED: forced colors: the open Dialog, AlertDialog, Drawer, PopoverContent and MenuContent have `outline-style: none` and a solid 1px border (each fails before the fix).
- [ ] GREEN: `forced-colors:outline-none` on the dialog popup, the Drawer panel and `popupSurface` (update its doc comment). Run the gate. Commit `fix(overlays): single forced-colors frame on bordered surfaces`.
- [ ] RED: the Dialog close button at the inline end under `dir="rtl"`, LTR unchanged.
- [ ] GREEN: `end-4`. Commit `fix(dialog): logical close button`.
- [ ] RED: `<Field invalid><FieldError /></Field>` renders no `[data-slot=field-error]`; with children it renders; a Form error with no children still shows.
- [ ] GREEN: FieldError's `match` default. Commit `fix(field): no empty FieldError without children`.
- [ ] RED: read-only Checkbox / Switch / Radio: cursor `default`, no hover border change.
- [ ] GREEN: `data-readonly:cursor-default` + `not-data-readonly:` hover gating. Backlog: remove the double-border, Dialog close, FieldError and read-only-cursor entries. Run the gate. Commit `fix: read-only cursor on checkbox, switch and radio`.

### Task 2: color.ts and the shared form control
Spec §1 and §2 "Field and Form".
- [ ] RED: `src/lib/color.test.ts` per spec §1 (the parse table, formats, conversions, contrast with the computed values including 50% black over white = 3.98, `wcagContrast`, `readableForeground`).
- [ ] GREEN: `src/lib/color.ts` (server-safe, no rounding before the final ratio). Run the gate. Commit `feat(color): colour parsing, conversion and contrast helpers`.
- [ ] Move `useDateFormControl` / `useFocusScope` and the visually hidden styles into `src/components/field/form-control.tsx` as `useFormControl` / `useFocusScope`, with the hidden input's `data-slot` as a `slot` option (the date controls pass `"date-form-control"`); `date-form-control.tsx` imports them. RED is the existing date and Form suites, run before and after: they pass unchanged. Update the backlog's Base UI pin note with the new path. Run the gate. Commit `refactor(field): shared hidden-input form control`.

### Task 3: Inline ColorPicker
Spec §2 (all but `ColorPickerPopover`).
- [ ] RED: `src/components/color-picker/color-picker.test.tsx` per spec §2 "Tests, inline" (rendering and composition; ARIA; the area and channel key tables; RTL; pointer drags with real pointer capture; the grey-hue rule; input commit/revert/Escape; format toggle and `formatLabel`; swatches; EyeDropper stub; controlled/uncontrolled; Form and Field with one control; focus rings; forced colors; reduced motion; axe).
- [ ] GREEN: `color-picker.tsx` (the root with `ColorPickerHostContext` and the internal `ColorPickerFormControl` child, `ColorArea`, `ColorHueSlider`, `ColorAlphaSlider`, `ColorInput`, `ColorFormatToggle`, `ColorEyeDropper`, `ColorSwatches` / `ColorSwatch`), `color-picker-classes.ts`, `PipetteIcon`. Stories (Inline, With alpha, With swatches, Composed, In a Form, Disabled), exports, README entry. Visual check on 6107 (light and dark, alpha checkerboard, swatches, forced colors, RTL, 390px). Run the gate. Commit `feat(color-picker): ColorPicker`.

### Task 4: ColorPickerPopover
Spec §2 `ColorPickerPopover` and "Tests, popover".
- [ ] RED: `color-picker-popover.test.tsx` per spec §2 "Tests, popover" (the exact trigger name "Choose color: #1d4ed8" and `triggerLabel`; Field naming; open focus and Escape return; the two-Escape layering; one control and one FormData entry inside a Field and Form; the blur scope over trigger + popup; controlled/uncontrolled; forced-colors swatch; axe closed and open).
- [ ] GREEN: `color-picker-popover.tsx` (the trigger, the popup with its hidden title, the host context set to `joinsForm: false` for the inner picker). Stories (Popover, Popover in a Form), exports, README entry. Visual check (popover open light and dark, forced colors, 390px). Run the gate. Commit `feat(color-picker): ColorPickerPopover`.

### Task 5: Rating
Spec §3.
- [ ] RED: `src/components/rating/rating.test.tsx` per spec §3 (structure; the keyboard table with the pinned end behaviour; `allowHalf` with the `--rating-fill` geometry in LTR and RTL; RTL keys; pointer, hover preview and the touch `tap()` case; clearable; controlled/uncontrolled; display mode with the 30% fill from each side; disabled; Form and Field; sizes; focus ring; forced colors fill vs outline; reduced motion; axe).
- [ ] GREEN: `rating.tsx` on Base UI RadioGroup + Radio in a `DirectionProvider`, with `StarIcon`. Stories, exports, README entry. Visual check (sizes, half steps, hover preview, display mode, forced colors, RTL). Run the gate. Commit `feat(rating): Rating`.

### Task 6: Stepper
Spec §4.
- [ ] RED: `src/components/stepper/stepper.test.tsx` per spec §4 (structure with `role="list"` and `aria-current`; display-only items; names and descriptions; the reachability examples as a table-driven test; the keyboard table including the pinned no-arrow behaviour; controlled/uncontrolled; indicator content; orientation geometry; RTL; the focusable-disabled look; forced colors including the 4px complete separator; reduced motion; axe).
- [ ] GREEN: `stepper.tsx` with `AlertIcon`. Stories (the horizontal wizard drives `value` from Back/Next and tracks completion in a set), exports, README entry. Visual check (horizontal and vertical, error step, forced colors, RTL, 390px: the horizontal stepper must not overflow; if it does, the story wraps titles or switches to vertical, and the spec is amended). Run the gate. Commit `feat(stepper): Stepper`.

### Task 7: Resizable
Spec §5.
- [ ] RED: `src/components/resizable/resizable.test.tsx` per spec §5 (ARIA; the full key table in LTR / RTL / vertical; limits; the collapse-consistency cases for `hi` / `lo` with collapsible neighbours and gap snapping; Enter collapse and restore; pointer drags with the `dragAndDrop` + `MutationObserver` pattern, collapse snapping at the gap midpoint and no per-move direction read; layout initialisation and conditional panels; controlled/uncontrolled; SSR + hydration; grip; focus ring; forced colors; reduced motion; axe).
- [ ] GREEN: `resizable.tsx` with `GripVerticalIcon`. Stories (including the Persisted story with try/catch around `localStorage`), exports, README entry. Visual check (horizontal with grips, vertical, nested, collapsed sidebar, dragging, forced colors, RTL). Run the gate. Commit `feat(resizable): ResizablePanelGroup, ResizablePanel and ResizableHandle`.

### Task 8: Theme Studio example and docs
Spec §6. Files: `src/docs/examples/theme-studio-page.{tsx,test.tsx,stories.tsx}`. Keep the page under ~450 lines by using local sub-components (`ColorsStep`, `ShapeStep`, `ReviewStep`, `Preview`, `CodePanel`).
- [ ] RED: test the keyboard flow:
  - Tab to the "Resize controls" handle; → grows the controls panel (`aria-valuenow`), Enter collapses it and Enter restores it.
  - The default theme reads "Primary on surface 6.3:1 AA". Type `#1d4ed8` + Enter into the primary ColorInput: the preview's solid Button background is that colour and the badge reads "Primary on surface 6.7:1 AA".
  - Type `#ffff66` + Enter (1.06:1 on the white surface): the badge reads "Primary on surface 1.1:1 Fails AA"; "Next" marks "Colors" `error`, shows the message and stays. Back to `#1d4ed8`: the error clears; "Next" moves to "Shape" (`aria-current="step"` moves, "Colors" is complete).
  - Open the surface `ColorPickerPopover`, type `#0f172a` + Enter: the badge reads "Primary on surface 2.7:1 Fails AA" (2.66:1); Escape closes the popover with focus back on the trigger; restore `#ffffff`.
  - Go to "Review", then Back to "Colors" with the Stepper: "Shape" and "Review" stay reachable (the completed set).
  - In "Review", → on the Rating checks the next star; Ctrl+S calls `onSave` with the theme, `defaultPrevented` is true, and "Theme saved" appears; it also works while typing in the name Input; the status clears on the next theme change. Under a macOS stub ⌘+S saves and the Save hint's glyph is "⌘"; by default its `kbd`s read "Ctrl" and "S" (each checked on its own), and the Save button has `aria-keyshortcuts="Control+S"`.
  - Ctrl+J (also from inside an input) mounts the code panel (three panels, sizes summing to 100) and again removes it; `defaultPrevented` is true.
  - axe in light and dark, with and without the popover open (`auditOpenOverlay`); 390px renders the panels stacked (vertical group).
- [ ] GREEN: implement the page. Update the README (component list complete; "Phase J is complete"; the Theme Studio paragraph; roadmap Phase K per spec §6), the backlog (Phase J notes) and `src/docs/introduction.mdx`. Run the gate. Visual check on 6107 (`theme-studio-*.png`: light, dark, popover open, code panel open, error step, forced colors, RTL, 390px). Stop only your own PID. Commit `docs(examples): theme studio composing Phase J components`.

### Task 9: Direction for the older Base UI composites
Spec §7.
- [ ] Audit: map Base UI's direction consumers (spec §7 list) to Tessera components (at least RadioGroup, ToggleGroup, Toolbar, Tabs, Slider, ScrollArea, Menu / Menubar / ContextMenu, NavigationMenu, Select, Combobox, Autocomplete, OTPField, Tooltip, Popover, PreviewCard, Accordion). Record the list in the spec (*Amended in Task 9*).
- [ ] RED: per affected component, `dir="rtl"` keys follow the visual order (Slider: pin against Base UI's docs); LTR unchanged; an ancestor `dir` change is followed; the Slider RTL drag test; the ScrollArea RTL regression test; the popup-side checks (an RTL Popover with `align="start"` aligns to the trigger's right edge; an RTL MenuSub opens to the left and ← opens it).
- [ ] GREEN: each affected component wraps its Base UI root in `DirectionProvider` fed by `useElementDirection` on its own element; element-less overlay roots read their trigger's element through the root context. All existing suites stay green. README RTL line (the DOM `dir` rule and the portal note); backlog. Visual check on 6107 (an RTL RadioGroup, Tabs, Slider drag, ScrollArea and a Popover). Run the gate. Commit `fix(rtl): Base UI composites follow the element direction`.
