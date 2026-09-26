# Tessera Phase G: Forms and Navigation (Spec Addendum)

**Date:** 2026-09-26
**Status:** Claude made these decisions under the owner's standing delegation. After the Phase F follow-ups, the owner asked to "continue with the implementations of the phases".
**Builds on:** design-system-v2 §4 (tokens, sizes, focus `outline-none` + toggle pattern with `forced-colors:focus-visible:outline-[Highlight]`, selected Highlight/HighlightText states with `forced-color-adjust-none`, cursor, motion, server safety); Phase B §3 (Field composition, `textFieldBase`); Phase C (overlay pattern, `popupSurface`, `popupMotion`, `menuItemBase`, `menuContentClasses`, z tokens, `container`); Phase D §0 (`useLayeredEscape`); Phase E (Combobox parts and `textFieldGroupBase`); Phase F (`src/lib/icons.tsx`, `focus-classes.ts`, `use-controllable-state.ts`, Base UI pinned `~1.8.0`).

**Scope:** Collapsible, CheckboxGroup, Form, OTPField, Autocomplete, Menubar and NavigationMenu, all on Base UI 1.8 primitives, plus a Checkout example. The Editor example gains a Menubar.

**Scope rulings:**
- *DateField (typed date segments) and an app-shell Sidebar go to Phase H.* Each is hand-built and large. Base UI has no primitive for either, and Phase F showed a hand-built component needs a task of its own plus review rounds. Cost if wrong: typed dates wait one more phase.
- *Autocomplete reuses the Combobox building blocks.* Base UI's Autocomplete re-exports most Combobox parts (`Input`, `List`, `Popup`, `Group`, `Empty`, `Status`, …). Tessera's Autocomplete shares class strings with Tessera's Combobox; if a class string is needed by both, it moves to a server-safe module (`combobox-variants.ts` or `overlay-classes.ts`). Components aren't shared, because the contexts differ.
- *Menubar reuses the Menu parts.* Base UI's `Menubar` is a root around `Menu.Root`s. Tessera exports `Menubar` plus a `MenubarTrigger` styled for a bar; content and items stay `MenuContent` / `MenuItem` / … unchanged (the implementer verifies this composition in `menubar.md`; the tests prove it).
- *Form wraps Base UI `Form`.* It carries no styling beyond layout. It's for Base UI's `errors` (server-returned errors keyed by field `name`) and its validation modes; Tessera Fields already render `FieldError`.

## 0. Carry-over (Task 0, first)

- **Separators in forced colors:** `bg-border` separators (`Separator`, `MenuSeparator`, the Select, Combobox and Autocomplete separators, `ToolbarSeparator`) are repainted invisible in forced colors. Add `forced-colors:bg-[CanvasText]` to each separator class string. Where the separator is a border instead, use `forced-colors:border-[CanvasText]`. Tests: each separator's computed background (or border) is `CanvasText` in forced colors. Fix the "Separators" backlog entry.
- **Flaky ContextMenu axe test:** `context-menu.test.tsx` "has no axe violations while open, with a submenu open (light)" failed once on colour-contrast during a Phase F gate run and passed on re-runs; it's probably audited mid-animation. Make it deterministic by waiting for both popups to settle (`waitForPopupSettled` on the submenu too, or wait for `data-starting-style` to clear). Prove it with 20 consecutive runs of that file (`npx vitest run src/components/context-menu --repeat=20` or a loop) and record the result.

## 1. Components

| Export | Base UI | Client? | Notes |
|---|---|---|---|
| `Collapsible`, `CollapsibleTrigger`, `CollapsiblePanel` | `Collapsible.*` | yes | §2 |
| `CheckboxGroup` | `CheckboxGroup` | yes | §2 |
| `Form` | `Form` | yes | §2 |
| `OTPField`, `OTPFieldInput`, `OTPFieldSeparator` | `OTPField.*` | yes | §2 |
| `Autocomplete` (+ parts) | `Autocomplete.*` | yes | §2 |
| `Menubar`, `MenubarTrigger` (items are the Menu parts) | `Menubar` + `Menu.*` | yes | §2 |
| `NavigationMenu` (+ parts) | `NavigationMenu.*` | yes | §2 |

## 2. Details

