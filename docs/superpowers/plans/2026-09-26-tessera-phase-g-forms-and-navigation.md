# Tessera Phase G — Forms and Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix forced-colors separators and a flaky test, then add Collapsible, CheckboxGroup, Form, OTPField, Autocomplete, Menubar and NavigationMenu on Base UI 1.8, a Checkout example, and a Menubar in the Editor example.

**Architecture:** As Phases B–F: `src/components/<name>/{<name>.tsx, <name>-variants.ts?, <name>.test.tsx, <name>.stories.tsx, index.ts}`; shared helpers in `src/lib` (cn, merge-class-name, overlay-classes, tone, tooltip-escape, icons, clone-render, focus-classes, use-controllable-state, date); tests in real Chromium with `test/overlay.ts`, `test/emulation.ts`, `test/pointer.ts`.

**Tech Stack:** as before. New Base UI subpaths: `collapsible, checkbox-group, form, otp-field, autocomplete, menubar, navigation-menu` (add each to `vitest.config.ts` optimizeDeps when first imported). No new dependencies. Base UI stays pinned `~1.8.0`.

**Spec:** `docs/superpowers/specs/2026-09-26-tessera-phase-g-forms-and-navigation.md` (binding) + design-system-v2 §4 + earlier phase specs it references.

## Global Constraints

- Repo `C:\Users\Filip\Desktop\projects\tessera`; Windows 11; Node 24; Bash tool. Branch `phase-g`.
- **Never start anything on port 8080 and never kill the process there (the owner's Storybook).** Smoke tests only on `-p 6107 --ci --no-open`. **Stop only the exact PID you started** (`netstat -ano | grep :6107 | grep LISTEN` → `taskkill //PID <pid> //T //F`). **Never kill processes by name** (`tskill node`, `taskkill /IM node.exe`, `Stop-Process -Name node`): that killed the owner's Storybook and Claude's MCP servers once. Verify 8080 is still listening afterwards if it was before.
- Markdown/source edits keep LF.
- Class strings as the spec; adapt only with evidence (amend the spec in the same commit as an *Amended in Task N* bullet, noting why).
- `{...props}` first, then `data-slot`/className (`mergeClassName`, which supports function-form className). Every part sets `data-slot`.
- `"use client"` on files importing Base UI or using hooks; `src/lib/*` non-hook modules and `*-variants.ts` are server-safe.
- Interactive controls `outline-none` + `toggleFocusClasses` + `forced-colors:focus-visible:outline-[Highlight]`; surfaces `outline-hidden`; selected/open Highlight/HighlightText states add `forced-color-adjust-none`.
- Shared icons only from `src/lib/icons.tsx` (add new ones there with a test entry); never copy an icon.
- Exports per component in `src/index.ts`: components + `*Props` types (+ variants/defaults where cva is used).
- Tests: `vitest-browser-react` + `userEvent` from `vitest/browser`; portalled parts via `document.body`; `waitForPopupSettled` not sleeps; axe via `auditOpenOverlay` for overlays or `axe.run(container)`; violations + incomplete both `[]`; light + dark; forced colors / reduced motion via `test/emulation.ts`.
- Stories: `title: "Components/<Name>"`, `tags: ["autodocs"]`, realistic content.
- `npm run format && npm run check && npm run build:storybook` green at each task end. Commits end with blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `.omc/`, `.superpowers/`, `dist/`, `storybook-static/`, `.tmp-consumer/`, `*.tgz`, `.vitest/`.
- Implementers read `node_modules/@base-ui/react/<part>/**/*.d.ts`, `.js` for behaviour, and `node_modules/@base-ui/react/docs/react/components/<part>.md` first.

---

### Task 0: Forced-colors separators and the flaky ContextMenu axe test
Spec §0.
- [ ] Tests first (RED): each separator family's forced-colors colour.
- [ ] Implement; make the ContextMenu submenu axe test deterministic and prove it with 20 repeated runs; backlog updated; gate; commits `fix(a11y): visible separators in forced colors`, `test(context-menu): settle both popups before axe`.

### Task 1: Collapsible and CheckboxGroup
Spec §2 Collapsible / CheckboxGroup + §3.
- [ ] Tests per spec (hiddenUntilFound, height motion + reduced motion, parent checkbox indeterminate, FormData, in Fieldset/Field, axe light/dark).
- [ ] Implement; stories (Collapsible: Basic, With chevron, Hidden until found; CheckboxGroup: Basic, Parent checkbox, In Fieldset, Horizontal); exports; README; gate; commit `feat: Collapsible and CheckboxGroup`.

### Task 2: Form
Spec §2 Form + §3.
- [ ] Tests per spec (server `errors` by name shown in FieldError and cleared on change, the three validation modes, submit values, DatePicker participation documented by a test).
- [ ] Implement; stories (Server errors, Validation modes, Submit as object); exports; README; gate; commit `feat(form): Form`.

### Task 3: OTPField
Spec §2 OTPField + §3.
- [ ] Tests per spec (typing/backspace/paste/arrows, complete callback, validation type, mask, groups, in Field + invalid, FormData, sizes line up with controls, axe light/dark, focus ring per input).
- [ ] Implement; stories (Default, Grouped, Alphanumeric, Masked, In Field invalid, Sizes); exports; README; gate; commit `feat(otp-field): OTPField`.

### Task 4: Autocomplete
Spec §2 Autocomplete + §3 + the Autocomplete scope ruling.
- [ ] Tests per spec.
- [ ] Implement (share class strings with Combobox via a server-safe module); stories per spec; exports; README; gate; commit `feat(autocomplete): Autocomplete`.

### Task 5: Menubar
Spec §2 Menubar + the Menubar ruling + §3.
- [ ] Tests per spec (Menu reuse, ←/→ across triggers and open menus, hover switching, Escape/focus return, submenus, checkbox items, forced colors, axe light/dark).
- [ ] Implement; stories (Application menubar, With submenus and checkbox items, Vertical if supported); Editor example gains the Menubar with working View toggles (+ its tests updated); exports; README; gate; commit `feat(menubar): Menubar`.

### Task 6: NavigationMenu
Spec §2 NavigationMenu + §3.
- [ ] Tests per spec.
- [ ] Implement; stories (Site header with two panels, Link list, Nested inline submenu, With router-style links); exports; README; gate; commit `feat(navigation-menu): NavigationMenu`.

### Task 7: Checkout example + docs
Spec §4. Files `src/docs/examples/checkout-page.{tsx,test.tsx,stories.tsx}` (keep the page file under ~400 lines via local sub-components); README, backlog, intro mdx.
- [ ] Test: keyboard-only flow — navigate the header menu to a link; fill contact fields; pick a city via Autocomplete; toggle delivery options including "Select all"; open Promo code, submit "EXPIRED" → Form error shown under the promo Field and cleared on edit; Send code → OTP entry by typing and by paste → complete callback; summary Collapsible opens; axe light/dark closed and with an overlay open.
- [ ] Implement; README (Phase G complete; roadmap next Phase H per spec §4); backlog; intro; gate; visual check on 6107 (screenshots `checkout-*.png` light/dark, nav menu open, autocomplete open, forced colors, 390px mobile; `editor-menubar-*.png`) → stop only your PID; commit `docs(examples): checkout page composing Phase G components`.
