# Tessera Foundation + Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `@tessera/ui` — a local React 19 + Tailwind v4 component library with a Storybook site on localhost:8080 — and ship its first component, `Button`.

**Architecture:** Single npm package. Source in `src/`, one folder per component (component, server-safe variants, tests, stories, barrel). Styles are Tailwind utility classes + a shipped token stylesheet (`@tessera/ui/styles.css`) using shadcn-compatible token names; the stylesheet carries `@source "./"` so consumers' Tailwind scans the library automatically. tsdown builds unbundled ESM + `.d.ts` into `dist/`.

**Tech Stack:** React 19.3, TypeScript 7, @base-ui/react 1.8, Tailwind CSS 4.3, cva 0.7 + tailwind-merge 3 + clsx 2, tsdown 0.23, Storybook 10.6 (react-vite, Vite 8), Vitest 5 browser mode + Playwright chromium + vitest-browser-react + axe-core, Biome 2.5, npm 11 / Node 24.

**Spec:** `docs/superpowers/specs/2026-09-23-tessera-foundation-design.md`

## Global Constraints

- Project root: `C:\Users\Filip\Desktop\projects\tessera` (Windows; use Git Bash or PowerShell; paths with forward slashes in code).
- Package name `@tessera/ui`, `"private": true`, `"type": "module"`. Never run `npm publish`.
- `react`, `react-dom` are **peerDependencies** (`^19.0.0`) and devDependencies — never regular dependencies.
- Storybook dev server port: **8080** (`storybook dev -p 8080`).
- Token names are shadcn-compatible: `background, foreground, card(-foreground), popover(-foreground), primary(-foreground), secondary(-foreground), muted(-foreground), accent(-foreground), destructive(-foreground), border, input, ring, radius`.
- `src/styles/tessera.css` must never contain `@import "tailwindcss"`.
- `button.tsx` starts with `"use client";`. `button-variants.ts`, `cn.ts`, `index.ts` files must NOT.
- Install packages with `npm install` (no pinned versions in commands — npm writes caret ranges of current latest into package.json). Do not use `--force` or `--legacy-peer-deps`; if a peer conflict appears, stop and report it.
- Formatting: Biome, 2-space indent, double quotes, semicolons, line width 100.
- Every commit message ends with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- A task is done only when its verification commands have been run and their output matches "Expected".

---

### Task 1: Tooling scaffold, design tokens, `cn` utility, browser test harness

**Files:**
- Create: `package.json`, `.gitignore`, `tsconfig.json`, `env.d.ts`, `biome.json`, `vitest.config.ts`, `test/setup.ts`, `test/setup.css`
- Create: `src/lib/cn.ts`, `src/lib/cn.test.ts`, `src/styles/tessera.css`, `src/index.ts`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` exported from `src/lib/cn.ts` and `src/index.ts`.
- Produces: Tailwind utilities `bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-accent`, `bg-destructive`, `text-destructive-foreground`, `border-border`, `bg-background`, `ring-ring`, `rounded-sm|md|lg|xl` (via tokens in `tessera.css`).
- Produces: npm scripts `test`, `typecheck`, `lint`, `format`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@tessera/ui",
  "version": "0.1.0",
  "private": true,
  "description": "Tessera — Filip's personal React component library. Every component a tile; every project a mosaic.",
  "type": "module",
  "sideEffects": ["**/*.css"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./styles.css": "./dist/styles.css",
    "./package.json": "./package.json"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "format": "biome check --write ."
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
node_modules/
dist/
storybook-static/
.tmp-consumer/
*.tgz
__screenshots__/
test-results/
*.log
.DS_Store
```

- [ ] **Step 3: Install dependencies**

```bash
npm install @base-ui/react class-variance-authority clsx tailwind-merge
npm install -D react react-dom @types/react @types/react-dom typescript tailwindcss @tailwindcss/vite vite @vitejs/plugin-react vitest @vitest/browser-playwright playwright vitest-browser-react axe-core @biomejs/biome
npx playwright install chromium
```

