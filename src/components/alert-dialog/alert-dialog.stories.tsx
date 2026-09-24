import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";

const meta = {
  title: "Components/AlertDialog",
  component: AlertDialogContent,
  tags: ["autodocs"],
  args: { size: "md" },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof AlertDialogContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A destructive confirmation. A backdrop click does not dismiss it; Escape or Cancel does. The
 * confirm Button runs its handler and closes the dialog through the controlled `open` state.
 */
export const DeleteProject: Story = {
  render: function DeleteProjectDialog(args) {
    const [open, setOpen] = useState(false);
    const [deleted, setDeleted] = useState(false);
    return (
      <div className="flex items-center gap-3">
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger render={<Button variant="outline" color="danger" />}>
            Delete project
          </AlertDialogTrigger>
          <AlertDialogContent {...args}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “Mosaic”?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the project, its layers and its export history. This cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" color="neutral" />}>
                Cancel
              </AlertDialogClose>
              <Button
                color="danger"
                onClick={() => {
                  setDeleted(true);
                  setOpen(false);
                }}
              >
                Delete project
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <span className="text-sm text-muted-foreground">
          {deleted ? "Project deleted" : "Project kept"}
        </span>
      </div>
    );
  },
};
