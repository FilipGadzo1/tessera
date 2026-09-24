import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { waitForPopupSettled } from "../../../test/overlay";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../alert-dialog";
import { Button } from "../button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "../dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../menu";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "../popover";
import { Tooltip, TooltipContent, type TooltipProps, TooltipTrigger } from "./tooltip";

/**
 * Layered Escape: with a Tessera Tooltip open inside another Tessera overlay, the first Escape
 * closes only the tooltip and the second closes the outer overlay. The tooltip's Escape is never
 * swallowed: an app-level `document` keydown listener receives it. (The outer overlay's own close
 * keeps Base UI's default of stopping the Escape it handles.)
 */

type Outer = "dialog" | "alert-dialog" | "popover" | "menu";

const tooltipSpy = vi.fn<NonNullable<TooltipProps["onOpenChange"]>>();
const outerSpy = vi.fn();
const appKeys: string[] = [];
const windowKeys: string[] = [];
function appListener(event: KeyboardEvent) {
  if (event.key === "Escape") appKeys.push(event.key);
}
function windowListener(event: KeyboardEvent) {
  if (event.key === "Escape") windowKeys.push(event.key);
}

beforeEach(() => {
  tooltipSpy.mockReset();
  outerSpy.mockReset();
  appKeys.length = 0;
  windowKeys.length = 0;
  document.addEventListener("keydown", appListener);
  window.addEventListener("keydown", windowListener);
});

afterEach(() => {
  document.removeEventListener("keydown", appListener);
  window.removeEventListener("keydown", windowListener);
});

function HelpTooltip({ trigger }: { trigger?: ReactNode }) {
  return (
    <Tooltip onOpenChange={tooltipSpy}>
      {trigger ?? (
        <TooltipTrigger delay={0} closeDelay={0} render={<Button variant="outline" />}>
          Help
        </TooltipTrigger>
      )}
      <TooltipContent>Opens the help centre</TooltipContent>
    </Tooltip>
  );
}

function Fixture({ outer }: { outer: Outer }) {
  if (outer === "dialog") {
    return (
      <Dialog onOpenChange={outerSpy}>
        <DialogTrigger render={<Button variant="outline" />}>Open outer</DialogTrigger>
        <DialogContent>
          <DialogTitle>Outer</DialogTitle>
          <DialogDescription>Holds a tooltip.</DialogDescription>
          <Button variant="outline">Details</Button>
          <HelpTooltip />
        </DialogContent>
      </Dialog>
    );
  }
  if (outer === "alert-dialog") {
    return (
      <AlertDialog onOpenChange={outerSpy}>
        <AlertDialogTrigger render={<Button variant="outline" />}>Open outer</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Outer</AlertDialogTitle>
          <AlertDialogDescription>Holds a tooltip.</AlertDialogDescription>
          <Button variant="outline">Details</Button>
          <HelpTooltip />
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  if (outer === "popover") {
    return (
      <Popover onOpenChange={outerSpy}>
        <PopoverTrigger render={<Button variant="outline" />}>Open outer</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Outer</PopoverTitle>
          <Button variant="outline">Details</Button>
          <HelpTooltip />
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <Menu onOpenChange={outerSpy}>
      <MenuTrigger render={<Button variant="outline" />}>Open outer</MenuTrigger>
      <MenuContent>
        <MenuItem>Duplicate</MenuItem>
        <HelpTooltip
          trigger={
            <TooltipTrigger delay={0} closeDelay={0} render={<MenuItem />}>
              Help
            </TooltipTrigger>
          }
        />
      </MenuContent>
    </Menu>
  );
}

const outerPopup = (outer: Outer) =>
  document.querySelector<HTMLElement>(`[data-slot=${outer === "menu" ? "menu" : outer}-content]`);
const tooltipPopup = () => document.querySelector<HTMLElement>("[data-slot=tooltip-content]");

async function openOuter(outer: Outer) {
  await userEvent.click(page.getByRole("button", { name: "Open outer" }));
  await expect.poll(() => outerPopup(outer)).not.toBeNull();
  await waitForPopupSettled(outerPopup(outer) as HTMLElement);
}

function helpTrigger(outer: Outer) {
  return outer === "menu"
    ? page.getByRole("menuitem", { name: "Help" })
    : page.getByRole("button", { name: "Help" });
}

async function openTooltipByHover(outer: Outer) {
  await userEvent.hover(helpTrigger(outer));
  await expect.element(page.getByRole("tooltip")).toBeVisible();
  await waitForPopupSettled(tooltipPopup() as HTMLElement);
}

async function expectLayeredEscape(outer: Outer) {
  await userEvent.keyboard("{Escape}");
  await expect.poll(tooltipPopup).toBeNull();
  expect(outerPopup(outer)).not.toBeNull();
  expect(appKeys).toEqual(["Escape"]);
  expect(windowKeys).toEqual(["Escape"]);
  expect(tooltipSpy).toHaveBeenLastCalledWith(
    false,
    expect.objectContaining({ reason: "escape-key" }),
  );
  expect(tooltipSpy.mock.calls.filter(([open]) => open === false)).toHaveLength(1);
  // The outer overlay's cancelled close is not forwarded to its onOpenChange.
  expect(outerSpy.mock.calls.filter(([open]) => open === false)).toHaveLength(0);

  await userEvent.keyboard("{Escape}");
  await expect.poll(() => outerPopup(outer)).toBeNull();
  expect(outerSpy).toHaveBeenLastCalledWith(
    false,
    expect.objectContaining({ reason: "escape-key" }),
  );
}

describe("Tooltip Escape inside another overlay", () => {
  it.each(["dialog", "alert-dialog", "popover", "menu"] as const)(
    "%s: hover-opened tooltip closes first, without swallowing Escape",
    async (outer) => {
      await render(<Fixture outer={outer} />);
      await openOuter(outer);
      await openTooltipByHover(outer);
      await expectLayeredEscape(outer);
    },
  );

  it.each(["dialog", "popover"] as const)(
    "%s: tooltip opened by keyboard focus closes first, without swallowing Escape",
    async (outer) => {
      await render(<Fixture outer={outer} />);
      await openOuter(outer);
      const help = page.getByRole("button", { name: "Help" });
      for (let i = 0; i < 6 && document.activeElement !== help.element(); i++) {
        await userEvent.tab();
      }
      expect(document.activeElement).toBe(help.element());
      await expect.element(page.getByRole("tooltip")).toBeVisible();
      await expectLayeredEscape(outer);
    },
  );

  it("standalone: Escape closes the tooltip and reaches document and window listeners", async () => {
    await render(
      <div className="p-16">
        <HelpTooltip />
      </div>,
    );
    await openTooltipByHover("dialog");
    await userEvent.keyboard("{Escape}");
    await expect.poll(tooltipPopup).toBeNull();
    expect(appKeys).toEqual(["Escape"]);
    expect(windowKeys).toEqual(["Escape"]);
    expect(tooltipSpy).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    );
  });

  it("dialog: Escape with no tooltip open still closes the dialog at once", async () => {
    await render(<Fixture outer="dialog" />);
    await openOuter("dialog");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => outerPopup("dialog")).toBeNull();
    expect(outerSpy).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    );
  });
});
