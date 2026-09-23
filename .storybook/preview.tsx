import type { Preview } from "@storybook/react-vite";
import "@fontsource-variable/inter";
import "./storybook.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Light or dark",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
    primary: {
      description: "Primary palette (data-primary)",
      toolbar: {
        title: "Primary",
        icon: "paintbrush",
        items: [
          { value: "malachite", title: "Malachite" },
          { value: "lapis", title: "Lapis" },
          { value: "amethyst", title: "Amethyst" },
          { value: "carnelian", title: "Carnelian" },
        ],
        dynamicTitle: true,
      },
    },
    surface: {
      description: "Surface palette (data-surface)",
      toolbar: {
        title: "Surface",
        icon: "component",
        items: [
          { value: "marble", title: "Marble" },
          { value: "slate", title: "Slate" },
          { value: "sandstone", title: "Sandstone" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light", primary: "malachite", surface: "marble" },
  decorators: [
    (Story, context) => {
      const root = document.documentElement;
      root.classList.toggle("dark", context.globals.theme === "dark");
      root.dataset.primary = String(context.globals.primary ?? "malachite");
      root.dataset.surface = String(context.globals.surface ?? "marble");
      return <Story />;
    },
  ],
  parameters: {
    layout: "centered",
    controls: { expanded: true },
  },
};

export default preview;
