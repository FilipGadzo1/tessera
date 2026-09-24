# Tessera Phase C: Overlays (Spec Addendum)

**Date:** 2026-09-24
**Status:** Claude made these decisions under the owner's standing delegation.
**Builds on:** design-system-v2 §4 and Phase B §3, including the composition rule (a Tessera part used as a render host must carry no base classes that conflict with the element it renders).

## 1. Shape of the API (shadcn-style wrappers over Base UI)

Each overlay ships three kinds of part:

- **Pass-through parts** have no styling: Root, Trigger, Close.
  - Triggers carry **no base classes** at all. Consumers style them by composing: `<PopoverTrigger render={<Button variant="outline" />}>Open</PopoverTrigger>`.
- **A `*Content` part** wraps Base UI's `Portal` → `Positioner` (anchored overlays) → `Popup`.
  - Positioning props go to the Positioner: `side`, `align`, `sideOffset`, `alignOffset`, `collisionPadding`.
  - `container` goes to the Portal.
  - `className`, `children` and all other Popup props go to the Popup.
  - Tessera's default is `sideOffset = 6` for all anchored overlays.
- **Small styled text and layout parts**, such as Title, Description, Header, Footer, Separator, Shortcut and GroupLabel.
  - Parts that render plain elements with no Base UI context are server-safe.

| Component | Exports |
|---|---|
| Tooltip | `TooltipProvider`, `Tooltip` (Root), `TooltipTrigger`, `TooltipContent` |
| Popover | `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverTitle`, `PopoverDescription`, `PopoverClose` |
| Dialog | `Dialog`, `DialogTrigger`, `DialogContent` (Portal + Backdrop + Popup, optional close button), `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose` |
| AlertDialog | `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogClose` |
| Menu | `Menu`, `MenuTrigger`, `MenuContent`, `MenuItem` (`variant: "default" \| "danger"`), `MenuSeparator`, `MenuGroup`, `MenuGroupLabel`, `MenuCheckboxItem`, `MenuRadioGroup`, `MenuRadioItem`, `MenuSub` (SubmenuRoot), `MenuSubTrigger`, `MenuSubContent`, `MenuShortcut` |

## 2. Layering, portals and theming

- **Z-index tokens** are added to `theme.css` in `:root` (not layered with colours) and exposed as `@theme` z values: `--z-overlay: 50` (popover, menu, dialog backdrop and popup) and `--z-tooltip: 60`. Positioners and dialog layers use `z-(--z-overlay)` / `z-(--z-tooltip)`.
  - Docs recommend putting `isolation: isolate` on the app root, as Base UI's own docs do.
- **Portals render into `document.body`.**
  - Theme scopes (`.dark`, `data-primary`, `data-surface`) placed on `<html>` apply to overlays automatically.
  - A scope on an inner element does **not** reach a portalled overlay. For that case, every `*Content` accepts `container`: pass an element inside the scope. This is documented and tested.
- **Motion.** Every popup uses:
  - `origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out data-starting-style:opacity-0 data-starting-style:scale-96 data-ending-style:opacity-0 data-ending-style:scale-96 motion-reduce:transition-none`.
  - Dialogs use the same but without `origin-(--transform-origin)` (they are centred).
  - The dialog backdrop uses `transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none`.

## 3. Visual contract

- **Surface** (Popover, Menu): `rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-hidden`.
  - Popover adds `w-72 p-4 flex flex-col gap-2`.
  - Menu adds `min-w-(--anchor-width) max-h-(--available-height) overflow-y-auto p-1`.
- **Tooltip:** `rounded-md bg-neutral px-2 py-1 text-xs text-neutral-foreground shadow-md max-w-xs text-balance`.
  - It is inverted: dark on a light page, light on a dark page. There is no arrow.
- **Dialog:**
  - Backdrop: `fixed inset-0 z-(--z-overlay) bg-black/50`.
  - Popup: `fixed left-1/2 top-1/2 z-(--z-overlay) -translate-x-1/2 -translate-y-1/2 grid w-[calc(100%-2rem)] gap-4 rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-xl outline-hidden`.
  - The popup also carries `max-h-[calc(100dvh-2rem)] overflow-y-auto` (added in Task 3): it is centred with `fixed` + translate, so long content would otherwise overflow both viewport edges and its top could not be reached while page scroll is locked.
  - The `size` prop sets the max width: sm `max-w-sm`, md `max-w-lg` (default), lg `max-w-2xl`.
  - `showCloseButton` (default `true`) renders a `DialogClose` composed with `<Button variant="ghost" color="neutral" size="icon-sm" aria-label="Close">` plus an X icon (inline SVG), positioned `absolute right-4 top-4`.
    - Because Button always sets its own `data-slot="button"` after its props, the `dialog-close-button` slot and the `absolute right-4 top-4` position sit on a `<span>` wrapping the close Button (Task 3).
  - Base UI hides everything outside a modal dialog (`aria-hidden` plus `data-base-ui-inert`) but sets no `aria-modal`; Tessera adds `aria-modal="true"` when the dialog is modal (Dialog `modal` true or `"trap-focus"`; AlertDialog always).
  - AlertDialog content matches, but has no close button and no `showCloseButton` prop.
