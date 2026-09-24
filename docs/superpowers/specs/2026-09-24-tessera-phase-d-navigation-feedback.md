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
- *Amended in Task 2 (implementation details the spec left open):*
  - The variant is shared with `TabsTab` through a React context provided by `TabsList` (not the root), so a root may hold lists of different variants.
  - Segmented tabs also get the toggle focus pattern; `data-disabled:…` resolves to the underline tab's `data-disabled:cursor-not-allowed data-disabled:opacity-50`.
  - Vertical styles key off Base UI's `data-orientation` via `data-[orientation=vertical]:` (every part carries it). Root: `flex gap-6` (list beside the panels). Underline list: `gap-1` (the horizontal `gap-4` leaves 16px between stacked h-10 tabs, visibly loose in a screenshot). Underline tab: `mb-0 px-3` (the `-mb-px` border overlap only makes sense horizontally; `px-3` clears the left-edge indicator). Indicator: `top-(--active-tab-top) bottom-auto left-0 h-(--active-tab-height) w-0.5 transition-[top,height] motion-reduce:transition-none` (fix round 1: the vertical `transition-[top,height]` has specificity 0,2,0 and beat the base `motion-reduce:transition-none` at 0,1,0, so the vertical rule repeats the reduced-motion reset; verified by a test with real `prefers-reduced-motion: reduce` emulation via CDP). Segmented list: `h-auto flex-col items-stretch self-start`; segmented tab: `h-8 flex-none justify-start`. Panel: `min-w-0 flex-1 pt-0`.
  - `left-(--active-tab-left)` / `w-(--active-tab-width)` generate as specified (the geometry test passes; verify-consumer gains a needle for `left: var(--active-tab-left)` and `top: var(--active-tab-top)`).
  - **Disabled tab "skipped" → skipped for activation.** Base UI 1.8 keeps disabled tabs focusable by design (`TabsTab` passes `focusableWhenDisabled: true`; `TabsList` passes `disabledIndices: []` to its composite root), as the WAI-ARIA APG permits, and exposes no prop to change it. Arrow keys land on a disabled tab (`aria-disabled="true"`), but neither Enter/Space, `activateOnFocus` nor a click activates it. §3's test asserts this.

