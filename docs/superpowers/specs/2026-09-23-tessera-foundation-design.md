# Tessera — Foundation + Button (Design Spec)

**Date:** 2026-09-23
**Status:** Decided by Claude — owner explicitly delegated design decisions ("Do not ask me questions"); owner may revise at any time.

## 1. What Tessera is

Tessera is Filip's personal React component library. A *tessera* is a single tile of a
mosaic: every component is a tile, every project is a mosaic built from them.

- Package name: `@tessera/ui` (free on npm as of 2026-09-23; not published — local only).
- Location: `C:\Users\Filip\Desktop\projects\tessera`.
- Long-lived project: the foundation must make adding the 2nd…50th component cheap and safe.

## 2. Context — what the owner's projects use today

Surveyed `projects/*`: the newest apps (TherapyNote, weather-app, wedding) use React 19,
TypeScript, Tailwind CSS v4, Next.js 16 / Vite, and shadcn's `base-nova` style
(`@base-ui/react` primitives + `class-variance-authority` + `tailwind-merge` + `lucide-react`,
shadcn token names such as `--primary`, `--ring` in oklch). One older app uses Vue/PrimeVue.

**Consequence:** Tessera targets React 19 + Tailwind v4 and uses shadcn-compatible token
names, so its components drop into existing apps and inherit their themes unchanged.

## 3. Tech stack (versions verified against npm registry 2026-09-23)

| Concern | Choice | Version | Why |
|---|---|---|---|
| Runtime | React / React DOM (peer deps) | ^19 (dev: 19.3.0) | All modern consumer apps are on 19 |
| Language | TypeScript (native Go compiler) | 7.0.x | Current stable; fast typecheck |
| Primitives | `@base-ui/react` | 1.8.x | Stable since Feb 2026; owner already uses it |
| Styling | Tailwind CSS v4 | 4.3.x | Owner's standard |
| Variants | `class-variance-authority` + `tailwind-merge` + `clsx` | 0.7.1 / 3.7 / 2.1 | Owner's existing pattern; minimal |
| Library build | tsdown (Rolldown) | 0.23.x | tsup is unmaintained; tsdown is its successor |
| Docs / playground | Storybook (`@storybook/react-vite`) on **port 8080** | 10.6.x | Controls, autodocs, a11y addon |
| Dev bundler | Vite | 8.x | Required by Storybook builder & plugin-react 6 |
| Tests | Vitest browser mode + Playwright (chromium) + `vitest-browser-react` | 5.0.x | Real browser, no jsdom gaps |
| A11y tests | `axe-core` inside Vitest + `@storybook/addon-a11y` | 4.13 / 10.6 | Automated a11y gates |
| Lint + format | Biome | 2.5.x | One binary replaces ESLint + Prettier |
| Package manager | npm | 11 | What the owner uses; pnpm not installed |

**Deliberately excluded (YAGNI / conflicts):**
- `@storybook/addon-vitest` — peer range is Vitest ≤4; we run Vitest 5 standalone instead.
- React Compiler on library output — optional; consumers can compile. Revisit later.
- Monorepo/workspaces — a single package is enough until a second package exists.
- Icons dependency — Button accepts any `ReactNode` children; `lucide-react` is a devDep for stories only.

## 4. Repository layout

```
tessera/
  package.json            # @tessera/ui, type: module, exports map, scripts
  tsconfig.json           # strict, jsx react-jsx, moduleResolution bundler
  tsdown.config.ts        # unbundle ESM + dts, copies styles
  vitest.config.ts        # browser mode, chromium, headless
  biome.json
  .storybook/
    main.ts               # react-vite framework, addon-docs, addon-a11y
    preview.tsx           # imports storybook.css, light/dark toolbar
    storybook.css         # @import "tailwindcss"; @import "../src/styles/tessera.css";
  src/
    index.ts              # public barrel
    lib/cn.ts             # clsx + tailwind-merge
    styles/tessera.css    # design tokens (@theme inline + :root/.dark) + @source
    components/button/
      button.tsx          # "use client"
      button-variants.ts  # cva, server-safe
      button.test.tsx
      button.stories.tsx
      index.ts
  scripts/
    verify-consumer.mjs   # builds a CSS fixture as a consumer would; asserts classes exist
  docs/superpowers/{specs,plans}/
```

Convention for every future component: `src/components/<name>/{<name>.tsx, <name>.test.tsx,
<name>.stories.tsx, index.ts}` + export from `src/index.ts`.

## 5. Styling & theming contract

