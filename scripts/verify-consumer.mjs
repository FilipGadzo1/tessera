// Verifies dist/ behaves like an installed package for a real Tailwind v4 consumer.
// Checks 1–2 derive their file lists from src/ automatically — no manual upkeep per component.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = join(root, "dist");
const fixture = join(root, ".tmp-consumer");

const pkgJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const stylesExport = pkgJson.exports["./styles.css"];
// Derive the dist-relative path from package.json's exports map (strip the leading "./dist/").
const stylesDistPath = stylesExport.replace(/^\.\/dist\//, "");

function fail(message) {
  rmSync(fixture, { recursive: true, force: true });
  console.error(`✗ ${message}`);
  process.exit(1);
}
function pass(message) {
  console.log(`✓ ${message}`);
}

const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** True when the module's first statement (after leading comments) is a "use client" directive. */
const startsWithUseClient = (code) =>
  /^(["'])use client\1\s*(;|\r?\n|$)/.test(
    code.replace(/^(?:\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/, ""),
  );

/** True when the module only re-exports (`export { x } from "…"` / `export * from "…"`). */
const isReExportOnly = (code) =>
  stripComments(code)
    .replace(/export\s+(type\s+)?\{[^}]*\}\s*from\s*["'][^"']+["']\s*;?/g, "")
    .replace(/export\s+\*(\s+as\s+\w+)?\s+from\s*["'][^"']+["']\s*;?/g, "")
    .trim() === "";

// Library sources: src/**/*.{ts,tsx} minus tests, stories, declaration files and src/docs/.
const sources = readdirSync(src, { recursive: true })
  .map((file) => String(file).replaceAll("\\", "/"))
  .filter(
    (file) =>
      /\.tsx?$/.test(file) &&
      !/\.d\.ts$/.test(file) &&
      !/\.(test|stories)\.tsx?$/.test(file) &&
      !file.startsWith("docs/"),
  );
if (sources.length === 0) fail("no library sources found under src/");

// 1. Every library source has its build output, plus the package entry points.
for (const file of [
  "index.js",
  "index.d.ts",
  stylesDistPath,
  "styles/palettes.css",
  "styles/theme.css",
]) {
  if (!existsSync(join(dist, file))) fail(`missing dist/${file}`);
}
const pairs = [];
for (const file of sources) {
  const base = file.replace(/\.tsx?$/, "");
  const code = readFileSync(join(src, file), "utf8");
  if (!existsSync(join(dist, `${base}.d.ts`))) fail(`missing dist/${base}.d.ts (from src/${file})`);
  const js = `${base}.js`;
  if (existsSync(join(dist, js))) pairs.push({ file, js, code });
  // In unbundle mode rolldown inlines pure re-export barrels (other than the entry) into
  // their importers, so only their .d.ts is emitted. Anything else must have a .js file.
  else if (file === "index.ts" || !isReExportOnly(code))
    fail(`missing dist/${js} (from src/${file})`);
}
pass(`dist artifacts present for ${sources.length} library sources`);

// 2. dist file starts with "use client" IFF its source does.
for (const { file, js, code } of pairs) {
  const expected = startsWithUseClient(code);
  const actual = startsWithUseClient(readFileSync(join(dist, js), "utf8"));
  if (expected !== actual)
    fail(
      expected
        ? `dist/${js} must start with "use client" (src/${file} does)`
        : `dist/${js} must NOT start with "use client" (src/${file} does not)`,
    );
}
pass(`"use client" directives match their sources (${pairs.length} modules)`);

// 2b. Every sourceMappingURL in dist points at a map that exists.
for (const file of readdirSync(dist, { recursive: true }).map(String)) {
  if (!/\.(js|d\.ts)$/.test(file)) continue;
  const match = readFileSync(join(dist, file), "utf8").match(/\/\/# sourceMappingURL=(\S+)\s*$/);
  if (match && !existsSync(join(dist, dirname(file), match[1])))
    fail(`dist/${file} references missing source map ${match[1]}`);
}
pass("source map references resolve");

// 3. Install the real `npm pack` tarball (validates package.json "files") into a consumer
//    that only imports the stylesheet, and check Tessera's classes get generated.
rmSync(fixture, { recursive: true, force: true });
const pkgDir = join(fixture, "node_modules", "@tessera", "ui");
mkdirSync(pkgDir, { recursive: true });

// Single command strings (not an args array) — Node deprecates args + shell: true.
const run = (command, cwd) => spawnSync(command, { cwd, shell: true, encoding: "utf8" });

const packed = run(`npm pack --json --pack-destination "${fixture}"`, root);
if (packed.status !== 0) fail(`npm pack failed:\n${packed.stderr}`);
const tarball = JSON.parse(packed.stdout)[0]?.filename;
if (!tarball || !existsSync(join(fixture, tarball)))
  fail(`npm pack produced no tarball:\n${packed.stdout}`);

// Relative paths only: GNU tar (e.g. Git Bash's) would read "C:\…" as a remote host.
const extracted = run(
  `tar -xzf "${tarball}" -C node_modules/@tessera/ui --strip-components=1`,
  fixture,
);
if (extracted.status !== 0) fail(`tar extraction failed:\n${extracted.stderr}`);
if (!existsSync(join(pkgDir, "dist", stylesDistPath)))
  fail(`installed package is missing dist/${stylesDistPath} — check package.json files`);

// `source(none)` disables Tailwind's automatic content detection for the "tailwindcss" import —
// without it, Tailwind auto-scans this whole repo (the fixture lives inside it) and the check
// can never fail, since repo sources (Storybook, tests, …) already contain every class needed.
// With it, the only content source left is the package's own `@source "../"` in tessera.css, so
// this check genuinely exercises (and can genuinely fail) @source scanning of the installed dist.
// `@source inline("tone-primary")` forces one `tone-*` candidate so the `@utility tone-*` rules
// in theme.css compile at least once, proving that scaffolding survives the packed install.
writeFileSync(
  join(fixture, "input.css"),
  '@import "tailwindcss" source(none);\n@import "@tessera/ui/styles.css";\n@source inline("tone-primary");\n',
);

const cliPkg = JSON.parse(
  readFileSync(join(root, "node_modules/@tailwindcss/cli/package.json"), "utf8"),
);
const cliBin = typeof cliPkg.bin === "string" ? cliPkg.bin : cliPkg.bin.tailwindcss;
const result = spawnSync(
  process.execPath,
  [join(root, "node_modules/@tailwindcss/cli", cliBin), "-i", "input.css", "-o", "out.css"],
  { cwd: fixture, encoding: "utf8" },
);
if (result.status !== 0) fail(`tailwind CLI failed:\n${result.stderr}`);

const css = readFileSync(join(fixture, "out.css"), "utf8");
// NOTE: tessera.css defines its color tokens in `@theme inline`, which Tailwind v4
// inlines directly at each usage site (e.g. `background-color: var(--primary)`) and
// never emits as a literal `--color-primary` custom property — confirmed by isolated
// repro (see task-4-report.md). `--primary` is the real, re-themable token (also the
// one documented in README.md), so it is what proves the token reached the consumer.
const needleGroups = [
  {
    reason: "@source scanning of dist/ is broken",
    needles: [".animate-spin", ".select-none"],
  },
  {
    reason: "imported stylesheets (palettes/theme) did not arrive",
    needles: ["--primary:", "--tsr-malachite-600:", "--tsr-primary-600:"],
  },
  {
    reason: "@utility tone-* did not compile",
    needles: ["--tone:"],
  },
  {
    reason: "Button v2 utilities (tone, cursor, sizes) did not reach the consumer",
    needles: [".bg-tone", ".cursor-pointer", ".tone-primary", ".h-10"],
  },
];
for (const { reason, needles } of needleGroups) {
  for (const needle of needles) {
    if (!css.includes(needle)) fail(`consumer CSS is missing ${needle} — ${reason}`);
  }
}
pass(`consumer Tailwind build from ${tarball} generates Tessera classes via @source`);

rmSync(fixture, { recursive: true, force: true });
pass("consumer verification complete");
