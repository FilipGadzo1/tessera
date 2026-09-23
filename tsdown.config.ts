import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "neutral",
  target: "es2022",
  unbundle: true,
  dts: { sourcemap: true },
  sourcemap: true,
  clean: true,
  fixedExtension: false,
  // unbundle keeps each module's "use client" directive in its own output file
  // (scripts/verify-consumer.mjs asserts that), so rolldown's per-module
  // MODULE_LEVEL_DIRECTIVE warning is noise. Drop only that code.
  inputOptions: (options) => {
    const { onLog } = options;
    return {
      ...options,
      onLog(level, log, defaultHandler) {
        if (log.code === "MODULE_LEVEL_DIRECTIVE") return;
        if (onLog) onLog(level, log, defaultHandler);
        else defaultHandler(level, log);
      },
    };
  },
});
