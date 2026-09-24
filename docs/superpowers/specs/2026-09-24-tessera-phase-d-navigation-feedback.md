# Tessera Phase D: Navigation and Feedback (Spec Addendum)

**Date:** 2026-09-24
**Status:** Claude made these decisions under the owner's standing delegation ("do not ask me questions, keep implementing"). The owner asked for the palette tilt fix first; that fix is merged.
**Builds on:**
- design-system-v2 §4: tokens, sizes, focus, cursor.
- Phase B §3: composition rule, `mergeClassName`.
- Phase C §1–§4: the overlay pattern (`popupSurface`, `popupMotion`, `menuItemBase`, z tokens, `container`, `auditOpenOverlay`).

## 0. Carry-over from Phase C (Task 0)

Today, while a hover-opened Tooltip is open, a window-capture listener closes it on Escape and swallows the event.

The target is to replace this with a **registry of open Tessera tooltips** plus `eventDetails.cancel()` in the `onOpenChange` of the Dialog, AlertDialog, Popover and Menu roots:
- When the reason is `"escape-key"` and a Tessera tooltip is open, the outer overlay cancels its own close.
- The tooltip's own Escape handling then closes it, with reason `"escape-key"`.
- Nothing swallows the event.

Keep whichever approach passes all the tests: the tooltip is closed first, with the Dialog, Popover and Menu each staying open; the second Escape closes the outer overlay; and an app-level `document` Escape listener still receives the event. Tests must also cover a Tooltip inside a Popover and inside a Menu. Document the chosen behaviour in the README Tooltip section and in the backlog.

## 1. Components

| Export | Base UI | Client? | Notes |
|---|---|---|---|
| `Separator` | none (plain markup) | no | `orientation` `horizontal` (default) or `vertical`. `decorative` (default `true`) renders `role="none"`; `decorative={false}` renders `role="separator"` + `aria-orientation`. Classes: `shrink-0 bg-border`, plus `h-px w-full` (horizontal) or `w-px self-stretch` (vertical). |
| `Avatar`, `AvatarImage`, `AvatarFallback` | `Avatar.*` | yes | Sizes `sm` size-8, `md` size-10 (default), `lg` size-12. Root: `relative inline-flex shrink-0 overflow-hidden rounded-full bg-muted align-middle`. Image: `size-full object-cover`. Fallback: `flex size-full items-center justify-center text-sm font-medium text-muted-foreground uppercase select-none` (`text-xs` at sm). |
| `AvatarGroup` | none | no | `flex -space-x-2 [&>*]:ring-2 [&>*]:ring-background`. |
| `Progress`, `ProgressLabel`, `ProgressValue` | `Progress.*` | yes | `Progress` renders Root, Track and Indicator itself. Props: `value` (`null` = indeterminate), `min`, `max`, `format`, `color` (tone, default primary), `size` (`sm` h-1.5, `md` h-2 default, `lg` h-3), `children` (label/value slot above the bar). Track: `relative w-full overflow-hidden rounded-full bg-muted`. Indicator: `h-full rounded-full bg-tone transition-[width] duration-300 ease-out motion-reduce:transition-none`. Indeterminate: indicator `w-1/3 animate-[tsr-indeterminate_1.2s_ease-in-out_infinite] motion-reduce:animate-none` (keyframes in theme.css). |
| `Tabs`, `TabsList`, `TabsTab`, `TabsPanel` | `Tabs.*` | yes | `variant` on `TabsList`: `underline` (default) or `segmented`. See §2. |
| `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionPanel` | `Accordion.*` | yes | `AccordionTrigger` wraps Header plus Trigger (header level via a `headingLevel` prop, default 3) and adds a chevron. See §2. |
| `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectGroupLabel`, `SelectSeparator` | `Select.*` | yes | See §2. |
| `Toaster`, `useToast`, `createToaster` | `Toast.*` | yes | See §2. |

## 2. Details

**Tabs**
- `underline`:
  - List: `relative flex gap-4 border-b border-border`.
  - Tab: `relative -mb-px inline-flex h-10 cursor-pointer items-center gap-2 px-1 text-sm font-medium text-muted-foreground transition-colors not-data-disabled:hover:text-foreground data-active:text-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50`, plus the toggle focus pattern.
  - Indicator: `absolute bottom-0 left-(--active-tab-left) h-0.5 w-(--active-tab-width) rounded-full bg-primary transition-[left,width] duration-200 ease-out motion-reduce:transition-none`, rendered by `TabsList`.
- `segmented`:
  - List: `inline-flex h-10 items-center rounded-lg bg-muted p-1`.
  - Tab: `inline-flex h-full flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground not-data-disabled:hover:text-foreground data-active:bg-background data-active:text-foreground data-active:shadow-xs data-disabled:…`. No Indicator part.
- Vertical orientation: the list becomes `flex-col border-b-0 border-l` (underline), and the indicator uses the top/height vars on the left edge.
- Panel: `outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring` with `pt-4`.

**Accordion**
- Item: `border-b border-border`.
- Trigger: `flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-sm font-medium not-data-disabled:hover:underline underline-offset-4`, plus the toggle focus pattern.
- Chevron: `size-4 shrink-0 text-muted-foreground transition-transform duration-200 in-data-panel-open:rotate-180` (verify that the variant generates; if not, use `group-data-panel-open:`).
- Panel: `h-(--accordion-panel-height) overflow-hidden text-sm transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none`, with an inner `pb-4` wrapper.

