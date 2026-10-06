import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "../src/components/alert-dialog";
import { Button } from "../src/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../src/components/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "../src/components/drawer";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../src/components/menu";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "../src/components/popover";
import { emulateForcedColors } from "./emulation";
import { waitForPopupSettled } from "./overlay";

/*
 * Spec Phase J §0.2: in forced colors a bordered overlay surface draws one frame, its 1px border.
 * Tailwind's `outline-hidden` alone becomes `outline: 2px solid transparent; outline-offset: 2px`
 * there, which Chromium paints in CanvasText: a second frame 2px outside the border.
 */

beforeEach(async () => {
  await emulateForcedColors(true);
  expect(matchMedia("(forced-colors: active)").matches).toBe(true);
});

afterEach(async () => {
  await emulateForcedColors(false);
});

const cases: [name: string, slot: string, edge: "top" | "left", ui: () => ReactElement][] = [
  [
    "Dialog",
    "dialog-content",
    "top",
    () => (
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update your display name.</DialogDescription>
        </DialogContent>
      </Dialog>
    ),
  ],
  [
    "AlertDialog",
    "alert-dialog-content",
    "top",
    () => (
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    ),
  ],
  [
    // The default side is the inline end (right in LTR): its border is the inner (left) edge.
    "Drawer",
    "drawer-content",
    "left",
    () => (
      <Drawer defaultOpen>
        <DrawerContent>
          <DrawerTitle>Filters</DrawerTitle>
        </DrawerContent>
      </Drawer>
    ),
  ],
  [
    "PopoverContent",
    "popover-content",
    "top",
    () => (
      <Popover defaultOpen>
        <PopoverTrigger render={<Button variant="outline" />}>Open</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Details</PopoverTitle>
        </PopoverContent>
      </Popover>
    ),
  ],
  [
    "MenuContent",
    "menu-content",
    "top",
    () => (
      <Menu defaultOpen>
        <MenuTrigger render={<Button variant="outline" />}>Actions</MenuTrigger>
        <MenuContent>
          <MenuItem>Edit</MenuItem>
        </MenuContent>
      </Menu>
    ),
  ],
];

describe("forced colors: one frame on bordered overlay surfaces", () => {
  it.each(cases)("%s: no outline, a solid 1px border", async (_, slot, edge, ui) => {
    await render(ui());
    const find = () => document.querySelector<HTMLElement>(`[data-slot=${slot}]`);
    await expect.poll(find).not.toBeNull();
    const popup = find() as HTMLElement;
    await waitForPopupSettled(popup);
    const style = getComputedStyle(popup);
    expect(style.outlineStyle).toBe("none");
    expect(style.getPropertyValue(`border-${edge}-style`)).toBe("solid");
    expect(style.getPropertyValue(`border-${edge}-width`)).toBe("1px");
  });
});
