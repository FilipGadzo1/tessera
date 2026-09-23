# Tessera Phase B — Form Controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Label, Input, Field (+ Label/Description/Error), Textarea, Checkbox, Switch, RadioGroup/Radio and Fieldset — styled with the v2 tokens, fully accessible, each with focus/cursor/axe tests — plus a composed sign-up form example.

**Architecture:** Thin styled wrappers over Base UI parts (same pattern as `src/components/button`): `<name>-variants.ts` (cva, server-safe) where a component has variants, `<name>.tsx` (`"use client"` when it uses Base UI), tests, stories, barrel; exported from `src/index.ts`.

**Tech Stack:** as Phase A. Base UI imports: `@base-ui/react/{input,field,fieldset,checkbox,switch,radio,radio-group,form}`.

**Spec:** `docs/superpowers/specs/2026-09-24-tessera-phase-b-forms.md` (binding visual/behavior contract) + `docs/superpowers/specs/2026-09-23-tessera-design-system-v2.md` §4.

## Global Constraints

- Project root `C:\Users\Filip\Desktop\projects\tessera`; Windows 11; Node 24; npm 11; Bash tool (Git Bash). Work on the branch the controller names.
- Class strings exactly as the Phase B spec §2 states (they encode the design language); adapt only if Tailwind fails to generate one — show evidence.
- Focus: text fields `outline-hidden focus:outline-1 focus:outline-solid focus:outline-ring focus:border-ring`; toggles `outline-hidden outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid`. Never rely on `outline-N` without `outline-solid` (Tailwind v4: `outline-hidden` sets `--tw-outline-style:none`).
- Cursor: clickable → `cursor-pointer`; disabled → `cursor-not-allowed`; never `pointer-events-none` on the control.
- Tokens only (`bg-field`, `border-field-border`, `border-field-border-hover`, `bg-switch-track`, `bg-primary`, `text-primary-foreground`, `border-danger`, `outline-danger`, `outline-ring`, `text-muted-foreground`, `text-danger`, `bg-muted`, `bg-surface-0`); no `dark:`.
- `className` accepts string or Base UI state function; merge with `cn` after the component classes (see `src/components/button/button.tsx`).
- Every part sets `data-slot` per spec §3. Props pass through (`{...props}` first, then Tessera's data-slot/className).
- `"use client"` on every file importing Base UI; `Label` stays server-safe (no directive). `npm run verify:consumer` checks parity automatically.
- Every component test file includes: render + accessible name; data-slot; a Tab-focus test asserting computed `outlineStyle === "solid"` and width (`"1px"` text fields, `"2px"` toggles) and `"none"` before focus; computed `cursor` (`pointer` for toggles, `text` for text fields, `not-allowed` when disabled); disabled behavior; invalid styling via `<Field invalid>` wrapper (computed border color equals a reference element with `border-danger`); axe (`axe.run(container)`, assert `violations` and `incomplete` targets both `[]`) in light and in dark (`<div className="dark bg-background p-4">`).
- Use `userEvent` from `vitest/browser` for keyboard/typing; `render` from `vitest-browser-react`.
- Stories: `title: "Components/<Name>"`, `tags: ["autodocs"]`, Playground + States (+ Sizes where relevant) + InField; use `role="heading"` patterns only where headings are shown.
- `npm run format && npm run check && npm run build:storybook` green at each task end. Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `.omc/`, `.superpowers/`, `dist/`, `storybook-static/`, `.tmp-consumer/`, `*.tgz`, `.vitest/`.
- Plan note (controller ruling): tasks give exact contracts + mandatory test lists rather than full code, because Base UI typing details are best resolved against the installed `.d.ts`; implementers must read the relevant `node_modules/@base-ui/react/<part>/*.d.ts` before coding.

---

### Task 1: Label + Input

**Files:** Create `src/components/label/{label.tsx,label.test.tsx,label.stories.tsx,index.ts}`, `src/components/input/{input-variants.ts,input.tsx,input.test.tsx,input.stories.tsx,index.ts}`; modify `src/index.ts`, `README.md`.

**Interfaces (produces):**
- `Label(props: React.ComponentProps<"label">)` — no directive; classes `text-sm font-medium leading-snug text-foreground`; `data-slot="label"`.
- `inputVariants({ size, className })`, `inputDefaults = { size: "md" } as const`, `type InputVariantProps`; `Input(props: InputProps)` where `InputProps = Omit<BaseInput.Props, "size"> & InputVariantProps`; renders Base UI `Input`; `data-slot="input"`, `data-size`.
- The text-field class string (spec §2) lives in `input-variants.ts` as `export const textFieldBase: string[]` so Task 3 (Textarea) reuses it.

- [ ] Step 1 — tests (RED): `label.test.tsx`: renders `<label>` with text; `htmlFor` works (clicking label focuses an associated `<input id>`); className merge; no axe violations. `input.test.tsx`: renders textbox with accessible name via `<Label htmlFor>`; default `data-size="md"` + class `h-10`; sizes sm `h-8`, lg `h-12`; typing updates value (`userEvent.type`); `onValueChange` receives the string; Tab focus → outline solid 1px, none before; cursor `text`; disabled → `toBeDisabled`, cursor `not-allowed`; `aria-invalid="true"` → border color equals reference `border-danger` element; placeholder visible via `placeholder` attr; className merge (`h-14` beats `h-10`); axe light + dark (include placeholder + disabled + invalid instances, each labelled).
- [ ] Step 2 — implement per contract; exports in barrels + `src/index.ts` (`Label`, `Input`, `InputProps`, `inputVariants`, `InputVariantProps`, `inputDefaults`).
- [ ] Step 3 — stories: Label (Default); Input (Playground, Sizes with a Button of the same size beside each to show alignment, States: default/placeholder/disabled/read-only/invalid).
- [ ] Step 4 — README components list: add Label, Input. Gate + commit `feat(input): Label and Input with sizes, focus and invalid states`.

### Task 2: Field family

**Files:** `src/components/field/{field.tsx,field.test.tsx,field.stories.tsx,index.ts}`; modify `src/index.ts`, README.

**Interfaces:** `Field` (Base UI `Field.Root`; classes `flex flex-col gap-1.5`; `data-slot="field"`), `FieldLabel` (`Field.Label`; label classes + `data-disabled:opacity-50`), `FieldDescription` (`Field.Description`; `text-sm text-muted-foreground`), `FieldError` (`Field.Error`; `text-sm text-danger`); props = respective `Field.*.Props`; all `"use client"`.

- [ ] Step 1 — tests (RED), each composing `<Field><FieldLabel>Email</FieldLabel><Input /><FieldDescription>…</FieldDescription><FieldError>…</FieldError></Field>`:
  - label is associated: `getByRole("textbox", { name: "Email" })` resolves; description is in the input's accessible description (`toHaveAccessibleDescription` containing the description text, or `aria-describedby` points at it);
  - `<Field invalid>` → input has `data-invalid`, border color equals `border-danger` reference, FieldError text visible and referenced by `aria-describedby`;
  - valid field → FieldError not rendered;
  - `validate` + `validationMode="onBlur"`: `validate={(v) => (String(v).includes("@") ? null : "Enter an email address")}`; type "x", Tab away → error text "Enter an email address" appears; type a valid value → error disappears;
  - `<Field disabled>` → input disabled, FieldLabel has `data-disabled` and computed opacity `0.5`;
  - data-slots for all four parts; axe light + dark for valid and invalid states.
- [ ] Step 2 — implement; exports. Step 3 — stories: Default, WithDescription, Invalid (static `invalid`), ValidateOnBlur (email example), Disabled. Step 4 — README; gate; commit `feat(field): Field, FieldLabel, FieldDescription, FieldError`.

### Task 3: Textarea

**Files:** `src/components/textarea/{textarea.tsx,textarea.test.tsx,textarea.stories.tsx,index.ts}`; modify `src/index.ts`, README.

**Interfaces:** `Textarea(props: TextareaProps)` — Base UI `Input` with `render={<textarea />}` so it integrates with Field; `TextareaProps` typed for textarea attributes (`rows`, `value`, `defaultValue`, `onValueChange(value: string)`, `placeholder`, `disabled`, `readOnly`, `required`, `name`, `className`), implementer resolves typing against `input/Input.d.ts`; classes = `textFieldBase` + `min-h-20 px-3 py-2 text-sm field-sizing-content resize-y`; `data-slot="textarea"`.

- [ ] Step 1 — tests (RED): renders a `<textarea>` (tagName `TEXTAREA`) with role textbox, name via FieldLabel inside `Field`; typing multi-line text (`{Enter}`) updates value; `onValueChange` gets the string; Tab focus outline solid 1px; cursor `text`; Field `invalid` → `data-invalid` + danger border; disabled; auto-grow: height after typing 8 lines > initial height; axe light + dark.
- [ ] Step 2 — implement; exports. Step 3 — stories: Playground, InField (with description + character count via `onValueChange`), States. Step 4 — README; gate; commit `feat(textarea): auto-growing Textarea integrated with Field`.

### Task 4: Checkbox

**Files:** `src/components/checkbox/{checkbox.tsx,checkbox.test.tsx,checkbox.stories.tsx,index.ts}`; modify `src/index.ts`, README.

**Interfaces:** `Checkbox(props: CheckboxProps)` (`CheckboxProps = Checkbox.Root.Props` from Base UI) renders `Checkbox.Root` (`data-slot="checkbox"`) containing `Checkbox.Indicator` (`data-slot="checkbox-indicator"`, `flex items-center justify-center`) with an inline check SVG (14px, `aria-hidden`, stroke `currentColor`, stroke-width 3) or, when `indeterminate`, a dash SVG. Classes per spec §2.

- [ ] Step 1 — tests (RED): wrapped `<Label><Checkbox /> Accept terms</Label>` → `getByRole("checkbox", { name: "Accept terms" })`; click toggles `aria-checked` false→true and `data-checked`; clicking the label text toggles too; `onCheckedChange` called with `true`; Space key toggles when focused; `defaultChecked` renders indicator (check SVG present); `indeterminate` → `aria-checked="mixed"` + dash SVG; disabled → click does nothing, cursor `not-allowed`; cursor `pointer`; Tab focus outline solid 2px; checked background equals `bg-primary` reference; inside `<Field invalid>` → border equals danger reference; hidden native input carries `name`/`value` for forms (form submission via `new FormData(form)` contains `terms=on` when checked); axe light + dark (unchecked, checked, indeterminate, disabled).
- [ ] Step 2 — implement; exports. Step 3 — stories: Playground, States (unchecked/checked/indeterminate/disabled/invalid), WithLabel, ParentChild (select-all using `indeterminate` computed from children state). Step 4 — README; gate; commit `feat(checkbox): Checkbox with indeterminate state`.

### Task 5: Switch

**Files:** `src/components/switch/{switch.tsx,switch.test.tsx,switch.stories.tsx,index.ts}`; modify `src/index.ts`, README.

**Interfaces:** `Switch(props: SwitchProps)` (`Switch.Root.Props`) renders `Switch.Root` (`data-slot="switch"`) with `Switch.Thumb` (`data-slot="switch-thumb"`); classes per spec §2.

- [ ] Step 1 — tests (RED): `getByRole("switch", { name })` via `<Label>` wrapper; click toggles `aria-checked` + `data-checked`; `onCheckedChange(true)`; Space toggles; thumb translate differs between unchecked/checked (computed `translate` or bounding box x); track bg unchecked equals `bg-switch-track` reference, checked equals `bg-primary` reference; cursor pointer / not-allowed when disabled; Tab focus outline solid 2px; axe light + dark.
- [ ] Step 2 — implement; exports. Step 3 — stories: Playground, States, WithLabel (label left, switch right, `justify-between` row — settings-list pattern). Step 4 — README; gate; commit `feat(switch): Switch`.

### Task 6: RadioGroup, Radio, Fieldset

**Files:** `src/components/radio-group/{radio-group.tsx,radio-group.test.tsx,radio-group.stories.tsx,index.ts}`, `src/components/fieldset/{fieldset.tsx,fieldset.test.tsx,index.ts}` (fieldset stories live in radio-group stories); modify `src/index.ts`, README.

**Interfaces:** `RadioGroup` (Base UI `RadioGroup`, `data-slot="radio-group"`, `flex flex-col gap-2`), `Radio` (`Radio.Root` + `Radio.Indicator` dot; `data-slot="radio"` / `radio-indicator`), `Fieldset` (`Fieldset.Root`, `flex flex-col gap-3`, `data-slot="fieldset"`), `FieldsetLegend` (`Fieldset.Legend`, `text-sm font-medium text-foreground`, `data-slot="fieldset-legend"`).

- [ ] Step 1 — tests (RED): canonical composition `<Field><Fieldset render={<RadioGroup defaultValue="card" />}><FieldsetLegend>Payment</FieldsetLegend><Label><Radio value="card" /> Card</Label><Label><Radio value="bank" /> Bank transfer</Label></Fieldset></Field>` (adjust to Base UI's documented pattern if needed, keeping the legend as the group's accessible name):
  - `getByRole("radiogroup", { name: "Payment" })`; radios named "Card"/"Bank transfer";
  - default checked is "card"; clicking "Bank transfer" checks it and unchecks card; `onValueChange("bank")`;
  - arrow keys move selection (ArrowDown from card → bank checked + focused);
  - Tab focus on the checked radio → outline solid 2px; cursor pointer; disabled group → cursor not-allowed, no change on click;
  - checked radio bg equals `bg-primary` reference; indicator dot present only on checked;
  - form submission: `FormData` contains `payment=bank` when the group has `name="payment"`;
  - Fieldset: legend renders, `data-slot`s; axe light + dark.
- [ ] Step 2 — implement; exports. Step 3 — stories: RadioGroup Playground (plan picker), Horizontal (className `flex-row gap-6`), Disabled, Invalid (inside `<Field invalid>` with FieldError). Step 4 — README; gate; commit `feat(radio-group): RadioGroup, Radio, Fieldset`.

### Task 7: Sign-up form example + docs + backlog

**Files:** create `src/docs/examples/sign-up-form.stories.tsx`; modify `README.md`, `docs/backlog.md`, `src/docs/introduction.mdx`, `scripts/verify-consumer.mjs` (only if a needle for a form class is added — add `".bg-field"`, `".border-field-border"` to the scan group).

- [ ] Step 1 — story `Tessera/Examples/Sign-up form`: Base UI `Form` (`@base-ui/react/form`) with `onFormSubmit` showing the submitted JSON in a `<pre>` below; fields: Name (Input, required), Email (Input, validate contains "@"), Plan (RadioGroup: Free/Pro/Team), About you (Textarea, optional, description), Newsletter (Switch), Terms (Checkbox, required, error "Accept the terms to continue"), Submit Button (`type="submit"`) + Reset (ghost neutral). Inside a `Card` (`w-[28rem]`). Add `src/docs/examples/sign-up-form.test.tsx` that renders the same form component (export it from a sibling `sign-up-form.tsx` module under `src/docs/examples/`, not from the library index) and asserts: submitting empty shows the name/email/terms errors; filling valid values and submitting shows JSON containing `"plan":"pro"` when Pro chosen; axe clean light + dark.
- [ ] Step 2 — README: components list complete for Phase B; "Next up" → Phase C (Tooltip, Popover, Dialog, Menu). Theming note from backlog: nested `data-primary` scope rebinds `--tsr-primary-*`, so a `:root` primary-scale override doesn't reach inside it.
- [ ] Step 3 — backlog: add residual items: type-only check misclassifies a semicolon-less `type` alias (latent; Biome enforces semicolons); `export type * from` not recognized (fails loudly); `toneClass` not exported publicly (export when a consumer needs toned custom components).
- [ ] Step 4 — gate; visual check of the sign-up story light + dark (screenshots to scratchpad, look at them, stop server, port 8080 free); commit `docs(examples): sign-up form composing all form controls`.
