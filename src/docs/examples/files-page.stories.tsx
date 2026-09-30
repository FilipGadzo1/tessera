import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilesPage } from "./files-page";

/**
 * A file manager composing the Phase I components. The `Sidebar` (Ctrl/⌘+B; a Drawer below `md`)
 * holds a folder `Tree` (single selection): ↑/↓ move, → expands, and Enter, Space or a click opens
 * the folder. The inset shows the open folder's files in a `Table`, a filter `Form` with an editable
 * `DateRangePicker` "Modified" (type or pick a range, then Apply: the Form reports
 * `{ modified: { start, end } }` and the table filters), and, for image files, a preview `Carousel`
 * of inline SVG placeholders. Ctrl/⌘+K (or the Commands button) opens a `CommandDialog`: "Go to
 * folder…" switches it to a folder list (type a name, Enter goes there and the Tree reveals it),
 * "New folder" creates and opens one in the current folder, and "Toggle sidebar" collapses it.
 */
const meta = {
  title: "Tessera/Examples/Files",
  component: FilesPage,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 720 } },
  },
} satisfies Meta<typeof FilesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Files: Story = { name: "Files" };
