# Tessera backlog

Open follow-ups from the foundation, Phase A (2026-09-23), Phase B and Phase C (2026-09-24) reviews.
None block current use.

## Components
- Soft / outline / ghost Button variants have no distinct `active` (pressed) color yet — only solid does.
- `CardTitle` heading semantics: a hook-free render prop that picks the heading level is not possible
  in a server-safe component, so the documented pattern is `<CardTitle role="heading" aria-level={3}>`
  (see the Card stories). Revisit if Card gains a client part.
- Button test: assert the loading spinner renders before the children.
- FieldError renders an empty node when `<Field invalid>` has no FieldError children (fix: apply
  the default `match` only when `children != null`).
- FieldError has no live region — `onBlur` errors are not announced until the control is refocused
  (consider an optional `aria-live`).
- Field blur-validation test should assert the error is absent before the Tab.
- Textarea: the `rows` min-height desyncs with custom padding, and with `rows < 2`.
- No `readOnly` styling test for the text fields (Input, Textarea).
- `read-only:bg-muted` also matches disabled inputs; in dark mode fields shouldn't sit on muted.
- Checkbox: the indicator may flash the check icon on an indeterminate→unchecked exit.
- Checkbox / Switch / Radio: `readOnly` keeps `cursor-pointer`.
- Switch (dark): unchecked hover thumb vs track ≈2.3–2.5:1 (hover-only; the track stays ≥3:1 vs the
  background).
- Label story lacks an `htmlFor` + Input pairing.
- RadioGroup has no story literally named `InField` (the Playground covers the Field composition).
- Sign-up example: the Card width is set via a wrapper element.
- `toneClass` is not exported publicly — export it when a consumer needs toned custom components.
- Project card example: member avatars are initials in tinted `<span>`s (and the Card width is set
  with a class) until an Avatar component lands (Phase D).
- Project card example: `MenuShortcut` hints (⌘L, F2) are decorative — no key handler is wired.
- Overlays: no Tessera helper for dialogs opened from a Menu item; each call site controls `open` and
  passes `finalFocus` (consider a documented pattern or a `DialogTrigger`-less helper).
- Tooltip: no `TooltipArrow` part (the spec chose no arrow); add one if a design needs it.

## Theming
- No `.light` scope: a region cannot switch back to light inside `.dark` (documented limit).

## Storybook
- The palettes story id is `tessera-palettes--role-tokens` while the Phase A plan's smoke test says
  `--roles` (historical plan inconsistency; the plan is not updated). Harmless.
- Storybook build prints a `MODULE_LEVEL_DIRECTIVE` and a >500 kB chunk warning (Storybook internals).

## Tooling
- `.d.ts.map` / `.js.map` point at `src/**` which is not shipped (`files: ["dist"]`). Either ship `src` or drop maps.
- Biome: `linter.rules.recommended` deprecation notice — run `npx biome migrate --write` at next Biome major.
- The consumer fixture resolves `tailwindcss` via the repo's own node_modules — it validates the package contents, not dependency installation.
- `verify-consumer` type-only check misclassifies a semicolon-less `type` alias (latent: Biome
  enforces semicolons).
- `verify-consumer` does not recognize `export type * from` (fails loudly rather than silently).

## Next components
Follow the phases in the design-system spec §6
(`docs/superpowers/specs/2026-09-23-tessera-design-system-v2.md`): Phase B forms (Label, Field, Input,
Textarea, Checkbox, Switch, RadioGroup — use the `field*` / `switch-track` tokens), Phase C overlays,
Phase D navigation and feedback. Phases B and C are done; next is Phase D (Tabs, Select, Accordion,
Toast, Avatar, Separator, Progress).
