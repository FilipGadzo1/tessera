import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "src/styles");
const to = join(root, "dist/styles");
mkdirSync(to, { recursive: true });
const files = readdirSync(from).filter((file) => file.endsWith(".css"));
for (const file of files) copyFileSync(join(from, file), join(to, file));
console.log(`copied ${files.length} stylesheets -> dist/styles/`);
