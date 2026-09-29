import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundle every Base UI entry the library uses. Otherwise the first run after a cache wipe
  // re-optimizes deps mid-run when a new subpath is imported, reloading React and failing tests.
  // Add every new @base-ui/react/* subpath here when a component starts importing it (Phase C:
  // tooltip, popover, dialog, menu, …) — otherwise cold runs reload and flake.
  optimizeDeps: {
    include: [
      "@base-ui/react/button",
      "@base-ui/react/input",
      "@base-ui/react/field",
      "@base-ui/react/fieldset",
      "@base-ui/react/checkbox",
      "@base-ui/react/checkbox-group",
      "@base-ui/react/collapsible",
      "@base-ui/react/switch",
      "@base-ui/react/radio",
      "@base-ui/react/radio-group",
      "@base-ui/react/form",
      "@base-ui/react/tooltip",
      "@base-ui/react/popover",
      "@base-ui/react/dialog",
      "@base-ui/react/alert-dialog",
      "@base-ui/react/menu",
      "@base-ui/react/avatar",
      "@base-ui/react/progress",
      "@base-ui/react/meter",
      "@base-ui/react/scroll-area",
      "@base-ui/react/toggle",
      "@base-ui/react/toggle-group",
      "@base-ui/react/toolbar",
      "@base-ui/react/tabs",
      "@base-ui/react/accordion",
      "@base-ui/react/select",
      "@base-ui/react/slider",
      "@base-ui/react/number-field",
      "@base-ui/react/combobox",
      "@base-ui/react/autocomplete",
      "@base-ui/react/drawer",
      "@base-ui/react/toast",
      "@base-ui/react/preview-card",
      "@base-ui/react/context-menu",
      "@base-ui/react/otp-field",
      "@base-ui/react/menubar",
      "@base-ui/react/navigation-menu",
      // Sidebar switches to its mobile Drawer below `md` with Base UI's media-query hook.
      "@base-ui/react/unstable-use-media-query",
      // The date controls join a Field and Form through these (the modules Select uses).
      "@base-ui/react/internals/field-root-context",
      "@base-ui/react/internals/labelable-provider",
      "@base-ui/react/internals/field-register-control",
      "@base-ui/react/internals/form-context",
      // Icons used by the docs examples (src/docs/examples).
      "lucide-react",
    ],
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
