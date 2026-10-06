# Tessera Phase J: Kbd, Resizable, Stepper, Rating and ColorPicker (Spec Addendum)

**Date:** 2026-10-01
**Status:** Claude made these decisions under the owner's standing delegation ("no questions, verify heavily"). The controller set the phase scope (the carry-overs, Resizable, Stepper, Rating, ColorPicker, a Theme Studio example, and the direction fix for the older composites) and ruled on the critic's review (revision 2). The design decisions below are Claude's unless marked as a controller ruling.
**Builds on:**
- design-system-v2 §4:
  - focus uses `outline-none` + `toggleFocusClasses` + `forced-colors:focus-visible:outline-[Highlight]`;
  - selected/current Highlight/HighlightText + `forced-color-adjust-none`;
  - disabled → `cursor-not-allowed`; a disabled control that stays focusable uses `text-muted-foreground` (GrayText in forced colors) and keeps opacity 1 (the Phase I amendment);
  - the localisation and naming conventions (a per-part `aria-label` with an English default plus label functions outside the date family; the action-callback names);
  - motion and reduced motion.
- Phase C/D: the overlay pattern, `useLayeredEscape`, `claimEscape` (`src/lib/tooltip-escape.ts`).
- Phase E: Slider, NumberField.
- Phase F: ToggleGroup.
- Phase H: `useDateFormControl` / `useFocusScope` (`src/components/date-picker/date-form-control.tsx`), Sidebar's direction read.
- Phase I: `isRtl` (`src/lib/direction.ts`), `useMergedRefs`, Command's `mod+k` shortcut parser and `isApplePlatform`, Tree's element-type child detection, Carousel's "guess from children before mount", its focusable-disabled ends and its `tap()` test helper.

**Scope and tasks:**
1. Shortcuts: `Kbd`, platform-aware shortcut labels and their wiring (§0.1, Task 0).
2. Small carry-overs: the forced-colors double border, three backlog fixes, `useElementDirection` (§0.2, Task 1).
3. `src/lib/color.ts` and the shared hidden-input form control (§1, §2 "Field and Form", Task 2).
4. The inline `ColorPicker` (§2, Task 3).
5. `ColorPickerPopover` (§2, Task 4).
6. `Rating` (§3, Task 5).
7. `Stepper` (§4, Task 6).
8. `Resizable` (ResizablePanelGroup, ResizablePanel, ResizableHandle) (§5, Task 7).
9. A Theme Studio example and the docs (§6, Task 8).
10. Direction for the older Base UI composites (§7, Task 9, last).