Expected: no `ERESOLVE` errors. `npm ls react` shows a single `react@19.x`. If `npm install` warns about an unmet optional peer (e.g. `date-fns` for @base-ui) that is fine — it is optional.

- [ ] **Step 4: Create `tsconfig.json` and `env.d.ts`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "test", ".storybook", "scripts", "env.d.ts", "*.config.ts"]
}
```

`env.d.ts` (lets TypeScript accept side-effect CSS imports):
```ts
declare module "*.css";
```

- [ ] **Step 5: Create `biome.json`**

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": { "quoteStyle": "double", "semicolons": "always" }
  },
  "css": {
    "parser": { "tailwindDirectives": true }
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "assist": {
    "actions": { "source": { "organizeImports": "on" } }
  }
}
```

Run: `npx biome check biome.json`
Expected: no configuration errors. If Biome reports an unknown key (schema drift), run `npx biome migrate --write` and re-check; keep the intent (tailwind directives parsing, recommended rules, import sorting).

- [ ] **Step 6: Create `src/styles/tessera.css` (design tokens)**

```css
/*
 * Tessera design tokens.
 * Consumers:  @import "tailwindcss";  @import "@tessera/ui/styles.css";
 * Token names are shadcn-compatible: redefine any of them in your own :root / .dark to theme Tessera.
 * Never @import "tailwindcss" here — only the consuming app does that.
 */

/* Scan the shipped library files (this stylesheet sits in dist/) for class names. */
@source "./";

@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* Light — warm stone base, lapis primary. */
:root {
  --radius: 0.5rem;
  --background: oklch(0.99 0.004 85);
  --foreground: oklch(0.2 0.015 60);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.2 0.015 60);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.2 0.015 60);
  --primary: oklch(0.44 0.16 264);
  --primary-foreground: oklch(0.98 0.01 264);
  --secondary: oklch(0.95 0.012 80);
  --secondary-foreground: oklch(0.25 0.02 60);
  --muted: oklch(0.95 0.01 80);
  --muted-foreground: oklch(0.5 0.02 60);
  --accent: oklch(0.94 0.02 264);
  --accent-foreground: oklch(0.3 0.1 264);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.9 0.01 80);
  --input: oklch(0.9 0.01 80);
  --ring: oklch(0.6 0.15 264);
}

/* Dark — deep night-blue base, luminous lapis primary. */
.dark {
  --background: oklch(0.17 0.012 265);
  --foreground: oklch(0.96 0.006 85);
  --card: oklch(0.21 0.014 265);
  --card-foreground: oklch(0.96 0.006 85);
  --popover: oklch(0.21 0.014 265);
  --popover-foreground: oklch(0.96 0.006 85);
  --primary: oklch(0.72 0.13 264);
  --primary-foreground: oklch(0.18 0.04 264);
  --secondary: oklch(0.26 0.015 265);
  --secondary-foreground: oklch(0.95 0.006 85);
  --muted: oklch(0.25 0.012 265);
  --muted-foreground: oklch(0.72 0.015 85);
  --accent: oklch(0.3 0.04 264);
  --accent-foreground: oklch(0.96 0.01 264);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(1 0 0 / 12%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.72 0.13 264);
}
```

- [ ] **Step 7: Create the test harness**

`vitest.config.ts`:
```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
```

`test/setup.css` (real Tailwind + tokens so axe checks real colors):
```css
@import "tailwindcss";
@import "../src/styles/tessera.css";
```

`test/setup.ts`:
```ts
import "./setup.css";
```

- [ ] **Step 8: Write the failing `cn` test** — `src/lib/cn.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy class values and drops falsy ones", () => {
    expect(cn("a", false, undefined, null, "c", { d: true, e: false })).toBe("a c d");
  });

  it("lets later Tailwind utilities override conflicting earlier ones", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("treats Tessera token colors as colors when merging", () => {
    expect(cn("bg-primary text-primary-foreground", "bg-red-500")).toBe(
      "text-primary-foreground bg-red-500",
    );
  });
});
```