- `src/styles/tessera.css` is shipped as `@tessera/ui/styles.css`. It contains:
  - `@custom-variant dark (&:where(.dark, .dark *));`
  - `@theme inline { --color-primary: var(--primary); ... --radius-*: ... }` mapping
  - `:root { ... }` and `.dark { ... }` token values (oklch), shadcn-compatible names:
    `background, foreground, primary(-foreground), secondary(-foreground), muted(-foreground),
    accent(-foreground), destructive(-foreground), border, input, ring, radius`.
  - `@source "./";` — relative to the shipped CSS file, so a consumer who imports the
    stylesheet automatically gets the library's JS scanned for class names (no manual
    `@source "../node_modules/..."` needed). Verified by `scripts/verify-consumer.mjs`.
- It never does `@import "tailwindcss"` — only the consuming app does.
- Consumer usage:
  ```css
  @import "tailwindcss";
  @import "@tessera/ui/styles.css";
  ```
- Tessera's default palette: a warm-neutral base with a deep "lapis" primary
  (mosaic-inspired) — distinct from shadcn's pure neutral, but a consumer's own `:root`
  token values override it since names are identical.

## 6. Button component — API

Built on `Button` from `@base-ui/react/button`.

```ts
type ButtonProps = BaseButton.Props & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link"; // default "primary"
  size?: "xs" | "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon" | "icon-lg";     // default "md"
  loading?: boolean; // default false
};
export function Button(props: ButtonProps): JSX.Element;
export const buttonVariants: (opts?) => string; // cva, for styling non-Button elements (e.g. links)
```

Behavior:
- Renders a native `<button>` with `type="button"` by default (Base UI requires explicit
  `type="submit"` for submit; we default to `button` to prevent accidental form submits;
  caller can override).
- `data-slot="button"`, `data-variant`, `data-size` attributes for styling hooks.
- `ref` forwarded (React 19 ref-as-prop).
- `disabled`: not clickable, `data-disabled`, reduced opacity, `pointer-events-none`
  (loading buttons keep full opacity; only the spinner signals the state).
- Tests load the real Tailwind CSS + tokens, so axe's color-contrast rule checks the actual palette.
- `loading`: sets `disabled` + `focusableWhenDisabled` (stays in tab order so focus is not
  lost mid-action), `aria-busy="true"`, `data-loading`, shows an inline spinner
  (`aria-hidden`) before children; children stay rendered (width is stable).
- `render` / `nativeButton` pass through to Base UI for polymorphism on non-link elements
  (Base UI adds `role="button"` when `nativeButton={false}`). **Links are not Buttons**:
  style `<a>`/router links with `buttonVariants()` instead (per Base UI guidance).
- `buttonVariants` lives in `button-variants.ts` with **no** `"use client"` directive, so
  React Server Components can call it; `button.tsx` carries `"use client"`.
- `className` may be a string or Base UI's state function; merged via `cn` after variants.
- Icons: any `svg` child auto-sized (`[&_svg:not([class*='size-'])]:size-4`), no pointer events.
- Focus: visible `focus-visible` ring using `--ring`; no outline on mouse click.
- Motion: subtle press (`active:translate-y-px`), disabled under `motion-reduce`.

## 7. Testing strategy

Vitest browser mode (real Chromium, headless). Button tests cover:
1. renders a `<button type="button">` with children and accessible name
2. default variant/size data attributes and classes; each variant applies its class
3. `onClick` fires; does not fire when `disabled`
4. `loading`: `aria-busy`, disabled, still focusable, spinner present and `aria-hidden`,
   `onClick` does not fire
5. `type="submit"` override works inside a form
6. `render={<span />}` + `nativeButton={false}` renders a focusable `role="button"` span
7. `ref` receives the DOM element
8. `className` merges and overrides conflicting utilities (tailwind-merge)
9. axe: zero violations for default, disabled, loading, icon-only-with-aria-label

Plus: `scripts/verify-consumer.mjs` (build output + Tailwind CLI compile of a consumer
fixture → asserts `.bg-primary` etc. are generated) and a check that `dist/**/*.js` for
client components starts with `"use client"`.

`npm run check` = biome check + typecheck + tests + build + verify-consumer. Must be green
before any task is called done.

## 8. Error handling / edge cases

- Icon-only buttons: documented requirement to pass `aria-label`; story shows it; axe test.
- Consumers without Tailwind: out of scope (documented).
- Duplicate React when linking locally: react/react-dom are peerDependencies; recommended
  local consumption is `npm pack` → install the tarball (copies, no symlink), documented in README.

## 9. Out of scope (for now)

Publishing, CI, changesets/versioning, more components, visual regression, React Compiler.
These are the roadmap in README.
