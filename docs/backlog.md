# Tessera backlog

Open follow-ups from the foundation reviews (2026-09-23). None block current use.

## Tooling
- `scripts/verify-consumer.mjs`: a future type-only source file (`export type`/`interface` only, or `export type * from`) emits no `.js` and would fail check 1 loudly. Exempt modules with no runtime statements.
- `scripts/verify-consumer.mjs`: guard `JSON.parse(npm pack stdout)` with try/catch → `fail()` so the fixture is always cleaned up.
- `.d.ts.map` / `.js.map` point at `src/**` which is not shipped (`files: ["dist"]`). Either ship `src` or drop maps.
- Biome: `linter.rules.recommended` deprecation notice — run `npx biome migrate --write` at next Biome major.
- Storybook build prints a `MODULE_LEVEL_DIRECTIVE` and a >500 kB chunk warning (Storybook internals).
- The consumer fixture resolves `tailwindcss` via the repo's own node_modules — it validates the package contents, not dependency installation.

## Button tests
- Add a positive control to the Enter/Space-while-loading test (non-loading button *does* fire on Enter).
- Size tests for `icon-xs`, `icon-sm`, `icon-lg`; assert the spinner renders before children.

## Docs
- README theming: say explicitly that overriding a token requires redefining it in both `:root` and `.dark`.

## Next components
Input, Label, Card, Badge, Dialog, Tooltip, Select, Tabs.
