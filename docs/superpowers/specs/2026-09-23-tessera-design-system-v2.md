# Tessera — Design System v2 (Theme, Button v2, Component Roadmap)

**Date:** 2026-09-23
**Status:** Decided by Claude on owner's direction: "I don't like these colors… use inspiration from primevue.dev and mui.com/material-ui and continue implementing other components. Buttons should have pointer mouse." Owner has delegated decisions ("do not ask me questions").
**Supersedes:** §5 (palette values) and §6 (Button API) of `2026-09-23-tessera-foundation-design.md`. Everything else there still holds.

## 1. What we take from each inspiration

| From PrimeVue (Aura) | From Material UI |
|---|---|
| Three-tier tokens: **primitive palettes (50–950) → semantic roles → component usage** | Two-axis Button API: **variant × color** (`contained/outlined/text` × `primary/success/error/…`) |
| Swappable **primary palette** and **surface palette** presets | Status colors as first-class roles: success · warning · danger(error) · info |
| 40px default control height, 6px radius, `font-weight: 500` controls | Elevation for surfaces: Card `elevated` vs `outlined` |
| Solid focus outline (2px, offset 2px, primary color) | Consistent size scale shared across controls |

Not taken: MUI ripple (JS-heavy, dated), uppercase button labels, PrimeVue's white-on-emerald-500 (fails WCAG AA).

## 2. Signature: the gem palettes

Tessera's palettes are named after mosaic stones. Each is generated in OKLCH with the **same lightness curve for every hue**, so step 600 of *any* palette carries white text at ≥ 4.5:1 and step 400 carries its own step-950 text at ≥ 4.5:1. That is what makes palettes truly swappable: any primary works with every component with no per-palette exceptions.

- **Primary options:** `malachite` (green-teal, default) · `lapis` (blue) · `amethyst` (violet) · `carnelian` (orange-red)
- **Status palettes (fixed):** success = `verdant` · warning = `amber` · danger = `garnet` · info = `azure`
- **Surface options:** `marble` (neutral, default) · `slate` (cool) · `sandstone` (warm)

Selection is by attribute on any ancestor (usually `<html>`), and it nests:
```html
<html class="dark" data-primary="lapis" data-surface="slate">
```

The Storybook docs gain a toolbar to switch primary × surface × light/dark, and a **Palettes** page drawn as a mosaic: every step of every palette is a tile, laid with grout gaps.

Lightness curve (all chromatic palettes): 50 .975 · 100 .945 · 200 .895 · 300 .825 · 400 .74 · 500 .64 · 600 .54 · 700 .47 · 800 .40 · 900 .33 · 950 .255. Chroma peaks at 500 and is capped at 97% of the sRGB gamut edge per hue.
Surface curve: 0 1 · 50 .985 · 100 .972 · 200 .925 · 300 .87 · 400 .708 · 500 .535 · 600 .446 · 700 .372 · 800 .279 · 900 .21 · 950 .145.
Contrast was verified numerically for every palette × surface (script in the plan); worst case is 4.73:1.

## 3. Token architecture

1. **Primitives** (`src/styles/palettes.css`): `--tsr-<palette>-<step>`, all oklch.
2. **Bindings**: `--tsr-primary-<step>` and `--tsr-surface-<step>` point at the palette chosen by `data-primary` / `data-surface` (defaults malachite / marble on `:root`).
3. **Semantic roles** (`src/styles/theme.css`), light and dark:
   - Surfaces (shadcn-compatible names): `background, foreground, card(-foreground), popover(-foreground), muted(-foreground), accent(-foreground), border, input, ring`.
   - Form controls (WCAG 1.4.11, ≥ 3:1, gated by the generator): `field` (light surface-0 / dark 900), `field-border` and `switch-track` (light = oklab mix of 400 and 500 / dark 500), `field-border-hover` (light 500 / dark 400). Dark 500 is only 2.83:1 on 800, so fields must not sit on `bg-muted` in dark. `tone-neutral`'s `--tone-line` is `--field-border`.
   - Color roles `primary, neutral, success, warning, danger, info`, each with `-hover`, `-active`, `-foreground` (text on solid), `-soft`, `-soft-hover`, `-soft-foreground`.
   - shadcn aliases: `secondary(-foreground)` = neutral soft; `destructive(-foreground)` = danger.
   - Light: solid = 600 / hover 700 / active 800 / foreground white / soft 100 / soft-hover 200 / soft-foreground 700.
   - Dark: solid = 400 / hover 300 / active 200 / foreground 950 / soft = 400 at 16% / soft-hover 400 at 24% / soft-foreground 200.