**Collapsible**
- `Collapsible` (Root, `data-slot`) has no styling; `CollapsibleTrigger` is unstyled by default, like `MenuTrigger` (compose it with `render={<Button variant="ghost" />}`), and gets `data-slot` and `cursor-pointer`. `CollapsiblePanel` animates height with Base UI's `--collapsible-panel-height`, the way Tessera's Accordion panel does: reuse the Accordion panel's height/motion classes, extracting a shared constant if they're identical. `motion-reduce:transition-none`. It supports `hiddenUntilFound` (the find-in-page reveal) via pass-through, with a test.
- A `CollapsibleChevron` part is YAGNI; stories show the Accordion chevron pattern with a rotating icon via `data-panel-open` / `data-open` (verify the attribute).

**CheckboxGroup**
- `CheckboxGroup` = Base UI `CheckboxGroup`, `flex flex-col gap-3` (`data-orientation`-free; the caller can pass `className="flex-row"`), `data-slot`. It takes `value` / `defaultValue` / `onValueChange` / `allValues` (parent checkbox) / `disabled`. Tessera's existing `Checkbox` works inside it unchanged; tests prove the reuse, including a parent checkbox (`parent` prop on the parent Checkbox, indeterminate when partially checked).
- Labelling: inside `Fieldset` + `FieldsetLegend` (existing), or `Field`, per Base UI's `checkbox-group.md` labelling guidance. The story shows both.
- FormData: the checked values submit under each Checkbox's `name` (verify how Base UI names them) — test.

**Form**
- `Form` = Base UI `Form` + `data-slot="form"`, `className` merge, no default layout (the caller lays out; the stories use `flex flex-col gap-4`). Props pass through (`errors`, `onSubmit` / `onFormSubmit` (whichever 1.8 exposes, verified), `validationMode`, `actionsRef`).
- Integration: Tessera `Field` + `FieldError` show `errors[name]`, and the errors clear on change (Base UI behaviour, verified and tested). Validation modes `onSubmit` (default), `onBlur` and `onChange` are each tested with a required Input.
- DatePicker/DateRangePicker participation: Phase F's backlog says they don't register with Field validation. If `@base-ui/react/internals/field-register-control` makes `required` + Form `errors` work for DatePicker with a small change, do it (same pin rationale, recorded); otherwise leave the backlog entry and write down why. Either way, add a test documenting the actual behaviour.

**OTPField**
- `OTPField` (Root: all Base UI props, `length` required, `data-slot`, `size` sm/md/lg matching control heights), `OTPFieldInput` (one per slot; `size-10` for md (sm `size-8`, lg `size-12`), `text-center text-lg font-medium tabular-nums` + the text-field look from `textFieldBase` (border, radius, focus ring `focus:outline-1 …`, `aria-invalid` / `data-invalid` danger)), and `OTPFieldSeparator` (`aria-hidden` dash, `text-muted-foreground`).
- Convenience: an `OTPField` with no children renders `length` inputs, optionally grouped with `groups` (e.g. `[3, 3]` → 3 inputs, separator, 3 inputs). With children it renders only the Root.
- Behaviour from Base UI (verified and tested): typing advances, Backspace goes back, paste fills all, arrow keys move, `onValueComplete` / `onComplete` (the verified name) fires, the `validationType` numeric/alphanumeric filter, `mask`. `autoComplete="one-time-code"` on the first input (verify Base UI sets it).
- In `Field`: the label names the group or the first input as Base UI's docs recommend; invalid gives a danger border on all inputs. FormData gives one value under `name`.

