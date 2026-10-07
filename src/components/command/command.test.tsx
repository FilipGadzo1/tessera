import { type ReactElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia, systemColor } from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { restorePlatform, stubMac, stubWindows } from "../../../test/platform";
import { Button } from "../button";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "../drawer";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import {
  Command,
  CommandDialog,
  type CommandDialogProps,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
  type CommandProps,
  type CommandSelectEvent,
  CommandSeparator,
  CommandShortcut,
} from "./command";
import * as stories from "./command.stories";

const DefaultStory = stories.default.render as unknown as (args: object) => ReactElement;
const DialogStory = stories.Dialog.render as unknown as () => ReactElement;

interface ItemsProps {
  onRun?: (name: string, event: CommandSelectEvent) => void;
  keepOpen?: string;
}

function Items({ onRun, keepOpen }: ItemsProps) {
  const run = (name: string) => (event: CommandSelectEvent) => {
    if (name === keepOpen) event.preventDefault();
    onRun?.(name, event);
  };
  return (
    <>
      <CommandInput placeholder="Type a command or search…" />
      <CommandEmpty />
      <CommandList>
        <CommandGroup>
          <CommandGroupLabel>Suggestions</CommandGroupLabel>
          <CommandItem onSelect={run("Calendar")}>Calendar</CommandItem>
          <CommandItem keywords={["smiley", "face"]} onSelect={run("Search emoji")}>
            Search emoji
          </CommandItem>
          <CommandItem disabled onSelect={run("Calculator")}>
            Calculator
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup>
          <CommandGroupLabel>Settings</CommandGroupLabel>
          <CommandItem onSelect={run("Profile")}>
            Profile
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run("Billing")}>
            Billing
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run("Settings")}>
            Settings
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </>
  );
}

function Palette({ onRun, keepOpen, ...props }: Partial<CommandProps> & ItemsProps) {
  return (
    <Command className="w-96 border border-border" {...props}>
      <Items onRun={onRun} keepOpen={keepOpen} />
    </Command>
  );
}

function DialogPalette({ onRun, keepOpen, ...props }: Partial<CommandDialogProps> & ItemsProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-3 bg-background p-4">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open palette
      </Button>
      <input aria-label="Notes" />
      <p data-testid="state">{open ? "open" : "closed"}</p>
      <CommandDialog open={open} onOpenChange={setOpen} {...props}>
        <Items onRun={onRun} keepOpen={keepOpen} />
      </CommandDialog>
    </div>
  );
}

const input = () =>
  page.getByRole("combobox", { name: "Command menu" }).element() as HTMLInputElement;
const option = (name: string) => page.getByRole("option", { name, exact: true });
const optionNames = () =>
  [...document.querySelectorAll("[role=option]")].map(
    (element) => element.getAttribute("aria-label") ?? element.firstChild?.textContent,
  );
const highlighted = () =>
  document.querySelector("[role=option][data-highlighted]")?.firstChild?.textContent ?? null;
const dialog = () => page.getByRole("dialog");
const popup = () => document.querySelector<HTMLElement>("[data-slot=dialog-content]");
const status = () =>
  document.querySelector<HTMLElement>("[data-slot=command-empty]") as HTMLElement;

async function openDialogByButton() {
  await userEvent.click(page.getByRole("button", { name: "Open palette" }));
  await expect.element(dialog()).toBeVisible();
  const element = popup() as HTMLElement;
  await waitForPopupSettled(element);
  return element;
}

afterEach(async () => {
  document.documentElement.classList.remove("dark");
  restorePlatform();
  await resetEmulatedMedia();
});

describe("CommandShortcut shortcut", () => {
  const hint = () => document.querySelector("[data-slot=command-shortcut]");

  it("reads Ctrl+B off Apple", async () => {
    stubWindows();
    await render(<CommandShortcut shortcut="mod+b" />);
    expect(hint()?.textContent).toBe("Ctrl+B");
    expect(hint()?.getAttribute("aria-hidden")).toBe("true");
  });

  it("reads ⌘B under a macOS stub", async () => {
    stubMac();
    await render(<CommandShortcut shortcut="mod+b" />);
    expect(hint()?.textContent).toBe("⌘B");
  });

  it("children win over shortcut", async () => {
    await render(<CommandShortcut shortcut="mod+b">F2</CommandShortcut>);
    expect(hint()?.textContent).toBe("F2");
  });
});