4. **Tone** (component level): utilities `tone-primary … tone-info` set `--tone`, `--tone-hover`, `--tone-active`, `--tone-foreground`, `--tone-soft`, `--tone-soft-hover`, `--tone-soft-foreground`, `--tone-ink` (colored text on the page surface) and `--tone-line` (border). Components write their styles once against `bg-tone`, `text-tone-ink`, and so on. The color prop only swaps the `tone-*` class. `cn` knows `tone-*` is one conflict group.

Tailwind utilities exposed: every semantic role (`bg-primary`, `bg-success-soft`, `text-danger-soft-foreground`…), scales `bg-primary-50…950` and `bg-surface-0…950`, and tone colors.
Radius: `--radius: 0.375rem`. `rounded-sm/md/lg/xl` = radius −2px / radius / +2px / +6px, which equals Tailwind's defaults at the default radius.
Tokens live in `@layer base`, so any unlayered consumer override wins. Tessera components never use `dark:`.

Shipped stylesheet moves to `dist/styles/tessera.css` (plus `palettes.css` and `theme.css` next to it). The export `@tessera/ui/styles.css` points there and uses `@source "../"`.

## 4. Design language (binding for every component)

- **Control sizes:** xs 28px (h-7) · sm 32px (h-8) · md 40px (h-10, default) · lg 48px (h-12). Text: xs/sm/md `text-sm` (xs `text-xs`), lg `text-base`. Buttons, inputs and selects of the same size line up exactly.
- **Radius:** controls `rounded-md`, surfaces (card, dialog, popover) `rounded-lg`/`rounded-xl`, chips and badges `rounded-md`.
- **Focus:** keyboard focus = `outline-none outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid`. In Tailwind v4 `outline-none` sets `--tw-outline-style: none` and the width utilities (`outline-2`) read `outline-style: var(--tw-outline-style)`, so the focus state must set `outline-solid` explicitly or the ring stays invisible; the color and offset live in the base so the ring does not fade in from `currentColor`. `outline-none` is `outline-style: none` in every mode, so in forced colors the ring appears only on focus, painted in a system colour (*Amended in Phase E Task 0*: interactive controls used `outline-hidden`, whose transparent forced-colors outline Chromium paints as CanvasText, a permanent ring; surfaces such as popups and the dialog popup keep `outline-hidden`, where that outline is a desirable border; the toast root never had `outline-hidden` — it only carries a `focus-visible:outline-*` ring). Where the focus colour would equal the unfocused border colour in forced colors, add `forced-colors:focus-visible:outline-[Highlight]`. Text fields instead use `outline-none focus:outline-1 focus:outline-solid focus:outline-ring focus:border-ring forced-colors:focus:outline-[Highlight]` (no offset, so the ring sits on the border and needs `Highlight` to stand out). Rule: every interactive component has a focus test that tabs to it and asserts computed `outline-style: solid` (and the expected width), and a forced-colors test (CDP, `test/emulation.ts`) that it has `outline-style: none` until focused.
- **Forced-colors selected states:** *Amended in Task 6 fix round 1 (Phase F)*: a "selected" look built from the `Highlight`/`HighlightText` system-colour pair (`forced-colors:data-pressed:bg-[Highlight] forced-colors:data-pressed:text-[HighlightText]`-style rules — pressed Toggle, active segmented Tab, active Pagination link, selected Table row, selected Calendar day) must also set `forced-color-adjust: none`, scoped to that same selected state (e.g. `forced-colors:data-pressed:forced-color-adjust-none`). Verified against a real minimal page under Windows-style forced colors (also reproduced in Chromium via CDP `Emulation.setEmulatedMedia`): with the default `forced-color-adjust: auto`, Chromium paints a `Canvas`-coloured text backplate behind text whenever forced colors is active — even when the text's own colour is already an explicit system colour (`HighlightText`) — and that backplate sits on top of an author-chosen `Highlight` background and hides the glyph entirely. `forced-color-adjust: none` disables that automatic backplate so the authored `Highlight`/`HighlightText` pair renders legibly, as specified. Because `forced-color-adjust: none` also stops the *automatic* forcing of any other author colour on that element (a border, an unpressed focus outline colour it was otherwise relying on), restate those explicitly in a system colour too while the selected state is active (e.g. `forced-colors:data-pressed:focus-visible:outline-[Highlight]`, `forced-colors:data-pressed:border-[Highlight]`). `forced-color-adjust` is an inherited property, so a parent's `none` (e.g. a selected Table row) also covers its children's own text (e.g. its cells) without repeating the rule on each. `getComputedStyle`'s `background-color`/`color` cannot detect a missing `forced-color-adjust: none` — the backplate is a paint-time effect, not a CSS property change — so a forced-colors test must assert the computed `forced-color-adjust` value itself (`none` selected, `auto` otherwise), and ideally a real-pixel screenshot/canvas-sampling check too.
- **Cursor:** anything clickable gets `cursor-pointer`. Disabled gets `cursor-not-allowed`, and hover styles are gated with `not-data-disabled:`. Loading gets `cursor-progress`. Nothing uses `pointer-events-none` on the control itself.
- **Disabled look:** `opacity-50`. Invalid: `data-invalid` → `border-danger` plus danger outline.
- **Motion:** `transition-[color,background-color,border-color,outline-color,box-shadow,translate] duration-150 ease-out`; `motion-reduce:transition-none`. Overlays animate with Base UI's `data-starting-style` / `data-ending-style` (fade + 4px slide / 96% scale).
- **Elevation:** popovers and menus `shadow-lg`, dialogs `shadow-xl`, elevated cards `shadow-md`.
- **Server safety:** components without hooks (Badge, Card, Separator…) carry no `"use client"`, so they render in RSC.

