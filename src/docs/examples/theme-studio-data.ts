import type { CSSProperties } from "react";
import { contrastRatio, parseColor, readableForeground, wcagContrast } from "../../lib/color";

export type Density = "compact" | "comfortable" | "spacious";

/** What the Theme Studio saves (`onSave`). */
export interface Theme {
  name: string;
  primary: string;
  surface: string;
  /** Corner radius in px. */
  radius: number;
  density: Density;
  rating: number | null;
}

export const defaultTheme: Theme = {
  name: "My theme",
  primary: "#4f46e5",
  surface: "#ffffff",
  radius: 6,
  density: "comfortable",
  rating: null,
};

export const steps = ["Colors", "Shape", "Review"] as const;

export const primarySwatches = [
  { value: "#4f46e5", label: "Indigo" },
  { value: "#1d4ed8", label: "Blue" },
  { value: "#0f766e", label: "Teal" },
  { value: "#15803d", label: "Green" },
  { value: "#be123c", label: "Rose" },
  { value: "#7c3aed", label: "Violet" },
];

export const densities: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
];

/** The preview's spacing and Button size per density. */
export const densityStyles: Record<Density, { gap: string; button: "sm" | "md" | "lg" }> = {
  compact: { gap: "gap-2", button: "sm" },
  comfortable: { gap: "gap-4", button: "md" },
  spacious: { gap: "gap-6", button: "lg" },
};

const rgba = (hex: string) => parseColor(hex) ?? { r: 0, g: 0, b: 0, a: 1 };

/** The primary colour as text on the surface, against WCAG AA for text (4.5:1). */
export function primaryContrast(theme: Pick<Theme, "primary" | "surface">) {
  const ratio = contrastRatio(rgba(theme.primary), rgba(theme.surface));
  return { ratio, aa: wcagContrast(ratio).aa };
}

/** "Primary on surface 6.3:1 AA" / "… 1.1:1 Fails AA" (the ratio with one decimal). */
export function contrastLabel(ratio: number, aa: boolean) {
  return `Primary on surface ${ratio.toFixed(1)}:1 ${aa ? "AA" : "Fails AA"}`;
}

/** The theme's role tokens, as the preview applies them and the code panel shows them. */
export function themeTokens(theme: Theme): Record<string, string> {
  const { primary, surface } = theme;
  const foreground = readableForeground(rgba(surface));
  return {
    "--primary": primary,
    "--primary-hover": `color-mix(in oklab, ${primary} 85%, ${foreground})`,
    "--primary-active": `color-mix(in oklab, ${primary} 75%, ${foreground})`,
    "--primary-foreground": readableForeground(rgba(primary)),
    "--primary-soft": `color-mix(in oklab, ${primary} 14%, ${surface})`,
    "--primary-soft-hover": `color-mix(in oklab, ${primary} 22%, ${surface})`,
    "--primary-soft-foreground": `color-mix(in oklab, ${primary} 70%, ${foreground})`,
    "--ring": primary,
    "--background": surface,
    "--card": surface,
    "--foreground": foreground,
    "--card-foreground": foreground,
    "--muted-foreground": `color-mix(in oklab, ${foreground} 65%, ${surface})`,
    "--border": `color-mix(in oklab, ${foreground} 15%, ${surface})`,
    "--field": surface,
    "--field-border": `color-mix(in oklab, ${foreground} 50%, ${surface})`,
    "--field-border-hover": `color-mix(in oklab, ${foreground} 60%, ${surface})`,
    "--radius": `${theme.radius}px`,
  };
}

/**
 * Inline style for the preview container: the theme's tokens, scoped to it. `color-scheme` follows
 * the surface, so native parts (the caret, scrollbars) match it on a dark page too.
 */
export function previewStyle(theme: Theme): CSSProperties {
  const tokens = themeTokens(theme);
  return {
    ...tokens,
    colorScheme: tokens["--foreground"] === "#ffffff" ? "dark" : "light",
  } as CSSProperties;
}

/** The theme as CSS for the code panel. */
export function themeCss(theme: Theme) {
  const lines = Object.entries(themeTokens(theme)).map(([name, value]) => `  ${name}: ${value};`);
  return `/* ${theme.name || "Untitled theme"}, ${theme.density} */\n:root {\n${lines.join("\n")}\n}`;
}