describe("Command", () => {
  describe("structure", () => {
    it("renders the parts with their slots, names the input and the list", async () => {
      await render(<Palette />);
      const root = document.querySelector<HTMLElement>("[data-slot=command]") as HTMLElement;
      expect(root.className).toContain("flex-col");
      expect(root.className).toContain("overflow-hidden");
      expect(root.className).toContain("rounded-lg");
      expect(root.className).toContain("bg-popover");
      expect(input().getAttribute("data-slot")).toBe("command-input");
      expect(page.getByRole("listbox", { name: "Command menu" }).element().className).toContain(
        "max-h-80",
      );
      expect(document.querySelectorAll("[data-slot=command-item]").length).toBe(6);
      expect(document.querySelectorAll("[data-slot=command-group]").length).toBe(2);
      expect(document.querySelectorAll("[data-slot=command-group-label]").length).toBe(2);
      expect(document.querySelector("[data-slot=command-separator]")).not.toBeNull();
      // The shortcut is a hint only: out of the item's accessible name.
      await expect.element(option("Profile")).toBeInTheDocument();
      const shortcut = document.querySelector("[data-slot=command-shortcut]") as HTMLElement;
      expect(shortcut.getAttribute("aria-hidden")).toBe("true");
      const group = page.getByRole("group", { name: "Settings" });
      await expect.element(group).toBeVisible();
    });

    it("label names the input and the list", async () => {
      await render(<Palette label="Actions" />);
      await expect.element(page.getByRole("combobox", { name: "Actions" })).toBeInTheDocument();
      await expect.element(page.getByRole("listbox", { name: "Actions" })).toBeInTheDocument();
    });
  });

  describe("filtering", () => {
    it("typing filters on the label and hides groups with no matches", async () => {
      await render(<Palette />);
      await userEvent.click(input());
      await userEvent.keyboard("bil");
      await expect.poll(optionNames).toEqual(["Billing"]);
      await expect.element(page.getByRole("group", { name: "Settings" })).toBeVisible();
      await expect
        .element(page.getByRole("group", { name: "Suggestions", includeHidden: true }))
        .not.toBeVisible();
      // Separators step aside while filtering.
      expect(document.querySelector("[data-slot=command-separator]")).toBeNull();
    });

    it("matches keywords", async () => {
      await render(<Palette />);
      await userEvent.click(input());
      await userEvent.keyboard("smiley");
      await expect.poll(optionNames).toEqual(["Search emoji"]);
    });

    it("does not match the shortcut text", async () => {
      await render(<Palette />);
      await userEvent.click(input());
      await userEvent.keyboard("⌘");
      await expect.poll(optionNames).toEqual([]);
    });

    it("value / onValueChange control the query, and a custom filter replaces the default", async () => {
      const onValueChange = vi.fn();
      function Controlled() {
        const [value, setValue] = useState("ing");
        return (
          <Palette
            value={value}
            onValueChange={(next) => {
              onValueChange(next);
              setValue(next);
            }}
            filter={(text, query) => text.toLowerCase().startsWith(query.toLowerCase())}
          />
        );
      }
      await render(<Controlled />);
      // The default (contains) filter would match "Billing" and "Settings"; startsWith matches none.
      expect(input().value).toBe("ing");
      await expect.poll(optionNames).toEqual([]);
      await userEvent.click(input());
      await userEvent.keyboard("{Backspace}");
      await userEvent.keyboard("{Backspace}");
      await userEvent.keyboard("{Backspace}");
      await userEvent.keyboard("b");
      await expect.poll(optionNames).toEqual(["Billing"]);
      expect(onValueChange).toHaveBeenLastCalledWith("b");
    });

    it("announces the empty state in a polite live region, localisable", async () => {
      await render(
        <Command>
          <CommandInput />
          <CommandEmpty>Nothing found.</CommandEmpty>
          <CommandList>
            <CommandItem>Calendar</CommandItem>
          </CommandList>
        </Command>,
      );
      expect(status().getAttribute("role")).toBe("status");
      expect(status().getAttribute("aria-live")).toBe("polite");
      expect(status().textContent).toBe("");
      await userEvent.click(input());
      await userEvent.keyboard("zz");
      await expect.poll(() => status().textContent).toBe("Nothing found.");
      // The listbox holds no option, so it is hidden (it stays in the DOM for aria-controls).
      await expect.element(page.getByRole("listbox", { includeHidden: true })).not.toBeVisible();
      await userEvent.keyboard("{Backspace}");
      await userEvent.keyboard("{Backspace}");
      await expect.poll(() => status().textContent).toBe("");
    });

    it('CommandEmpty says "No results." by default', async () => {
      await render(<Palette />);
      await userEvent.click(input());
      await userEvent.keyboard("zz");
      await expect.poll(() => status().textContent).toBe("No results.");
    });

    it("CommandLoading is a polite status row", async () => {
      await render(
        <Command>
          <CommandInput />
          <CommandLoading />
          <CommandList />
        </Command>,
      );
      const loading = page.getByRole("status").element();
      expect(loading.getAttribute("data-slot")).toBe("command-loading");
      await expect.poll(() => loading.textContent).toBe("Loading…");
    });
  });

  describe("keyboard", () => {
    it("highlights the first item, ArrowDown / ArrowUp move, and without loop the ends hold", async () => {
      await render(<Palette />);
      await userEvent.click(input());
      await expect.poll(highlighted).toBe("Calendar");
      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(highlighted).toBe("Search emoji");
      await userEvent.keyboard("{ArrowUp}");
      await expect.poll(highlighted).toBe("Calendar");
      await userEvent.keyboard("{ArrowUp}");
      await expect.poll(highlighted).toBe("Calendar");
      await userEvent.keyboard("{End}");
      await expect.poll(highlighted).toBe("Settings");
      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(highlighted).toBe("Settings");
      await userEvent.keyboard("{Home}");
      await expect.poll(highlighted).toBe("Calendar");
      expect(input().getAttribute("aria-activedescendant")).toBe(option("Calendar").element().id);
    });

    it("loop wraps from the last item to the first and back", async () => {
      await render(<Palette loop />);
      await userEvent.click(input());
      await expect.poll(highlighted).toBe("Calendar");
      await userEvent.keyboard("{ArrowUp}");
      await expect.poll(highlighted).toBe("Settings");
      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(highlighted).toBe("Calendar");
    });

    it("under dir=rtl, End scrolls an overflowing query to its inline end (the left)", async () => {
      await render(
        <div dir="rtl">
          <Palette defaultValue={"calendar emoji profile billing settings ".repeat(4)} />
        </div>,
      );
      const element = input();
      expect(element.scrollWidth).toBeGreaterThan(element.clientWidth);
      element.focus();
      await userEvent.keyboard("{Home}");
      await expect.poll(() => element.scrollLeft).toBe(0);
      await userEvent.keyboard("{End}");
      await expect
        .poll(() => element.scrollLeft)
        .toBeLessThanOrEqual(-(element.scrollWidth - element.clientWidth - 1));
    });

    it("Home / End move within the filtered items", async () => {
      await render(<Palette />);
      await userEvent.click(input());
      await userEvent.keyboard("i");
      await expect.poll(optionNames).toEqual(["Search emoji", "Profile", "Billing", "Settings"]);
      await expect.poll(highlighted).toBe("Search emoji");
      await userEvent.keyboard("{End}");
      await expect.poll(highlighted).toBe("Settings");
      await userEvent.keyboard("{Home}");
      await expect.poll(highlighted).toBe("Search emoji");
    });

    it("Enter runs the highlighted item's onSelect; a click runs it too; a disabled item does not run", async () => {
      const onRun = vi.fn();
      await render(<Palette onRun={onRun} />);
      await userEvent.click(input());
      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(highlighted).toBe("Search emoji");
      await userEvent.keyboard("{Enter}");
      await expect.poll(() => onRun.mock.calls.map((call) => call[0])).toEqual(["Search emoji"]);
      await userEvent.click(option("Billing"));
      await expect
        .poll(() => onRun.mock.calls.map((call) => call[0]))
        .toEqual(["Search emoji", "Billing"]);
      await userEvent.keyboard("{ArrowUp}");
      await userEvent.keyboard("{ArrowUp}");
      await expect.poll(highlighted).toBe("Calculator");
      expect(option("Calculator").element().getAttribute("aria-disabled")).toBe("true");
      await userEvent.keyboard("{Enter}");
      await userEvent.click(option("Calculator"), { force: true });
      expect(onRun.mock.calls.map((call) => call[0])).toEqual(["Search emoji", "Billing"]);
    });

    it("Escape clears the query", async () => {
      await render(<Palette />);
      await userEvent.click(input());
      await userEvent.keyboard("bil");
      await expect.poll(() => input().value).toBe("bil");
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => input().value).toBe("");
      await expect.poll(() => optionNames().length).toBe(6);
    });

    it("Shift+Escape clears the query like Escape", async () => {
      await render(<Palette />);
      await userEvent.click(input());
      await userEvent.keyboard("bil");
      await expect.poll(() => input().value).toBe("bil");
      await userEvent.keyboard("{Shift>}{Escape}{/Shift}");
      await expect.poll(() => input().value).toBe("");
    });
  });

  describe("header ring", () => {
    it("sits inside the header, whose top corners match the container's radius", async () => {
      await render(<Palette />);
      await userEvent.click(input());
      const header = document.querySelector<HTMLElement>(
        "[data-slot=command-input-wrapper]",
      ) as HTMLElement;
      const root = document.querySelector<HTMLElement>("[data-slot=command]") as HTMLElement;
      const style = getComputedStyle(header);
      expect(style.outlineStyle).toBe("solid");
      expect(Number.parseFloat(style.outlineOffset)).toBeLessThanOrEqual(
        -Number.parseFloat(style.outlineWidth),
      );
      const rootRadius = getComputedStyle(root).borderTopLeftRadius;
      expect(Number.parseFloat(rootRadius)).toBeGreaterThan(0);
      expect(style.borderTopLeftRadius).toBe(rootRadius);
      expect(style.borderTopRightRadius).toBe(getComputedStyle(root).borderTopRightRadius);
      expect(style.borderBottomLeftRadius).toBe("0px");
    });

    /*
     * The popup clips its content at its padding box, whose corner radius is the popup's radius
     * minus its border. The header takes the popup's own radius (inherited through the Command),
     * which is at least that inner radius, so its inset ring curves inside the clip, and it follows
     * a `contentClassName` radius or border override.
     */
    it.each([
      ["default", undefined],
      ["overridden radius and border", "rounded-3xl border-4"],
      ["square", "rounded-none"],
    ] as const)(
      "in the dialog, the header follows the popup's radius (%s)",
      async (_, contentClassName) => {
        await render(<DialogPalette contentClassName={contentClassName} />);
        const element = await openDialogByButton();
        const header = element.querySelector<HTMLElement>(
          "[data-slot=command-input-wrapper]",
        ) as HTMLElement;
        const popupStyle = getComputedStyle(element);
        const radius = Number.parseFloat(popupStyle.borderTopLeftRadius);
        const inner = Math.max(0, radius - Number.parseFloat(popupStyle.borderTopWidth));
        const headerStyle = getComputedStyle(header);
        expect(headerStyle.outlineStyle).toBe("solid");
        expect(Number.parseFloat(headerStyle.borderTopLeftRadius)).toBeCloseTo(radius, 1);
        expect(Number.parseFloat(headerStyle.borderTopRightRadius)).toBeCloseTo(radius, 1);
        expect(Number.parseFloat(headerStyle.borderTopLeftRadius)).toBeGreaterThanOrEqual(inner);
        if (contentClassName === "rounded-3xl border-4") expect(radius).toBe(24);
        expect(Number.parseFloat(popupStyle.paddingTop)).toBe(0);
      },
    );
  });

  it.each(["light", "dark"] as const)(
    "the Default story has no axe violations (%s)",
    async (theme) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      const screen = await render(
        <div className="bg-background p-4">
          <DefaultStory {...stories.default.args} />
        </div>,
      );
      await userEvent.click(input());
      await expect
        .poll(() => document.querySelector("[role=option][data-highlighted]")?.textContent)
        .toBe("Calendar");
      expect(screen.container.contains(input())).toBe(true);
      // axe always leaves a combobox with `aria-haspopup` + `aria-controls` for review
      // (`controlsWithinPopup`); `auditOpenOverlay` drops it only after checking the idrefs resolve.
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    },
  );

  describe("forced colors", () => {
    it("the highlighted item is Highlight with HighlightText, no backplate", async () => {
      await emulateForcedColors(true);
      await render(<Palette />);
      await userEvent.click(input());
      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(highlighted).toBe("Search emoji");
      const active = option("Search emoji").element() as HTMLElement;
      const other = option("Calendar").element() as HTMLElement;
      expect(getComputedStyle(active).backgroundColor).toBe(systemColor("Highlight"));
      expect(getComputedStyle(active).color).toBe(systemColor("HighlightText"));
      expect(getComputedStyle(active).forcedColorAdjust).toBe("none");
      expect(getComputedStyle(other).forcedColorAdjust).toBe("auto");
      // The shortcut hint on a highlighted item is HighlightText too.
      await userEvent.keyboard("{End}");
      await expect.poll(highlighted).toBe("Settings");
      const hint = option("Settings").element().querySelector("[data-slot=command-shortcut]");
      expect(getComputedStyle(hint as Element).color).toBe(systemColor("HighlightText"));
      const separator = document.querySelector("[data-slot=command-separator]") as HTMLElement;
      expect(getComputedStyle(separator).backgroundColor).toBe(systemColor("CanvasText"));
    });
  });
});

