import { describe, expect, it } from "vitest";
import {
  compositeOver,
  contrastRatio,
  formatColor,
  formatHex,
  formatHsl,
  formatRgb,
  hslToRgb,
  hsvToRgb,
  parseColor,
  type RGBA,
  readableForeground,
  relativeLuminance,
  rgbToHsl,
  rgbToHsv,
  wcagContrast,
} from "./color";

const rgba = (r: number, g: number, b: number, a = 1): RGBA => ({ r, g, b, a });

/** Each channel within 1e-6 (alphas such as 128 / 255 are not exact decimals). */
function expectColor(actual: object | null, expected: Record<string, number>) {
  expect(actual).not.toBeNull();
  const value = actual as Record<string, number>;
  expect(Object.keys(value).sort()).toEqual(Object.keys(expected).sort());
  for (const key of Object.keys(expected)) {
    expect(value[key], key).toBeCloseTo(expected[key] as number, 6);
  }
}

/** Each channel within 0.5 (a round trip through 0–255 or 0–100). */
function expectNear(actual: object, expected: Record<string, number>) {
  const value = actual as Record<string, number>;
  for (const key of Object.keys(expected)) {
    expect(Math.abs((value[key] as number) - (expected[key] as number)), key).toBeLessThan(0.5);
  }
}

describe("parseColor", () => {
  it.each<[string, RGBA]>([
    // hex, with and without `#`
    ["#1d4ed8", rgba(29, 78, 216)],
    ["#1D4ED8", rgba(29, 78, 216)],
    ["1d4ed8", rgba(29, 78, 216)],
    ["#abc", rgba(170, 187, 204)],
    ["abc", rgba(170, 187, 204)],
    ["#abcd", rgba(170, 187, 204, 221 / 255)],
    ["#1d4ed880", rgba(29, 78, 216, 128 / 255)],
    ["1d4ed880", rgba(29, 78, 216, 128 / 255)],
    ["  #1d4ed8\n", rgba(29, 78, 216)],
    // rgb(): comma and space syntax, numbers and percentages
    ["rgb(12, 34, 56)", rgba(12, 34, 56)],
    ["rgba(12, 34, 56, 0.5)", rgba(12, 34, 56, 0.5)],
    ["rgba(12, 34, 56, 50%)", rgba(12, 34, 56, 0.5)],
    ["rgb(12 34 56)", rgba(12, 34, 56)],
    ["rgb(12 34 56 / 50%)", rgba(12, 34, 56, 0.5)],
    ["rgb(12 34 56 / .25)", rgba(12, 34, 56, 0.25)],
    ["rgba(12 34 56 / 0.25)", rgba(12, 34, 56, 0.25)],
    ["rgb(100%, 0%, 50%)", rgba(255, 0, 127.5)],
    ["rgb(100% 0% 50%)", rgba(255, 0, 127.5)],
    ["RGB(12,34,56)", rgba(12, 34, 56)],
    ["  rgb(  12 ,34,   56  )  ", rgba(12, 34, 56)],
    ["rgb(12.5 34 56)", rgba(12.5, 34, 56)],
    // hsl(): comma and space syntax, hue units, bare saturation / lightness
    ["hsl(210, 50%, 40%)", rgba(51, 102, 153)],
    ["hsla(210, 50%, 40%, 0.5)", rgba(51, 102, 153, 0.5)],
    ["hsl(210 50% 40%)", rgba(51, 102, 153)],
    ["hsl(210deg 50% 40%)", rgba(51, 102, 153)],
    ["hsl(210 50% 40% / 50%)", rgba(51, 102, 153, 0.5)],
    ["hsla(210 50% 40% / 0.5)", rgba(51, 102, 153, 0.5)],
    ["hsl(0.5turn 100% 50%)", rgba(0, 255, 255)],
    [`hsl(${Math.PI}rad 100% 50%)`, rgba(0, 255, 255)],
    ["hsl(120 100 50)", rgba(0, 255, 0)],
    ["HSL(120DEG, 100%, 50%)", rgba(0, 255, 0)],
    ["hsl(-120 100% 50%)", rgba(0, 0, 255)],
    ["hsl(480 100% 50%)", rgba(0, 255, 0)],
    // out of range clamps
    ["rgb(300 0 0)", rgba(255, 0, 0)],
    ["rgb(-10, 0, 0)", rgba(0, 0, 0)],
    ["rgb(150% 0 0)", rgba(255, 0, 0)],
    ["rgba(0, 0, 0, 2)", rgba(0, 0, 0, 1)],
    ["rgb(0 0 0 / 150%)", rgba(0, 0, 0, 1)],
    ["rgb(0 0 0 / -1)", rgba(0, 0, 0, 0)],
    ["hsl(0 150% 50%)", rgba(255, 0, 0)],
    ["hsl(0 100% 120%)", rgba(255, 255, 255)],
  ])("%s", (input, expected) => {
    expectColor(parseColor(input), { ...expected });
  });

  it.each([
    "",
    "   ",
    "red",
    "transparent",
    "color(srgb 1 0 0)",
    "oklch(0.5 0.1 200)",
    "#12",
    "#12345",
    "#1234567",
    "#123456789",
    "#ggg",
    "abcd",
    "12",
    "rgb(1 2)",
    "rgb(1, 2 3)",
    "rgb(1 2 3 4)",
    "rgb(1, 2, 3, 4, 5)",
    "rgb(a b c)",
    "rgb(1 2 3",
    "rgb 1 2 3",
    "rgb(1 2 3 /)",
    "rgb(1px 2 3)",
    "hsl(10% 50% 50%)",
    "hsl(10 50% 50% 50%)",
    "hsl(10grad 50% 50%)",
  ])("%j is null", (input) => {
    expect(parseColor(input)).toBeNull();
  });
});

