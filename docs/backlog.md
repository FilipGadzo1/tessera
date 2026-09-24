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

### Phase C final review — KEEP DEFERRED
- Tooltip: `TooltipContent` stores the caller's `ref` in an insertion effect, but the stable popup
  callback ref is not re-run if the caller swaps `ref` while the tooltip is open, so the new ref gets
  nothing until the next mount (fix: merged refs that re-attach on change).
- Dialog: the close button is last in the tab order (visually top-right) and scrolls away with the
  content in a long dialog (documented in the README). Consider a sticky-header option later.
- Dialog / AlertDialog: `aria-modal` and `data-size` are set after `{...props}` on purpose, so they
  are not overridable.
- `verify-consumer`: `inTypeGraph` matches declaration files by filename and ignores side-effect
  imports. Stricter: walk the import graph from `dist/index.d.ts`.
- Dialog: the backdrop is not customizable (no `backdropClassName`), and Base UI's nested-dialog
  styling hook (`data-nested-dialog-open`) is unused.
- Project card example: the deleted state's `role="status"` mounts together with its content, so
  the announcement is unreliable; moving focus to Undo mitigates it.

### Phase D notes (from the Phase C review)
- Toast: add a `--z-toast` token and extend the verify-consumer z-token needle to it.
- Select: reuse `popupSurface` / `menuItemBase`; consider exporting the internal popup layer
  (Portal → Positioner → Popup, as `MenuPopupLayer`) for reuse.
- Select: decide `alignItemWithTrigger` (Base UI default, overlaps the trigger) vs the overlays'
  `sideOffset = 6`.
- Tooltip Escape (Task 0, done): layered via a registry of open Tessera tooltips
  (`src/lib/tooltip-escape.ts`). Dialog, AlertDialog, Popover, Menu and MenuSub roots cancel an
  Escape close (`eventDetails.cancel()` + `allowPropagation()`, not forwarded to the caller's
  `onOpenChange`) while a tooltip is open or was open at keydown (a window-capture listener records
  the event without stopping it); the tooltip closes itself with reason `"escape-key"`. Remaining
  trade-offs: any new overlay root with Escape dismissal (Phase D Select, future Drawer / Combobox)
  must wrap its `onOpenChange` with `useLayeredEscape`, and a raw Base UI overlay around a Tessera
  Tooltip still closes on the same Escape (with the tooltip's trigger focused, too — the tooltip now
  lets the event propagate). A controlled Tooltip whose owner ignores `onOpenChange(false)` keeps
  outer overlays from closing on Escape while it stays open. The outer overlay's own Escape close
  still stops propagation (Base UI default), so app listeners don't see that second Escape.
  The first Escape reaches app listeners with `defaultPrevented === true` (the tooltip's own close
  prevents default), so apps that bail out on `if (e.defaultPrevented) return` ignore it. The
  registry is global: any open Tessera tooltip anywhere defers every Tessera overlay's Escape close,
  not just overlays that contain it. The recorded keydown is cleared a macrotask after dispatch.

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