- **Dialog text and layout parts:**
  - Header: `flex flex-col gap-1.5`.
  - Footer: `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`.
  - Title: `text-lg font-semibold leading-snug`.
  - Description: `text-sm text-muted-foreground`.
  - Popover Title and Description use the same Title/Description styles but `text-base` for the title.
- **Menu item:**
  - `relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0`.
  - Forced-colors focus visibility: `data-highlighted:outline-2 data-highlighted:outline-solid data-highlighted:outline-transparent data-highlighted:-outline-offset-2`. A transparent outline is invisible normally but becomes a system colour in forced-colours mode.
  - `danger`: `text-danger data-highlighted:bg-danger-soft data-highlighted:text-danger-soft-foreground`.
  - Checkbox and radio items add `pl-8` and an indicator slot `absolute left-2 flex size-4 items-center justify-center` (check or dot SVG).
  - SubTrigger: an item with a trailing chevron-right, plus `data-popup-open:bg-accent`.
  - Separator: `-mx-1 my-1 h-px bg-border`.
  - GroupLabel: `px-2 py-1.5 text-xs font-medium text-muted-foreground`.
  - Shortcut: `ml-auto text-xs tracking-widest text-muted-foreground`, server-safe `<span>`.
- **Submenu alignment:** `MenuSubContent` defaults to `alignOffset = -5`. At -5 the submenu's first item lines up with its trigger, which accounts for the popup's 1px border plus `p-1`. A test measures this.
- **data-slot on every part:**
  - Tooltip: `tooltip-content`.
  - Popover: `popover-content`, `popover-title`, `popover-description`.
  - Dialog: `dialog-backdrop`, `dialog-content`, `dialog-header`, `dialog-footer`, `dialog-title`, `dialog-description`, `dialog-close-button`.
  - Menu: `menu-content`, `menu-sub-content`, `menu-group`, `menu-radio-group`, `menu-item-indicator`, `menu-item`, `menu-separator`, `menu-group-label`, `menu-checkbox-item`, `menu-radio-item`, `menu-sub-trigger`, `menu-shortcut`.
  - AlertDialog: the Dialog slots with the `alert-dialog-` prefix.

## 4. Behaviour and tests (every overlay)

- **Open and close:** by pointer and by keyboard (Enter/Space on the trigger; Escape closes). Focus returns to the trigger on close (Popover, Dialog, Menu).
- **ARIA:**
  - Tooltip: `role="tooltip"` and the trigger's `aria-describedby`.
  - Popover and Dialog: `role="dialog"`, with `aria-labelledby` pointing at the Title and `aria-describedby` at the Description.
  - AlertDialog: `role="alertdialog"`.
  - Menu: `role="menu"` / `menuitem` / `menuitemcheckbox` / `menuitemradio`, with `aria-checked` on checkbox and radio items.
- **Dialog:**
  - Focus moves inside on open, and Tab cycles within it (focus trap).
  - Clicking the backdrop closes a Dialog but **not** an AlertDialog.
  - Background scroll is locked while open (`document.documentElement` or body overflow is hidden).
- **Menu:**
  - The arrow keys move the highlight. Disabled items stay reachable by arrow key but can't be activated. This is Base UI 1.8's deliberate behaviour, and the WAI-ARIA menu guidance recommends it.
  - Enter activates an item (its `onClick` fires and the menu closes).
  - A checkbox item toggles and stays open.
  - A radio item selects.
  - ArrowRight opens a submenu and ArrowLeft closes it.
- **Tooltip:** opens on hover and on keyboard focus (tests use `delay={0}`) and closes on Escape.
- **Theming:** with `.dark` on `<html>`, the popup background computes to the dark `--popover`. A `container` inside a `data-primary="lapis"` scope makes the popup inherit lapis. Tests must clean up `<html>` classes and attributes afterwards.
- **Axe:** run in the open state in light and dark mode (dark via `.dark` on `<html>` during the test), asserting that both violations and incomplete are empty.
- **Portal:** the popup element is a descendant of `document.body` and not of the render container, unless `container` is passed.