describe("formatting", () => {
  it.each([
    ["#abc", "#aabbcc"],
    ["#ABCD", "#aabbccdd"],
    ["#1D4ED8", "#1d4ed8"],
    ["#1d4ed880", "#1d4ed880"],
    ["1d4ed8", "#1d4ed8"],
  ])("formatHex(parseColor(%s)) is %s", (input, output) => {
    expect(formatHex(parseColor(input) as RGBA)).toBe(output);
  });

  it("formatHex's alpha option", () => {
    const opaque = rgba(29, 78, 216);
    const translucent = rgba(29, 78, 216, 0.5);
    expect(formatHex(opaque)).toBe("#1d4ed8");
    expect(formatHex(translucent)).toBe("#1d4ed880");
    expect(formatHex(translucent, { alpha: "auto" })).toBe("#1d4ed880");
    expect(formatHex(opaque, { alpha: "always" })).toBe("#1d4ed8ff");
    expect(formatHex(translucent, { alpha: "never" })).toBe("#1d4ed8");
  });

  it("formatHex rounds half up", () => {
    expect(formatHex(rgba(127.5, 0.5, 0.49))).toBe("#800100");
    expect(formatHex(rgba(254.5, 254.49, 255))).toBe("#fffeff");
  });

  it("formatRgb", () => {
    expect(formatRgb(rgba(12, 34, 56))).toBe("rgb(12 34 56)");
    expect(formatRgb(rgba(12, 34, 56, 0.5))).toBe("rgb(12 34 56 / 0.5)");
    expect(formatRgb(rgba(12, 34, 56, 1 / 3))).toBe("rgb(12 34 56 / 0.33)");
    expect(formatRgb(rgba(12, 34, 56, 0))).toBe("rgb(12 34 56 / 0)");
    expect(formatRgb(rgba(127.5, 0, 255))).toBe("rgb(128 0 255)");
    expect(formatRgb(parseColor("rgb(12, 34, 56)") as RGBA)).toBe("rgb(12 34 56)");
  });

  it("formatHsl", () => {
    expect(formatHsl(parseColor("hsl(210 50% 40%)") as RGBA)).toBe("hsl(210 50% 40%)");
    expect(formatHsl(parseColor("hsla(210, 50%, 40%, 0.5)") as RGBA)).toBe(
      "hsl(210 50% 40% / 0.5)",
    );
    expect(formatHsl(rgba(255, 0, 0))).toBe("hsl(0 100% 50%)");
    expect(formatHsl(rgba(128, 128, 128))).toBe("hsl(0 0% 50%)");
    // A hue that rounds to 360 is reported as 0.
    expect(formatHsl(rgba(255, 0, 1))).toBe("hsl(0 100% 50%)");
  });

  it("formatColor dispatches on the format", () => {
    const color = rgba(51, 102, 153, 0.5);
    expect(formatColor(color, "hex")).toBe("#33669980");
    expect(formatColor(color, "rgb")).toBe("rgb(51 102 153 / 0.5)");
    expect(formatColor(color, "hsl")).toBe("hsl(210 50% 40% / 0.5)");
  });
});

