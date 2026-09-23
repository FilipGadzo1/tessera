import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundle every Base UI entry the library uses. Otherwise the first run after a cache wipe
  // re-optimizes deps mid-run when a new subpath is imported, reloading React and failing tests.
  optimizeDeps: {
    include: [
      "@base-ui/react/button",
      "@base-ui/react/input",
      "@base-ui/react/field",
      "@base-ui/react/fieldset",
      "@base-ui/react/checkbox",
      "@base-ui/react/switch",
      "@base-ui/react/radio",
      "@base-ui/react/radio-group",
      "@base-ui/react/form",
    ],
  },
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