- [ ] **Step 9: Run it to verify it fails**

Run: `npx vitest run src/lib/cn.test.ts`
Expected: FAIL — cannot resolve `./cn`. (If instead the failure is about Chromium/Playwright not launching, fix the harness first: re-run `npx playwright install chromium`.)

- [ ] **Step 10: Implement `src/lib/cn.ts` and `src/index.ts`**

`src/lib/cn.ts`:
```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Compose class names; later Tailwind utilities win over conflicting earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

`src/index.ts`:
```ts
export { cn } from "./lib/cn";
```

- [ ] **Step 11: Verify tests, types, lint**

Run: `npx vitest run` → Expected: 3 passed.
Run: `npm run typecheck` → Expected: exit 0, no output.
Run: `npm run format && npm run lint` → Expected: exit 0 ("Checked N files… No fixes applied" or equivalent).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Tessera tooling, design tokens, and cn utility

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Storybook docs site on localhost:8080

**Files:**
- Create: `.storybook/main.ts`, `.storybook/preview.tsx`, `.storybook/storybook.css`
- Create: `src/docs/introduction.mdx`, `src/docs/colors.stories.tsx`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `src/styles/tessera.css` tokens (Task 1).
- Produces: `npm run dev` → Storybook at http://localhost:8080; `npm run build:storybook`. Stories glob `src/**/*.stories.@(ts|tsx)` and `src/**/*.mdx` (Task 3's button stories are picked up automatically). Global toolbar `theme` = `light | dark` toggling `.dark` on `<html>`.

- [ ] **Step 1: Install**

```bash
npm install -D storybook @storybook/react-vite @storybook/addon-docs @storybook/addon-a11y lucide-react
```

Expected: no ERESOLVE. All `storybook`/`@storybook/*` resolve to the same 10.x version (`npm ls storybook`).

- [ ] **Step 2: Create `.storybook/main.ts`**

```ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: { name: "@storybook/react-vite", options: {} },
  core: { disableTelemetry: true },
  async viteFinal(viteConfig) {
    const { default: tailwindcss } = await import("@tailwindcss/vite");
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];
    return viteConfig;
  },
};

export default config;
```

- [ ] **Step 3: Create `.storybook/storybook.css`**

```css
@import "tailwindcss";
@import "../src/styles/tessera.css";

body {
  background-color: var(--background);
  color: var(--foreground);
}
```

- [ ] **Step 4: Create `.storybook/preview.tsx`**

```tsx
import type { Preview } from "@storybook/react-vite";
import "./storybook.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Color theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, context) => {
      document.documentElement.classList.toggle("dark", context.globals.theme === "dark");
      return <Story />;
    },
  ],
  parameters: {
    layout: "centered",
    controls: { expanded: true },
  },
};

export default preview;
```

- [ ] **Step 5: Create `src/docs/introduction.mdx`**

```mdx
import { Meta } from "@storybook/addon-docs/blocks";

<Meta title="Tessera/Introduction" />

# Tessera

A *tessera* is a single tile of a mosaic. Every component here is a tile; every project is a mosaic.

## Use it in a project

```css
/* your app's main stylesheet */
@import "tailwindcss";
@import "@tessera/ui/styles.css";
```

```tsx
import { Button } from "@tessera/ui";

<Button variant="primary">Save</Button>
```

Tessera uses shadcn-compatible token names (`--primary`, `--ring`, …). Redefine them in your
app's `:root` / `.dark` to re-theme every component.

## Stack

React 19 · Base UI · Tailwind CSS v4 · cva + tailwind-merge · tsdown · Vitest browser mode · Storybook 10 · Biome
```

