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
  /^["']use client["'];?$/.test(
    readFileSync(join(dist, file), "utf8").trimStart().split(/\r?\n/)[0].trim(),
  );
if (!isClient("components/button/button.js"))
  fail('dist/components/button/button.js must start with "use client"');
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
writeFileSync(
  join(fixture, "input.css"),
  '@import "tailwindcss";\n@import "@tessera/ui/styles.css";\n',
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
for (const needle of [
  ".bg-primary",
  "--primary:",
  ".h-9",
  ".animate-spin",
  ".focus-visible\\:ring-3",
]) {
  if (!css.includes(needle)) fail(`consumer CSS is missing ${needle} — @source scanning is broken`);
}
pass("consumer Tailwind build generates Tessera classes via @source");

rmSync(fixture, { recursive: true, force: true });
pass("consumer verification complete");
