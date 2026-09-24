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
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "../menu";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "../popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
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
const selectSpy = vi.fn();
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
  selectSpy.mockReset();
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

  it("dialog: a tooltip close cancelled by the caller keeps the tooltip registered as open", async () => {
    let cancelNext = true;
    tooltipSpy.mockImplementation((open, eventDetails) => {
      if (!open && eventDetails.reason === "escape-key" && cancelNext) eventDetails.cancel();
    });
    await render(<Fixture outer="dialog" />);
    await openOuter("dialog");
    await openTooltipByHover("dialog");

    // 1st Escape: the caller cancels the tooltip's close, so both stay open.
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("tooltip")).toBeVisible();
    expect(outerPopup("dialog")).not.toBeNull();
    cancelNext = false;

    // 2nd Escape: the tooltip is still open, so it (not the dialog) takes this one.
    await userEvent.keyboard("{Escape}");
    await expect.poll(tooltipPopup).toBeNull();
    expect(outerPopup("dialog")).not.toBeNull();
    expect(outerSpy.mock.calls.filter(([open]) => open === false)).toHaveLength(0);

    // 3rd Escape closes the dialog.
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => outerPopup("dialog")).toBeNull();
  });

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

  it("menu submenu: a tooltip in MenuSubContent closes first, then the submenu, then the menu", async () => {
    const subSpy = vi.fn();
    await render(
      <Menu onOpenChange={outerSpy}>
        <MenuTrigger render={<Button variant="outline" />}>Open outer</MenuTrigger>
        <MenuContent>
          <MenuItem>Duplicate</MenuItem>
          <MenuSub onOpenChange={subSpy}>
            <MenuSubTrigger>Share</MenuSubTrigger>
            <MenuSubContent>
              <MenuItem>Email</MenuItem>
              <HelpTooltip
                trigger={
                  <TooltipTrigger delay={0} closeDelay={0} render={<MenuItem />}>
                    Help
                  </TooltipTrigger>
                }
              />
            </MenuSubContent>
          </MenuSub>
        </MenuContent>
      </Menu>,
    );
    await openOuter("menu");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}");
    const sub = () => document.querySelector<HTMLElement>("[data-slot=menu-sub-content]");
    await expect.poll(sub).not.toBeNull();
    await waitForPopupSettled(sub() as HTMLElement);
    await userEvent.hover(page.getByRole("menuitem", { name: "Help" }));
    await expect.element(page.getByRole("tooltip")).toBeVisible();
    await waitForPopupSettled(tooltipPopup() as HTMLElement);

    // 1st Escape: only the tooltip; the submenu and the root menu stay open; the app hears it.
    await userEvent.keyboard("{Escape}");
    await expect.poll(tooltipPopup).toBeNull();
    expect(sub()).not.toBeNull();
    expect(outerPopup("menu")).not.toBeNull();
    expect(appKeys).toEqual(["Escape"]);
    expect(subSpy.mock.calls.filter(([open]) => open === false)).toHaveLength(0);
    expect(outerSpy.mock.calls.filter(([open]) => open === false)).toHaveLength(0);

    // 2nd Escape: the submenu only (Base UI closes the innermost menu).
    const menuCount = () => document.querySelectorAll('[role="menu"]').length;
    await userEvent.keyboard("{Escape}");
    await expect.poll(menuCount).toBe(1);
    await expect.poll(sub).toBeNull();
    expect(outerPopup("menu")).not.toBeNull();
    expect(subSpy).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    );
    expect(outerSpy.mock.calls.filter(([open]) => open === false)).toHaveLength(0);

    // 3rd Escape: the root menu.
    await userEvent.keyboard("{Escape}");
    await expect.poll(menuCount).toBe(0);
    expect(outerSpy).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    );
  });

  it("dialog > select > tooltip: three Escapes close tooltip, select, dialog in turn", async () => {
    await render(
      <Dialog onOpenChange={outerSpy}>
        <DialogTrigger render={<Button variant="outline" />}>Open outer</DialogTrigger>
        <DialogContent>
          <DialogTitle>Outer</DialogTitle>
          <DialogDescription>Holds a select.</DialogDescription>
          <Select<string> items={{ kiwi: "Kiwi", lime: "Lime" }} onOpenChange={selectSpy}>
            <SelectTrigger aria-label="Fruit">
              <SelectValue placeholder="Pick a fruit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lime">Lime</SelectItem>
              <SelectItem value="kiwi">
                Kiwi
                <Tooltip onOpenChange={tooltipSpy}>
                  <TooltipTrigger delay={0} closeDelay={0} render={<span data-testid="info" />}>
                    (seasonal)
                  </TooltipTrigger>
                  <TooltipContent>Available from October</TooltipContent>
                </Tooltip>
              </SelectItem>
            </SelectContent>
          </Select>
        </DialogContent>
      </Dialog>,
    );
    await openOuter("dialog");
    await userEvent.click(page.getByRole("combobox", { name: "Fruit" }));
    await expect.element(page.getByRole("listbox")).toBeVisible();
    await waitForPopupSettled(
      document.querySelector<HTMLElement>("[data-slot=select-content]") as HTMLElement,
    );
    await userEvent.hover(page.getByTestId("info"));
    await expect.element(page.getByRole("tooltip")).toBeVisible();
    await waitForPopupSettled(tooltipPopup() as HTMLElement);
    const closes = (spy: typeof outerSpy) => spy.mock.calls.filter(([open]) => !open).length;

    // 1st Escape: the tooltip only; the app's document listener hears it.
    await userEvent.keyboard("{Escape}");
    await expect.poll(tooltipPopup).toBeNull();
    await expect.element(page.getByRole("listbox")).toBeVisible();
    expect(outerPopup("dialog")).not.toBeNull();
    expect(appKeys).toEqual(["Escape"]);
    expect(closes(selectSpy)).toBe(0);
    expect(closes(outerSpy)).toBe(0);

    // 2nd Escape: the select only. Base UI stops the Escape it handles itself (as for every
    // overlay's own close), so the app's document listener does not hear this one.
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("listbox")).not.toBeInTheDocument();
    await expect.element(page.getByRole("combobox", { name: "Fruit" })).toHaveFocus();
    expect(outerPopup("dialog")).not.toBeNull();
    expect(appKeys).toEqual(["Escape"]);
    expect(selectSpy).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    );
    expect(closes(outerSpy)).toBe(0);

    // 3rd Escape: the dialog.
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => outerPopup("dialog")).toBeNull();
    expect(outerSpy).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: "escape-key" }),
    );
  });
});