## 5. Button v2 API

```ts
variant?: "solid" | "soft" | "outline" | "ghost" | "link";                         // default "solid"
color?:   "primary" | "neutral" | "success" | "warning" | "danger" | "info";         // default "primary"
size?:    "xs" | "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon" | "icon-lg";   // default "md"
loading?: boolean;
```
Breaking change from v1: `variant="primary|secondary|destructive"` becomes `variant` × `color`. There are no consumers yet.
DOM contract: `data-slot="button"`, `data-variant`, `data-color`, `data-size`, `data-loading`. `buttonVariants({ variant, color, size, className })` stays server-safe.

## 6. Component roadmap

Each phase gets its own plan and goes through subagent-driven execution:
- **Phase A (plan 2): Theme v2, Button v2, Badge, Card.**
- **Phase B (plan 3), forms:** Label, Field (label + control + description + error, Base UI Field), Input, Textarea, Checkbox, Switch, RadioGroup.
- **Phase C (plan 4), overlays:** Tooltip, Popover, Dialog, Menu.
- **Phase D (plan 5), navigation and feedback:** Tabs, Select, Accordion, Toast, Avatar, Separator, Progress.

Every component follows the folder convention, has Vitest browser tests including axe in both themes, has stories with `tags: ["autodocs"]`, and is exported from `src/index.ts`.
