import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { Input } from "../input";
import { Label } from "../label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

const meta = {
  title: "Components/Dialog",
  component: DialogContent,
  tags: ["autodocs"],
  args: { size: "md", showCloseButton: true },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    showCloseButton: { control: "boolean" },
  },
  render: (args) => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Edit profile</DialogTrigger>
      <DialogContent {...args}>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Change how you appear to your team. Save when you are done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="dialog-story-name">Name</Label>
            <Input id="dialog-story-name" defaultValue="Ada Lovelace" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dialog-story-username">Username</Label>
            <Input id="dialog-story-username" defaultValue="@ada" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" color="neutral" />}>Cancel</DialogClose>
          <DialogClose render={<Button />}>Save changes</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
} satisfies Meta<typeof DialogContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Click (or Enter/Space) opens it. Focus moves to the first field and Tab stays inside; page scroll
 * is locked. Escape, a backdrop click, the corner close button or `DialogClose` closes it, and focus
 * returns to the trigger.
 */
export const Default: Story = {};

/** `size` sets the maximum width: sm `max-w-sm`, md `max-w-lg` (default), lg `max-w-2xl`. */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Dialog key={size}>
          <DialogTrigger render={<Button variant="outline" />}>Size {size}</DialogTrigger>
          <DialogContent size={size}>
            <DialogHeader>
              <DialogTitle>Size {size}</DialogTitle>
              <DialogDescription>
                The dialog is as wide as the viewport allows, up to its size's maximum width.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  ),
};

/** `showCloseButton={false}`: give the footer an explicit way out instead. */
export const WithoutCloseButton: Story = {
  args: { showCloseButton: false },
  render: (args) => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Show terms</DialogTrigger>
      <DialogContent {...args}>
        <DialogHeader>
          <DialogTitle>Terms updated</DialogTitle>
          <DialogDescription>
            We changed how long we keep deleted projects: 30 days.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button />}>Got it</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

const paragraphs = Array.from({ length: 24 }, (_, index) => index + 1);

/**
 * Long content: the dialog is capped at the viewport height (`max-h-[calc(100dvh-2rem)]`) and
 * scrolls inside (`overflow-y-auto`), so the title stays reachable while page scroll is locked.
 */
export const ScrollableContent: Story = {
  render: (args) => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Read the changelog</DialogTrigger>
      <DialogContent {...args}>
        <DialogHeader>
          <DialogTitle>Changelog</DialogTitle>
          <DialogDescription>Everything that shipped this quarter.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          {paragraphs.map((n) => (
            <p key={n}>
              Release {n}: tiles now snap to the grid, exports keep their colour profiles, and the
              layers panel remembers which groups you collapsed.
            </p>
          ))}
        </div>
        <DialogFooter>
          <DialogClose render={<Button />}>Close changelog</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
