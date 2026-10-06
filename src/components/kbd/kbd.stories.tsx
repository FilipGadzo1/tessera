import type { Meta, StoryObj } from "@storybook/react-vite";
import { useModifierKeyLabel } from "../../lib/use-modifier-key-label";
import { Button } from "../button";
import { Kbd, KbdGroup } from "./kbd";
import { KbdShortcut } from "./kbd-shortcut";

const meta = {
  title: "Components/Kbd",
  component: Kbd,
  tags: ["autodocs"],
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Single keys. */
export const Basic: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Kbd>Esc</Kbd>
      <Kbd>Enter</Kbd>
      <Kbd>K</Kbd>
      <Kbd>/</Kbd>
    </div>
  ),
};

/** A key combination: `Kbd`s in a `KbdGroup`, separated by a gap rather than "+". */
export const Group: Story = {
  render: () => (
    <p className="text-sm">
      Press{" "}
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <Kbd>Shift</Kbd>
        <Kbd>P</Kbd>
      </KbdGroup>{" "}
      to open the command palette.
    </p>
  ),
};

/**
 * A standalone `KbdShortcut`: it shows ⌘ K on a Mac and Ctrl K elsewhere. Symbol keys carry their
 * names for screen readers (sr-only "Command") and as a tooltip (`title`), so it reads "Command K".
 */
export const Shortcut: Story = {
  render: () => (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        Search: <KbdShortcut shortcut="mod+k" />
      </p>
      <p>
        Redo: <KbdShortcut shortcut="mod+shift+z" />
      </p>
      <p>
        Send: <KbdShortcut shortcut="mod+enter" />
      </p>
    </div>
  ),
};

function InAButtonDemo() {
  const { aria } = useModifierKeyLabel();
  return (
    <Button variant="outline" color="neutral" aria-keyshortcuts={aria("mod+k")}>
      Search
      <KbdShortcut aria-hidden shortcut="mod+k" />
    </Button>
  );
}

/**
 * Inside a control the hint is `aria-hidden` (visual only) and the control carries
 * `aria-keyshortcuts` for the platform's binding ("Control+K", or "Meta+K" on a Mac), so the
 * shortcut is announced once and stays out of the button's name.
 */
export const InAButton: Story = {
  name: "In a Button",
  render: () => <InAButtonDemo />,
};