describe("Command inside an overlay", () => {
  it.each(["Popover", "Drawer"] as const)(
    "in a %s, the first Escape clears the query and keeps it open, the second closes it",
    async (kind) => {
      const trigger = `Open ${kind.toLowerCase()}`;
      await render(
        kind === "Popover" ? (
          <Popover>
            <PopoverTrigger render={<Button variant="outline" />}>{trigger}</PopoverTrigger>
            <PopoverContent>
              <Palette />
            </PopoverContent>
          </Popover>
        ) : (
          <Drawer>
            <DrawerTrigger render={<Button variant="outline" />}>{trigger}</DrawerTrigger>
            <DrawerContent>
              <DrawerTitle>Commands</DrawerTitle>
              <Palette />
            </DrawerContent>
          </Drawer>
        ),
      );
      await userEvent.click(page.getByRole("button", { name: trigger }));
      const surface = () =>
        document.querySelector<HTMLElement>(
          kind === "Popover" ? "[data-slot=popover-content]" : "[data-slot=drawer-content]",
        );
      await expect.poll(() => surface() !== null).toBe(true);
      await waitForPopupSettled(surface() as HTMLElement);
      await userEvent.click(input());
      await userEvent.keyboard("bil");
      await expect.poll(() => input().value).toBe("bil");
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => input().value).toBe("");
      expect(surface()?.hasAttribute("data-ending-style")).toBe(false);
      expect(surface()?.hasAttribute("data-closed")).toBe(false);
      await userEvent.keyboard("{Escape}");
      await expect.poll(surface).toBeNull();
    },
  );
});

