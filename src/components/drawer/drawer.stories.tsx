import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, buttonVariants } from "../button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../dialog";
import { Input } from "../input";
import { Label } from "../label";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";

const meta = {
  title: "Components/Drawer",
  component: Drawer,
  tags: ["autodocs"],
  args: { side: "right" },
  argTypes: {
    side: { control: "inline-radio", options: ["right", "left", "bottom", "top"] },
  },
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger render={<Button variant="outline" />}>Edit profile</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Edit profile</DrawerTitle>
          <DrawerDescription>
            Change how you appear to your team. Save when you are done.
          </DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-4 px-4">
          <div className="grid gap-1.5">
            <Label htmlFor="drawer-story-name">Name</Label>
            <Input id="drawer-story-name" defaultValue="Ada Lovelace" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="drawer-story-username">Username</Label>
            <Input id="drawer-story-username" defaultValue="@ada" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="drawer-story-email">Email</Label>
            <Input id="drawer-story-email" type="email" defaultValue="ada@example.com" />
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose render={<Button variant="outline" color="neutral" />}>Cancel</DrawerClose>
          <DrawerClose render={<Button />}>Save changes</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A form in a right-hand panel (the default `side`). Focus moves into the drawer and Tab stays
 * inside; page scroll is locked. Escape, a backdrop click, the close button, `DrawerClose` or
 * dragging the panel towards its edge closes it, and focus returns to the trigger.
 */
export const RightWithForm: Story = {};

const sections = ["Dashboard", "Projects", "Team", "Billing", "Settings"];

/** Navigation from the left edge: a `nav` landmark of links, the current page marked. */
export const LeftNavigation: Story = {
  args: { side: "left" },
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger render={<Button variant="outline" />}>Open menu</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Acme Inc.</DrawerTitle>
          <DrawerDescription>Workspace navigation</DrawerDescription>
        </DrawerHeader>
        <nav aria-label="Workspace" className="px-2">
          <ul className="grid gap-1">
            {sections.map((section, index) => (
              <li key={section}>
                <a
                  href={`#${section.toLowerCase()}`}
                  aria-current={index === 0 ? "page" : undefined}
                  className={buttonVariants({
                    variant: "ghost",
                    color: "neutral",
                    className: "w-full justify-start aria-[current=page]:bg-accent",
                  })}
                >
                  {section}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </DrawerContent>
    </Drawer>
  ),
};

/**
 * A bottom sheet with a grab handle: drag it down (or press Escape) to dismiss. Capped at 85% of
 * the viewport height.
 */
export const BottomSheet: Story = {
  args: { side: "bottom" },
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger render={<Button variant="outline" />}>Share</DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>Share “Q3 roadmap”</DrawerTitle>
            <DrawerDescription>Anyone with the link can view this document.</DrawerDescription>
          </DrawerHeader>
          <div className="flex gap-2 px-4">
            <Input
              aria-label="Link"
              readOnly
              defaultValue="https://acme.example/docs/q3-roadmap"
              className="flex-1"
            />
            <Button>Copy link</Button>
          </div>
          <DrawerFooter>
            <DrawerClose render={<Button variant="outline" color="neutral" />}>Done</DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  ),
};

/** A drawer from the top edge, for short announcements or search. */
export const Top: Story = {
  args: { side: "top" },
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger render={<Button variant="outline" />}>Search</DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-xl">
          <DrawerHeader>
            <DrawerTitle>Search</DrawerTitle>
            <DrawerDescription>Find projects, people and documents.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <Input aria-label="Search" type="search" placeholder="Search Acme…" />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  ),
};

/**
 * A Dialog opened from inside a drawer stacks above it; Escape closes the dialog first (focus
 * returns to its trigger in the drawer), and the next Escape closes the drawer.
 */
export const NestedDialog: Story = {
  render: (args) => (
    <Drawer {...args}>
      <DrawerTrigger render={<Button variant="outline" />}>Account settings</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Account settings</DrawerTitle>
          <DrawerDescription>Manage your account and data.</DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-2 px-4">
          <p className="text-sm text-muted-foreground">
            Deleting your account removes all projects and cannot be undone.
          </p>
          <Dialog>
            <DialogTrigger render={<Button color="danger" className="justify-self-start" />}>
              Delete account
            </DialogTrigger>
            <DialogContent size="sm">
              <DialogHeader>
                <DialogTitle>Delete account?</DialogTitle>
                <DialogDescription>
                  All 12 projects and their files will be removed permanently.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" color="neutral" />}>
                  Cancel
                </DialogClose>
                <DialogClose render={<Button color="danger" />}>Delete</DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DrawerContent>
    </Drawer>
  ),
};
