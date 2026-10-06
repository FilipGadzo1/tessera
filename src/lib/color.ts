/*
 * Colour parsing, formatting, conversion and WCAG contrast (spec Phase J §1). Server-safe: pure
 * functions, no DOM and no dependency. Channels are never rounded while converting or compositing;
 * only the formatters and the final contrast ratio round.
 */

/** sRGB channels 0–255 (unrounded) and alpha 0–1. */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Hue 0–360, saturation and value (brightness) 0–100, alpha 0–1. */
export interface HSVA {
  h: number;
  s: number;
  v: number;
  a: number;
}

/** Hue 0–360, saturation and lightness 0–100, alpha 0–1. */
export interface HSLA {
  h: number;
  s: number;
  l: number;
  a: number;
}

export type ColorFormat = "hex" | "rgb" | "hsl";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/;

function parseNumber(token: string): number | null {
  return numberPattern.test(token) ? Number(token) : null;
}

/** A number, or a percentage scaled so that 100% is `full`. */
function parseScaled(token: string, full: number): number | null {
  if (token.endsWith("%")) {
    const percent = parseNumber(token.slice(0, -1));
    return percent === null ? null : (percent / 100) * full;
  }
  return parseNumber(token);
}

function parseAlpha(token: string | undefined): number | null {
  if (token === undefined) return 1;
  const alpha = parseScaled(token, 1);
  return alpha === null ? null : clamp(alpha, 0, 1);
}

const hueUnits: Record<string, number> = { "": 1, deg: 1, turn: 360, rad: 180 / Math.PI };

function parseHue(token: string): number | null {
  const match = /^(.*?)(deg|turn|rad)?$/.exec(token);
  const value = match ? parseNumber(match[1] as string) : null;
  if (value === null) return null;
  const degrees = value * (hueUnits[match?.[2] ?? ""] as number);
  return ((degrees % 360) + 360) % 360;
}

function parseHex(input: string): RGBA | null {
  const hasHash = input.startsWith("#");
  const digits = hasHash ? input.slice(1) : input;
  if (!/^[0-9a-f]+$/.test(digits)) return null;
  const lengths = hasHash ? [3, 4, 6, 8] : [3, 6, 8];
  if (!lengths.includes(digits.length)) return null;
  const pairs =
    digits.length <= 4
      ? [...digits].map((digit) => digit + digit)
      : (digits.match(/../g) as string[]);
  const [r, g, b, a] = pairs.map((pair) => Number.parseInt(pair, 16)) as number[];
  return { r: r as number, g: g as number, b: b as number, a: a === undefined ? 1 : a / 255 };
}

/** Splits a function body into three channels and an optional alpha (comma or space syntax). */
function splitArguments(body: string): { channels: string[]; alpha?: string } | null {
  if (body.includes(",")) {
    const parts = body.split(",").map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4) return null;
    return { channels: parts.slice(0, 3), alpha: parts[3] };
  }
  const [main, alpha, ...rest] = body.split("/");
  if (rest.length > 0) return null;
  const channels = (main as string).trim().split(/\s+/);
  if (channels.length !== 3) return null;
  return { channels, alpha: alpha?.trim() };
}

/**
 * Parses hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`; 3, 6 or 8 digits also without `#`),
 * `rgb()` / `rgba()` and `hsl()` / `hsla()` (comma or space syntax). Trimmed and case-insensitive;
 * out-of-range values clamp. Anything else (named colours, `color()`, `oklch()`, malformed input)
 * is `null`.
 */
export function parseColor(input: string): RGBA | null {
  const text = input.trim().toLowerCase();
  if (text === "") return null;
  const fn = /^(rgba?|hsla?)\(([^()]*)\)$/.exec(text);
  if (!fn) return parseHex(text);
  const args = splitArguments(fn[2] as string);
  if (!args) return null;
  const a = parseAlpha(args.alpha);
  if (a === null) return null;
  const [first, second, third] = args.channels as [string, string, string];
  if (fn[1]?.startsWith("rgb")) {
    const [r, g, b] = [first, second, third].map((token) => parseScaled(token, 255));
    if (r == null || g == null || b == null) return null;
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a };
  }
  const h = parseHue(first);
  // A bare number is read as a percentage (CSS Color 4).
  const s = parseNumber(second.replace(/%$/, ""));
  const l = parseNumber(third.replace(/%$/, ""));
  if (h === null || s === null || l === null) return null;
  return hslToRgb({ h, s: clamp(s, 0, 100), l: clamp(l, 0, 100), a });
}

const roundHalfUp = (value: number) => Math.floor(value + 0.5);

const hexByte = (value: number) => clamp(roundHalfUp(value), 0, 255).toString(16).padStart(2, "0");

const formatAlpha = (alpha: number) => String(Math.round(clamp(alpha, 0, 1) * 100) / 100);

/**
 * Lowercase `#rrggbb`, or `#rrggbbaa` when `alpha` is `"auto"` and the colour has alpha below 1
 * (`"always"` adds it to an opaque colour too, `"never"` drops it). Channels round half up.
 */