describe("CommandDialog", () => {
  // The tests press Ctrl+K / Ctrl+Shift+P: `mod` is Ctrl off Apple.
  beforeEach(() => {
    stubWindows();
  });

  it("opens with the shortcut, names the dialog and focuses the input", async () => {
    await render(<DialogPalette />);
    await userEvent.click(page.getByRole("button", { name: "Open palette" }));
    await expect.element(dialog()).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Open palette" })).toHaveFocus();
    await userEvent.keyboard("{Control>}k{/Control}");
    await expect.element(page.getByRole("dialog", { name: "Command menu" })).toBeVisible();
    await expect.element(page.getByRole("combobox", { name: "Command menu" })).toHaveFocus();
    await expect.element(page.getByTestId("state")).toHaveTextContent("open");
    const title = document.querySelector("[data-slot=dialog-title]") as HTMLElement;
    expect(title.className).toContain("sr-only");
    expect(title.textContent).toBe("Command menu");
  });

  it("ignores the shortcut in an editable target, and shortcut={false} disables it", async () => {
    const screen = await render(<DialogPalette />);
    await userEvent.click(page.getByRole("textbox", { name: "Notes" }));
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.keyboard("x");
    await expect
      .poll(
        () => (page.getByRole("textbox", { name: "Notes" }).element() as HTMLInputElement).value,
      )
      .toBe("x");
    expect(document.querySelector("[role=dialog]")).toBeNull();
    await screen.rerender(<DialogPalette shortcut={false} />);
    await userEvent.click(page.getByRole("button", { name: "Open palette" }));
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.keyboard("{Shift}");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it.each([
    ["a select", () => <select aria-label="Target">{<option>One</option>}</select>],
    [
      "a role=textbox",
      // biome-ignore lint/a11y/useSemanticElements: the test is about custom ARIA text widgets.
      () => <div role="textbox" aria-label="Target" tabIndex={0} />,
    ],
    [
      "a role=combobox",
      () => <div role="combobox" aria-label="Target" aria-expanded="false" tabIndex={0} />,
    ],
  ] as const)("ignores the shortcut in %s", async (_, target) => {
    await render(
      <>
        <DialogPalette />
        {target()}
      </>,
    );
    const element = document.querySelector<HTMLElement>("[aria-label=Target]") as HTMLElement;
    element.focus();
    expect(document.activeElement).toBe(element);
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.keyboard("{Shift}");
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(page.getByTestId("state").element().textContent).toBe("closed");
  });

  it("ignores the shortcut during an IME composition", async () => {
    await render(<DialogPalette />);
    const target = page.getByRole("button", { name: "Open palette" }).element();
    const press = (isComposing: boolean) =>
      target.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          code: "KeyK",
          ctrlKey: true,
          isComposing,
          bubbles: true,
          cancelable: true,
        }),
      );
    // A handled shortcut calls preventDefault, so dispatchEvent returns false.
    expect(press(true)).toBe(true);
    expect(page.getByTestId("state").element().textContent).toBe("closed");
    expect(press(false)).toBe(false);
    await expect.element(page.getByTestId("state")).toHaveTextContent("open");
  });

  it("description is a visually hidden DialogDescription that describes the dialog", async () => {
    await render(<DialogPalette description="Search for a command to run." />);
    await openDialogByButton();
    const description = document.querySelector("[data-slot=dialog-description]") as HTMLElement;
    expect(description.textContent).toBe("Search for a command to run.");
    expect(description.className).toContain("sr-only");
    await expect
      .element(page.getByRole("dialog", { name: "Command menu" }))
      .toHaveAccessibleDescription("Search for a command to run.");
  });

  it("renders no description for an empty description", async () => {
    await render(<DialogPalette description="" />);
    await openDialogByButton();
    expect(document.querySelector("[data-slot=dialog-description]")).toBeNull();
    expect(dialog().element().hasAttribute("aria-describedby")).toBe(false);
  });

  it("a custom shortcut opens it", async () => {
    await render(<DialogPalette shortcut="mod+shift+p" />);
    await userEvent.click(page.getByRole("button", { name: "Open palette" }));
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.keyboard("{Shift}");
    expect(document.querySelector("[role=dialog]")).toBeNull();
    await userEvent.keyboard("{Control>}{Shift>}P{/Shift}{/Control}");
    await expect.element(dialog()).toBeVisible();
  });

  it("Enter runs the item and closes, returning focus; preventDefault keeps it open", async () => {
    const onRun = vi.fn();
    await render(<DialogPalette onRun={onRun} keepOpen="Profile" />);
    await openDialogByButton();
    await expect.element(page.getByRole("combobox", { name: "Command menu" })).toHaveFocus();
    await userEvent.keyboard("pro");
    await expect.poll(optionNames).toEqual(["Profile"]);
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => onRun.mock.calls.length).toBe(1);
    // The open state updates in the same event, so it already reads "open" (a closing dialog
    // would still be visible during its exit transition).
    expect(page.getByTestId("state").element().textContent).toBe("open");
    expect(popup()?.hasAttribute("data-ending-style")).toBe(false);
    await userEvent.keyboard("{Backspace}");
    await userEvent.keyboard("{Backspace}");
    await userEvent.keyboard("{Backspace}");
    await userEvent.keyboard("bil");
    await expect.poll(optionNames).toEqual(["Billing"]);
    await userEvent.keyboard("{Enter}");
    await expect
      .poll(() => onRun.mock.calls.map((call) => call[0]))
      .toEqual(["Profile", "Billing"]);
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.element(page.getByTestId("state")).toHaveTextContent("closed");
    await expect.element(page.getByRole("button", { name: "Open palette" })).toHaveFocus();
  });

  it.each([
    ["Escape", "{Escape}"],
    ["Shift+Escape", "{Shift>}{Escape}{/Shift}"],
  ])(
    "%s clears the query first, then closes the dialog; nothing stops the event",
    async (_, key) => {
      const seen: string[] = [];
      const listener = (event: KeyboardEvent) => {
        if (event.key === "Escape") seen.push(input()?.value ?? "");
      };
      const windowEscapes = vi.fn();
      const windowSeen = (event: KeyboardEvent) => {
        if (event.key === "Escape") windowEscapes();
      };
      document.addEventListener("keydown", listener);
      window.addEventListener("keydown", windowSeen);
      try {
        await render(<DialogPalette />);
        await openDialogByButton();
        await userEvent.keyboard("bil");
        await expect.poll(() => input().value).toBe("bil");
        await userEvent.keyboard(key);
        await expect.poll(() => input().value).toBe("");
        // The document and window listeners still received the Escape that cleared the query.
        expect(seen).toHaveLength(1);
        expect(windowEscapes).toHaveBeenCalledTimes(1);
        expect(page.getByTestId("state").element().textContent).toBe("open");
        expect(popup()?.hasAttribute("data-ending-style")).toBe(false);
        await userEvent.keyboard(key);
        await expect.element(dialog()).not.toBeInTheDocument();
        await expect.element(page.getByTestId("state")).toHaveTextContent("closed");
        await expect.element(page.getByRole("button", { name: "Open palette" })).toHaveFocus();
      } finally {
        document.removeEventListener("keydown", listener);
        window.removeEventListener("keydown", windowSeen);
      }
    },
  );

  it("defaultOpen opens it uncontrolled", async () => {
    await render(
      <CommandDialog defaultOpen>
        <Items />
      </CommandDialog>,
    );
    await expect.element(dialog()).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
  });

  it("the Dialog story runs an item and closes; Billing keeps it open", async () => {
    await render(<DialogStory />);
    await userEvent.click(page.getByRole("button", { name: "Open command menu" }));
    await expect.element(dialog()).toBeVisible();
    await userEvent.keyboard("invoices");
    await expect.poll(optionNames).toEqual(["Billing"]);
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByText("Ran: Billing (dialog kept open)")).toBeVisible();
    expect(popup()?.hasAttribute("data-ending-style")).toBe(false);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => input().value).toBe("");
    await userEvent.keyboard("csv");
    await expect.poll(optionNames).toEqual(["Export orders"]);
    await userEvent.keyboard("{Enter}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.element(page.getByText("Ran: Export orders")).toBeVisible();
  });

  it.each(["light", "dark"] as const)("has no axe violations while open (%s)", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    await render(<DialogPalette />);
    await openDialogByButton();
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(highlighted).toBe("Search emoji");
    const { violations, incomplete } = await auditOpenOverlay();
    expect(violations).toEqual([]);
    expect(incomplete).toEqual([]);
  });
});
