# Tessera

> A *tessera* is a single tile of a mosaic. Every component here is a tile; every project is a mosaic.

Filip's personal React component library — `@tessera/ui`. Local only (not published).

## Setup (first time)

```sh
npm install
npx playwright install chromium   # browser for Vitest browser mode
npm run check                     # should be all green
```

If the Chromium download times out, Playwright prints the exact download URL and revision it
tried — fetch that zip with `curl` and unpack it into `%LOCALAPPDATA%\ms-playwright\chromium-<revision>`
(the folder name Playwright expects), then re-run `npm run check`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Storybook docs + playground at **http://localhost:8080** |
| `npm test` | Component tests in real Chromium (Vitest browser mode + axe) |
| `npm run build` | Builds the library into `dist/` (tsdown) |
| `npm run check` | Palette contrast check + lint + typecheck + tests + build + consumer verification — run before every commit |
| `npm run format` | Biome format + safe lint fixes |
| `npm run palettes` | Regenerates src/styles/palettes.css and checks contrast |

## Stack

React 19 · @base-ui/react · Tailwind CSS v4 · cva + tailwind-merge · tsdown · Vitest 5 browser mode + Playwright + axe-core · Storybook 10 · Biome 2 · TypeScript 7

## Using Tessera in another project (locally, without publishing)

1. In `tessera/`: `npm run build && npm pack` → creates `tessera-ui-<version>.tgz`.
2. In your app: `npm install ../tessera/tessera-ui-<version>.tgz`
   (a tarball install copies files, so there is no duplicate-React problem that `npm link` causes).
3. In your app's main CSS:
   ```css
   @import "tailwindcss";
   @import "@tessera/ui/styles.css";
   ```
4. Use it:
   ```tsx
   import { Button, buttonVariants } from "@tessera/ui";

   <Button variant="outline" onClick={save}>Save</Button>
   <a href="/docs" className={buttonVariants({ variant: "link" })}>Docs</a>
   ```

Requirements: React 19, Tailwind CSS v4.

### Theming

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

After changing Tessera, repeat steps 1–2 (bump `version` in package.json when you want a new tarball name).

## Adding a component

```
src/components/<name>/
  <name>.tsx            # "use client" if it uses hooks/state
  <name>-variants.ts    # cva classes, server-safe (optional)
  <name>.test.tsx       # Vitest browser tests incl. axe
  <name>.stories.tsx    # Storybook stories (tags: ["autodocs"])
  index.ts              # barrel
```
Export it from `src/index.ts` and run `npm run check` — `scripts/verify-consumer.mjs` discovers new
source files automatically (build output + `"use client"` directive checks).

## Components

- [x] Button
- [x] Badge
- [x] Card
- [ ] Next up: Label, Field, Input, Textarea, Checkbox, Switch, RadioGroup (Phase B) · Tooltip, Popover, Dialog, Menu (Phase C) · Tabs, Select, Accordion, Toast, Avatar, Separator, Progress (Phase D)

## Roadmap

Components above · visual regression · React Compiler on output · publish to npm (`@tessera/ui` is free).
