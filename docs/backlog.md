# Tessera backlog

Open follow-ups from the foundation and Phase A reviews (2026-09-23). None block current use.

## Components
- Soft / outline / ghost Button variants have no distinct `active` (pressed) color yet — only solid does.
- `CardTitle` heading semantics: a hook-free render prop that picks the heading level is not possible
  in a server-safe component, so the documented pattern is `<CardTitle role="heading" aria-level={3}>`
  (see the Card stories). Revisit if Card gains a client part.
- Button test: assert the loading spinner renders before the children.

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

## Next components
Follow the phases in the design-system spec §6
(`docs/superpowers/specs/2026-09-23-tessera-design-system-v2.md`): Phase B forms (Label, Field, Input,
Textarea, Checkbox, Switch, RadioGroup — use the `field*` / `switch-track` tokens), Phase C overlays,
Phase D navigation and feedback.