export function formatHex(
  { r, g, b, a }: RGBA,
  { alpha = "auto" }: { alpha?: "auto" | "always" | "never" } = {},
): string {
  const withAlpha = alpha === "always" || (alpha === "auto" && a < 1);
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}${withAlpha ? hexByte(a * 255) : ""}`;
}

/** `rgb(12 34 56)` or `rgb(12 34 56 / 0.5)` (CSS Color 4 space syntax; alpha with ≤ 2 decimals). */
export function formatRgb({ r, g, b, a }: RGBA): string {
  const channels = [r, g, b].map((channel) => clamp(roundHalfUp(channel), 0, 255)).join(" ");
  return a < 1 ? `rgb(${channels} / ${formatAlpha(a)})` : `rgb(${channels})`;
}

/** `hsl(210 50% 40%)` or `hsl(210 50% 40% / 0.5)`, in integers (a hue rounding to 360 is 0). */
export function formatHsl(rgba: RGBA): string {
  const { h, s, l, a } = rgbToHsl(rgba);
  const channels = `${Math.round(h) % 360} ${Math.round(s)}% ${Math.round(l)}%`;
  return a < 1 ? `hsl(${channels} / ${formatAlpha(a)})` : `hsl(${channels})`;
}

export function formatColor(rgba: RGBA, format: ColorFormat): string {
  if (format === "rgb") return formatRgb(rgba);
  if (format === "hsl") return formatHsl(rgba);
  return formatHex(rgba);
}

/** The hue in degrees of 0–1 channels; 0 for a grey. */
function hueOf(r: number, g: number, b: number, max: number, delta: number): number {
  if (delta === 0) return 0;
  let sector: number;
  if (max === r) sector = ((g - b) / delta) % 6;
  else if (max === g) sector = (b - r) / delta + 2;
  else sector = (r - g) / delta + 4;
  const hue = sector * 60;
  return hue < 0 ? hue + 360 : hue;
}

/** RGB → HSV. A grey reports hue 0 (the caller keeps its own hue). */
export function rgbToHsv({ r, g, b, a }: RGBA): HSVA {
  const [red, green, blue] = [r / 255, g / 255, b / 255] as [number, number, number];
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  return {
    h: hueOf(red, green, blue, max, delta),
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
    a,
  };
}

export function hsvToRgb({ h, s, v, a }: HSVA): RGBA {
  const hue = ((h % 360) + 360) % 360;
  const [sat, value] = [s / 100, v / 100];
  const channel = (n: number) => {
    const k = (n + hue / 60) % 6;
    return (value - value * sat * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return { r: channel(5), g: channel(3), b: channel(1), a };
}

/** RGB → HSL. A grey reports hue 0 (the caller keeps its own hue). */
export function rgbToHsl({ r, g, b, a }: RGBA): HSLA {
  const [red, green, blue] = [r / 255, g / 255, b / 255] as [number, number, number];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const light = (max + min) / 2;
  return {
    h: hueOf(red, green, blue, max, delta),
    s: delta === 0 ? 0 : (delta / (1 - Math.abs(2 * light - 1))) * 100,
    l: light * 100,
    a,
  };
}

export function hslToRgb({ h, s, l, a }: HSLA): RGBA {
  const hue = ((h % 360) + 360) % 360;
  const [sat, light] = [s / 100, l / 100];
  const chroma = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return (light - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return { r: channel(0), g: channel(8), b: channel(4), a };
}

const linearise = (channel: number) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.x relative luminance of the (unrounded) channels; alpha is ignored. */
export function relativeLuminance({ r, g, b }: RGBA): number {
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/** Alpha-composites `fg` over an opaque `bg`, without rounding. */
export function compositeOver(fg: RGBA, bg: RGBA): RGBA {
  const mix = (front: number, back: number) => front * fg.a + back * (1 - fg.a);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 };
}

const ratioOf = (first: number, second: number) =>
  (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);

/**
 * The WCAG contrast ratio, 1–21, rounded to 2 decimals at the end only. A translucent `a` is
 * composited over `b` first.
 */
export function contrastRatio(a: RGBA, b: RGBA): number {
  const front = a.a < 1 ? compositeOver(a, b) : a;
  return Math.round(ratioOf(relativeLuminance(front), relativeLuminance(b)) * 100) / 100;
}

/** Which WCAG 2.x levels a contrast ratio passes (normal and large text). */
export function wcagContrast(ratio: number): {
  aa: boolean;
  aaLarge: boolean;
  aaa: boolean;
  aaaLarge: boolean;
} {
  return { aa: ratio >= 4.5, aaLarge: ratio >= 3, aaa: ratio >= 7, aaaLarge: ratio >= 4.5 };
}

/** Black or white, whichever contrasts more with `bg` (a tie goes to white). */
export function readableForeground(bg: RGBA): "#000000" | "#ffffff" {
  const luminance = relativeLuminance(bg);
  return ratioOf(luminance, 1) >= ratioOf(luminance, 0) ? "#ffffff" : "#000000";
}