- [ ] **Step 6: Create `src/docs/colors.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";

const swatches = [
  { name: "background", className: "bg-background" },
  { name: "foreground", className: "bg-foreground" },
  { name: "primary", className: "bg-primary" },
  { name: "primary-foreground", className: "bg-primary-foreground" },
  { name: "secondary", className: "bg-secondary" },
  { name: "muted", className: "bg-muted" },
  { name: "muted-foreground", className: "bg-muted-foreground" },
  { name: "accent", className: "bg-accent" },
  { name: "destructive", className: "bg-destructive" },
  { name: "border", className: "bg-border" },
  { name: "ring", className: "bg-ring" },
] as const;

function ColorPalette() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {swatches.map((swatch) => (
        <figure key={swatch.name} className="m-0 flex flex-col gap-2">
          <div className={`h-16 w-32 rounded-lg border border-border ${swatch.className}`} />
          <figcaption className="font-mono text-foreground text-xs">--{swatch.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

const meta = {
  title: "Tessera/Colors",
  component: ColorPalette,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ColorPalette>;

export default meta;

export const Palette: StoryObj<typeof meta> = {};
```

- [ ] **Step 7: Add scripts to `package.json`**

Add to `"scripts"`:
```json
"dev": "storybook dev -p 8080",
"build:storybook": "storybook build -o storybook-static"
```

- [ ] **Step 8: Verify**

Run: `npm run build:storybook`
Expected: exits 0 and prints the output directory `storybook-static`. Then run `ls storybook-static/index.html` → exists.
Run: `npm run typecheck && npm run lint` → exit 0.
Run: `npx vitest run` → still 3 passed (stories are not picked up by the test include glob).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: Storybook docs site on port 8080 with theme toggle and color tokens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Button component (TDD)

