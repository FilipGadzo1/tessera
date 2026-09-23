# Tessera Phase B: Form Controls (Spec Addendum)

**Date:** 2026-09-24
**Status:** Claude made these decisions under the owner's standing delegation ("do not ask me questions, keep implementing").
**Builds on:** `2026-09-23-tessera-design-system-v2.md`. Its §4 design language is binding, especially the focus pattern, cursor rules and field tokens.

## 1. Components and Base UI mapping

| Tessera export | Base UI part | Server-safe? | Notes |
|---|---|---|---|
| `Label` | plain `<label>` | yes | For use outside a Field, e.g. wrapping a Checkbox and its text |
| `Field`, `FieldLabel`, `FieldDescription`, `FieldError` | `Field.Root/Label/Description/Error` (`@base-ui/react/field`) | no | Wires ids and `aria-describedby` automatically; validation via `validate`, `invalid` and `validationMode` pass-through |
| `Fieldset`, `FieldsetLegend` | `Fieldset.Root/Legend` (`@base-ui/react/fieldset`) | no | Groups radios and checkboxes; the legend names the group |
| `Input` | `Input` (`@base-ui/react/input`) | no | Works standalone or inside a Field |
| `Textarea` | `Input` with `render={<textarea />}` | no | Auto-grows with `field-sizing-content`; `rows` sets the minimum height |
| `Checkbox` | `Checkbox.Root` + `Checkbox.Indicator` | no | Supports indeterminate (a dash icon) |
| `Switch` | `Switch.Root` + `Switch.Thumb` | no | |
| `RadioGroup`, `Radio` | `RadioGroup` (`@base-ui/react/radio-group`) + `Radio.Root/Indicator` | no | |

## 2. Visual contract (all use tokens; no `dark:`)

- **Text fields** (Input, Textarea):
  - Base: `w-full min-w-0 rounded-md border border-field-border bg-field text-foreground shadow-xs placeholder:text-muted-foreground`.
  - Hover: `not-data-disabled:hover:border-field-border-hover`.
  - Focus: `outline-hidden focus:outline-1 focus:outline-solid focus:outline-ring focus:border-ring`.
  - Invalid: `data-invalid:border-danger data-invalid:focus:outline-danger aria-invalid:border-danger aria-invalid:focus:outline-danger`.
  - Disabled: `disabled:cursor-not-allowed disabled:opacity-50`. Read-only: `read-only:bg-muted`.
  - Transition: the §4 list.
- **Input sizes** (`size` prop): sm `h-8 px-2.5 text-sm` · md `h-10 px-3 text-sm` (default) · lg `h-12 px-4 text-base`. These heights match Buttons of the same size.
  - `size` clashes with the native `<input size>` attribute, so `InputProps` omits the native `size`.
- **Textarea:** `min-h-20 px-3 py-2 text-sm field-sizing-content`, with the same states. Resize: `resize-y`.
- **Checkbox:**
  - Box: `size-5 rounded-sm border border-field-border bg-field text-primary-foreground`.
  - Checked or indeterminate: `data-checked:bg-primary data-checked:border-primary data-indeterminate:bg-primary data-indeterminate:border-primary`.
  - Icons: the Indicator shows a 14px check (inline SVG, `aria-hidden`), or a dash when indeterminate.
- **Radio:**
  - Circle: `size-5 rounded-full border border-field-border bg-field`.
  - Checked: `bg-primary border-primary`. The Indicator is a `size-2 rounded-full bg-primary-foreground` dot.
- **Switch:**
  - Track: `h-6 w-11 rounded-full bg-switch-track p-0.5`. Checked: `data-checked:bg-primary`.
  - Thumb: `size-5 rounded-full bg-surface-0 shadow-sm`, with `translate-x-0` unchecked and `data-checked:translate-x-5` checked.
  - Transition: `transition-[translate,background-color]`.
- **Shared by Checkbox, Radio and Switch:**
  - Cursor: `cursor-pointer`. Disabled: `data-disabled:cursor-not-allowed data-disabled:opacity-50`.
  - Focus: `outline-hidden outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid`.
  - Invalid: `data-invalid:border-danger` (the Switch track gets `data-invalid:outline-1 data-invalid:outline-solid data-invalid:outline-danger`).
  - Hover while unchecked: `not-data-disabled:not-data-checked:hover:border-field-border-hover`.
- **Label / FieldLabel:** `text-sm font-medium leading-snug text-foreground` plus `data-disabled:opacity-50` (FieldLabel reflects the Field's disabled state).
- **FieldDescription:** `text-sm text-muted-foreground`.
- **FieldError:** `text-sm text-danger`.
- **Field:** `flex flex-col gap-1.5`.
- **Fieldset:** `flex flex-col gap-3`. **FieldsetLegend:** `text-sm font-medium text-foreground`.
- **RadioGroup:** `flex flex-col gap-2` (a horizontal layout is up to the caller's className).

## 3. Behavior

Every component passes Base UI props through, including `render` and `className`. `className` may be a string or a state function, following Button's pattern: merge with `cn` after the component's own classes.

- `data-slot` is set on every part: `field`, `field-label`, `field-description`, `field-error`, `fieldset`, `fieldset-legend`, `input`, `textarea`, `checkbox`, `checkbox-indicator`, `switch`, `switch-thumb`, `radio-group`, `radio`, `radio-indicator`, `label`.
- `FieldError` shows only while the field is invalid, which is Base UI's default. `match` passes through.
- Every interactive component gets a Tab-focus test that asserts the computed `outline-style` is `solid` and the width is correct (1px for text fields, 2px for the others). The cursor is checked via computed style.

## 4. Stories and docs

- Each component gets stories: Playground, States (default, disabled, invalid, read-only where it applies), sizes where it applies, and use within a Field.
- A `Tessera/Examples/Sign-up form` story composes Field + Input + Textarea + Checkbox + RadioGroup + Switch + Button, with validation on submit (Base UI `Form`, wrapped only inside the story; no Tessera `Form` export yet).
