// Generates src/styles/palettes.css — Tessera's gem palettes — and verifies WCAG contrast.
// Usage: node scripts/generate-palettes.mjs          (write the file)
//        node scripts/generate-palettes.mjs --check  (fail if the file is stale or a contrast gate fails)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "src/styles/palettes.css");

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
// Same lightness curve for every hue: step 600 always carries white text, step 400 its own 950.
const LIGHTNESS = [0.975, 0.945, 0.895, 0.825, 0.74, 0.64, 0.54, 0.47, 0.4, 0.33, 0.255];
const CHROMA = [0.018, 0.04, 0.075, 0.115, 0.15, 0.17, 0.165, 0.145, 0.12, 0.095, 0.07];

/** Chromatic palettes: name → OKLCH hue. */
const GEMS = {
  malachite: 165,
  lapis: 258,
  amethyst: 295,
  carnelian: 40,
  verdant: 148,
  amber: 58,
  garnet: 25,
  azure: 235,
};

/** Palettes selectable per role via data-primary / data-surface. The first entry is the default. */
const PRIMARY_OPTIONS = ["malachite", "lapis", "amethyst", "carnelian"];
const SURFACE_OPTIONS = ["marble", "slate", "sandstone"];

const SURFACE_STEPS = [0, ...STEPS];
const SURFACE_LIGHTNESS = [
  1, 0.985, 0.972, 0.925, 0.87, 0.708, 0.535, 0.446, 0.372, 0.279, 0.21, 0.145,
];
/** Surface palettes: name → [hue, chroma per step]. */
const SURFACES = {
  marble: [265, [0, 0.002, 0.003, 0.004, 0.005, 0.007, 0.009, 0.009, 0.008, 0.007, 0.006, 0.005]],
  slate: [257, [0, 0.003, 0.007, 0.013, 0.02, 0.035, 0.042, 0.042, 0.04, 0.037, 0.034, 0.03]],
  sandstone: [65, [0, 0.002, 0.004, 0.006, 0.008, 0.011, 0.013, 0.012, 0.011, 0.009, 0.008, 0.006]],
};

function oklchToLinearSrgb(l, c, h) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (l, c, h) => oklchToLinearSrgb(l, c, h).every((v) => v >= -1e-4 && v <= 1 + 1e-4);

function maxChroma(l, h) {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(l, mid, h)) lo = mid;
    else hi = mid;
  }
  return lo;
}

const round = (n) => Math.round(n * 1000) / 1000;

