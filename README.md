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

Or override semantic tokens (`--primary`, `--background`, `--radius`, …) in your own `:root`
**and** `.dark`. Palettes are generated — edit `scripts/generate-palettes.mjs`, then `npm run palettes`.
Overrides placed on `:root` apply everywhere except inside a nested `data-primary` / `data-surface`
scope, which re-derives its roles from its own palette.

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
- [ ] Next up: Input, Label, Card, Badge, Dialog, Tooltip, Select, Tabs

## Roadmap

Components above · visual regression · React Compiler on output · publish to npm (`@tessera/ui` is free).