**Accordion**
- Item: `border-b border-border`.
- Trigger: `flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-sm font-medium not-data-disabled:hover:underline underline-offset-4`, plus the toggle focus pattern.
- Chevron: `size-4 shrink-0 text-muted-foreground transition-transform duration-200 in-data-panel-open:rotate-180` (verify that the variant generates; if not, use `group-data-panel-open:`).
- Panel: `h-(--accordion-panel-height) overflow-hidden text-sm transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none`, with an inner `pb-4` wrapper.
- *Amended in Task 3 (implementation details the spec left open):*
  - Chevron: `in-data-panel-open:rotate-180` generates and works as specified (the Trigger carries Base UI's `data-panel-open`; Tailwind's `in-*` matches any ancestor), so no `group-` fallback. The chevron string gains `motion-reduce:transition-none`: without it the chevron still turned with a transition under `prefers-reduced-motion: reduce`, unlike every other Tessera motion. Verified with real reduced-motion emulation via CDP (panel height and chevron both report `transition-property: none`; removing either reset fails the test).
  - Panel: the specified string needs no extra reset — its `data-*` variants only set `h-0`, never a transition, so the base `motion-reduce:transition-none` wins.
  - Trigger gains `data-disabled:cursor-not-allowed data-disabled:opacity-50` (design-system-v2 §4 cursor rule: disabled gets `cursor-not-allowed`). Base UI 1.8 keeps a disabled item's trigger focusable (`focusableWhenDisabled: true`, `aria-disabled="true"`); it never opens.
  - Parts and slots: `accordion`, `accordion-item`, `accordion-header` (the `h1`–`h6` from `headingLevel`, rendered through `Accordion.Header`'s `render`), `accordion-trigger`, `accordion-chevron` (an inline `aria-hidden` SVG), `accordion-panel`, and `accordion-panel-content` (the inner `pb-4` wrapper). `AccordionTrigger`'s other props (and `className`) go to the button, not the heading. The root adds no classes.
  - Base UI sets the trigger's `aria-controls` only while the panel is open; the panel is a `role="region"` labelled by the trigger.
- *Amended in Task 4 (Accordion review):* the panel gains `-mx-1 px-1`. Its `overflow-hidden` (needed for the height animation) clipped the 2px outline at 2px offset of focusables flush with the panel's left or right edge; the negative margin plus padding gives 4px of ring room on both sides while the content keeps lining up with the trigger. A test tabs to flush-left and flush-right buttons and checks the ring box stays inside the panel's clip rect. The top edge gets no room: vertical padding on a `h-0`-animated, border-box panel would leave a 4px sliver while collapsed, so content that opens with a focusable should start with its own spacing.
- *Amended in Task 5 (Select review):* `-mx-1 px-1` made the panel 8px wider than its item, so inside a zero-padding `overflow-auto` parent it added horizontal scroll (a test measured `scrollWidth` 324 vs `clientWidth` 320). The panel now uses `overflow-clip [overflow-clip-margin:4px] [clip-path:inset(0_-4px)]` instead of `-mx-1 overflow-hidden px-1`: `overflow: clip` clips without a scroll container and lets 4px paint past the box on every side; the `clip-path` inset trims top and bottom back to the box (no 4px sliver under the trigger while collapsing) and keeps the 4px horizontally. Tests: `scrollWidth === clientWidth` in a zero-padding scroll parent (RED on the old classes); real screenshot pixels show the ring colour at the outer edge of a flush-left and a flush-right button's outline (fails with plain `overflow-hidden`); content pinned at `h-3` paints nothing below the panel's bottom edge (fails without the `clip-path`). Browser support: where `overflow-clip-margin` is unsupported (Safari at the time of writing) flush rings are clipped at the sides, i.e. the pre-Task-4 behaviour, with no layout cost; where `overflow: clip` itself is unsupported the `clip-path` still clips. README notes it.

**Select**
- Trigger: the text-field look from `textFieldBase` plus `inline-flex items-center justify-between gap-2 cursor-pointer text-left`, sizes sm/md/lg matching Input, and a chevron-down `Select.Icon` (`text-muted-foreground`).
  - `SelectValue` placeholder colour: `data-placeholder:text-muted-foreground` on the trigger's value span.
- Content: Portal → Positioner (`alignItemWithTrigger` **default false**, like PrimeVue and MUI dropdowns; `side` bottom, `align` start, `sideOffset` 6, `z-(--z-overlay)`) → Popup (`popupSurface` + `popupMotion` + `min-w-(--anchor-width) max-h-(--available-height) overflow-y-auto p-1`) → List.
- Item: `menuItemBase` + `pl-8`, with an `ItemIndicator` check at the left (like `MenuRadioItem`); `data-selected` has `font-medium`.
- Works inside `Field`: `FieldLabel` names it, and invalid shows the danger border. It works inside a `Dialog` (test required).
- Supports `multiple`. `SelectValue` accepts a render function.
- *Amended in Task 4 (implementation details the spec left open):*
  - Trigger `read-only:bg-muted` → `data-readonly:bg-muted`. The trigger is a `<button>`, and every non-editable element matches `:read-only`, so `textFieldBase` as-is painted every trigger muted (a test compares the trigger background with Input's; reverting fails it). Base UI sets `data-readonly` on a `readOnly` select.
  - Sizes come from a shared `textFieldSizes` map exported by `input-variants.ts` (Input uses the same map). The trigger is a cva exported as `selectTriggerVariants` / `SelectTriggerVariantProps` / `selectDefaults`, and carries `data-size`.
  - `SelectValue`: `min-w-0 truncate data-placeholder:text-muted-foreground` — `min-w-0 truncate` so a long value ends in an ellipsis instead of pushing the chevron out. `Select.Icon`: `flex shrink-0 text-muted-foreground [&_svg]:size-4`, `aria-hidden`.
  - Item: `menuItemBase pl-8 data-selected:font-medium`; indicator `absolute left-2 flex size-4 items-center justify-center` (as Menu's); children render inside `Select.ItemText`. Group label and separator reuse Menu's strings (`px-2 py-1.5 text-xs font-medium text-muted-foreground`, `-mx-1 my-1 h-px bg-border`). Base UI renders the separator `role="presentation"` (a listbox may only own options and groups).
  - `SelectValue` shows the raw value unless the root gets `items` (value → label) or `itemToStringLabel`; the README and stories always pass `items`.
  - Parts and slots: `select-trigger`, `select-value`, `select-icon`, `select-content` (Popup), `select-list`, `select-item`, `select-item-indicator`, `select-item-text`, `select-group`, `select-group-label`, `select-separator`.
  - The root wraps `onOpenChange` with `useLayeredEscape` (§0): with a hover-opened Tooltip inside the open list, the first Escape closes only the tooltip (an app `document` listener still receives it), the second closes the select; a test covers it and fails without the wrapper.
  - Reduced motion: no stateful transitions beyond `popupMotion` and `textFieldBase`, whose `data-*` variants set only opacity/scale, so their base `motion-reduce:transition-none` wins; no extra CDP test.

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
- *Amended in Task 5 (implementation details the spec left open):*
  - `Toaster` also takes `children` (the app, so `useToast()` works inside — Base UI's hook needs the Provider), `container` (portal target, like the overlays) and `className` (merged onto the viewport). The viewport carries `data-slot="toaster"` and `data-position`; Base UI makes it a `role="region"` `aria-live="polite"` named "Notifications".
  - Position offsets: `right-4 bottom-4`, `top-4 right-4`, `bottom-4 left-1/2 -translate-x-1/2`, `top-4 left-1/2 -translate-x-1/2`. Toasts are `absolute inset-x-0` against the matching edge; `--toast-dir` (-1 bottom, 1 top) flips every stacking offset, and swipe directions follow the edge (`down`+`right`, `up`+`right`, `down`, `up`).
  - Stacking (after Base UI's documented example): collapsed toasts take `--toast-frontmost-height`, scale down 5% per index and peek `--toast-peek` (0.75rem); expanded (`data-expanded`) toasts use `--toast-offset-y` + `index × --toast-gap` (0.75rem) at their own `--toast-height`. One `transform: translateX(var(--toast-x)) translateY(var(--toast-y)) scale(var(--toast-scale))` is driven by vars that `data-starting-style` / `data-ending-style` / `data-swipe-direction` swap (slide from/past the edge + fade); `data-limited` fades out. Transition `transform, opacity, height` 300ms `cubic-bezier(0.22,1,0.36,1)` + `motion-reduce:transition-none` (no `data-*` variant sets a transition, so the reset wins; CDP test). An `after:` bridge fills the gap so hovering between toasts keeps the stack expanded. `Toast.Content` fades out while `data-behind` and not expanded.
  - Root keeps `outline-hidden` from `popupSurface` and adds the 2px focus-visible ring (the root is focusable: F6 then Tab).
  - Accent: `border-l-4 border-l-tone` + `tone-*` on the root. Types: `success`, `warning`, `danger`, `info`, plus Base UI's `promise()` types `error` (→ danger) and `loading` (a spinning icon in `text-muted-foreground`, no accent). Icons (inline, `aria-hidden`, `data-slot="toast-icon"`): circle-check, triangle-alert, circle-x, info.
  - Action and Close: Button always sets `data-slot="button"`, so (as with Dialog's close) the slots `toast-action` / `toast-close` sit on wrapper spans. Base UI renders `Toast.Close` `aria-hidden` unless the stack is expanded or the button is focused.
  - Priority: Base UI never raises priority by itself. `priority: "high"` makes the root `role="alertdialog"`, `aria-hidden` until keyboard focus enters the viewport, and adds a visually hidden `role="alert"` copy of title + description. Tessera's `useToast().add` and `createToaster().add` default `priority` to `"high"` when `actionProps` is set and no priority is given. axe flags that hidden-but-focusable root as `aria-hidden-focus` "needs review"; the axe test allows exactly that entry and a separate test asserts the `aria-hidden` lift on focus.
  - Parts and slots: `toaster`, `toast`, `toast-content`, `toast-icon`, `toast-title` (Base UI's `h2`), `toast-description`, `toast-action`, `toast-close`.

## 3. Tests (every component)

- Every component: `data-slot` on every part, className merge, and axe in light and dark (violations and incomplete both `[]`).
- Interactive parts: the Tab-focus test (2px solid outline) and cursor.
- **Tabs:** arrow keys move between tabs (loop), and Home/End work. In manual activation mode, Enter/Space activate. `activateOnFocus` activates on arrow. `aria-selected`, `aria-controls` and the panel's `aria-labelledby` are wired. A disabled tab is never activated (Enter/Space, `activateOnFocus`, click); it stays focusable per Base UI — see the §2 amendment. The underline indicator's computed left and width match the active tab's box (within 1px, after the transition settles). Vertical orientation works with ArrowDown.
- **Accordion:** Enter/Space toggle `aria-expanded`. Single mode closes the other item. `multiple` keeps both open. The panel height animates to its content height (computed height > 0 after open, 0 after close). `hiddenUntilFound` makes find-in-page content reachable (the `hidden="until-found"` attribute is present when closed). The heading level is correct.
- **Select:**
  - Opening: click or Enter/Space/ArrowDown opens a listbox, and typeahead highlights the matching item.
  - Selecting: Enter selects, closes and updates the value text, and focus returns to the trigger.
  - `aria-selected` and the check indicator appear only on the selected item. Disabled items can't be chosen (Base UI rule). `multiple` keeps the popup open and shows a comma-joined value.
  - Inside `Field`: the label names the trigger, and invalid gives the danger border. The placeholder colour is muted.
  - Inside a modal `Dialog`: the select is usable and Escape closes only the select.
  - Form submission: the hidden input's name/value appears in FormData.
  - *Amended in Task 5:* the trigger's Tab-focus outline is **1px** solid (`textFieldBase` parity with Input), not the 2px of the toggle focus pattern; its test asserts 1px. Inside `<Field invalid>` the trigger also carries `aria-invalid="true"` (asserted).
- **Toast:**
  - `add({title, description})` shows it in a live region (a `role` with `aria-live` is present). The Close button dismisses it.
  - Timeout auto-dismisses (a short timeout in tests). `timeout: 0` persists.
  - An action button fires its `onClick`.
  - `limit` marks excess toasts `data-limited`. The `type` sets tone and icon.
  - A toast with an action gets `priority: "high"` semantics (verify what Base UI does and assert it).
  - `createToaster()` works outside React.
  - *Amended in Task 5:* also covered — the Toaster's default `timeout`, Close/Action rendered as the specified Buttons, `promise()` loading → success, positions (16px from the edges, centred), collapsed peek vs expanded gap geometry, Tab-focus ring (F6 then Tab), viewport className merge, reduced motion via CDP, and `z-index` 70.
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
