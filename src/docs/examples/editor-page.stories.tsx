import type { Meta, StoryObj } from "@storybook/react-vite";
import { EditorPage } from "./editor-page";

/**
 * Every Phase F component in one "New post" editor card. A Toolbar holds a formatting
 * `ToggleGroup` (Bold/Italic/Underline), an alignment `ToggleGroup` and an "Insert" `Menu`. The
 * body sits in a `ScrollArea` under a `ContextMenu` (right-click it) whose Format submenu reuses
 * `MenuCheckboxItem` bound to the same toolbar state. The byline's `@filip` is a `PreviewCardTrigger`
 * (hover or focus it); "Publish on" is a `DatePicker` and "Embargo" a `DateRangePicker`; a `Meter`
 * reports the character count.
 */
const meta = {
  title: "Tessera/Examples/Editor",
  component: EditorPage,
  parameters: { layout: "padded" },
} satisfies Meta<typeof EditorPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editor: Story = { name: "Editor" };