/** WCAG relative luminance of an OKLCH color (clipped to sRGB). */
function luminance([l, c, h]) {
  const [r, g, b] = oklchToLinearSrgb(l, c, h).map((v) => Math.min(Math.max(v, 0), 1));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (y1, y2) => (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05);

const palettes = {};
for (const [name, hue] of Object.entries(GEMS)) {
  palettes[name] = Object.fromEntries(
    STEPS.map((step, i) => {
      const l = LIGHTNESS[i];
      return [step, [l, round(Math.min(CHROMA[i], maxChroma(l, hue) * 0.97)), hue]];
    }),
  );
}
for (const [name, [hue, chroma]] of Object.entries(SURFACES)) {
  palettes[name] = Object.fromEntries(
    SURFACE_STEPS.map((step, i) => [step, [SURFACE_LIGHTNESS[i], chroma[i], hue]]),
  );
}

// Contrast gate — mirrors the role mapping in theme.css.
// Text pairs need ≥ 4.5:1 (WCAG 1.4.3); non-text UI (field borders, focus ring) ≥ 3:1 (WCAG 1.4.11).
const failures = [];
const need = (label, ratio, min = 4.5) => {
  if (ratio < min) failures.push(`${label}: ${ratio.toFixed(2)} (< ${min})`);
};
const needUi = (label, ratio) => need(label, ratio, 3);
const white = 1;
for (const gem of Object.keys(GEMS)) {
  const p = palettes[gem];
  need(`${gem} solid (600 / white)`, contrast(luminance(p[600]), white));
  need(`${gem} soft (700 on 100)`, contrast(luminance(p[700]), luminance(p[100])));
  need(`${gem} soft hover (700 on 200)`, contrast(luminance(p[700]), luminance(p[200])));
  need(`${gem} dark solid (950 on 400)`, contrast(luminance(p[950]), luminance(p[400])));
  need(`${gem} dark solid hover (950 on 300)`, contrast(luminance(p[950]), luminance(p[300])));
  for (const surface of Object.keys(SURFACES)) {
    const s = palettes[surface];
    need(`${gem} ink on ${surface}-0`, contrast(luminance(p[600]), luminance(s[0])));
    need(`${gem} dark ink on ${surface}-950`, contrast(luminance(p[400]), luminance(s[950])));
    need(`${gem} dark ink on ${surface}-900`, contrast(luminance(p[400]), luminance(s[900])));
    // Dark soft = 400 at 24% (hover, worst case) over surface-950; text = 200.
    // This linear-luminance mix is conservative: browsers composite the translucent color in
    // gamma-encoded sRGB, which yields a darker background (higher contrast with the 200 text).
    const softBg = 0.24 * luminance(p[400]) + 0.76 * luminance(s[950]);
    need(`${gem} dark soft on ${surface}`, contrast(luminance(p[200]), softBg));
  }
}
// Focus ring (non-text): primary 600 in light, primary 400 in dark, against page and muted surfaces.
for (const gem of PRIMARY_OPTIONS) {
  const p = palettes[gem];
  for (const surface of Object.keys(SURFACES)) {
    const s = palettes[surface];
    needUi(`${gem} ring (600) on ${surface}-0`, contrast(luminance(p[600]), luminance(s[0])));
    needUi(`${gem} ring (600) on ${surface}-100`, contrast(luminance(p[600]), luminance(s[100])));
    needUi(
      `${gem} dark ring (400) on ${surface}-950`,
      contrast(luminance(p[400]), luminance(s[950])),
    );
    needUi(
      `${gem} dark ring (400) on ${surface}-900`,
      contrast(luminance(p[400]), luminance(s[900])),
    );
  }
}
for (const surface of Object.keys(SURFACES)) {
  const s = palettes[surface];
  // --field-border / --switch-track: light = oklab midpoint of 400 and 500 (same hue → mid L and C).
  const fieldBorder = [(s[400][0] + s[500][0]) / 2, (s[400][1] + s[500][1]) / 2, s[400][2]];
  needUi(
    `${surface} field-border (400/500) on 0`,
    contrast(luminance(fieldBorder), luminance(s[0])),
  );
  needUi(
    `${surface} field-border (400/500) on 100`,
    contrast(luminance(fieldBorder), luminance(s[100])),
  );
  // Dark field border = 500. Fields must not sit on bg-muted (800) in dark: 500 on 800 is < 3:1.
  needUi(
    `${surface} dark field-border (500) on 950`,
    contrast(luminance(s[500]), luminance(s[950])),
  );
  needUi(
    `${surface} dark field-border (500) on 900`,
    contrast(luminance(s[500]), luminance(s[900])),
  );
  need(`${surface} neutral solid (0 on 900)`, contrast(luminance(s[0]), luminance(s[900])));
  need(`${surface} dark neutral solid (950 on 50)`, contrast(luminance(s[950]), luminance(s[50])));
  // Tooltip chip: light reuses neutral solid (900/0, gated above); dark is a raised surface-700
  // chip with surface-50 text (see theme.css `--tooltip*`).
  need(`${surface} dark tooltip (50 on 700)`, contrast(luminance(s[50]), luminance(s[700])));
  need(`${surface} muted-foreground (500) on 0`, contrast(luminance(s[500]), luminance(s[0])));
  need(`${surface} muted-foreground (500) on 100`, contrast(luminance(s[500]), luminance(s[100])));
  need(
    `${surface} dark muted-foreground (400) on 950`,
    contrast(luminance(s[400]), luminance(s[950])),
  );
  need(
    `${surface} dark muted-foreground (400) on 800`,
    contrast(luminance(s[400]), luminance(s[800])),
  );
}
if (failures.length > 0) {
  console.error(`✗ contrast below threshold\n  ${failures.join("\n  ")}`);
  process.exit(1);
}

const lines = [
  "/*",
  " * Tessera gem palettes — GENERATED by scripts/generate-palettes.mjs. Do not edit by hand.",
  " * Every chromatic palette shares one OKLCH lightness curve, so any palette can fill any role.",
  " * Also binds --tsr-primary-* / --tsr-surface-* to the palette chosen by data-primary / data-surface.",
  " */",
  "@layer base {",
  "  :root {",
];
for (const [name, steps] of Object.entries(palettes)) {
  lines.push(`    /* ${name} */`);
  for (const [step, [l, c, h]] of Object.entries(steps)) {
    lines.push(`    --tsr-${name}-${step}: oklch(${l} ${c} ${h});`);
  }
}
lines.push("  }", "");
lines.push(
  "  /* Role bindings: data-primary / data-surface on any ancestor; defaults on :root. */",
);
const bind = (attr, options, steps) => {
  options.forEach((name, i) => {
    const selector = i === 0 ? `:root,\n  [data-${attr}="${name}"]` : `[data-${attr}="${name}"]`;
    lines.push(`  ${selector} {`);
    for (const step of steps) lines.push(`    --tsr-${attr}-${step}: var(--tsr-${name}-${step});`);
    lines.push("  }");
  });
};
bind("primary", PRIMARY_OPTIONS, STEPS);
bind("surface", SURFACE_OPTIONS, SURFACE_STEPS);
lines.push("}", "");
const css = lines.join("\n");

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8").replace(/\r\n/g, "\n");
  } catch {}
  if (current !== css) {
    console.error("✗ src/styles/palettes.css is stale — run: node scripts/generate-palettes.mjs");
    process.exit(1);
  }
  console.log("✓ palettes up to date; text contrasts ≥ 4.5:1, non-text UI ≥ 3:1");
} else {
  writeFileSync(target, css);
  console.log(`✓ wrote src/styles/palettes.css (${Object.keys(palettes).length} palettes)`);
}
