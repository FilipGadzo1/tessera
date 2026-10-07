import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeStudioPage } from "./theme-studio-page";

/**
 * Every Phase J component in one theme editor. A `Stepper` wizard (Colors, Shape, Review) sits in a
 * collapsible controls panel of a `ResizablePanelGroup` (drag the "Resize controls" handle, or
 * focus it and press the arrows, Home / End, or Enter to collapse and restore; the panels stack
 * below `md`). Colors holds an inline `ColorPicker` for the primary colour and a
 * `ColorPickerPopover` for the surface; a contrast `Badge` from `color.ts` measures the primary as
 * text on the surface, and Next refuses below 4.5:1 (try `#ffff66`), marking the step `error`. The
 * page keeps its own set of completed steps, so going Back keeps the later steps reachable. Shape
 * holds a radius `Slider` and a density `RadioGroup`; Review a name `Input` and a clearable
 * `Rating`. The live preview applies the theme through inline custom properties on its own
 * container. Ctrl/⌘+S saves ("Theme saved" until the next change) and Ctrl/⌘+J shows the CSS in a
 * third panel; both work while typing, and their `KbdShortcut` hints show ⌘ on a Mac.
 */
const meta = {
  title: "Tessera/Examples/Theme Studio",
  component: ThemeStudioPage,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ThemeStudioPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThemeStudio: Story = { name: "Theme Studio" };
