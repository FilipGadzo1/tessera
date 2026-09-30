import { type ReactElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia, systemColor } from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { Button } from "../button";
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
  await resetEmulatedMedia();
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

    it("in the dialog, the header radius equals the popup's inner radius", async () => {
      await render(<DialogPalette />);
      const element = await openDialogByButton();
      const header = element.querySelector<HTMLElement>(
        "[data-slot=command-input-wrapper]",
      ) as HTMLElement;
      const popupStyle = getComputedStyle(element);
      const inner =
        Number.parseFloat(popupStyle.borderTopLeftRadius) -
        Number.parseFloat(popupStyle.borderTopWidth);
      expect(getComputedStyle(header).outlineStyle).toBe("solid");
      expect(Number.parseFloat(getComputedStyle(header).borderTopLeftRadius)).toBeCloseTo(inner, 1);
      expect(Number.parseFloat(getComputedStyle(header).borderTopRightRadius)).toBeCloseTo(
        inner,
        1,
      );
      expect(Number.parseFloat(popupStyle.paddingTop)).toBe(0);
    });
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

describe("CommandDialog", () => {
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

  it("Escape clears the query first, then closes the dialog", async () => {
    await render(<DialogPalette />);
    await openDialogByButton();
    await userEvent.keyboard("bil");
    await expect.poll(() => input().value).toBe("bil");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => input().value).toBe("");
    await expect.element(dialog()).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog()).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Open palette" })).toHaveFocus();
  });

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