describe("conversions", () => {
  it.each<[string, RGBA, { h: number; s: number; v: number }, { h: number; s: number; l: number }]>(
    [
      ["red", rgba(255, 0, 0), { h: 0, s: 100, v: 100 }, { h: 0, s: 100, l: 50 }],
      ["green", rgba(0, 255, 0), { h: 120, s: 100, v: 100 }, { h: 120, s: 100, l: 50 }],
      ["blue", rgba(0, 0, 255), { h: 240, s: 100, v: 100 }, { h: 240, s: 100, l: 50 }],
      ["yellow", rgba(255, 255, 0), { h: 60, s: 100, v: 100 }, { h: 60, s: 100, l: 50 }],
      ["cyan", rgba(0, 255, 255), { h: 180, s: 100, v: 100 }, { h: 180, s: 100, l: 50 }],
      ["magenta", rgba(255, 0, 255), { h: 300, s: 100, v: 100 }, { h: 300, s: 100, l: 50 }],
      ["white", rgba(255, 255, 255), { h: 0, s: 0, v: 100 }, { h: 0, s: 0, l: 100 }],
      ["black", rgba(0, 0, 0), { h: 0, s: 0, v: 0 }, { h: 0, s: 0, l: 0 }],
      [
        "mid grey",
        rgba(128, 128, 128),
        { h: 0, s: 0, v: (128 / 255) * 100 },
        { h: 0, s: 0, l: (128 / 255) * 100 },
      ],
    ],
  )("%s", (_name, rgb, hsv, hsl) => {
    expectColor(rgbToHsv(rgb), { ...hsv, a: 1 });
    expectColor(rgbToHsl(rgb), { ...hsl, a: 1 });
    expectColor(hsvToRgb({ ...hsv, a: 1 }), { ...rgb });
    expectColor(hslToRgb({ ...hsl, a: 1 }), { ...rgb });
  });

  it("keeps alpha", () => {
    expect(rgbToHsv(rgba(255, 0, 0, 0.4)).a).toBe(0.4);
    expect(rgbToHsl(rgba(255, 0, 0, 0.4)).a).toBe(0.4);
    expect(hsvToRgb({ h: 0, s: 100, v: 100, a: 0.4 }).a).toBe(0.4);
    expect(hslToRgb({ h: 0, s: 100, l: 50, a: 0.4 }).a).toBe(0.4);
  });

  it("hue 360 is red", () => {
    expectColor(hsvToRgb({ h: 360, s: 100, v: 100, a: 1 }), { ...rgba(255, 0, 0) });
    expectColor(hslToRgb({ h: 360, s: 100, l: 50, a: 1 }), { ...rgba(255, 0, 0) });
  });

  it("round-trips HSV → RGB → HSV and HSL → RGB → HSL within 0.5", () => {
    for (const hsv of [
      { h: 210, s: 72, v: 40, a: 1 },
      { h: 33, s: 64, v: 91, a: 0.5 },
      { h: 300, s: 12, v: 77, a: 1 },
    ]) {
      expectNear(rgbToHsv(hsvToRgb(hsv)), hsv);
    }
    for (const hsl of [
      { h: 210, s: 72, l: 40, a: 1 },
      { h: 33, s: 64, l: 58, a: 0.5 },
      { h: 300, s: 12, l: 77, a: 1 },
    ]) {
      expectNear(rgbToHsl(hslToRgb(hsl)), hsl);
    }
  });
});

describe("contrast", () => {
  const black = rgba(0, 0, 0);
  const white = rgba(255, 255, 255);
  const hex = (input: string) => parseColor(input) as RGBA;

  it("relativeLuminance", () => {
    expect(relativeLuminance(black)).toBe(0);
    expect(relativeLuminance(white)).toBe(1);
    // Below the 0.04045 threshold the channel is linear (10 / 255 / 12.92).
    expect(relativeLuminance(rgba(10, 10, 10))).toBeCloseTo(10 / 255 / 12.92, 10);
  });

  it("compositeOver does not round", () => {
    expect(compositeOver(rgba(0, 0, 0, 0.5), white)).toEqual(rgba(127.5, 127.5, 127.5));
    expect(compositeOver(rgba(29, 78, 216), white)).toEqual(rgba(29, 78, 216));
    expect(compositeOver(rgba(255, 0, 0, 0), rgba(0, 0, 255))).toEqual(rgba(0, 0, 255));
  });

  it.each([
    ["#000", "#fff", 21],
    ["#777777", "#ffffff", 4.48],
    ["#ffffff", "#ffffff", 1],
    ["#1d4ed8", "#ffffff", 6.7],
    ["#ffff66", "#ffffff", 1.06],
    ["#1d4ed8", "#0f172a", 2.66],
  ])("contrastRatio(%s, %s) is %d, in either order", (a, b, ratio) => {
    expect(contrastRatio(hex(a), hex(b))).toBe(ratio);
    expect(contrastRatio(hex(b), hex(a))).toBe(ratio);
  });

  it("composites a translucent colour without rounding first", () => {
    // The unrounded 127.5 grey; #808080 (rounded) gives 3.95.
    expect(contrastRatio(rgba(0, 0, 0, 0.5), white)).toBe(3.98);
    expect(contrastRatio(hex("#808080"), white)).toBe(3.95);
  });

  it.each([
    [2.99, { aa: false, aaLarge: false, aaa: false, aaaLarge: false }],
    [3, { aa: false, aaLarge: true, aaa: false, aaaLarge: false }],
    [4.49, { aa: false, aaLarge: true, aaa: false, aaaLarge: false }],
    [4.5, { aa: true, aaLarge: true, aaa: false, aaaLarge: true }],
    [7, { aa: true, aaLarge: true, aaa: true, aaaLarge: true }],
  ])("wcagContrast(%d)", (ratio, levels) => {
    expect(wcagContrast(ratio)).toEqual(levels);
  });

  it("readableForeground", () => {
    expect(readableForeground(hex("#ffff00"))).toBe("#000000");
    expect(readableForeground(hex("#1d4ed8"))).toBe("#ffffff");
    expect(readableForeground(black)).toBe("#ffffff");
    expect(readableForeground(white)).toBe("#000000");
  });
});