**Files:**
- Create: `src/components/button/button-variants.ts`, `src/components/button/button.tsx`, `src/components/button/button.test.tsx`, `src/components/button/button.stories.tsx`, `src/components/button/index.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `cn` from `src/lib/cn.ts`; tokens from Task 1; Storybook from Task 2.
- Produces (exported from `src/index.ts`):
  - `Button(props: ButtonProps): React.JSX.Element`
  - `interface ButtonProps extends BaseButton.Props, ButtonVariantProps { loading?: boolean }`
  - `buttonVariants(options?: ButtonVariantProps & { className?: string }): string`
  - `type ButtonVariantProps = { variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link" | null; size?: "xs" | "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon" | "icon-lg" | null }`
  - DOM contract: `data-slot="button"`, `data-variant`, `data-size`, `data-loading` (present when loading), spinner `svg[data-slot="button-spinner"][aria-hidden="true"]`.

- [ ] **Step 1: Write the failing tests** — `src/components/button/button.test.tsx`

```tsx
import axe from "axe-core";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { Button } from "./button";
import { buttonVariants } from "./button-variants";

const variants = ["primary", "secondary", "outline", "ghost", "destructive", "link"] as const;

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

describe("Button", () => {
  it("renders a native button with type=button and an accessible name", async () => {
    const screen = await render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    await expect.element(button).toBeInTheDocument();
    await expect.element(button).toHaveAttribute("type", "button");
    expect(button.element().tagName).toBe("BUTTON");
  });

  it("defaults to the primary variant and md size", async () => {
    const screen = await render(<Button>Save</Button>);
    const button = screen.getByRole("button");
    await expect.element(button).toHaveAttribute("data-slot", "button");
    await expect.element(button).toHaveAttribute("data-variant", "primary");
    await expect.element(button).toHaveAttribute("data-size", "md");
    await expect.element(button).toHaveClass("bg-primary", "h-9");
  });

  it.each([
    ["secondary", "bg-secondary"],
    ["outline", "border-border"],
    ["ghost", "hover:bg-accent"],
    ["destructive", "bg-destructive"],
    ["link", "underline-offset-4"],
  ] as const)("applies the %s variant", async (variant, expectedClass) => {
    const screen = await render(<Button variant={variant}>Label</Button>);
    const button = screen.getByRole("button");
    await expect.element(button).toHaveAttribute("data-variant", variant);
    await expect.element(button).toHaveClass(expectedClass);
  });

  it.each([
    ["xs", "h-7"],
    ["sm", "h-8"],
    ["lg", "h-10"],
    ["icon", "size-9"],
  ] as const)("applies the %s size", async (size, expectedClass) => {
    const screen = await render(
      <Button size={size} aria-label="Label">
        L
      </Button>,
    );
    await expect.element(screen.getByRole("button")).toHaveClass(expectedClass);
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const screen = await render(<Button onClick={onClick}>Go</Button>);
    await screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const onClick = vi.fn();
    const screen = await render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    const button = screen.getByRole("button");
    await expect.element(button).toBeDisabled();
    (button.element() as HTMLButtonElement).click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("marks loading buttons busy, keeps them focusable, and blocks clicks", async () => {
    const onClick = vi.fn();
    const screen = await render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving" });
    const element = button.element() as HTMLButtonElement;

    await expect.element(button).toHaveAttribute("aria-busy", "true");
    await expect.element(button).toHaveAttribute("aria-disabled", "true");
    await expect.element(button).toHaveAttribute("data-loading");

    element.focus();
    expect(document.activeElement).toBe(element);

    const spinner = element.querySelector('[data-slot="button-spinner"]');
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute("aria-hidden")).toBe("true");

    element.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("submits a form when type=submit", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const screen = await render(
      <form
        onSubmit={(event) => {
          onSubmit(event.nativeEvent as SubmitEvent);
        }}
      >
        <Button type="submit">Send</Button>
      </form>,
    );
    await screen.getByRole("button", { name: "Send" }).click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not submit a form by default", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const screen = await render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(event.nativeEvent as SubmitEvent);
        }}
      >
        <Button>Just a button</Button>
      </form>,
    );
    await screen.getByRole("button").click();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders a custom element via render + nativeButton={false}", async () => {
    const screen = await render(
      <Button nativeButton={false} render={<span />}>
        Menu
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button.element().tagName).toBe("SPAN");
    await expect.element(button).toHaveClass("bg-primary");
  });

  it("forwards ref to the DOM element", async () => {
    const ref = createRef<HTMLButtonElement>();
    await render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("merges className so caller utilities win conflicts", async () => {
    const screen = await render(<Button className="bg-red-500 px-8">Custom</Button>);
    const button = screen.getByRole("button");
    await expect.element(button).toHaveClass("bg-red-500", "px-8");
    await expect.element(button).not.toHaveClass("bg-primary");
    await expect.element(button).not.toHaveClass("px-4");
  });

  it("accepts a className function receiving Base UI state", async () => {
    const screen = await render(
      <Button disabled className={(state) => (state.disabled ? "is-off" : "is-on")}>
        State
      </Button>,
    );
    await expect.element(screen.getByRole("button")).toHaveClass("is-off");
  });

  it("buttonVariants styles non-button elements such as links", () => {
    const classes = buttonVariants({ variant: "outline", size: "sm", className: "px-6" });
    expect(classes).toContain("border-border");
    expect(classes).toContain("h-8");
    expect(classes).toContain("px-6");
    expect(classes).not.toContain("px-3");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        {variants.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
        <Button size="icon" aria-label="Add item">
          <PlusIcon />
        </Button>
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/button`
Expected: FAIL — cannot resolve `./button` / `./button-variants`.

- [ ] **Step 3: Implement `src/components/button/button-variants.ts`** (server-safe, no directive)

```ts
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const buttonCva = cva(
  [
    "group/button relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md border border-transparent font-medium select-none",
    "transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out",
    "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    "active:not-data-disabled:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0",
    "data-disabled:pointer-events-none data-disabled:not-data-loading:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border-border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:border-destructive focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 text-sm",
        md: "h-9 px-4 text-sm",
        lg: "h-10 px-5 text-base",
        "icon-xs": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        icon: "size-9",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonCva>;

/** Button classes for any element — use on `<a>` / router links, which must not be Buttons. */
export function buttonVariants(options: ButtonVariantProps & { className?: string } = {}): string {
  return cn(buttonCva(options));
}
```

- [ ] **Step 4: Implement `src/components/button/button.tsx`**

```tsx
"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { buttonVariants, type ButtonVariantProps } from "./button-variants";

export interface ButtonProps extends BaseButton.Props, ButtonVariantProps {
  /** Shows a spinner, sets aria-busy, and blocks interaction while keeping focus. */
  loading?: boolean;
}

export function Button({
  variant,
  size,
  loading = false,
  disabled,
  focusableWhenDisabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      {...props}
      data-slot="button"
      data-variant={variant ?? "primary"}
      data-size={size ?? "md"}
      data-loading={loading ? "" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      focusableWhenDisabled={loading || focusableWhenDisabled}
      className={(state) =>
        buttonVariants({
          variant,
          size,
          className: typeof className === "function" ? className(state) : className,
        })
      }
    >
      {loading && <ButtonSpinner />}
      {children}
    </BaseButton>
  );
}

function ButtonSpinner() {
  return (
    <svg
      aria-hidden="true"
      data-slot="button-spinner"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
```

Notes for the implementer:
- Base UI renders `type="button"` for native buttons by default; the first test proves it. If that test fails on the `type` assertion only, add `type={props.nativeButton === false ? undefined : (props.type ?? "button")}` after `{...props}` (and destructure nothing else).
- If `className` typing complains (Base UI's `className` is `string | ((state) => string | undefined)`), keep the runtime logic and adjust only the type annotation.
- `ref` must work via React 19 ref-as-prop through `{...props}`. If the ref test fails because `BaseButton.Props` lacks `ref`, add `ref?: React.Ref<HTMLElement>` to `ButtonProps` and pass `ref={ref}`.

- [ ] **Step 5: Create the barrel and public exports**

`src/components/button/index.ts`:
```ts
export { Button, type ButtonProps } from "./button";
export { type ButtonVariantProps, buttonVariants } from "./button-variants";
```

`src/index.ts`:
```ts
export { Button, type ButtonProps, type ButtonVariantProps, buttonVariants } from "./components/button";
export { cn } from "./lib/cn";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run`
Expected: all Button tests + 3 cn tests pass. If an axe `color-contrast` violation appears, fix the **token values in `tessera.css`** (never disable the rule), keeping the hue family (lapis primary, warm stone neutrals), and re-run.

- [ ] **Step 7: Write stories** — `src/components/button/button.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { fn } from "storybook/test";
import { Button } from "./button";
import { buttonVariants } from "./button-variants";

const variants = ["primary", "secondary", "outline", "ghost", "destructive", "link"] as const;
const sizes = ["xs", "sm", "md", "lg"] as const;

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Button", onClick: fn() },
  argTypes: {
    variant: { control: "select", options: variants },
    size: {
      control: "select",
      options: [...sizes, "icon-xs", "icon-sm", "icon", "icon-lg"],
    },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {variants.map((variant) => (
        <Button key={variant} {...args} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {sizes.map((size) => (
        <Button key={size} {...args} size={size}>
          Size {size}
        </Button>
      ))}
    </div>
  ),
};

export const WithIcons: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args}>
        <Plus /> New project
      </Button>
      <Button {...args} variant="outline">
        Continue <ArrowRight />
      </Button>
      <Button {...args} variant="destructive">
        <Trash2 /> Delete
      </Button>
    </div>
  ),
};

export const IconOnly: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="icon-xs" aria-label="Add">
        <Plus />
      </Button>
      <Button {...args} size="icon-sm" aria-label="Add">
        <Plus />
      </Button>
      <Button {...args} size="icon" aria-label="Add">
        <Plus />
      </Button>
      <Button {...args} size="icon-lg" aria-label="Add">
        <Plus />
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { loading: true, children: "Saving…" },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const AsLink: Story = {
  render: () => (
    <a href="#docs" className={buttonVariants({ variant: "outline" })}>
      Read the docs <ArrowRight />
    </a>
  ),
};
```

If `Trash2` is not exported by the installed lucide-react, use `Trash` (check with `grep -c "Trash2" node_modules/lucide-react/dist/lucide-react.d.ts`).

- [ ] **Step 8: Verify everything**

Run: `npm run format && npm run lint` → exit 0.
Run: `npm run typecheck` → exit 0.
Run: `npx vitest run` → all pass.
Run: `npm run build:storybook` → exit 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(button): Button component with variants, sizes, loading state, and stories

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Library build, consumer verification, README

**Files:**
- Create: `tsdown.config.ts`, `scripts/copy-styles.mjs`, `scripts/verify-consumer.mjs`, `README.md`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `src/index.ts` public API; `src/styles/tessera.css`.
- Produces: `dist/index.js`, `dist/index.d.ts`, `dist/styles.css`, `dist/components/button/button.js` (first line `"use client";`), `dist/components/button/button-variants.js`, `dist/lib/cn.js`. Scripts `build`, `verify:consumer`, `check`.

- [ ] **Step 1: Install**

```bash
npm install -D tsdown @tailwindcss/cli
```

- [ ] **Step 2: Create `tsdown.config.ts`**

```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "neutral",
  target: "es2022",
  unbundle: true,
  dts: true,
  sourcemap: true,
  clean: true,
  fixedExtension: false,
});
```

- [ ] **Step 3: Create `scripts/copy-styles.mjs`**

```js
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "dist"), { recursive: true });
copyFileSync(join(root, "src/styles/tessera.css"), join(root, "dist/styles.css"));
console.log("copied src/styles/tessera.css -> dist/styles.css");
```

- [ ] **Step 4: Write the (failing) consumer verification** — `scripts/verify-consumer.mjs`

```js
// Verifies dist/ behaves like an installed package for a real Tailwind v4 consumer.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
function pass(message) {
  console.log(`✓ ${message}`);
}

// 1. Artifacts exist where package.json "exports" points.
const expected = [
  "index.js",
  "index.d.ts",
  "styles.css",
  "lib/cn.js",
  "components/button/button.js",
  "components/button/button-variants.js",
];
for (const file of expected) {
  if (!existsSync(join(dist, file))) fail(`missing dist/${file}`);
}
pass("dist artifacts present");

// 2. "use client" only where it belongs.
const isClient = (file) =>
  /^["']use client["'];?$/.test(readFileSync(join(dist, file), "utf8").trimStart().split(/\r?\n/)[0].trim());
if (!isClient("components/button/button.js")) fail('dist/components/button/button.js must start with "use client"');
for (const file of ["index.js", "lib/cn.js", "components/button/button-variants.js"]) {
  if (isClient(file)) fail(`dist/${file} must NOT be a client module`);
}
pass('"use client" directives correct');

// 3. A consumer app that only imports the stylesheet gets Tessera's classes generated.
const fixture = join(root, ".tmp-consumer");
rmSync(fixture, { recursive: true, force: true });
const pkgDir = join(fixture, "node_modules", "@tessera", "ui");
mkdirSync(pkgDir, { recursive: true });
cpSync(dist, join(pkgDir, "dist"), { recursive: true });
cpSync(join(root, "package.json"), join(pkgDir, "package.json"));
writeFileSync(join(fixture, "input.css"), '@import "tailwindcss";\n@import "@tessera/ui/styles.css";\n');

const cliPkg = JSON.parse(readFileSync(join(root, "node_modules/@tailwindcss/cli/package.json"), "utf8"));
const cliBin = typeof cliPkg.bin === "string" ? cliPkg.bin : cliPkg.bin.tailwindcss;
const result = spawnSync(
  process.execPath,
  [join(root, "node_modules/@tailwindcss/cli", cliBin), "-i", "input.css", "-o", "out.css"],
  { cwd: fixture, encoding: "utf8" },
);
if (result.status !== 0) fail(`tailwind CLI failed:\n${result.stderr}`);

const css = readFileSync(join(fixture, "out.css"), "utf8");
for (const needle of [".bg-primary", "--color-primary", ".h-9", ".animate-spin", ".focus-visible\\:ring-3"]) {
  if (!css.includes(needle)) fail(`consumer CSS is missing ${needle} — @source scanning is broken`);
}
pass("consumer Tailwind build generates Tessera classes via @source");

rmSync(fixture, { recursive: true, force: true });
pass("consumer verification complete");
```

- [ ] **Step 5: Add scripts to `package.json`**

Add to `"scripts"`:
```json
"build": "tsdown && node scripts/copy-styles.mjs",
"verify:consumer": "node scripts/verify-consumer.mjs",
"check": "npm run lint && npm run typecheck && npm run test && npm run build && npm run verify:consumer"
```

Run first without building to see it fail: `rm -rf dist && npm run verify:consumer`
Expected: `✗ missing dist/index.js`, exit 1.

- [ ] **Step 6: Build and verify**

Run: `npm run build`
Expected: exit 0; `find dist -type f | sort` lists at least the six files in the verify script (plus `.d.ts` / `.map` files).

Run: `npm run verify:consumer`
Expected: four `✓` lines, exit 0.

Fallbacks (apply only if the matching check fails, then re-run build + verify):
- **Output extensions are `.mjs`/`.d.mts`:** `fixedExtension: false` was ignored — inspect `dist`, and set tsdown's `outExtensions: () => ({ js: ".js", dts: ".d.ts" })`.
- **dts generation fails under TypeScript 7:** read the error; set `dts: { tsgo: true }` and `npm install -D @typescript/native-preview`; if still failing, report it (do not downgrade TypeScript silently).
- **`"use client"` missing from `button.js`:** add to the tsdown config:
  ```ts
  outputOptions: {
    banner: (chunk) => {
      const id = chunk.facadeModuleId;
      return id && /^\s*["']use client["']/.test(readFileSync(id, "utf8")) ? '"use client";' : "";
    },
  },
  ```
  with `import { readFileSync } from "node:fs";` at the top.
- **Consumer CSS missing classes:** confirm `dist/styles.css` contains `@source "./";` and that `dist/components/button/button-variants.js` contains the literal class strings (not minified away).

- [ ] **Step 7: Write `README.md`**

````markdown
# Tessera

> A *tessera* is a single tile of a mosaic. Every component here is a tile; every project is a mosaic.

Filip's personal React component library — `@tessera/ui`. Local only (not published).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Storybook docs + playground at **http://localhost:8080** |
| `npm test` | Component tests in real Chromium (Vitest browser mode + axe) |
| `npm run build` | Builds the library into `dist/` (tsdown) |
| `npm run check` | Lint + typecheck + tests + build + consumer verification — run before every commit |
| `npm run format` | Biome format + safe lint fixes |

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

Requirements: React 19, Tailwind CSS v4. Re-theme by redefining the shadcn-compatible tokens
(`--primary`, `--ring`, `--radius`, …) in your own `:root` / `.dark`.

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
Export it from `src/index.ts`, add its dist paths to `scripts/verify-consumer.mjs`, run `npm run check`.

## Components

- [x] Button
- [ ] Next up: Input, Label, Card, Badge, Dialog, Tooltip, Select, Tabs

## Roadmap

Components above · visual regression · React Compiler on output · publish to npm (`@tessera/ui` is free).
````

- [ ] **Step 8: Full gate**

Run: `npm run format && npm run check`
Expected: every stage exits 0; final output ends with `✓ consumer verification complete`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "build: tsdown library build, consumer verification, and README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
