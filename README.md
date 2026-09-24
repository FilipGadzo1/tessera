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
- [x] Label
- [x] Input
- [x] Field (FieldLabel, FieldDescription, FieldError, FieldItem for one option of a radio or checkbox group)
- [x] Textarea (auto-grows with its content; `rows` sets the minimum height)
- [x] Checkbox (checked and indeterminate states; wrap in Label or use inside a Field)
- [x] Switch (on/off toggle; wrap in Label or use inside a Field)
- [x] RadioGroup, Radio (arrow keys move selection; render through a Fieldset so the legend names the group:
  `<Fieldset render={<RadioGroup />}><FieldsetLegend>…</FieldsetLegend>…</Fieldset>`; inside a Field,
  wrap each option in FieldItem)
- [x] Fieldset, FieldsetLegend (groups radios or Fields; a disabled Fieldset disables its RadioGroup;
  to mute the label text as well, set `disabled` on the surrounding `Field` — FieldLabel dims its text
  color, and the control keeps its own 50% opacity)
- [x] Tooltip (TooltipProvider, Tooltip, TooltipTrigger, TooltipContent; inverted neutral bubble, no arrow.
  Compose the trigger: `<TooltipTrigger render={<Button size="icon" aria-label="Add" />}>`. Hover delay
  is set on the trigger or a TooltipProvider (`delay`, default 600 ms). The content gets
  `role="tooltip"` and the trigger `aria-describedby` while it is open — still give icon-only triggers
  an `aria-label`: tooltips don't reach touch users)
- [x] Popover (Popover, PopoverTrigger, PopoverContent, PopoverTitle, PopoverDescription, PopoverClose;
  a `role="dialog"` panel on the popover surface, named by PopoverTitle and described by
  PopoverDescription. Compose the trigger and close: `<PopoverTrigger render={<Button variant="outline" />}>`.
  Opens on click, Enter or Space; Escape, an outside click or PopoverClose closes it and focus returns
  to the trigger. On open, focus moves to the first tabbable element inside (or the panel itself);
  change that with `initialFocus` on PopoverContent. Controlled via `open` / `onOpenChange`)
- [x] Dialog (Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle,
  DialogDescription, DialogClose; a centred modal `role="dialog"` over a dimmed backdrop. DialogContent
  takes `size` (`sm` / `md` default / `lg`) and `showCloseButton` (default true: a ghost icon Button
  named "Close" in the corner). Focus moves to the first tabbable element and is trapped; page scroll
  is locked; Escape, a backdrop click or DialogClose closes it and focus returns to the trigger. Long
  content scrolls inside the dialog. `dialogVariants({ size })` gives the popup classes)
- [x] AlertDialog (AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogClose; `role="alertdialog"`
  styled like Dialog, with no close button. A backdrop click does not close it — Escape does. Put the
  choices in the footer: `<AlertDialogClose render={<Button variant="outline" color="neutral" />}>Cancel</AlertDialogClose>`
  and a confirm `<Button color="danger" onClick={…}>`)
- [ ] Next up: Menu (Phase C) · Tabs, Select, Accordion, Toast, Avatar, Separator, Progress (Phase D)

Composition: when a part is rendered through another (`<Fieldset render={<RadioGroup className=…/>}>`),
the outer part's own classes win over conflicting classes on the render element (Base UI merges the
render element's className first; tailwind-merge keeps the last). Lay out children with a wrapper
instead — e.g. a horizontal radio group puts the radios in `<div className="flex flex-row gap-6">`
after the FieldsetLegend.

Overlays (Tooltip, Popover, Dialog, AlertDialog, and Menu as it lands) portal into `document.body`:

- Put theme scopes (`.dark`, `data-primary`, `data-surface`) on `<html>` so overlays pick them up.
- A scope on an inner element does not reach a portalled overlay — pass `container` (an element
  inside that scope) to the `*Content` part: `<TooltipContent container={scopeRef}>`.
- Add `isolation: isolate` to your app root so app z-indexes can't rise above overlays. Overlays
  use `--z-overlay` (50) and `--z-tooltip` (60), overridable in an unlayered `:root`.
- Triggers carry no styles: compose them with `render={<Button … />}`. Anchored `*Content` parts
  (Tooltip, Popover, Menu) take the positioning props `side`, `align`, `sideOffset` (default 6),
  `alignOffset`, `collisionPadding`; dialogs are centred and take none.

Forms: there is no Tessera `Form` yet — use Base UI's `Form` (`@base-ui/react/form`) around named
Fields for submit-time validation. The Storybook story **Tessera/Examples/Sign-up form**
(`src/docs/examples/sign-up-form.tsx`) composes every form control this way.

## Roadmap

Components above · visual regression · React Compiler on output · publish to npm (`@tessera/ui` is free).