**Autocomplete**
- Parts mirror Tessera's Combobox subset: `Autocomplete` (Root, `useLayeredEscape` on `onOpenChange`), `AutocompleteInput` (text-field look in the input group, with optional `showClear`, and a trigger only if Base UI's Autocomplete has one (it does: `Trigger`)), `AutocompleteContent` (Portal → Positioner → Popup, as `ComboboxContent`), `AutocompleteList`, `AutocompleteItem` (`menuItemBase`, no check indicator: autocomplete has no selection state), `AutocompleteEmpty`, `AutocompleteStatus`, `AutocompleteGroup`, `AutocompleteGroupLabel`, `AutocompleteSeparator`, `AutocompleteCollection`.
- Stories: Default (search suggestions), Async search with Status, Grouped, Inline autocomplete (`mode` verified), Command palette (inside a Dialog: the list always open, items run actions; `Dialog` + `Autocomplete` per Base UI's command palette example).
- Tests: typing filters, ArrowDown/Enter fills the input (no selection kept), Escape layering (a tooltip first, then the list, then the input value per Base UI), empty and status live regions, in `Field` (label, invalid), inside a Dialog (the command palette), FormData (input value), axe open light/dark, and the forced-colors highlighted item outline.

**Menubar**
- `Menubar` = Base UI `Menubar` (`role="menubar"`, `data-slot`, `flex items-center gap-1 rounded-lg border border-border bg-background p-1`, orientation pass-through). `MenubarTrigger` = `MenuTrigger` styled `inline-flex h-8 cursor-pointer select-none items-center rounded-md px-3 text-sm font-medium outline-none not-data-disabled:hover:bg-muted data-popup-open:bg-muted` + `toggleFocusClasses` + `forced-colors:focus-visible:outline-[Highlight]` + a forced-colors open state (`forced-colors:data-popup-open:bg-[Highlight] forced-colors:data-popup-open:text-[HighlightText] forced-colors:data-popup-open:forced-color-adjust-none`).
- Composition: `<Menubar><Menu><MenubarTrigger>File</MenubarTrigger><MenuContent>…MenuItem…</MenuContent></Menu>…</Menubar>`. The implementer verifies this in `menubar.md` and records it (including whether `Menu` needs a prop inside a menubar).
- Keyboard (Base UI): ←/→ between triggers; with a menu open, ←/→ moves to the neighbouring menu; hover switches menus while one is open. Tested. Escape closes the open menu and focus returns to its trigger (layered with a tooltip inside).
- The Editor example gains a Menubar above the toolbar: File (New, Open…, Save, separator, Export submenu), Edit (Undo, Redo, separator, Cut / Copy / Paste), View (checkbox items: Show toolbar, Word wrap). "Show toolbar" and "Word wrap" actually toggle the UI.

**NavigationMenu**
- Parts: `NavigationMenu` (Root, `data-slot`, `relative`; wrap `onValueChange` / `onOpenChange` Escape with `useLayeredEscape` if the root has Escape dismissal, verified), `NavigationMenuList` (`flex items-center gap-1`), `NavigationMenuItem`, `NavigationMenuTrigger` (like `MenubarTrigger`, plus a chevron icon that rotates on `data-popup-open`, `motion-reduce` safe), `NavigationMenuContent` (`p-4 w-full sm:w-[36rem]`, and content motion using Base UI's activation-direction data attributes if they exist: slide from the side the pointer came from, fade under `motion-reduce`), `NavigationMenuLink` (`block rounded-md p-3 text-sm not-data-disabled:hover:bg-muted` + focus pattern; supports `render` for router links and `active` → `aria-current="page"` styling), and `NavigationMenuViewport` rendered inside a Tessera-provided Portal → Positioner → Popup (`popupSurface`, `z-(--z-overlay)`, `container`), sized by Base UI's `--popup-width` / `--popup-height` with a size transition.
- Convenience: `NavigationMenuContent` children render into the shared viewport automatically. `NavigationMenu` renders the Portal/Positioner/Popup/Viewport itself, so callers write only List/Item/Trigger/Content/Link.
- Tests: Tab moves between top-level triggers and links; Enter/Space/ArrowDown open; focus moves into the content; Escape closes and returns focus; hover opens after the Base UI delay (a small `delay` in tests); links are real anchors (the `href` works); `aria-current` on the active link; nested inline submenu (a story); axe open light/dark; forced colors (trigger focus, open state legible).
- The Checkout example header uses it (Shop ▾ with a two-column link panel, Help ▾, a plain "Orders" link).

## 3. Tests (every component)

As in earlier phases: `data-slot` on every part, className merge (including a function-form className where Base UI allows it), axe in light and dark (violations and incomplete both `[]`), a forced-colors test (no outline until focused, focus visible, selected/open states legible with `forced-color-adjust-none`), the Tab-focus test (2px solid; text-field-like 1px) and the cursor.

## 4. Docs

- Stories per component (`title: "Components/<Name>"`, autodocs).
- `Tessera/Examples/Checkout`: a header NavigationMenu, then a two-column checkout:
  - Left: a `Form` with the contact Field Inputs; a shipping-address Autocomplete (city suggestions); a delivery-options CheckboxGroup (gift wrap, leave at door, … with a parent "Select all"); a "Promo code" Collapsible that reveals an Input + Apply; and a verify-your-phone OTPField (6 digits, groups `[3, 3]`) shown after "Send code".
  - Right: an order summary Card with a Collapsible "Show items" list.
  - Submitting with errors shows Form `errors` from a fake server response (e.g. a promo code "EXPIRED" rejected).
- The Editor example gains the Menubar (§2).
- README: the component list and the Phase G completion; roadmap next: Phase H (DateField, Sidebar/app shell, plus candidates: Command palette as a first-class component if the Autocomplete story shows the need, Carousel?, Tree?). Backlog updated.
