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