**Scope rulings:**
- *Resizable, Stepper and the ColorPicker's area and channel sliders are hand-built.* Base UI 1.8 has no splitter, stepper or 2D slider, and a dependency (react-resizable-panels, React Aria's color package, react-colorful) for one component each would break the "Base UI + Tailwind only" stack. They follow APG where APG has a pattern (window splitter; slider) and React Aria's ColorArea for the 2D slider. Cost if wrong: more code to own than a dependency would have been.
- *The ColorPicker's hue and alpha sliders do not reuse Tessera's Slider or Base UI's Slider.* Base UI's `Slider.Root` registers itself with the enclosing Base UI Field (`useRegisterFieldControl` in `SliderRoot.js`, and it takes the Field's label), so a ColorPicker inside a `Field` would have three competing field controls and its Field label would name the hue slider. Tessera's Slider also always renders a solid Indicator, where a hue track is a gradient with none. The two channel sliders share one small hand-built 1D engine with the 2D area (the same pointer capture and key handling), so the extra code is small. Their thumbs are focused directly (`:focus-visible` on the thumb, `toggleFocusClasses`), unlike Slider's thumb (a `has-[:focus-visible]` ring around a hidden input), so no class constant is shared with Slider. Cost if wrong: two slider implementations to keep in step; Base UI's slider features (`thumbAlignment`, `largeStep`, locale formatting) are not available on the colour channels.
- *The same Field rule decides the ColorPicker's other inner parts.* The text field is a native `<input>` styled with `inputVariants` (Tessera's `Input` is Base UI's `Field.Control`, which would register too), and the format chooser and swatches are Base UI `ToggleGroup`s (which do not register). Only one element per picker joins the Field and Form: the inline root, or the `ColorPickerPopover` trigger (the picker inside the popup is told not to join, §2). Cost if wrong: none expected; a consumer who wants the hex input as the Field's own control composes Input separately.
- *Rating is built on Base UI RadioGroup semantics.* A rating input is a single choice from an ordered set, which is what a radio group is; MUI's Rating and Ark UI's RatingGroup expose the same `radiogroup` / `radio` semantics, and APG has no rating pattern. RadioGroup brings the roving focus, `required`, `name`, `disabled` state, Field labelling and Form participation for free (the Field registration that rules Slider out above is what we want here: the Rating *is* the Field's control). Half steps are two radios per star (MUI's approach), so the arrows step by 0.5 with no custom key code. The read-only *display* is not a radio group (see §3). Cost if wrong: a hand-built slider-style rating (`role="slider"`, one tab stop, arbitrary precision) would announce "3 of 5" more compactly; the radio model announces "3 stars, radio, 3 of 5".
- *Stepper triggers are plain buttons in an ordered list, not a tablist.* WAI-ARIA defines `aria-current="step"` for exactly this ("the current step within a process"), and the step list is navigation through a process whose content the consumer owns (a form per step), not a set of tab panels: `role="tab"` would require `aria-selected` and tabpanels the Stepper does not render, and screen readers announce tabs as "tab 2 of 4" with no notion of complete or failed steps. The wizards in GOV.UK, USWDS (step indicator), MUI (`StepButton`) and Mantine all render buttons or a plain list; a tablist is Ark/Zag's choice, which pairs it with its own content panels. Every step is a Tab stop (steppers have 3–7 steps, so the cost is small), Enter/Space activate, and there are no arrow keys. Cost if wrong: a keyboard user tabs through every step instead of one roving stop; switching to a roving tablist later changes the roles, which is a breaking change for consumers' tests.
- *Steps in a linear Stepper that are not yet reachable are `aria-disabled`, not `disabled`.* They stay focusable, so a screen-reader user tabbing through hears that the step exists and is unavailable, and the Phase I convention applies (muted text, GrayText, opacity 1, full-strength ring). Cost if wrong: one extra Tab stop per unreachable step.
- *Resizable redistributes space between the two panels next to the handle only.* Dragging a handle stops when either neighbour reaches its limit; it does not push further panels (react-resizable-panels cascades). Cost if wrong: a three-panel layout cannot shrink the far panel by dragging the first handle past the middle panel's minimum; the user drags the second handle.
- *Resizable has no imperative API* (no `collapse()` / `expand()` ref). Collapse is reachable from the handle (Enter, Home/End, a drag past the snap point) and from a controlled `layout`; a "toggle sidebar" button is a controlled-layout recipe in the stories and the Theme Studio. Persistence is the consumer's: store what `onLayout` reports, pass it back as `defaultLayout`. Cost if wrong: a consumer with many buttons that collapse panels writes the size bookkeeping themselves; an imperative handle can be added later without breaking anything.
- *The ColorPicker's colour surfaces are physical, not mirrored in RTL.* The saturation/brightness area and the hue/alpha tracks are pictures of a colour space (white on the left, black at the bottom; the hue wheel unrolled red-to-red), so they render `dir="ltr"` and → always moves the thumb right. The text input, the swatches and the labels follow the page direction. Cost if wrong: an RTL user who expects the hue track to start on the right; mirroring is a later prop.
- *ColorPicker values are strings: `#rrggbb`, or `#rrggbbaa` when `alpha` is on and the alpha is below 1.* Lowercase, always valid, never `null`, so there is no `required` prop (it could never fail). The picker keeps an HSVA state inside so the hue survives a grey (a hex has no hue at saturation 0). Cost if wrong: no "no colour yet" state; a form that needs one pairs the picker with a Checkbox, or a later `value: null` (with `required`) is added.
- *The DOM `dir` is the source of truth for direction* (controller ruling). Base UI reads the direction only from its `DirectionProvider` context (default LTR), for arrow keys (`useCompositeRoot.js` swaps ←/→ only for `"rtl"`) and for pointer and layout maths (Slider drag, ScrollArea offsets, anchor positioning). Every Tessera component that sits on a direction-reading Base UI part wraps it in its own `DirectionProvider`, fed by `useElementDirection` on its own element (§0.2). Tessera never detects or defers to a consumer's `DirectionProvider`: the element's resolved direction (from `dir` on it or any ancestor) always wins for that component's subtree. That also makes nesting safe: a Tessera component inside another reads its own element, so the inner provider is always right for its subtree. Phase J's new components do this from the start; the older ones get it in Task 9 (§7): a known RTL bug with a ready fix is not deferred. Cost if wrong: a consumer who sets a `DirectionProvider` that disagrees with the DOM `dir` (not a coherent setup) gets the DOM's direction; a direction set only by a CSS `direction` rule without a `dir` attribute is read on mount but not observed afterwards (§0.2).

## 0. Carry-overs

### 0.1 Shortcuts and Kbd (Task 0)

**`Kbd` and `KbdGroup`** (`src/components/kbd/kbd.tsx`, server-safe, no `"use client"`):
- `Kbd`: a `<kbd>` with `data-slot="kbd"` and
  `inline-flex h-5 min-w-5 select-none items-center justify-center gap-0.5 rounded-sm border border-border bg-muted px-1 font-sans text-xs font-medium tabular-nums text-muted-foreground [&_svg]:size-3 forced-colors:border-[CanvasText]`.
- `KbdGroup`: a `<kbd>` (HTML nests `<kbd>` for a key combination) with `data-slot="kbd-group"` and `inline-flex items-center gap-1`.
- Both are plain elements: they spread `{...props}` first, then `data-slot` and `className` through `cn` (the pattern for plain-element parts such as `CommandShortcut` and `MenuShortcut`; `mergeClassName` is for Base UI parts, whose `className` can be a function).

**`src/lib/modifier-key.ts`** (server-safe, no hooks). `command.tsx`'s `parseShortcut`, `isApplePlatform`, `matchesShortcut` and `isEditable` move here, unchanged in behaviour (Command's shortcut tests guard it; `parseShortcut` keeps exactly today's tokens: `mod`, `ctrl`, `meta`, `cmd`, `shift`, `alt`):
- `isApplePlatform(nav?: Navigator)`: `false` when `navigator` is undefined (server). Otherwise `userAgentData.platform ?? platform` against `/mac|iphone|ipad|ipod/i`, as today. The optional argument makes it unit-testable.
- `parseShortcut(shortcut)` → `{ key, mod, ctrl, meta, shift, alt }`.
- `matchesShortcut(event, parsed, apple = isApplePlatform())`.
- `isEditable(target)`: today's rule (text inputs, textarea, select, contenteditable, `role="textbox"` / `role="combobox"`). CommandDialog keeps using it; the Theme Studio's shortcuts deliberately do not (§6).
- `shortcutKeys(shortcut, { apple })` → one entry per key, `{ glyph, name }`, for a `KbdGroup`:
  - Apple: modifiers as symbols in Apple's order ⌃ ⌥ ⇧ ⌘ (`ctrl`, `alt`, `shift`, `mod`/`meta`/`cmd`), then the key: `"mod+shift+k"` → glyphs `⇧`, `⌘`, `K`; names "Shift", "Command", "K".
  - Elsewhere: `Ctrl`, `Alt`, `Shift`, `Meta`, then the key: glyphs `Ctrl`, `Shift`, `K` (glyph and name equal).
  - Keys: a letter is upper-cased; `enter` ↵ "Enter" (Apple) / `Enter`; `escape` `Esc`; `backspace` ⌫ "Backspace" / `Backspace`; `delete` ⌦ "Delete" / `Del`; `tab` ⇥ "Tab" / `Tab`; `space` `Space`; `arrowup`/`up` ↑ "Up arrow" (the four arrows the same on both); anything else as typed.
  - `name` is the English spoken name of a symbol glyph; it equals the glyph for text glyphs.
- `formatShortcut(shortcut, { apple })` → one string of glyphs: Apple joins with nothing (`"⇧⌘K"`), elsewhere with `+` (`"Ctrl+Shift+K"`).
- `ariaKeyShortcuts(shortcut, { apple })` → the `aria-keyshortcuts` value for the platform's real binding: `"Meta+S"` on Apple, `"Control+S"` elsewhere (`mod` follows the platform, as `matchesShortcut` does).
- Unit tests (`modifier-key.test.ts`): each function with both platforms, a stubbed `Navigator` (`userAgentData` present and absent), `undefined` navigator, the key table above, `isEditable`'s table, and a `parseShortcut` table pinned to today's tokens.

**`useModifierKeyLabel()`** (`src/lib/use-modifier-key-label.ts`, `"use client"`):
- Returns `{ apple, mod, format, keys, aria }`: `mod` is `"⌘"` or `"Ctrl"`; `format(shortcut)`, `keys(shortcut)` and `aria(shortcut)` bind `formatShortcut`, `shortcutKeys` and `ariaKeyShortcuts` to the platform.
- SSR strategy: `useSyncExternalStore(subscribeNever, () => isApplePlatform(), () => false)`. The server snapshot (and the hydration render) is non-Apple, so the server HTML says "Ctrl"; React re-renders with the client snapshot right after hydration, with no mismatch error (`useSyncExternalStore`'s documented hydration contract). A Mac shows "Ctrl" for one frame after hydration only in server-rendered apps; a client-rendered app (Storybook) shows ⌘ on the first paint.

**`KbdShortcut`** (`src/components/kbd/kbd-shortcut.tsx`, `"use client"`): `<KbdShortcut shortcut="mod+k" />` renders a `KbdGroup` (`data-slot="kbd-shortcut"`) with one `Kbd` per key from `useModifierKeyLabel().keys`, with no "+" between them (the gap separates them). It takes `KbdGroup`'s props plus `keyName(name)` (a label function; default identity) for localising the spoken names.
- Exposure: a text glyph (`Ctrl`, `K`) is the `Kbd`'s only text. A symbol glyph renders `<span aria-hidden="true" data-slot="kbd-glyph">⌘</span><span class="sr-only">Command</span>` inside its `Kbd`, plus `title="Command"` on the `Kbd` for sighted mouse users. So a standalone `KbdShortcut` (e.g. in help text) reads "Shift Command K", not symbol names a screen reader may skip.
- Inside a control (a Button or Switch label) the `KbdShortcut` is `aria-hidden`, and the control carries `aria-keyshortcuts` from `aria(shortcut)`: the hint is visual, the binding is announced once.

**Wiring the shortcut labels:**
- `CommandShortcut` and `MenuShortcut` gain `shortcut?: string`. With `shortcut` and no `children`, they render `format(shortcut)` (the hook). They stay `aria-hidden` spans, unchanged otherwise.
- `CommandDialog` imports `parseShortcut` / `matchesShortcut` / `isEditable` from `modifier-key.ts`.
- The examples and stories that hard-code ⌘:
  - Files: `<CommandShortcut shortcut="mod+b" />`; the Commands button's "⌘K" hint becomes `<KbdShortcut aria-hidden shortcut="mod+k" />`.
  - Dashboard: the Search button gains the same `aria-hidden` `<KbdShortcut shortcut="mod+k" />` hint.
  - Both buttons' `aria-keyshortcuts="Control+K Meta+K"` becomes `aria("mod+k")`: CommandDialog's `mod+k` only matches the platform's modifier, so "Meta+K" on Windows was never a real binding.
  - Project card: `<MenuShortcut shortcut="mod+l" />` (F2 stays literal).
  - Editor: it renders no shortcut hints today, so there is nothing to change (checked; the controller listed it).
  - Stories: the Menu (⌘E, ⌘D, ⌘N), Menubar (⌘N, ⌘O, ⌘S, ⌘Z, ⇧⌘Z) and Command (⌘P, ⌘B, ⌘S) stories use `shortcut="…"`. ContextMenu's ⌥← stays literal.
- Tests:
  - `CommandShortcut` / `MenuShortcut` with `shortcut="mod+b"` read "Ctrl+B" with a Windows platform stub and "⌘B" with a macOS stub (stub `navigator.userAgentData` with `Object.defineProperty(…, { configurable: true })`, restored in `afterEach`).
  - `KbdShortcut`: `kbd[data-slot=kbd-shortcut] > kbd` × 2; each inner `kbd`'s text checked on its own: "Ctrl", "K" (Windows); under the macOS stub the first `kbd`'s `[data-slot=kbd-glyph]` is "⌘", its sr-only text "Command" and its `title` "Command", the second "K". No "+" anywhere.
  - Hydration: `renderToString` (`react-dom/server`) of a `KbdShortcut` under a macOS stub contains "Ctrl"; `hydrateRoot` into that HTML calls no `onRecoverableError`, and the glyph then becomes "⌘" (`expect.poll`).
  - The Files and Dashboard buttons have `aria-keyshortcuts="Control+K"` under the default Chromium platform (Windows or Linux) and `"Meta+K"` under the stub; their `KbdShortcut` is `aria-hidden`; the button's accessible name does not contain "Ctrl".
  - The Files and Project card tests read "Ctrl+B" / "Ctrl+L" under the default platform; a macOS-stub case reads ⌘.
  - axe light and dark on the Kbd stories (including the standalone `KbdShortcut` under the macOS stub); forced colors: the `Kbd` border is CanvasText.
- *Amended in Task 0*: `KbdShortcut` renders its own `<kbd>` with `KbdGroup`'s classes (the exported `kbdGroupBase`), not a `KbdGroup` element: `KbdGroup` sets `data-slot` after `{...props}`, so a `KbdGroup` could not carry `data-slot="kbd-shortcut"`.
- *Amended in Task 0*: `keyName` also applies to text keys (their shown text is their name, e.g. "Ctrl" → "Strg"), so one function localises the whole shortcut.
- *Amended in Task 0*: axe cannot rate the contrast of a symbol-only glyph (⌘, ⇧, ↵) and reports `color-contrast` "needs review" with `nonBmp` ("Element content contains only non-text characters") on each `[data-slot=kbd-glyph]`. The Kbd axe test allows exactly those entries and checks instead that each glyph has the same colour and keycap background as a text key that axe does rate. Every other violation and incomplete must be `[]`.
- *Amended in Task 0*: `useModifierKeyLabel` (and its `ModifierKeyLabel` type) is exported from the package, since `KbdShortcut`'s documented pattern for a hint inside a control needs `aria(shortcut)`. `react-dom/client` joins vitest's `optimizeDeps` (the hydration test imports `hydrateRoot`; without it Vite reloads mid-run).
- *Amended in Task 0*: the Command `Dialog` story's "Open command menu" button had the same per-platform bug as the examples (a hard-coded `aria-keyshortcuts="Control+K"` and a literal "Ctrl K" hint), so it gets the same fix: `aria("mod+k")` and an `aria-hidden` `KbdShortcut`. With `children`, `CommandShortcut` / `MenuShortcut` show the children and ignore `shortcut`.
- *Amended in Task 0*: `CommandShortcut` and `MenuShortcut` drop `tracking-widest` (Phase C §Menu's class string). It was tuned for "⌘E"; the visual check showed the Windows/Linux labels it now renders letter-spaced as "C t r l + P". Without it both "Ctrl+P" and "⌘P" read normally (screens `task0-command-dialog-*.png`).
- *Amended in Task 1*: `KbdShortcut` puts an `sr-only` no-break space between its keys, so its text is "Ctrl K", not "CtrlK" (flex-item `<kbd>`s with no text between them can be read as one word). It is out of flow, so the keys still sit one flex gap apart (tested); a plain `{" "}` would be a whitespace-only flex child, which is not rendered. `KbdShortcutProps` is `Omit<KbdGroupProps, "children">` (the keys come from `shortcut`).
- *Amended in Task 1*: the platform stubs live in `test/platform.ts` (`stubMac`, `stubWindows`, `restorePlatform`). Every test that assumes a non-Apple platform (a "Ctrl" label, `Control+K`, pressing Ctrl+K) calls `stubWindows()`, so the suite also passes on a Mac.

### 0.2 Small carry-overs (Task 1)

**`useElementDirection(ref)`** (`src/lib/use-element-direction.ts`, `"use client"`): returns `"ltr" | "rtl"`.
- It returns `"ltr"` before mount (server HTML and the first client render).
- It reads `isRtl(ref.current)` in a layout effect on mount (before paint, so no key press can land on the LTR guess).
- Afterwards it re-reads only when a `dir` attribute changes somewhere in the document: one module-level `MutationObserver` on `document.documentElement` (`subtree: true`, `attributeFilter: ["dir"]`), created for the first subscriber and disconnected after the last; each subscriber re-reads its own element when it fires. It does not read on every commit, so a Resizable drag or a ColorPicker drag (a commit per pointer move) never forces a style read per frame.
- It sets state only when the direction changed (the Phase I lesson: an unchanged `setState` can be rebased over a newer one).
- Limits (documented): a direction set only by a CSS `direction` rule (no `dir` attribute) is read on mount but not observed; moving a mounted element under a different `dir` ancestor is not observed. Both are consistent with "the DOM `dir` is the source of truth".
- `src/lib/direction.ts`'s `isRtl` doc is amended: it now names `useElementDirection` as the shared client read, alongside Drawer's render-time read.
- Sidebar's own read is not migrated (no behaviour change wanted).
- Tests: `"rtl"` after mount under `dir="rtl"`; an ancestor's `dir` change is seen (`expect.poll`); a re-render with no `dir` change does not call `getComputedStyle` (spy); the observer is disconnected when the last user unmounts.
- *Amended in Task 1*: the "no style read on re-render" test spies on `isRtl` (`vi.mock("./direction", { spy: true })`) and counts only the calls for the test's element, not a global `getComputedStyle` spy (Base UI and floating-ui call it too). The observer test spies on `MutationObserver.prototype.observe` / `disconnect` and follows the one instance that observes `dir` on `document.documentElement` (two users share it; it is disconnected only after the second unmounts). The hook keeps the last direction in a ref and calls `setState` only when it differs.

**Dialog-wide forced-colors double border** (backlog, Phase I):
- Cause: Tailwind v4's `outline-hidden` is `outline-style: none` normally but, under `@media (forced-colors: active)`, `outline: 2px solid transparent; outline-offset: 2px`, which Chromium paints in CanvasText. On a surface that also has `border border-border` (forced to CanvasText), that draws a second frame 2px outside the first.
- Fix: add `forced-colors:outline-none` to every bordered surface that uses `outline-hidden`, so the 1px border is the one frame:
  - the dialog popup (`dialog-variants.ts`; Dialog, AlertDialog and CommandDialog share it);
  - the Drawer panel (`drawer-variants.ts`; its inner-edge border);
  - `popupSurface` (`src/lib/overlay-classes.ts`; Popover, Menu, ContextMenu, Select, Combobox, Autocomplete). Its doc comment changes: the border is the forced-colors frame; `outline-hidden` stays for the normal mode only.
- Tests (forced colors emulated): the open Dialog, AlertDialog, Drawer, PopoverContent and MenuContent popups have computed `outline-style: none` and a solid 1px border (`border-top-style: solid`, `border-top-width: 1px`; the Drawer's inner edge). Each fails without the fix.

**Three small backlog fixes**, picked because they are concrete, cheap and touch what this phase builds on:
- *Dialog close button RTL.* The Dialog's close button is physical (`absolute right-4 top-4`, backlog Phase I "Dialog / AlertDialog"); Drawer's became `end-4` in Phase I. Change it to `end-4`. Why now: Phase J is RTL-heavy and ends with a direction task (§7), so the one physical close button left in the overlays goes too. Test: under `dir="rtl"` the close button sits at the popup's inline end (its left edge is 16px from the popup's left padding edge, geometry), and LTR is unchanged. (AlertDialog renders no close button; nothing to change.)
- *FieldError empty node.* `<Field invalid>` with a children-less `<FieldError />` renders an empty node (backlog Components). Fix in `FieldError`: apply the `invalid`-derived default `match` only when `children != null`, i.e. `match ?? (fieldInvalid && children != null ? true : undefined)`. Why now: Rating and ColorPicker are new Field controls and their stories use `Field invalid`. Tests: `<Field invalid><FieldError /></Field>` renders no `[data-slot=field-error]`; with children it renders them; a Form-reported error with no children still shows the message (unchanged).
- *Checkbox / Switch / Radio `readOnly` cursor.* They keep `cursor-pointer` and their hover border when read-only (backlog Components), which breaks design-system-v2 §4's cursor rule (a pointer promises a response the control will not give). Add `data-readonly:cursor-default` and gate their hover rules with `not-data-readonly:` (Base UI sets `data-readonly` on all three roots). Why now: a two-class fix per control, and Phase J's forms (Rating, ColorPicker, the Theme Studio wizard) sit beside these controls in the same stories, where the inconsistency shows. Tests: each read-only control has computed cursor `default`, and hovering it does not change its border colour.
- *Amended in Task 1*: the Switch track has no border (its hover changes the fill), so its read-only test checks that hovering does not change the background colour, checked and unchecked. The hover tests wait for the control's transitions to finish (`getAnimations()` empty), not a fixed sleep. The forced-colors frame tests live in `test/forced-colors-frame.test.tsx` (one table over the five surfaces), and the Phase B / Phase C spec lines for the changed class strings carry "superseded by Phase J §0.2" notes. Visual check: screens `task1-forced-*.png` (one frame each), `task1-dialog-close-{rtl,ltr}.png`, `task1-{readonly,editable}-{checkbox,switch,radio}-{rest,hover}.png`.

**Backlog:** remove the entries resolved in Tasks 0 and 1 (the Dialog-wide double border, the Dialog close button, the ⌘-everywhere shortcut hints, FieldError's empty node, the read-only cursor) and add the Phase J notes as they arise.

## 1. `src/lib/color.ts` (Task 2)

Server-safe, no dependency, no hooks. Every function is pure and unit-tested in `src/lib/color.test.ts`.

**Types:**
- `RGBA { r, g, b, a }`: channels 0–255 (not rounded while converting or compositing), `a` 0–1.
- `HSVA { h, s, v, a }`: `h` 0–360, `s` / `v` 0–100.
- `HSLA { h, s, l, a }`: `h` 0–360, `s` / `l` 0–100.
- `ColorFormat = "hex" | "rgb" | "hsl"`.

**Parsing:** `parseColor(input: string): RGBA | null`. Trimmed, case-insensitive:
- hex: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`; also without the `#` for 3/6/8 digits (typed into the input);
- `rgb()` / `rgba()`: comma syntax `rgb(12, 34, 56)` / `rgba(12, 34, 56, 0.5)` and space syntax `rgb(12 34 56 / 50%)`; channels as numbers or percentages, alpha as a number or a percentage;
- `hsl()` / `hsla()`: the same two syntaxes; hue as a number, `deg`, `turn` or `rad`; saturation and lightness as percentages (a bare number is read as a percentage, as CSS Color 4 allows);
- out-of-range values clamp (`rgb(300 0 0)` → r 255); anything else (named colours, `color()`, `oklch()`, malformed input) → `null`.

**Formatting:**
- `formatHex(rgba, { alpha = "auto" })` → lowercase `#rrggbb`; `#rrggbbaa` when `alpha` is `"auto"` and `a < 1`, or always with `alpha: "always"`, never with `"never"`. Channels round half up.
- `formatRgb(rgba)` → `rgb(12 34 56)` or `rgb(12 34 56 / 0.5)` (CSS Color 4 space syntax; alpha with at most 2 decimals).
- `formatHsl(rgba)` → `hsl(210 50% 40%)` or `hsl(210 50% 40% / 0.5)` (integers).
- `formatColor(rgba, format)` dispatches on `ColorFormat`.

**Conversions:** `rgbToHsv`, `hsvToRgb`, `rgbToHsl`, `hslToRgb`. A grey reports hue 0; the caller keeps its own hue (the ColorPicker does).

**Contrast:**
- `relativeLuminance(rgba)`: WCAG 2.x (sRGB linearised with the 0.04045 threshold), on unrounded channels.
- `compositeOver(fg, bg)`: alpha-composites `fg` on an opaque `bg`, without rounding (50% black over white gives channels of 127.5).
- `contrastRatio(a, b)`: composites `a` over `b` when `a` has alpha, then `(L1 + 0.05) / (L2 + 0.05)`, rounded to 2 decimals at the end only.
- `wcagContrast(ratio)` → `{ aa: ratio >= 4.5, aaLarge: ratio >= 3, aaa: ratio >= 7, aaaLarge: ratio >= 4.5 }`.
- `readableForeground(bg)` → `"#000000"` or `"#ffffff"`, whichever contrasts more (ties go to white).

**Tests:**
- a parse table: every syntax above, upper case, whitespace, missing `#`, the clamping cases, and the `null` cases;
- format round trips: `formatHex(parseColor(x)!)` for 3/4/6/8-digit hex; rgb/hsl output strings;
- conversions: the primaries, secondaries, white, black, a mid grey, and a fixed sample round-tripping HSV → RGB → HSV and HSL → RGB → HSL within 0.5;
- contrast (values computed for this spec): `#000` / `#fff` = 21; `#777777` / `#ffffff` = 4.48; `#ffffff` on itself = 1; order does not matter; 50%-alpha black over white = 3.98 (the unrounded 127.5 grey; `#808080` would give 3.95, so the test proves no rounding); `#1d4ed8` / `#ffffff` = 6.7; `#ffff66` / `#ffffff` = 1.06; `#1d4ed8` / `#0f172a` = 2.66; `wcagContrast` at 2.99 / 3 / 4.49 / 4.5 / 7;
- `readableForeground` on `#ffff00` (black) and `#1d4ed8` (white).

## 2. ColorPicker (Tasks 2–4)

**Parts** (`src/components/color-picker/color-picker.tsx`, `"use client"`; class strings in `color-picker-classes.ts`, server-safe). The inline picker and its parts are Task 3; `ColorPickerPopover` is Task 4 (`color-picker-popover.tsx` in the same folder).
- **`ColorPicker`:** the inline root, a `div role="group"` with `data-slot="color-picker"`.
  - Props: `value` / `defaultValue` (default `"#000000"`) / `onValueChange(hex)` (every change, also during a drag) / `onValueCommitted(hex)` (pointer up, each key press, an input commit, a swatch, the eyedropper), `alpha` (show the alpha slider and keep alpha; default `false`, which reports 6-digit hex and drops an incoming alpha), `swatches` (`string[] | { value: string; label: string }[]`), `format` / `defaultFormat` (default `"hex"`) / `onFormatChange`, `disabled`, `name`, `form`, `aria-label` (default "Color picker"; a Field label replaces it, see below). No `required` (scope ruling).
  - Classes: `flex w-64 flex-col gap-3 data-disabled:cursor-not-allowed data-disabled:opacity-50`.
  - With no `children` it renders the default composition: `ColorArea`, `ColorHueSlider`, `ColorAlphaSlider` (when `alpha`), a row of `ColorInput` + `ColorFormatToggle` + `ColorEyeDropper`, then `ColorSwatches` (when `swatches`). With `children` it renders them instead (every part reads the root's context).
- **`ColorArea`:** the 2D saturation/brightness plane.
  - Container `data-slot="color-area"`: `relative h-40 w-full touch-none select-none rounded-md forced-color-adjust-none forced-colors:border forced-colors:border-[CanvasText]`, `dir="ltr"`, background `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(<h> 100% 50%))` (inline style).
  - Thumb `data-slot="color-area-thumb"`, the focusable `role="slider"`, focused directly (`toggleFocusClasses` on `:focus-visible`): `absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.45)] ${toggleFocusClasses} forced-colors:border-[CanvasText] forced-colors:focus-visible:outline-[Highlight]`, at `left: s%`, `top: (100 − v)%`, filled with the current opaque colour.
  - ARIA (React Aria's ColorArea approach, on one element): `aria-roledescription` "2D slider", `aria-valuemin` 0, `aria-valuemax` 100, `aria-valuenow` = saturation, `aria-valuetext` from `getValueText(s, v)` (default "Saturation 72%, Brightness 40%"), `aria-label` (default "Saturation and brightness"), `aria-disabled` when disabled (and `tabIndex` −1).
- **`ColorHueSlider` / `ColorAlphaSlider`:** the 1D channels.
  - Track `data-slot="color-hue-slider"` / `"color-alpha-slider"`: `relative h-3 w-full touch-none select-none rounded-full forced-color-adjust-none forced-colors:outline forced-colors:outline-1 forced-colors:outline-[CanvasText]`, `dir="ltr"`. The hue track's background is `linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)`; the alpha track layers `linear-gradient(to right, transparent, <opaque colour>)` over the checkerboard.
  - Thumb `data-slot="color-slider-thumb"`, `role="slider"`, focused directly: `absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.45)] ${toggleFocusClasses} forced-colors:border-[CanvasText] forced-colors:focus-visible:outline-[Highlight]`.
  - ARIA: `aria-orientation="horizontal"`, `aria-valuemin` / `aria-valuemax` (hue 0–360, alpha 0–100), `aria-valuenow`, `aria-valuetext` from `getValueText` (hue default "210°", alpha default "50%"), `aria-label` (defaults "Hue", "Alpha").
- **`ColorInput`:** a native `<input type="text">` with `data-slot="color-input"`, `inputVariants({ size: "sm" })` + `font-mono`, `spellCheck={false}`, `autoComplete="off"`, `aria-label` (default "Color value"). It shows the value in the root's format (its own `format` prop pins one).
- **`ColorFormatToggle`:** a Base UI `ToggleGroup` (single, never empty) of three `ToggleGroupItem`s, `size="sm"` (Toggle has no `xs`; it lines up with the `sm` input), `variant="outline"`, `data-slot="color-format-toggle"`, `aria-label` (default "Color format"). Each item shows and is named by `formatLabel(format)` (a label function; default `hex` → "HEX", `rgb` → "RGB", `hsl` → "HSL"). It drives the root's `format`.
- **`ColorEyeDropper`:** an outline neutral `icon-sm` Button with a `PipetteIcon` (new in `icons.tsx`), `data-slot="color-eye-dropper"`, `aria-label` (default "Pick a color from the screen"). It renders `null` unless `"EyeDropper" in window`, checked in an effect after mount (so the server HTML and the first client render agree: nothing).
- **`ColorSwatches` / `ColorSwatch`:** a Base UI `ToggleGroup` (single; `data-slot="color-swatches"`, `flex flex-wrap gap-1.5`, `aria-label` default "Swatches") of `Toggle`s (`data-slot="color-swatch"`), each named by its `label` (default the hex).
  - Swatch classes: `relative size-6 cursor-pointer rounded-md border border-black/10 forced-color-adjust-none ${toggleFocusClasses} forced-colors:border-[CanvasText] forced-colors:focus-visible:outline-[Highlight] data-pressed:border-2 data-pressed:border-foreground forced-colors:data-pressed:border-[Highlight] data-disabled:cursor-not-allowed transition-[border-color,outline-color] duration-150 ease-out motion-reduce:transition-none`, background the swatch colour (over the checkerboard when it has alpha).
  - The pressed swatch (its hex equals the value, compared normalised) also shows a `CheckIcon` in `readableForeground(swatch)`, so the selection is never colour-only. Pressing the pressed swatch does nothing (the group never empties).
- **`ColorPickerPopover`** (Task 4): the trigger + Popover variant.
  - Props: the root's props, plus `triggerLabel(hex)` (a label function; default `` (hex) => `Choose color: ${hex}` ``), `title` (the popup's visually hidden title, default "Color picker"), `side` / `align` (PopoverContent's), `contentClassName`, and `children` (the popup's picker composition; default the inline default composition).
  - The trigger: `Button variant="outline" color="neutral"` with `data-slot="color-picker-trigger"` and `justify-start gap-2 font-mono`, holding a swatch `span` (`size-4 rounded-sm border border-black/10 forced-color-adjust-none forced-colors:border-[CanvasText]`, `aria-hidden`, checkerboard behind an alpha colour) and the value text. Its name is `aria-label={triggerLabel(hex)}`: the colon lives inside the label function's string, so there is no sr-only text and no whitespace question; the visible hex is part of the name (WCAG 2.5.3 label in name).
  - The popup: `PopoverContent` with `data-slot="color-picker-popover"`, `w-auto p-3`, and a visually hidden `PopoverTitle` (`title`). Focus goes to the area thumb on open (`initialFocus`) and back to the trigger on close.
  - It owns the value state and the form control (the hidden input stays mounted while closed). The picker inside is controlled by it and does not join the Field or Form: an internal `ColorPickerHostContext` (`{ joinsForm: false }`, not exported) tells the inner `ColorPicker` to skip its form control, Field labelling and focus scope. The inline root renders its form wiring in an internal `ColorPickerFormControl` child only when it joins, so no hook is conditional.
- **Checkerboard:** `checkerboardClasses` = `bg-[conic-gradient(#d4d4d4_25%,#fff_0_50%,#d4d4d4_0_75%,#fff_0)] bg-[length:8px_8px]` (forced-color-adjust none wherever it is used).

**Behaviour:**
- State: the root holds HSVA. A controlled `value` that parses to the hex the state already formats to keeps the state (the hue survives a grey); any other value replaces it, keeping the previous hue when the new saturation is 0. An unparsable `value` is ignored with a dev-only `console.warn`.
- **Area keys** (physical in RTL too): ←/→ saturation −1/+1, ↑/↓ brightness +1/−1, Shift+arrow ±10, PageUp/PageDown brightness ±10, Home/End saturation 0/100. Clamped; each key press commits.
- **Channel keys:** ←/↓ −1, →/↑ +1, Shift+arrow and PageUp/PageDown ±10 (hue ±15 for PageUp/PageDown), Home/End to min/max. Hue 360 is allowed and equals 0 in the output.
- **Pointer:** a primary-button `pointerdown` on the area or a track moves the thumb there, focuses the thumb (`preventDefault` on the pointerdown so no text is selected, then `.focus({ preventScroll: true })`), and captures the pointer (`setPointerCapture`); moves update; `pointerup` / `pointercancel` / `lostpointercapture` end the drag and commit. `data-dragging` is set on the container while dragging (thumb `cursor-grabbing`).
- **Input:** typing does not change the value. Enter or blur commits a parsable text (any format, §1) and reformats it in the display format; unparsable text sets `aria-invalid` while focused and reverts on blur. Escape reverts the text; when the text differed from the value it also calls `claimEscape(event)`, so an enclosing `ColorPickerPopover` (or any Tessera overlay) closes only on the next Escape.
- **EyeDropper:** `new EyeDropper().open()` → set and commit `sRGBHex`; an `AbortError` (the user pressed Escape) is ignored; the button is disabled while picking.
- **Disabled:** every part ignores input; thumbs are `aria-disabled` and out of the Tab order; the swatches and format toggle are disabled.
- **Field and Form:**
  - The hook (Task 2): `useDateFormControl` and `useFocusScope` are not date-specific. Task 2 moves them, with the visually hidden input styles, into `src/components/field/form-control.tsx` as `useFormControl` / `useFocusScope`; `date-form-control.tsx` keeps the date validation helpers and imports them. The hidden input's `data-slot` becomes a `slot` option (the date controls pass `"date-form-control"`, unchanged; the ColorPicker passes `"color-picker-form-control"`). No behaviour change (the date and Form suites guard it); the backlog's Base UI pin note gets the new path.
  - The hidden input's value is the hex (`name`, `form`, `disabled`; never `required`); `onFormSubmit` reports the hex under the Field's name; `controlRef` is the area thumb (inline) or the trigger (popover), which Form focuses on an invalid submit (e.g. a Field `validate` that rejects the colour).
  - Labelling: in a Field, the root group (inline) or the trigger (popover) is `aria-labelledby` the Field label (inline: the label id alone; popover: label id + the trigger's own id, so "Primary color Choose color: #1d4ed8"), as DateField and DatePicker read it; a FieldDescription describes the same element.
  - Blur: `useFocusScope` over the root (inline) or the trigger + popup (popover).

**RTL:** the area and tracks are `dir="ltr"` (scope ruling). The input row, format toggle and swatches follow the page: the ToggleGroups are wrapped in a Base UI `DirectionProvider` fed by `useElementDirection(rootRef)`, so → in RTL moves to the previous swatch.

**Reduced motion:** the thumbs have no transitions (they track the pointer); swatches and buttons use the standard `transition-[…] duration-150 ease-out motion-reduce:transition-none`.

**Tests, inline (Task 3):**
- rendering: the default composition's parts and `data-slot`s; `alpha` adds the alpha slider; `swatches` adds the swatches; children replace the default;
- ARIA: the area thumb's role, `aria-roledescription`, valuemin/max/now, valuetext ("Saturation 100%, Brightness 100%" for `#ff0000`); each channel's role, orientation, values and valuetext; custom `getValueText` and `aria-label`s;
- the full area key table (every key, with Shift, clamping at 0 and 100) and the channel key table (hue and alpha), each asserting the reported hex;
- RTL: under `dir="rtl"`, → on the area still increases saturation and the thumb moves right (geometry); → in the swatches moves to the previous swatch;
- pointer: a press at the area's centre gives saturation 50 / brightness 50; a drag to the top-right corner and beyond clamps to `s 100, v 100`; `onValueChange` fires during the drag, `onValueCommitted` once at the end. Drags use `userEvent.dragAndDrop(locator, locator, { force, sourcePosition, targetPosition, steps } as Parameters<typeof userEvent.dragAndDrop>[2])` (real Playwright mouse events, so pointer capture is real), with a `MutationObserver` recording `data-dragging` mid-drag, as the Drawer swipe tests do (`drawer.test.tsx` ~795–815);
- the hue survives a grey: drag the hue to 210, then saturation to 0, then back up: the hue is still 210;
- input: typing `rgb(29 78 216)` + Enter → `#1d4ed8` and the text shows the hex; an invalid text has `aria-invalid` and reverts on blur; Escape reverts;
- format toggle: HSL shows `hsl(…)`; ← / → move within it; `formatLabel` localises the items;
- swatches: pressing one sets and commits; the pressed one has `aria-pressed="true"` and a check icon; a value that matches no swatch leaves all unpressed;
- EyeDropper: hidden without `window.EyeDropper`; with a stub class (`vi.stubGlobal`) the button appears, sets the value from `sRGBHex`, and an `AbortError` leaves the value unchanged;
- controlled/uncontrolled pairs: `defaultValue`; `value` + `onValueChange`; a controlled parent that ignores changes keeps the thumb where `value` puts it; `alpha` off drops an incoming `#rrggbbaa`'s alpha; `format` / `defaultFormat`;
- Form: `name` → FormData has the hex; `onFormSubmit` reports it under the Field name; the Field label names the root group; a Field `validate` that rejects focuses the area thumb on submit; the Field's blur (touched) fires when focus leaves the picker; disabled submits nothing;
- focus rings: Tab to each thumb → computed `outline-style: solid`, width 2px;
- forced colors: the area and tracks keep their gradients (`forced-color-adjust: none` computed) and have CanvasText borders/outlines; thumbs `outline-style: none` until focused, then Highlight; the pressed swatch has a Highlight border and `forced-color-adjust: none`;
- reduced motion: swatch transition-duration 0s;
- axe light and dark: inline (with alpha and swatches), disabled, in a Field; violations and incomplete both `[]`.

**Tests, popover (Task 4):**
- the trigger's name "Choose color: #1d4ed8" (exact); `triggerLabel` localises; in a Field, "Primary color Choose color: #1d4ed8";
- opening focuses the area thumb; Escape closes and focus returns to the trigger; the hidden input is present while closed;
- the Escape layering: the first Escape after an edit in the ColorInput reverts the text and leaves the popover open, the second closes it;
- one control: a `ColorPickerPopover` with `name` inside a `Field` inside a `Form` gives exactly one hidden `[data-slot=color-picker-form-control]` input and one FormData entry for the name; `onFormSubmit` has one key; the Field label names the trigger, not the inner group;
- the Field's blur fires only when focus leaves the trigger + popup;
- controlled/uncontrolled pairs as for the inline picker;
- forced colors: the trigger swatch keeps its colour (`forced-color-adjust: none`) with a CanvasText border;
- axe light and dark: closed, and open (`auditOpenOverlay`); violations and incomplete both `[]`.

## 3. Rating (Task 5)

**Parts:** `Rating` (`src/components/rating/rating.tsx`, `"use client"`), one component. `StarIcon` is added to `icons.tsx` (a 24-unit five-point star path, `stroke-linejoin="round"`).

**Props:** `value` / `defaultValue` (`number | null`, default `null`) / `onValueChange(value: number | null)`, `max` (default 5), `allowHalf` (default `false`), `clearable` (default `false`), `readOnly` (display mode, below), `disabled`, `name`, `form`, `required`, `size` (`"sm" | "md" | "lg"`, default `"md"`), `itemLabel(value, max)` (default "1 star" / "2.5 stars", English plural on the number), `valueLabel(value, max)` (display mode; default "3.5 out of 5 stars", `null` → "No rating"), `aria-label` / `aria-labelledby`. Numbers in the default labels are formatted with `Intl.NumberFormat("en", { maximumFractionDigits: 1 })` (a fixed locale, so server and client agree; localise through the label functions).

**Fill (both modes):** each item's filled star is clipped to its fill through one CSS variable, `--rating-fill` (0%, 50%, 100%, or any fraction in display mode), set inline on the item:
- LTR: `[clip-path:inset(0_calc(100%-var(--rating-fill))_0_0)]` (the fill grows from the left, the inline start);
- RTL: `rtl:[clip-path:inset(0_0_0_calc(100%-var(--rating-fill)))]` (it grows from the right).
- This is CSS only (Tailwind's `rtl:` variant matches a `dir="rtl"` ancestor), so the server HTML is right in both directions and no JS reads the direction for the fill.

**Interactive structure:**
- The root is Base UI `RadioGroup` (`data-slot="rating"`, `data-size`), wrapped in a Base UI `DirectionProvider` fed by `useElementDirection(rootRef)`.
- Per star *i* (1…`max`) a `span data-slot="rating-item"` holds two stacked SVG stars (`aria-hidden`): the empty outline and the filled star (clipped by `--rating-fill`).
- Radios, as Base UI `Radio.Root` (`data-slot="rating-radio"`), absolutely positioned over the star: without `allowHalf`, one radio `value={i}` covering it; with `allowHalf`, `value={i − 0.5}` over the inline-start half and `value={i}` over the inline-end half (DOM order ascending, so the arrows step by 0.5). Each is named `itemLabel(value, max)`.
- The fill shows the hover preview while a mouse or pen hovers a radio (`pointerType !== "touch"`), else the value. Items at or below it get `data-filled` (or `data-half`), and the root gets `data-preview` while previewing.
- `clearable`: a click (or Space, which Base UI turns into a click) on the checked radio sets `null` (`onValueChange(null)`). Without `clearable` it does nothing, as a radio.

**Display mode** (`readOnly`): a `span role="img"` with `aria-label={valueLabel(value, max)}`, `data-slot="rating"`, `data-readonly`, holding the same star visuals with any fractional fill (4.3 → the fifth item's `--rating-fill: 30%`). It has no radios and no Tab stop, and it ignores `name` / `required` (it is not a form control: a read-only average is display, not input; documented). Base UI's own `readOnly` radio state is not exposed. Cost if wrong: a focusable read-only rating inside a form needs a disabled-looking interactive one instead.

**Styling:**
- Root: `inline-flex items-center gap-0.5 data-disabled:cursor-not-allowed data-disabled:opacity-50` (a disabled RadioGroup's radios leave the Tab order, so the §4 opacity look applies).
- Item: `relative inline-flex shrink-0 rounded-sm forced-color-adjust-none outline-none outline-offset-2 outline-ring has-[[role=radio]:focus-visible]:outline-2 has-[[role=radio]:focus-visible]:outline-solid forced-colors:has-[[role=radio]:focus-visible]:outline-[Highlight]` + sizes `sm: size-4`, `md: size-5`, `lg: size-6`. The ring goes round the whole star when either half is focused (the radio itself is `outline-none`).
- Radio: `absolute inset-y-0 cursor-pointer rounded-sm outline-none data-disabled:cursor-not-allowed` + `inset-x-0` (whole) / `start-0 w-1/2` / `end-0 w-1/2` (halves).
- Empty star: `absolute inset-0 size-full fill-none stroke-current stroke-[1.5] text-muted-foreground forced-colors:text-[CanvasText]`.
- Filled star: `absolute inset-0 size-full fill-current stroke-current stroke-[1.5] text-warning [clip-path:inset(0_calc(100%-var(--rating-fill))_0_0)] rtl:[clip-path:inset(0_0_0_calc(100%-var(--rating-fill)))] transition-[clip-path,color] duration-150 ease-out motion-reduce:transition-none forced-colors:text-[CanvasText] in-data-preview:text-warning-hover forced-colors:in-data-preview:text-[Highlight]`.
- Forced colors: filled stars are solid CanvasText and empty ones are CanvasText outlines, so filled vs empty is a shape difference (solid vs outline), not colour alone; the preview turns Highlight; the focus ring is Highlight. The item sets `forced-color-adjust-none` so the SVG fills are not overridden.

**RTL:** the DOM order is ascending and the row is `inline-flex`, so star 1 sits at the inline start (the right). `DirectionProvider` makes ← the "next" key. The fill grows from the right (above).

**Tests:**
- structure: `max` radios named "1 star" … "5 stars" in one `radiogroup` named by `aria-label` or a Field label; `max={10}`;
- keyboard (pin Base UI's behaviour; it is the APG radio group): Tab focuses the checked radio (or the first when none); → / ↓ check the next value, ← / ↑ the previous; at the ends, record whether Base UI wraps (RadioGroup's default) and pin it; Space checks the focused radio; with `clearable`, Space on the checked radio clears to `null`; without, it keeps the value; Tab leaves the group;
- `allowHalf`: 10 radios "0.5 stars" … "5 stars"; → steps by 0.5; a click on the inline-start half of star 3 → 2.5 (and in RTL on its right half); the third item's `--rating-fill` is 50% and its filled star's visible part is the inline-start half (geometry in LTR and RTL);
- RTL: under `dir="rtl"`, ← checks the next value, star 1's rect is right of star 2's;
- pointer: a click on star 3 → 3; with `clearable` a second click → `null`; mouse hover over star 4 previews (`data-filled` on items 1–4, `data-preview` on the root), and leaving restores the value; a touch tap does not leave a preview (the Phase I carousel `tap()` pattern: dispatched `PointerEvent`s with `pointerType: "touch"`, `carousel.test.tsx` ~875, plus a dispatched `pointerover` / `pointerenter` with `pointerType: "touch"`);
- controlled/uncontrolled pairs: `defaultValue`; `value` + `onValueChange`; a controlled parent that ignores changes keeps its value;
- display mode: `role="img"` named "3.5 out of 5 stars"; no radios and no Tab stop; 4.3 sets the fifth item's `--rating-fill` to 30% and its filled star's visible width is 30% of the item, from the left in LTR and from the right in RTL (geometry); `valueLabel` overrides; `null` → "No rating";
- disabled: no Tab stop, clicks ignored, opacity 0.5, cursor `not-allowed`;
- Form: `name="rating"` → FormData `rating=4`; `required` with no value blocks submit and focuses the first radio; `onFormSubmit` reports `4`; `<Field invalid>` + FieldError shows; `itemLabel` localises the radio names;
- sizes: the item box is 16 / 20 / 24px;
- focus ring: Tab → the item's computed `outline-style: solid`, width 2px;
- forced colors: a filled star's computed `fill` is CanvasText and an empty one's is `none`; the item has `forced-color-adjust: none`; the ring is `none` until focused, then Highlight;
- reduced motion: the filled star's transition-duration is 0s;
- axe light and dark: empty, with a value, `allowHalf`, display mode, disabled, in a Field; violations and incomplete both `[]`.

## 4. Stepper (Task 6)

**Parts** (`src/components/stepper/stepper.tsx`, `"use client"` for the context and state):
- **`Stepper`:** an `<ol role="list">` (the explicit role keeps the list semantics that Safari drops for `list-style: none`) with `data-slot="stepper"`, `data-orientation`, `aria-label` (default "Progress"; or `aria-labelledby`).
  - Props: `value` / `defaultValue` (0-based current step, default 0) / `onValueChange(step)`, `orientation` (`"horizontal"` default | `"vertical"`), `linear` (default `true`), `stateLabel(state)` (the visually hidden state text; defaults `complete` "Completed", `error` "Error", `current` "", `upcoming` "").
  - Classes: `flex w-full list-none gap-2 data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:items-start data-[orientation=vertical]:flex-col`.
- **`StepperItem`:** an `<li>` with `data-slot="stepper-item"`, `data-state` (`complete | current | upcoming | error`), `data-orientation`, `data-disabled` when unreachable.
  - Props: `step` (required, 0-based), `completed` (overrides the derived completion, below), `error`, `disabled`.
  - Classes: `group/stepper-item relative flex gap-2 data-[orientation=horizontal]:flex-1 data-[orientation=horizontal]:items-center data-[orientation=horizontal]:last:flex-none data-[orientation=vertical]:flex-col`.
- **`StepperTrigger`:** a `<button type="button">` with `data-slot="stepper-trigger"`.
  - It holds the indicator, title and description, plus a visually hidden `span` with `stateLabel(state)` (when non-empty).
  - Name: `aria-labelledby` = the title's id + the state span's id ("Shipping Completed"); `aria-describedby` = the description's id. Ids come from the item's context (`useId`).
  - `aria-current="step"` on the current step.
  - Classes: `group/stepper-trigger flex min-w-0 cursor-pointer items-center gap-3 rounded-md text-start ${toggleFocusClasses} forced-colors:focus-visible:outline-[Highlight] data-disabled:cursor-not-allowed`.
- **`StepperIndicator`:** a `span` (`aria-hidden`, `data-slot="stepper-indicator"`, `data-state`).
  - Content: the step number (`step + 1`) for current/upcoming, `CheckIcon` for complete, `AlertIcon` (new in `icons.tsx`: a circle with "!") for error; `children` override.
  - Classes: `flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium tabular-nums transition-[color,background-color,border-color] duration-150 ease-out motion-reduce:transition-none [&_svg]:size-4`, plus by state:
    - upcoming: `border-border bg-background text-muted-foreground forced-colors:border-[CanvasText] forced-colors:text-[CanvasText]`;
    - current: `border-primary bg-background text-primary forced-colors:border-[Highlight] forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none`;
    - complete: `border-primary bg-primary text-primary-foreground forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]` (the check icon carries the meaning);
    - error: `border-danger bg-danger text-danger-foreground forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]` (the "!" icon carries it).
- **`StepperTitle`:** a `span`, `data-slot="stepper-title"`, `text-sm font-medium text-foreground group-data-disabled/stepper-trigger:text-muted-foreground forced-colors:group-data-disabled/stepper-trigger:text-[GrayText] group-data-[state=error]/stepper-item:text-danger`.
- **`StepperDescription`:** a `span`, `data-slot="stepper-description"`, `text-xs text-muted-foreground forced-colors:group-data-disabled/stepper-trigger:text-[GrayText]`.
- **`StepperSeparator`:** a `div` (`aria-hidden`, `data-slot="stepper-separator"`, `data-state` = its item's state), placed inside the item after the trigger.
  - Classes: `shrink-0 rounded-full bg-border data-[state=complete]:bg-primary forced-colors:bg-[CanvasText] group-data-[orientation=horizontal]/stepper-item:h-0.5 group-data-[orientation=horizontal]/stepper-item:flex-1 group-data-[orientation=vertical]/stepper-item:ms-[calc(1rem-1px)] group-data-[orientation=vertical]/stepper-item:min-h-6 group-data-[orientation=vertical]/stepper-item:w-0.5 forced-colors:group-data-[orientation=horizontal]/stepper-item:data-[state=complete]:h-1 forced-colors:group-data-[orientation=vertical]/stepper-item:data-[state=complete]:w-1`.
  - Forced colors: a complete separator is drawn thicker, not recoloured, so it does not rely on colour.

**State and reachability** (precise; one definition, used by both the styling and the triggers):
- *Complete:* `complete(k) = !error_k && (completed_k ?? k < value)`. An explicit `completed` wins over the position in both directions; an `error` step is never complete.
- *State:* `error_k` → `error`; else `complete(k)` → `complete`; else `k === value` → `current`; else `upcoming`. (A step marked `completed` while it is the current one shows `complete`, and still carries `aria-current="step"`: `aria-current` follows `value`, not the state.)
- *Frontier:* the first index `f ≥ value` such that `complete(f)` is false; if every step from `value` on is complete, `f` is the last index. It is the step right after the run of complete steps that starts at the current one.
- *Reachable:* `!disabled_k && (!linear || k <= value || k <= f)`. So in a linear Stepper every step up to the current one is reachable whatever its state (an earlier `error` step does not block anything, and neither blocks the current one), plus the run of complete steps after the current one and the step right after that run. Non-linear: every step that is not `disabled`.
- Examples (linear, 4 steps): `value` 0, nothing completed → reachable {0}. `value` 0, `completed` {0} → {0, 1}. `value` 0 after going Back, `completed` {0, 1, 2} → {0, 1, 2, 3}. `value` 2, `error` on 1 → {0, 1, 2}. `value` 1, `completed` {0, 2} (step 1 not complete) → {0, 1} (2 is complete but past the frontier 1).
- The Stepper does not remember completion: a consumer that lets the user go Back and keep later steps reachable passes `completed` explicitly from its own set (the Theme Studio does, §6).

**Behaviour:**
- An unreachable trigger is `aria-disabled="true"` + `data-disabled`: focusable, a click or Enter does nothing, muted text (GrayText in forced colors), opacity 1.
- Activating a reachable trigger calls `onValueChange(step)` (not for the current step: no change, no call).
- Keyboard: Tab / Shift+Tab move between triggers in order; Enter and Space activate (native button). No arrow keys (scope ruling).
- A display-only Stepper has no `StepperTrigger`s: a `StepperItem` that has no `StepperTrigger` among its direct children (or inside a fragment; matched by element type, as Tree matches `TreeItemContent`) puts `aria-current="step"` on its `li` instead. Server-safe: decided from the element children, not after mount.
- The step count is not announced by the Stepper (the list gives "list, 4 items" and each "1 of 4").

**RTL:** CSS only. The horizontal row is a flex row, so it runs right to left; the separators and the vertical indent are logical (`ms-`). There are no direction-dependent keys.

**Reduced motion:** the indicator's colour transition is `motion-reduce:transition-none`.

**Tests:**
- structure: `ol` with `role="list"` named "Progress" (or `aria-label`), `li` per item, `data-state` per item for value 0 / 2 / last, and with `error` / `completed` overrides (including `completed={false}` on an earlier step, and `completed` on the current step);
- `aria-current="step"` on the current trigger only; on the `li` when the item has no trigger (display-only), including inside a fragment;
- names: the trigger's accessible name is "Shipping Completed" for a complete step and "Payment" for the current; its description is the StepperDescription; `stateLabel` localises;
- reachability: each example in the table above, as a table-driven test asserting `aria-disabled` per step and that clicking / Enter on an unreachable step calls nothing; non-linear: every enabled step is reachable; `disabled` steps are never reachable;
- keyboard: Tab visits every trigger in order (including the `aria-disabled` ones), Enter and Space activate a reachable one; ← / → / Home / End do nothing (pinned);
- controlled/uncontrolled pairs: `defaultValue`; `value` + `onValueChange`; a controlled parent that ignores the change keeps the current step;
- indicator content: the number, the check icon on complete, the alert icon on error, `children` override;
- orientation: horizontal separators are 2px tall and stretch; vertical separators are 2px wide and centred under the indicator (geometry, LTR and RTL);
- RTL: under `dir="rtl"` the first item's rect is to the right of the second's;
- disabled look: a focused `aria-disabled` trigger has opacity 1, a full-strength solid ring, and muted title text;
- forced colors: the current indicator has Highlight / HighlightText and `forced-color-adjust: none`; a complete step shows the check icon and a 4px separator; the ring is `none` until focused, then Highlight; an `aria-disabled` title is GrayText;
- reduced motion: the indicator's transition-duration is 0s;
- axe light and dark: horizontal, vertical, display-only, with an error step; violations and incomplete both `[]`.

## 5. Resizable (APG window splitter) (Task 7)

**Parts** (`src/components/resizable/resizable.tsx`, `"use client"`):
- **`ResizablePanelGroup`:** a `div`, `data-slot="resizable-panel-group"`, `data-orientation`, `data-dragging` while a handle is dragged.
  - Props: `orientation` (`"horizontal"` default: panels side by side | `"vertical"`), `layout` / `defaultLayout` (`number[]`, percentages in panel order) / `onLayoutChange(layout)` (every change, also during a drag), `onLayout(layout)` (committed: drag end, each key press, a collapse or restore; the one to persist), `keyboardStep` (default 10, percentage points).
  - Classes: `flex size-full data-[orientation=vertical]:flex-col data-dragging:select-none data-dragging:data-[orientation=horizontal]:cursor-col-resize data-dragging:data-[orientation=vertical]:cursor-row-resize`.
  - Direction: `useElementDirection` on the group element (§0.2), read on mount and on `dir` mutations, never per drag frame.
- **`ResizablePanel`:** a `div`, `data-slot="resizable-panel"`, `id` (the prop, else `useId`), `data-collapsed` when at its collapsed size.
  - Props: `defaultSize`, `minSize` (default 0), `maxSize` (default 100), `collapsible` (default `false`), `collapsedSize` (default 0; must be below `minSize`), `onCollapsedChange(collapsed)`.
  - Style `flex: <size> 1 0px` (inline), classes `min-h-0 min-w-0 overflow-hidden`.
  - A panel collapsed to size 0 is `inert`, so Tab skips its hidden content.
- **`ResizableHandle`:** a `div role="separator"` with `tabIndex=0`, `data-slot="resizable-handle"`, `data-orientation` (the group's), `data-dragging`, `data-disabled`.
  - ARIA: `aria-orientation` is the separator's own orientation (`"vertical"` in a horizontal group); `aria-valuenow` = the preceding panel's size (rounded to an integer), `aria-valuemin` / `aria-valuemax` = its effective limits (below), `aria-controls` = the preceding panel's id, `aria-label` (default "Resize panel"; pass e.g. "Resize sidebar") or `aria-labelledby` (the APG suggests the primary pane's label).
  - Props: `withHandle` (renders the grip), `disabled` (not focusable, `tabIndex` −1, `aria-disabled`, no drag).
  - Classes: `relative flex shrink-0 touch-none select-none items-center justify-center bg-border ${toggleFocusClasses} transition-[background-color,outline-color] duration-150 ease-out motion-reduce:transition-none not-data-disabled:hover:bg-ring data-dragging:bg-ring forced-colors:bg-[CanvasText] forced-colors:focus-visible:outline-[Highlight] forced-colors:data-dragging:bg-[Highlight] data-disabled:cursor-not-allowed after:absolute data-[orientation=horizontal]:w-px data-[orientation=horizontal]:cursor-col-resize data-[orientation=horizontal]:after:inset-y-0 data-[orientation=horizontal]:after:-inset-x-1 data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:cursor-row-resize data-[orientation=vertical]:after:inset-x-0 data-[orientation=vertical]:after:-inset-y-1` (the `after:` element widens the hit area to 9px).
  - Grip (`withHandle`): `span data-slot="resizable-handle-grip"`, `aria-hidden`, `z-10 flex h-6 w-3 items-center justify-center rounded-sm border border-border bg-border forced-colors:border-[CanvasText] in-data-[orientation=vertical]:rotate-90 [&_svg]:size-2.5`, holding `GripVerticalIcon` (new in `icons.tsx`).

**Layout:**
- Panel order is DOM order. Before mount (server HTML, first render) each panel's index is guessed from the group's element children that are `ResizablePanel`s (handles skipped, fragments flattened), as Carousel guesses its slides; the panels' registration replaces it after mount.
- Initial layout: a valid `defaultLayout` (one entry per panel, summing to 100 ± 0.1) wins; otherwise each panel's `defaultSize`, and the remainder split equally among the panels without one; then each size is clamped to its limits and the total normalised to 100. An invalid `defaultLayout` logs a dev-only `console.warn`.
- Panels mounting or unmounting (a conditional panel): the kept panels keep their relative sizes, a new panel takes its `defaultSize` (or an equal share), and the result is clamped and normalised and reported through `onLayoutChange` and `onLayout`.
- A controlled `layout` must match the panel count; one that does not is normalised the same way and reported through `onLayoutChange`.

**Constraints:** a handle between panels *i* (preceding) and *i+1* (following) moves only those two (scope ruling). Let `T = s_i + s_{i+1}`.
- A panel's *allowed sizes* are `[min, max]`, plus `{collapsedSize}` when it is collapsible. The gap `(collapsedSize, min)` is never a resting size.
- The preceding panel's effective limits, which are `aria-valuemin` / `aria-valuemax` and the Home / End targets:
  - `lo = max(collapsible_i ? collapsedSize_i : min_i, T − max_{i+1})`;
  - `hi = min(max_i, T − (collapsible_{i+1} ? collapsedSize_{i+1} : min_{i+1}))`.
  - So End can collapse a collapsible following panel and Home a collapsible preceding one, exactly where a drag can; `aria-valuemax` never promises a size the keys and the drag cannot reach.
- Gap snapping, the one rule for keys and drags: a target that would put either panel inside its gap goes to the gap's edge in the direction of travel. Shrinking a collapsible panel below its `min` collapses it (keys); growing it from collapsed goes to its `min`. A drag snaps at the gap's midpoint instead (see Pointer), so the pointer has room before the panel jumps.

**Keyboard (APG window splitter), on the focused handle:**
- Horizontal group (vertical separator): ← shrinks the preceding panel by `keyboardStep`, → grows it. RTL flips them (the preceding panel is on the right: ← moves the separator left, which grows it). ↑ / ↓ do nothing.
- Vertical group (horizontal separator): ↑ shrinks the preceding panel, ↓ grows it. ← / → do nothing.
- Home: the preceding panel to `lo`. End: to `hi`. Either may collapse a collapsible panel (above).
- Enter: when the preceding panel is collapsible, collapses it; when it is collapsed, restores the size it had before collapsing (else its `minSize`), clamped to `hi`. A non-collapsible preceding panel ignores Enter.
- Every key commits (`onLayout`). Keys never move a panel outside its allowed sizes.
- F6 (APG optional pane cycling) is not implemented.

**Pointer:**
- A primary-button `pointerdown` on the handle captures the pointer (`setPointerCapture`) and records the start coordinate, the start layout and the group's size. Focus lands on the handle as on any focusable `div` (pointer focus, so no ring).
- Each `pointermove` computes the offset from the start in percent of the group (negated in RTL for a horizontal group) and applies it to the *start* layout, clamped to `[lo, hi]` (so limits never accumulate drift).
- Collapse snapping: a collapsible neighbour collapses when the drag would take it below the midpoint of its gap (`(collapsedSize + min) / 2`), and expands back to `min` when dragged past that point again.
- `pointerup` / `pointercancel` / `lostpointercapture` end the drag; `onLayout` fires once if the layout changed. `data-dragging` is on the handle and the group while dragging.
- The handle is `touch-none`, so touch drags resize instead of scrolling.

**Reduced motion:** panels never animate (collapse and restore are instant); the handle's colour transition is `motion-reduce:transition-none`.

**Tests:**
- ARIA: role, `aria-orientation` (vertical in a horizontal group, horizontal in a vertical one), valuenow/min/max, `aria-controls` = the preceding panel's id, the default and a custom name;
- the full key table: horizontal LTR (← / → / ↑ / ↓ / Home / End / Enter), horizontal RTL (← and → swapped), vertical group (↑ / ↓ / ← / →), each asserting `aria-valuenow` and both panels' rendered sizes (geometry, ±1px);
- limits: keys and drags clamp at the preceding panel's `minSize` / `maxSize` and at the following panel's limits; `aria-valuemin` / `aria-valuemax` reflect both;
- collapse consistency: with a collapsible following panel, `aria-valuemax` is `T − collapsedSize_{i+1}`, End collapses it, and a drag to the far end reaches the same layout; with a collapsible preceding panel, `aria-valuemin` is its `collapsedSize` and Home collapses it; ← from `minSize` collapses (gap snapping) and → from collapsed restores `minSize`;
- Enter: collapses a collapsible panel (`data-collapsed`, `inert`, `onCollapsedChange(true)`), restores the previous size (`onCollapsedChange(false)`); Enter on a non-collapsible panel does nothing;
- pointer: drags use `userEvent.dragAndDrop(page.elementLocator(handle), …, { force: true, targetPosition, steps: 12 } as Parameters<typeof userEvent.dragAndDrop>[2])` with a `MutationObserver` recording `data-dragging` on the handle and the group mid-drag (the Drawer swipe test pattern, `drawer.test.tsx` ~795–815). A drag resizes, fires `onLayoutChange` during the drag and `onLayout` once at the end; dragging past the limit clamps; a collapsible panel collapses past its gap midpoint and comes back; a disabled handle does not drag and is not focusable; in RTL the drag direction flips; a drag performs no `getComputedStyle` direction read per move (spy);
- layout: `defaultLayout`; panel `defaultSize`s with an unsized panel taking the rest; an invalid `defaultLayout` falls back (and warns); controlled `layout` + `onLayoutChange`; a controlled parent that ignores changes keeps the layout; three panels with two handles; a conditional third panel mounting and unmounting keeps the sum at 100 and reports it;
- SSR: `renderToString` gives each panel its `flex-grow` from the defaults and each handle its `aria-valuenow`; `hydrateRoot` raises no recoverable error;
- `withHandle` renders the grip; vertical groups rotate it;
- focus ring: Tab → handle computed `outline-style: solid`, width 2px;
- forced colors: the handle is CanvasText, `outline-style: none` until focused, then Highlight; dragging turns it Highlight;
- reduced motion: the handle's transition-duration is 0s;
- axe light and dark: horizontal with grips, vertical, a collapsed panel; violations and incomplete both `[]`.

## 6. Docs (Task 8; each component task writes its own stories)

- Stories (`title: "Components/<Name>"`, `tags: ["autodocs"]`), written by the component's task:
  - Kbd (Task 0): Basic, Group, Shortcut (a standalone `KbdShortcut`; says it shows ⌘ on a Mac and Ctrl elsewhere, and that symbols carry sr-only names), In a Button (`aria-hidden` hint + `aria-keyshortcuts`).
  - ColorPicker (Task 3): Inline, With alpha, With swatches, Composed (custom parts), In a Form (Field + submit echo), Disabled. Task 4 adds Popover and Popover in a Form.
  - Rating (Task 5): Basic, Half steps, Clearable, Sizes, Display (read-only average), In a Form, RTL.
  - Stepper (Task 6): Horizontal wizard (Back/Next buttons driving `value`, completion tracked in a set), Vertical, Non-linear, With error, Display only, RTL.
  - Resizable (Task 7): Horizontal, Vertical, Nested (vertical inside horizontal), Collapsible sidebar (with a controlled-layout toggle button), Persisted (`onLayout` → `localStorage` → `defaultLayout`, try/catch around storage), RTL.
- **`Tessera/Examples/Theme Studio`** (`src/docs/examples/theme-studio-page.{tsx,test.tsx,stories.tsx}`), a theme editor:
  - Defaults: primary `#4f46e5`, surface `#ffffff` (primary on surface 6.29:1).
  - A header with the title, a "Save" Button and a "Show code" Switch.
    - Save shows an `aria-hidden` `KbdShortcut` `mod+s` and carries `aria-keyshortcuts={aria("mod+s")}`. Ctrl/⌘+S saves and reports "Theme saved" in a `role="status"` line; the line stays until the next change to the theme (any setter clears it), with no timer.
    - The Switch's label shows an `aria-hidden` `KbdShortcut` `mod+j`, and the Switch carries `aria-keyshortcuts={aria("mod+j")}`. Ctrl/⌘+J toggles it.
    - The two shortcuts are app commands: one `keydown` listener on `document` matches them with `matchesShortcut` and works everywhere, including while typing in the name Input or a ColorInput (no `isEditable` check), and calls `event.preventDefault()` (Ctrl+S is the browser's Save page, Ctrl+J Chrome's Downloads). It ignores `event.repeat` and IME composition. Text typed but not yet committed in a ColorInput is not part of the saved theme.
  - A horizontal `ResizablePanelGroup` (vertical below `md`, by a `matchMedia` hook local to the example):
    - a controls panel (`defaultSize` 30, `minSize` 22, collapsible), `withHandle` "Resize controls";
    - a live preview panel (`minSize` 30);
    - an optional code panel (`defaultSize` 25, `minSize` 15) that mounts when "Show code" is on, showing the theme as CSS custom properties in a `<pre>`.
  - The controls hold a linear `Stepper` wizard "Create theme" with three steps; the page tracks the completed steps in its own `Set` and passes `completed` to each item, so steps stay reachable after going Back (§4):
    1. "Colors": an inline `ColorPicker` for the primary colour (with swatches) and a `ColorPickerPopover` for the surface colour. One contrast `Badge` from `color.ts` gates the step: **primary used as text or UI on the surface**, `contrastRatio(primary, surface)` against AA for text (4.5:1), labelled "Primary on surface 6.3:1 AA" in success or "Primary on surface 1.1:1 Fails AA" in danger (ratio shown with one decimal). There is no primary-vs-its-own-foreground badge: the preview picks that foreground with `readableForeground`, so it always passes and would never inform.
    2. "Shape": a radius `Slider` and a density `RadioGroup`.
    3. "Review": a theme name `Input`, a `Rating` "Rate this theme" (clearable) and "Finish".
  - "Next" adds the step to the completed set and moves on; on "Colors" it refuses while "Primary on surface" fails AA, marking the step `error` with a message under the badge ("The primary colour needs 4.5:1 against the surface") and removing it from the completed set. Fixing the colour clears the error. "Back" is always allowed.
  - The preview applies the theme with inline custom properties on its own container (`--primary`, `--primary-foreground` from `readableForeground`, `--primary-hover` via `color-mix`, `--background` and `--card` from the surface, `--foreground` from `readableForeground(surface)`, `--radius`): a Card with Buttons (solid, soft, outline), a primary-coloured link-style text sample on the surface (what the badge measures), a Badge, an Input, and a sample Rating display.
  - `ThemeStudioPage` takes `onSave(theme)`, called on Save (button or shortcut) with `{ name, primary, surface, radius, density, rating }`, so the test can read it.
- README: the component list (Kbd, ColorPicker, Rating, Stepper, Resizable entries in the house style, each added by its task), "Phase J … are complete", the Theme Studio example paragraph, and the roadmap moving to Phase K. Phase K candidates:
  - data-grid pieces: column visibility, sorting and multi-sort state, row selection, pagination state (a headless `useDataTable` over Table);
  - a Calendar events view (month and week agenda);
  - TimeField / TimePicker (the date family's missing half);
  - a FileUpload dropzone;
  - a TagsInput.
- Backlog: the Phase J notes; nothing resolved left in it.
- `src/docs/introduction.mdx`: a "Shortcuts, panels, steps, ratings and colour" section pointing at **Examples / Theme Studio**.

## 7. Direction for the older Base UI composites (Task 9, last)

Base UI reads the text direction from its `DirectionProvider` context only (default LTR). Tessera never rendered one, so in a `dir="rtl"` page the older components get LTR behaviour from Base UI for keys **and** for pointer and layout maths. The consumers in `@base-ui/react` 1.8 (`grep -rl useDirection`):
- `internals/composite/root/CompositeRoot.js`: ←/→ in every composite (RadioGroup, ToggleGroup, Toolbar, Tabs, Menu and Menubar item lists, Accordion headers if composite, NavigationMenu lists);
- `slider/control/SliderControl.js` (the drag maths: `direction === 'rtl' ? right - fingerX : fingerX - left`, ~line 173) and `slider/thumb/SliderThumb.js` (keys and the thumb's translate);
- `scroll-area/viewport/ScrollAreaViewport.js` (~line 143, the RTL scroll offsets that drive the overflow edges) and `scroll-area/scrollbar/ScrollAreaScrollbar.js`;
- `internals/useAnchorPositioning.js` (logical `align` / `side` for every positioned popup: Tooltip, Popover, Menu, MenuSub, ContextMenu, Select, Combobox, Autocomplete, PreviewCard, NavigationMenu);
- `menu/root/MenuRoot.js` (submenu ←/→), `navigation-menu/popup/NavigationMenuPopup.js` and `…/trigger/NavigationMenuTrigger.js`, `select/popup/SelectPopup.js`, `combobox/input/ComboboxInput.js`, `combobox/chip/ComboboxChip.js`, `combobox/root/AriaCombobox.js`, `otp-field/input/OTPFieldInput.js`, `utils/usePopupViewport.js`.

- **Audit.** Map these to the Tessera components that render them (at least RadioGroup, ToggleGroup, Toolbar, Tabs, Slider, ScrollArea, Menu / Menubar / ContextMenu, NavigationMenu, Select, Combobox, Autocomplete, OTPField, Tooltip, Popover, PreviewCard, Accordion; CheckboxGroup if it turns out to be composite). Record the final list as an *Amended in Task 9* bullet.
- **Fix** (the scope ruling: the DOM `dir` is the source of truth). Each affected Tessera component wraps its Base UI root in a `DirectionProvider` whose `direction` is `useElementDirection(ref)` on its own element. It never looks for a consumer's provider; its own provider overrides any outer one for its subtree, and nested Tessera components each read their own element, so nesting stays correct.
  - Components with a root element (RadioGroup, ToggleGroup, Toolbar, Tabs, Slider, ScrollArea, Menubar, NavigationMenu, OTPField, Accordion) read that element.
  - Overlay roots render no element (Popover, Menu, ContextMenu, Tooltip, Select, Combobox, Autocomplete, PreviewCard). They read the direction of their trigger (or anchor) element: the trigger part registers its element with the root's context, and the root's `DirectionProvider` (above the trigger and the portalled popup, since React context crosses portals) uses `useElementDirection` on it. Before the trigger mounts (server HTML) it is LTR, as everywhere.
  - A portalled popup takes its CSS direction from its portal container, not from the trigger: as with Drawer, a `dir` on an inner wrapper does not reach the popup's text unless `container` points inside it. Document this beside the existing Drawer note.
- **First render.** The first client render assumes LTR until the layout effect reads the direction; the read happens before paint, so no key press can land in between. Do not read layout during render.
- **Tests**, RED first:
  - keys: for each composite, a `dir="rtl"` wrapper where → moves to the visually next item (the logically previous one); Slider: → in a horizontal RTL slider moves the thumb right, which is a lower value (pin the expectation against Base UI's docs); an LTR case stays unchanged; a `dir` change on an ancestor is followed (`expect.poll`);
  - Slider RTL drag: `userEvent.dragAndDrop` on the thumb towards the left increases the value in a `dir="rtl"` Slider (it decreases before the fix), and the thumb ends under the pointer (geometry);
  - ScrollArea RTL regression: a horizontally scrollable `dir="rtl"` ScrollArea starts with its horizontal scrollbar thumb at the inline start (the right edge) and reports the overflow edges correctly (no start-edge overflow at the initial position; scrolling to the inline end reverses them); an LTR case is unchanged;
  - popup side: a `dir="rtl"` Popover with `align="start"` aligns its popup's right edge with the trigger's right edge (±1px); a MenuSub in an RTL Menu opens to the left of its trigger and ← (not →) opens it;
  - every existing suite stays green.
- **Docs.** README: one line in the RTL notes (the DOM `dir` rule and the portal note). Backlog: remove the RTL-composites entry if one exists.
- Commit `fix(rtl): Base UI composites follow the element direction`.
