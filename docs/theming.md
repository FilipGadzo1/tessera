# Theming

~~~html
<html class="dark" data-primary="lapis" data-surface="slate">
~~~

- Primary: `malachite` (default) · `lapis` · `amethyst` · `carnelian`
- Surface: `marble` (default) · `slate` · `sandstone`
- Dark mode: a `.dark` class on an ancestor

**Custom brand colors.** The supported path is overriding the palette *scale* in an unlayered
`:root` (Tessera's tokens live in `@layer base`, so any unlayered rule wins):

~~~css
:root {
  --tsr-primary-50: oklch(0.975 0.018 300);
  /* … every step … */
  --tsr-primary-950: oklch(0.255 0.07 300);
  /* and/or --tsr-surface-0 … --tsr-surface-950 */
}
~~~

Every role follows the scale — resting, hover, active, soft, soft-hover, foreground, ring, the
`primary-*` / `surface-*` utilities — in light **and** dark, including nested `data-surface` scopes.
Keep the scale's lightness curve (600 carries white text, 400 carries its own 950) so contrast holds.
Overriding a single semantic token such as `--primary` changes only that one resting value: its
hover, active, soft and ring colors stay on the old palette, it has no separate dark value (with
`.dark` on `<html>` the `:root` value also wins in dark mode — add a later `.dark` rule for one), and
nested `data-primary` / `data-surface` scopes re-derive it from their own palette.
A nested `data-primary` scope likewise rebinds `--tsr-primary-*` to its own palette, so a `:root`
primary-scale override does not reach inside it (override the scale on that scope too).
`--radius` is a plain token and can be overridden on its own.

Token names are shadcn-compatible (`--primary`, `--muted-foreground`, `--ring`, …), so utilities
such as `bg-primary` or `text-muted-foreground` work unchanged. What does **not** carry over is an
existing shadcn color setup: Tessera defines the values, and an app's own `--primary` etc. override
only the individual resting colors as described above.

Limits and naming:

- Dark mode is one-way: there is no `.light` scope to switch a region back to light inside `.dark`.
- Card variants are `outlined` / `elevated` (MUI naming for surfaces); Button and Badge use
  `outline` (a variant of a colored control).

Palettes are generated — edit `scripts/generate-palettes.mjs`, then `npm run palettes`.
