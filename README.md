<div align="center">

# 🧩 Tessera

**A *tessera* is a single tile of a mosaic. Every component here is a tile; every project is a mosaic.**

A personal React component library — `@filipgadzo1/tessera`.

![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4-06b6d4?logo=tailwindcss&logoColor=white)
![Base UI](https://img.shields.io/badge/built%20on-Base%20UI-6366f1)
![Storybook 10](https://img.shields.io/badge/Storybook-10-ff4785?logo=storybook&logoColor=white)

</div>

---

## ✨ Highlights

- 🎨 **Themeable** — four primary palettes, three surfaces, light and dark.
- ♿ **Accessible** — built on [Base UI](https://base-ui.com), tested in real Chromium with axe-core.
- 🌍 **RTL-aware** — logical properties throughout.
- 🧱 **Composable** — compound components styled with `cva` + `tailwind-merge`.
- 📚 **Documented** — a Storybook page for every component.

## 🚀 Getting started

```sh
npm install
npx playwright install chromium   # browser for the tests
npm run dev                       # Storybook at http://localhost:8080
```

| Command | What it does |
|---|---|
| `npm run dev` | Storybook docs + playground |
| `npm test` | Component tests in real Chromium (Vitest + axe) |
| `npm run build` | Build the library into `dist/` |
| `npm run check` | Palettes + lint + typecheck + tests + build — run before every commit |

## 📦 Using it in another project

Not on npm yet. Install from a tarball:

```sh
# in tessera/
npm run build && npm pack

# in your app
npm install ../tessera/tessera-ui-<version>.tgz
```

```css
/* your main CSS */
@import "tailwindcss";
@import "@filipgadzo1/tessera/styles.css";
```

```tsx
import { Button } from "@filipgadzo1/tessera";

<Button variant="outline" onClick={save}>Save</Button>
```

Requires React 19 and Tailwind CSS v4.

## 🎨 Theming

```html
<html class="dark" data-primary="lapis" data-surface="slate">
```

Primary: `malachite` · `lapis` · `amethyst` · `carnelian`  
Surface: `marble` · `slate` · `sandstone`

## 📖 More

- [Components](docs/components.md) — full list with API notes, and the roadmap
- [Theming](docs/theming.md) — custom brand colors and token details
- [Backlog](docs/backlog.md)

## Stack

React 19 · Base UI · Tailwind CSS v4 · cva + tailwind-merge · tsdown · Vitest + Playwright + axe-core · Storybook 10 · Biome · TypeScript

## License

[MIT](LICENSE)