**Select**
- Trigger: the text-field look from `textFieldBase` plus `inline-flex items-center justify-between gap-2 cursor-pointer text-left`, sizes sm/md/lg matching Input, and a chevron-down `Select.Icon` (`text-muted-foreground`).
  - `SelectValue` placeholder colour: `data-placeholder:text-muted-foreground` on the trigger's value span.
- Content: Portal → Positioner (`alignItemWithTrigger` **default false**, like PrimeVue and MUI dropdowns; `side` bottom, `align` start, `sideOffset` 6, `z-(--z-overlay)`) → Popup (`popupSurface` + `popupMotion` + `min-w-(--anchor-width) max-h-(--available-height) overflow-y-auto p-1`) → List.
- Item: `menuItemBase` + `pl-8`, with an `ItemIndicator` check at the left (like `MenuRadioItem`); `data-selected` has `font-medium`.
- Works inside `Field`: `FieldLabel` names it, and invalid shows the danger border. It works inside a `Dialog` (test required).
- Supports `multiple`. `SelectValue` accepts a render function.

**Toast**
- `Toaster`: `Toast.Provider` + `Toast.Portal` + `Toast.Viewport` rendering the current toasts.
  - Props: `position` (`bottom-right` default, `top-right`, `bottom-center`, `top-center`), `limit` (default 3), `timeout` (default 5000), `toastManager?`.
  - Viewport: `fixed z-(--z-toast) flex w-[calc(100%-2rem)] max-w-sm flex-col` plus the position offsets.
- Toast root:
  - Base: `popupSurface` look (`rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-4`), stacked with Base UI's CSS vars: offset by `--toast-offset-y` when expanded, `--toast-index` scale/peek when collapsed.
  - Motion: enter/exit (slide + fade) and swipe (`--toast-swipe-movement-x/y`), `motion-reduce` respected.
  - `type`: `default | success | warning | danger | info` sets a tone class. Colour appears as a leading icon (inline SVG) in `text-tone-ink` and a `border-l-4 border-l-tone` accent (the default type has no accent).
  - Title: `text-sm font-semibold`. Description: `text-sm text-muted-foreground`.
  - Action: a composed Button (`size="sm" variant="outline" color="neutral"`) rendered from `actionProps`.
  - Close: an icon Button (ghost, neutral, icon-xs, `aria-label="Close"`).
- `useToast()` re-exports `Toast.useToastManager()` (`add`, `close`, `update`, `promise`, `toasts`).
- `createToaster()` wraps `Toast.createToastManager()` for use outside React, passed to `<Toaster toastManager>`.
- New token `--z-toast: 70` (plus a verify-consumer needle).

## 3. Tests (every component)

- Every component: `data-slot` on every part, className merge, and axe in light and dark (violations and incomplete both `[]`).
- Interactive parts: the Tab-focus test (2px solid outline) and cursor.
- **Tabs:** arrow keys move between tabs (loop), and Home/End work. In manual activation mode, Enter/Space activate. `activateOnFocus` activates on arrow. `aria-selected`, `aria-controls` and the panel's `aria-labelledby` are wired. A disabled tab is skipped. The underline indicator's computed left and width match the active tab's box (within 1px, after the transition settles). Vertical orientation works with ArrowDown.
- **Accordion:** Enter/Space toggle `aria-expanded`. Single mode closes the other item. `multiple` keeps both open. The panel height animates to its content height (computed height > 0 after open, 0 after close). `hiddenUntilFound` makes find-in-page content reachable (the `hidden="until-found"` attribute is present when closed). The heading level is correct.
- **Select:**
  - Opening: click or Enter/Space/ArrowDown opens a listbox, and typeahead highlights the matching item.
  - Selecting: Enter selects, closes and updates the value text, and focus returns to the trigger.
  - `aria-selected` and the check indicator appear only on the selected item. Disabled items can't be chosen (Base UI rule). `multiple` keeps the popup open and shows a comma-joined value.
  - Inside `Field`: the label names the trigger, and invalid gives the danger border. The placeholder colour is muted.
  - Inside a modal `Dialog`: the select is usable and Escape closes only the select.
  - Form submission: the hidden input's name/value appears in FormData.
- **Toast:**
  - `add({title, description})` shows it in a live region (a `role` with `aria-live` is present). The Close button dismisses it.
  - Timeout auto-dismisses (a short timeout in tests). `timeout: 0` persists.
  - An action button fires its `onClick`.
  - `limit` marks excess toasts `data-limited`. The `type` sets tone and icon.
  - A toast with an action gets `priority: "high"` semantics (verify what Base UI does and assert it).
  - `createToaster()` works outside React.
- **Progress:** `role="progressbar"`. `aria-valuenow`/`min`/`max` are set when determinate. When indeterminate there is no `aria-valuenow`, `data-indeterminate` is present, and the animation class is present. The indicator width matches the value. The label names the bar via `aria-labelledby`.
- **Avatar:** the image shows once loaded (use a data-URI PNG). The fallback shows on error and after `delay`. Initials are uppercase.
- **Separator:** the role/orientation matrix above.

## 4. Docs

- Stories for each component.
- A `Tessera/Examples/Settings` page composing:
  - Tabs: Profile / Notifications / Billing.
  - Profile: Avatar with a fallback, Field + Input, and Select (language).
  - Notifications: an Accordion of channels, each containing Switches.
  - Billing: Progress showing storage used, plus Separator.
  - A "Save changes" Button that shows a success Toast.
- README: component list complete for Phase D. The backlog is updated.
