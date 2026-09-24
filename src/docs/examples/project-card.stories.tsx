import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProjectCard } from "./project-card";

/**
 * Every overlay in one card. The Star and Share icon Buttons carry Tooltips; "Members" opens a
 * Popover listing people with an invite field; the "Project actions" Menu opens a Dialog to rename
 * the project (Enter saves, focus returns to the Menu trigger) and an AlertDialog to delete it.
 * Deleting swaps the card for an empty state whose Undo restores the project.
 *
 * The dialogs are controlled (`open` / `onOpenChange`) and opened from Menu items, so they have no
 * trigger of their own; `finalFocus` on the content says where focus goes when they close.
 */
const meta = {
  title: "Tessera/Examples/Project card",
  component: ProjectCard,
} satisfies Meta<typeof ProjectCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Project: Story = { name: "Project card" };
