import axe from "axe-core";
import { type ReactElement, type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia, systemColor } from "../../../test/emulation";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { Button } from "../button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "../dialog";
import { Field, FieldDescription, FieldLabel } from "../field";
import { Input } from "../input";
import { Tooltip, TooltipContent, type TooltipProps, TooltipTrigger } from "../tooltip";
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteContent,
  type AutocompleteContentProps,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  type AutocompleteInputProps,
  AutocompleteItem,
  AutocompleteList,
  type AutocompleteProps,
  AutocompleteSeparator,
  AutocompleteStatus,
} from "./autocomplete";
import * as stories from "./autocomplete.stories";

const cities = ["Amsterdam", "Berlin", "Bern", "Lisbon", "Zagreb"];

interface CityProps extends Omit<AutocompleteProps<string>, "children"> {
  inputProps?: AutocompleteInputProps;
  contentProps?: AutocompleteContentProps;
  renderItem?: (item: string) => ReactNode;
}

function City({ inputProps, contentProps, renderItem, ...props }: CityProps) {
  // Padding leaves room on every side, so the popup never flips away from `side`.
  return (
    <div className="p-16">
      <Autocomplete items={cities} {...props}>
        <AutocompleteInput aria-label="City" placeholder="Search cities" {...inputProps} />
        <AutocompleteContent {...contentProps}>
          <AutocompleteEmpty>No city found.</AutocompleteEmpty>
          <AutocompleteList>
            {(item: string) =>
              renderItem?.(item) ?? (
                <AutocompleteItem key={item} value={item}>
                  {item}
                </AutocompleteItem>
              )
            }
          </AutocompleteList>
        </AutocompleteContent>
      </Autocomplete>
    </div>
  );
}

const storyByName = {
  Default: stories.Default,
  AsyncWithStatus: stories.AsyncWithStatus,
  Grouped: stories.Grouped,
  InlineAutocomplete: stories.InlineAutocomplete,
  InField: stories.InField,
  Sizes: stories.Sizes,
};

const paletteStory = () =>
  (stories.CommandPalette.render as unknown as (args: object) => ReactElement)(
    stories.default.args,
  );

const input = (name = "City") => page.getByRole("combobox", { name }).element() as HTMLInputElement;
const listbox = () => page.getByRole("listbox");
const popup = () => document.querySelector<HTMLElement>("[data-slot=autocomplete-content]");
const option = (name: string) => page.getByRole("option", { name, exact: true });
const optionNames = () =>
  [...document.querySelectorAll("[role=option]")].map((element) => element.textContent);
const groupOf = (element: Element) =>
  element.closest("[data-slot=autocomplete-input-group]") as HTMLElement;

async function settled() {
  await expect.element(listbox()).toBeVisible();
  const element = popup() as HTMLElement;
  await waitForPopupSettled(element);
  return element;
}

async function openByTyping(text = "b") {
  await userEvent.click(input());
  await userEvent.keyboard(text);
  return settled();
}

afterEach(async () => {
  document.documentElement.classList.remove("dark");
  await resetEmulatedMedia();
});

describe("Autocomplete direction", () => {
  it("under dir=rtl, End scrolls an overflowing input to its inline end (the left)", async () => {
    await render(
      <div dir="rtl">
        <City
          defaultValue={"Amsterdam Berlin Bern Lisbon Zagreb ".repeat(4)}
          inputProps={{ groupClassName: "w-40" }}
        />
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

  it("a dir=rtl wrapper (not <html>): the positioner carries dir=rtl, align start meets the right edge", async () => {
    await render(
      <div dir="rtl">
        <City
          inputProps={{ groupClassName: "w-40" }}
          contentProps={{ align: "start", className: "w-64" }}
        />
      </div>,
    );
    const element = await openByTyping();
    expect(element.parentElement?.getAttribute("dir")).toBe("rtl");
    const anchor = groupOf(input()).getBoundingClientRect();
    const p = element.getBoundingClientRect();
    expect(p.width).toBeGreaterThan(anchor.width + 20);
    expect(Math.abs(p.right - anchor.right)).toBeLessThanOrEqual(1);
  });

  it("follows a dir change on an ancestor after mount", async () => {
    const screen = await render(
      <div data-testid="host">
        <City
          defaultValue={"Amsterdam Berlin Bern Lisbon Zagreb ".repeat(4)}
          inputProps={{ groupClassName: "w-40" }}
        />
      </div>,
    );
    screen.getByTestId("host").element().setAttribute("dir", "rtl");
    const element = input();
    element.focus();
    await userEvent.keyboard("{Home}");
    await userEvent.keyboard("{End}");
    await expect
      .poll(() => element.scrollLeft)
      .toBeLessThanOrEqual(-(element.scrollWidth - element.clientWidth - 1));
  });
});

describe("Autocomplete", () => {
  describe("filtering and filling", () => {
    it("wires aria-expanded / aria-controls and opens the listbox as the user types", async () => {
      await render(<City />);
      const element = input();
      expect(element.getAttribute("aria-expanded")).toBe("false");
      await expect.element(listbox()).not.toBeInTheDocument();
      await userEvent.tab();
      expect(document.activeElement).toBe(element);
      await userEvent.keyboard("b");
      await settled();
      expect(element.getAttribute("aria-expanded")).toBe("true");
      expect(element.getAttribute("aria-controls")).toBe(listbox().element().id);
    });

    it("typing filters the suggestions", async () => {
      await render(<City />);
      await openByTyping("b");
      await expect.poll(optionNames).toEqual(["Berlin", "Bern", "Lisbon", "Zagreb"]);
      await userEvent.keyboard("er");
      await expect.poll(optionNames).toEqual(["Berlin", "Bern"]);
      await userEvent.keyboard("l");
      await expect.poll(optionNames).toEqual(["Berlin"]);
    });

    it("ArrowDown highlights, Enter fills the input and closes, keeping no selection", async () => {
      const onValueChange = vi.fn();
      await render(<City onValueChange={onValueChange} />);
      await userEvent.tab();
      await userEvent.keyboard("ber");
      await settled();
      await userEvent.keyboard("{ArrowDown}");
      await expect.element(option("Berlin")).toHaveAttribute("data-highlighted");
      await userEvent.keyboard("{Enter}");
      await expect.element(listbox()).not.toBeInTheDocument();
      expect(input().value).toBe("Berlin");
      expect(onValueChange).toHaveBeenLastCalledWith("Berlin", expect.anything());
      expect(document.activeElement).toBe(input());
    });

    it("fills the input on click", async () => {
      await render(<City />);
      await openByTyping("z");
      await userEvent.click(option("Zagreb"));
      await expect.element(listbox()).not.toBeInTheDocument();
      expect(input().value).toBe("Zagreb");
    });

    it("keeps no selection state: no aria-selected, no check indicator, regular weight", async () => {
      await render(<City defaultValue="Ber" />);
      await userEvent.click(input());
      await userEvent.keyboard("{ArrowDown}");
      await settled();
      for (const name of ["Berlin", "Bern"]) {
        const item = option(name).element() as HTMLElement;
        expect(item.hasAttribute("aria-selected")).toBe(false);
        expect(item.querySelector("svg")).toBeNull();
        expect(getComputedStyle(item).fontWeight).toBe("400");
        expect(getComputedStyle(item).paddingLeft).toBe("8px");
      }
      expect(getComputedStyle(option("Bern").element()).cursor).toBe("pointer");
    });

    it("accepts free-form text that matches nothing", async () => {
      const onValueChange = vi.fn();
      await render(<City onValueChange={onValueChange} />);
      await userEvent.click(input());
      await userEvent.keyboard("Split");
      await expect.element(page.getByText("No city found.")).toBeVisible();
      await userEvent.keyboard("{Enter}");
      expect(input().value).toBe("Split");
      expect(onValueChange).toHaveBeenLastCalledWith("Split", expect.anything());
    });

    it("never fills from a disabled item", async () => {
      await render(
        <City
          renderItem={(item) => (
            <AutocompleteItem key={item} value={item} disabled={item === "Bern"}>
              {item}
            </AutocompleteItem>
          )}
        />,
      );
      await openByTyping("bern");
      const disabled = option("Bern");
      await expect.element(disabled).toHaveAttribute("aria-disabled", "true");
      expect(getComputedStyle(disabled.element()).cursor).toBe("not-allowed");
      await userEvent.click(disabled, { force: true });
      expect(input().value).toBe("bern");
      await userEvent.keyboard("{Escape}");
    });

    it("Escape closes the list and keeps focus in the input", async () => {
      await render(<City />);
      await openByTyping("b");
      await userEvent.keyboard("{Escape}");
      await expect.element(listbox()).not.toBeInTheDocument();
      expect(document.activeElement).toBe(input());
      expect(input().getAttribute("aria-expanded")).toBe("false");
    });

    it("renders the empty state only when nothing matches, collapsing it otherwise", async () => {
      await render(<City />);
      await openByTyping("b");
      const empty = document.querySelector("[data-slot=autocomplete-empty]") as HTMLElement;
      expect(empty.getAttribute("role")).toBe("status");
      expect(empty.textContent).toBe("");
      expect(empty.getBoundingClientRect().height).toBe(0);
      await userEvent.keyboard("zzz");
      await expect.element(page.getByText("No city found.")).toBeVisible();
      expect(optionNames()).toEqual([]);
      expect(getComputedStyle(empty).paddingTop).toBe("24px");
      expect(getComputedStyle(empty).textAlign).toBe("center");
      // An empty listbox is hidden (a listbox must own options); the input still controls it.
      const list = document.querySelector("[data-slot=autocomplete-list]") as HTMLElement;
      expect(getComputedStyle(list).display).toBe("none");
      expect(input().getAttribute("aria-controls")).toBe(list.id);
    });

    it("submits the input's text through FormData under `name`", async () => {
      let data: FormData | null = null;
      await render(
        <form
          onSubmit={(event) => {
            event.preventDefault();
            data = new FormData(event.currentTarget);
          }}
        >
          <City name="city" />
          <button type="submit">Save</button>
        </form>,
      );
      await openByTyping("lis");
      await userEvent.keyboard("{ArrowDown}{Enter}");
      await userEvent.click(page.getByRole("button", { name: "Save" }));
      expect((data as FormData | null)?.get("city")).toBe("Lisbon");
    });

    it("mode='both' fills the highlighted item into the input while arrowing", async () => {
      await render(<City mode="both" />);
      await openByTyping("b");
      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(() => input().value).toBe("Berlin");
      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(() => input().value).toBe("Bern");
      await userEvent.keyboard("{Escape}");
    });
  });

  describe("trigger and clear", () => {
    it("has a chevron trigger only when asked for, named, out of the Tab order", async () => {
      await render(<City inputProps={{ showTrigger: true }} />);
      const trigger = page.getByRole("button", { name: "Show suggestions" });
      const element = trigger.element() as HTMLButtonElement;
      expect(element.tabIndex).toBe(-1);
      expect(element.getAttribute("data-slot")).toBe("autocomplete-trigger");
      expect(getComputedStyle(element).cursor).toBe("pointer");
      await userEvent.click(trigger);
      await settled();
      expect(optionNames()).toEqual(cities);
      await userEvent.keyboard("{Escape}");
    });

    it("shows no trigger by default", async () => {
      await render(<City />);
      expect(document.querySelector("[data-slot=autocomplete-trigger]")).toBeNull();
    });

    it("the clear button appears with text, clears it and refocuses the input", async () => {
      await render(<City inputProps={{ showClear: true }} />);
      expect(document.querySelector("[data-slot=autocomplete-clear]")).toBeNull();
      await userEvent.click(input());
      await userEvent.keyboard("ber");
      await userEvent.keyboard("{Escape}");
      const clear = page.getByRole("button", { name: "Clear" });
      const element = clear.element() as HTMLButtonElement;
      expect(element.tabIndex).toBe(-1);
      expect(getComputedStyle(element).cursor).toBe("pointer");
      await userEvent.click(clear);
      expect(input().value).toBe("");
      expect(document.activeElement).toBe(input());
      expect(document.querySelector("[data-slot=autocomplete-clear]")).toBeNull();
    });
  });

  describe("field look", () => {
    it("matches Input: heights per size, start padding, background and border", async () => {
      const screen = await render(
        <div className="flex flex-col gap-2">
          {(["sm", "md", "lg"] as const).map((size) => (
            <div key={size} className="flex gap-2">
              <Input aria-label={`input-${size}`} size={size} />
              <Autocomplete items={cities}>
                <AutocompleteInput aria-label={`autocomplete-${size}`} size={size} />
              </Autocomplete>
            </div>
          ))}
          <Autocomplete items={cities}>
            <AutocompleteInput aria-label="autocomplete-default" />
          </Autocomplete>
        </div>,
      );
      const heights = { sm: 32, md: 40, lg: 48 };
      for (const size of ["sm", "md", "lg"] as const) {
        const reference = screen.getByRole("textbox", { name: `input-${size}` }).element();
        const group = groupOf(input(`autocomplete-${size}`));
        expect(group.getBoundingClientRect().height).toBe(heights[size]);
        expect(group.getAttribute("data-size")).toBe(size);
        const i = getComputedStyle(reference);
        const g = getComputedStyle(group);
        expect(g.paddingLeft).toBe(i.paddingLeft);
        expect(getComputedStyle(input(`autocomplete-${size}`)).fontSize).toBe(i.fontSize);
        expect(g.backgroundColor).toBe(i.backgroundColor);
        expect(g.borderTopColor).toBe(i.borderTopColor);
        expect(g.borderRadius).toBe(i.borderRadius);
      }
      const fallback = groupOf(input("autocomplete-default"));
      expect(fallback.getAttribute("data-size")).toBe("md");
      expect(fallback.getBoundingClientRect().height).toBe(40);
    });

    it("shows a solid 1px focus-within ring on the group on Tab focus, none before", async () => {
      await render(<City />);
      const group = groupOf(input());
      expect(getComputedStyle(group).outlineStyle).toBe("none");
      expect(getComputedStyle(input()).outlineStyle).toBe("none");
      await userEvent.tab();
      expect(document.activeElement).toBe(input());
      const style = getComputedStyle(group);
      expect(style.outlineStyle).toBe("solid");
      expect(style.outlineWidth).toBe("1px");
      expect(getComputedStyle(input()).outlineStyle).toBe("none");
    });

    it("forced colors: no permanent outline on any part; the focus ring is Highlight", async () => {
      await emulateForcedColors(true);
      await render(<City defaultValue="Ber" inputProps={{ showClear: true, showTrigger: true }} />);
      const group = groupOf(input());
      const parts = [
        group,
        input(),
        page.getByRole("button", { name: "Show suggestions" }).element(),
        page.getByRole("button", { name: "Clear" }).element(),
      ];
      for (const part of parts) expect(getComputedStyle(part).outlineStyle).toBe("none");
      await userEvent.tab();
      expect(document.activeElement).toBe(input());
      expect(getComputedStyle(group).outlineStyle).toBe("solid");
      expect(getComputedStyle(group).outlineColor).toBe(systemColor("Highlight"));
    });

    it("read-only uses the muted background; disabled dims and blocks input", async () => {
      await render(
        <div>
          <Autocomplete items={cities} readOnly>
            <AutocompleteInput aria-label="Read only" />
          </Autocomplete>
          <Autocomplete items={cities} disabled>
            <AutocompleteInput aria-label="Disabled" />
          </Autocomplete>
          <div data-testid="muted" className="bg-muted" />
        </div>,
      );
      const muted = getComputedStyle(page.getByTestId("muted").element()).backgroundColor;
      expect(getComputedStyle(groupOf(input("Read only"))).backgroundColor).toBe(muted);
      expect(getComputedStyle(groupOf(input("Disabled"))).opacity).toBe("0.5");
      expect(input("Disabled").disabled).toBe(true);
      expect(getComputedStyle(input("Disabled")).cursor).toBe("not-allowed");
    });

    it("inside an invalid Field: named by the label, described, danger border on the group", async () => {
      const screen = await render(
        <div>
          <Field invalid>
            <FieldLabel>City</FieldLabel>
            <Autocomplete items={cities}>
              <AutocompleteInput placeholder="Search cities" />
            </Autocomplete>
            <FieldDescription>Where we deliver.</FieldDescription>
          </Field>
          <div data-testid="ref" className="border border-danger" />
        </div>,
      );
      const combobox = page.getByRole("combobox", { name: "City" });
      await expect.element(combobox).toHaveAccessibleDescription("Where we deliver.");
      await expect.element(combobox).toHaveAttribute("aria-invalid", "true");
      const group = groupOf(combobox.element());
      expect(group.hasAttribute("data-invalid")).toBe(true);
      expect(getComputedStyle(group).borderTopColor).toBe(
        getComputedStyle(screen.getByTestId("ref").element()).borderTopColor,
      );
    });
  });

  describe("status", () => {
    it("renders a muted polite live region that collapses when empty", async () => {
      function WithStatus() {
        const [text, setText] = useState("");
        return (
          <div className="p-16">
            <Autocomplete items={cities} onOpenChange={() => setText("")}>
              <AutocompleteInput aria-label="City" />
              <AutocompleteContent>
                <AutocompleteStatus>{text}</AutocompleteStatus>
                <AutocompleteList>
                  {(item: string) => (
                    <AutocompleteItem key={item} value={item}>
                      {item}
                    </AutocompleteItem>
                  )}
                </AutocompleteList>
              </AutocompleteContent>
            </Autocomplete>
            <button type="button" onClick={() => setText("5 results")}>
              Announce
            </button>
          </div>
        );
      }
      await render(<WithStatus />);
      await openByTyping("b");
      const status = document.querySelector("[data-slot=autocomplete-status]") as HTMLElement;
      expect(status.getAttribute("role")).toBe("status");
      expect(status.getAttribute("aria-live")).toBe("polite");
      expect(status.getBoundingClientRect().height).toBe(0);
      (document.querySelector("button") as HTMLButtonElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await expect.poll(() => status.textContent).toBe("5 results");
      const style = getComputedStyle(status);
      expect(style.paddingTop).toBe("6px");
      expect(style.fontSize).toBe("14px");
      const muted = document.createElement("div");
      muted.className = "text-muted-foreground";
      document.body.append(muted);
      expect(style.color).toBe(getComputedStyle(muted).color);
      muted.remove();
      await userEvent.keyboard("{Escape}");
    });
  });

  describe("structure", () => {
    it("sets data-slot on every part and merges className", async () => {
      await render(
        <div className="p-16">
          <Autocomplete items={cities} defaultOpen>
            <AutocompleteInput
              aria-label="City"
              showClear
              showTrigger
              className="input-x"
              groupClassName="group-x"
            />
            <AutocompleteContent className="content-x">
              <AutocompleteStatus className="status-x" />
              <AutocompleteEmpty className="empty-x" />
              <AutocompleteList className="list-x">
                <AutocompleteGroup className="group-part-x">
                  <AutocompleteGroupLabel className="label-x">Cities</AutocompleteGroupLabel>
                  <AutocompleteItem value="Bern" className="item-x">
                    Bern
                  </AutocompleteItem>
                </AutocompleteGroup>
                <AutocompleteSeparator className="separator-x" />
                <AutocompleteItem value="Lisbon">Lisbon</AutocompleteItem>
              </AutocompleteList>
            </AutocompleteContent>
          </Autocomplete>
        </div>,
      );
      await settled();
      const slots = {
        "autocomplete-input-group": "group-x",
        "autocomplete-input": "input-x",
        "autocomplete-content": "content-x",
        "autocomplete-status": "status-x",
        "autocomplete-empty": "empty-x",
        "autocomplete-list": "list-x",
        "autocomplete-group": "group-part-x",
        "autocomplete-group-label": "label-x",
        "autocomplete-item": "item-x",
        "autocomplete-separator": "separator-x",
      };
      for (const [slot, className] of Object.entries(slots)) {
        const element = document.querySelector(`[data-slot=${slot}]`);
        expect(element, slot).not.toBeNull();
        expect(element?.classList.contains(className), slot).toBe(true);
      }
      // Trigger and clear render only with a value / text to clear; the trigger is aria-hidden
      // while open, but present.
      expect(document.querySelector("[data-slot=autocomplete-trigger]")).not.toBeNull();
      await userEvent.keyboard("{Escape}");
    });

    it("merges a function-form className on the item", async () => {
      await render(
        <City
          contentProps={{ className: "custom-popup" }}
          renderItem={(item) => (
            <AutocompleteItem
              key={item}
              value={item}
              className={(state) => (state.highlighted ? "is-hot" : "not-hot")}
            >
              {item}
            </AutocompleteItem>
          )}
        />,
      );
      await openByTyping("b");
      expect(option("Bern").element().classList.contains("not-hot")).toBe(true);
      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(() => option("Berlin").element().classList.contains("is-hot")).toBe(true);
      expect(popup()?.classList.contains("custom-popup")).toBe(true);
      await userEvent.keyboard("{Escape}");
    });

    it("sits below the input group, start-aligned, 6px away, at least as wide", async () => {
      await render(<City />);
      await openByTyping("b");
      const group = groupOf(input()).getBoundingClientRect();
      const positioner = (popup() as HTMLElement).parentElement as HTMLElement;
      const rect = positioner.getBoundingClientRect();
      expect(rect.left).toBeCloseTo(group.left, 0);
      expect(rect.top - group.bottom).toBeCloseTo(6, 0);
      expect(rect.width).toBeGreaterThanOrEqual(group.width - 1);
    });

    it("uses the popover surface colours and the overlay z-index, portalled to body", async () => {
      const screen = await render(
        <div>
          <City />
          <div data-testid="surface" className="bg-popover text-popover-foreground" />
        </div>,
      );
      await openByTyping("b");
      const element = popup() as HTMLElement;
      const reference = getComputedStyle(screen.getByTestId("surface").element());
      expect(getComputedStyle(element).backgroundColor).toBe(reference.backgroundColor);
      expect(getComputedStyle(element).color).toBe(reference.color);
      expect(element.parentElement?.parentElement?.parentElement).toBe(document.body);
      expect(getComputedStyle(element.parentElement as HTMLElement).zIndex).not.toBe("auto");
      await userEvent.keyboard("{Escape}");
    });

    it("caps the popup height at 20rem and scrolls", async () => {
      const many = Array.from({ length: 60 }, (_, index) => `Town ${index + 1}`);
      await render(
        <div className="p-16">
          <Autocomplete items={many}>
            <AutocompleteInput aria-label="Town" />
            <AutocompleteContent>
              <AutocompleteList>
                {(item: string) => (
                  <AutocompleteItem key={item} value={item}>
                    {item}
                  </AutocompleteItem>
                )}
              </AutocompleteList>
            </AutocompleteContent>
          </Autocomplete>
        </div>,
      );
      await userEvent.click(input("Town"));
      await userEvent.keyboard("town");
      const element = await settled();
      expect(element.getBoundingClientRect().height).toBeLessThanOrEqual(320);
      expect(element.scrollHeight).toBeGreaterThan(element.clientHeight);
      expect(getComputedStyle(element).overflowY).toBe("auto");
      await userEvent.keyboard("{Escape}");
    });

    it("keeps AutocompleteSeparator visible in forced colors", async () => {
      await emulateForcedColors(true);
      expect(matchMedia("(forced-colors: active)").matches).toBe(true);
      await render(
        <div className="p-16">
          <Autocomplete items={cities} defaultOpen>
            <AutocompleteInput aria-label="City" />
            <AutocompleteContent>
              <AutocompleteList>
                <AutocompleteGroup>
                  <AutocompleteGroupLabel>Cities</AutocompleteGroupLabel>
                  <AutocompleteItem value="Bern">Bern</AutocompleteItem>
                </AutocompleteGroup>
                <AutocompleteSeparator data-testid="sep" />
                <AutocompleteItem value="Lisbon">Lisbon</AutocompleteItem>
              </AutocompleteList>
            </AutocompleteContent>
          </Autocomplete>
        </div>,
      );
      const sep = document.querySelector('[data-testid="sep"]') as HTMLElement;
      const style = getComputedStyle(sep);
      expect(style.backgroundColor).toBe(systemColor("CanvasText"));
      expect(style.backgroundColor).not.toBe(systemColor("Canvas"));
    });

    it("filters grouped items with AutocompleteCollection and hides groups without matches", async () => {
      const groups = [
        { value: "Germany", items: ["Berlin", "Bonn"] },
        { value: "Portugal", items: ["Lisbon", "Porto"] },
      ];
      await render(
        <div className="p-16">
          <Autocomplete items={groups}>
            <AutocompleteInput aria-label="City" />
            <AutocompleteContent>
              <AutocompleteList>
                {(group: (typeof groups)[number]) => (
                  <AutocompleteGroup key={group.value} items={group.items}>
                    <AutocompleteGroupLabel>{group.value}</AutocompleteGroupLabel>
                    <AutocompleteCollection>
                      {(city: string) => (
                        <AutocompleteItem key={city} value={city}>
                          {city}
                        </AutocompleteItem>
                      )}
                    </AutocompleteCollection>
                  </AutocompleteGroup>
                )}
              </AutocompleteList>
            </AutocompleteContent>
          </Autocomplete>
        </div>,
      );
      await userEvent.click(input());
      await userEvent.keyboard("on");
      await settled();
      await expect.poll(optionNames).toEqual(["Bonn", "Lisbon"]);
      expect(document.querySelectorAll("[data-slot=autocomplete-group]")).toHaveLength(2);
      await userEvent.keyboard("{Backspace}{Backspace}bonn");
      await expect.poll(optionNames).toEqual(["Bonn"]);
      expect(document.querySelectorAll("[data-slot=autocomplete-group]")).toHaveLength(1);
      await userEvent.keyboard("{Escape}");
    });
  });

  describe("forced colors", () => {
    it("the highlighted item has a ring, the others none", async () => {
      await emulateForcedColors(true);
      await render(<City />);
      await openByTyping("b");
      const names = ["Berlin", "Bern", "Lisbon", "Zagreb"];
      for (const name of names) {
        expect(getComputedStyle(option(name).element()).outlineStyle).toBe("none");
      }
      await userEvent.keyboard("{ArrowDown}");
      const active = option("Berlin").element();
      await expect.poll(() => active.hasAttribute("data-highlighted")).toBe(true);
      expect(getComputedStyle(active).outlineStyle).toBe("solid");
      expect(Number.parseFloat(getComputedStyle(active).outlineWidth)).toBeGreaterThanOrEqual(1);
      for (const name of names.slice(1)) {
        expect(getComputedStyle(option(name).element()).outlineStyle).toBe("none");
      }
      await userEvent.keyboard("{Escape}");
    });
  });

  describe("layering", () => {
    // The CommandPalette story now renders a CommandDialog (built on Autocomplete); the Command
    // suite covers it in depth, these keep the story working.
    it("the command palette story (CommandDialog) filters, runs the item and closes", async () => {
      await render(paletteStory());
      await userEvent.click(page.getByRole("button", { name: "Open command palette" }));
      await expect.element(page.getByRole("dialog")).toBeVisible();
      const field = page.getByRole("combobox", { name: "Command menu" });
      await expect.element(field).toHaveFocus();
      // Inline + open: the list is always there, inside the dialog, no popup of its own.
      await expect.element(listbox()).toBeVisible();
      expect(popup()).toBeNull();
      expect(page.getByRole("dialog").element().contains(listbox().element())).toBe(true);
      expect(optionNames().length).toBe(6);
      await userEvent.keyboard("bill");
      await expect.poll(optionNames).toEqual(["Open billingAccount"]);
      await userEvent.keyboard("{Enter}");
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
      await expect.element(page.getByText("Ran: Open billing")).toBeVisible();
    });

    it("shows the empty state in the palette when nothing matches", async () => {
      await render(paletteStory());
      await userEvent.click(page.getByRole("button", { name: "Open command palette" }));
      await expect.element(page.getByRole("dialog")).toBeVisible();
      await userEvent.keyboard("zzzz");
      await expect.element(page.getByText("No results.")).toBeVisible();
      expect(optionNames()).toEqual([]);
    });

    it("Escape in the palette clears the typed text first, then closes the dialog", async () => {
      await render(paletteStory());
      await userEvent.click(page.getByRole("button", { name: "Open command palette" }));
      await expect.element(page.getByRole("dialog")).toBeVisible();
      await userEvent.keyboard("bill");
      await expect.poll(() => input("Command menu").value).toBe("bill");
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => input("Command menu").value).toBe("");
      await expect.element(page.getByRole("dialog")).toBeVisible();
      await userEvent.keyboard("{Escape}");
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
      await expect
        .element(page.getByRole("button", { name: "Open command palette" }))
        .toHaveFocus();
    });

    it("works inside a modal Dialog: Escape closes the list, then clears the text, then the dialog", async () => {
      await render(
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>Edit address</DialogTrigger>
          <DialogContent>
            <DialogTitle>Edit address</DialogTitle>
            <DialogDescription>Pick a city.</DialogDescription>
            <City />
          </DialogContent>
        </Dialog>,
      );
      await userEvent.click(page.getByRole("button", { name: "Edit address" }));
      await expect.element(page.getByRole("dialog")).toBeVisible();
      await openByTyping("lis");
      await userEvent.click(option("Lisbon"));
      await expect.element(listbox()).not.toBeInTheDocument();
      expect(input().value).toBe("Lisbon");
      await expect.element(page.getByRole("dialog")).toBeVisible();

      await userEvent.keyboard("{ArrowDown}");
      await settled();
      await userEvent.keyboard("{Escape}");
      await expect.element(listbox()).not.toBeInTheDocument();
      await expect.element(page.getByRole("dialog")).toBeVisible();
      expect(document.activeElement).toBe(input());
      // Base UI: Escape on a closed autocomplete with text clears the text (and stops there).
      await userEvent.keyboard("{Escape}");
      expect(input().value).toBe("");
      await expect.element(page.getByRole("dialog")).toBeVisible();
      await userEvent.keyboard("{Escape}");
      await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    });

    describe("with a Tooltip open inside the popup", () => {
      const tooltipSpy = vi.fn<NonNullable<TooltipProps["onOpenChange"]>>();
      const appKeys: string[] = [];
      const appListener = (event: KeyboardEvent) => {
        if (event.key === "Escape") appKeys.push(event.key);
      };
      beforeEach(() => {
        tooltipSpy.mockReset();
        appKeys.length = 0;
        document.addEventListener("keydown", appListener);
      });
      afterEach(() => {
        document.removeEventListener("keydown", appListener);
      });

      it("the first Escape closes only the tooltip, the second the list; the app still hears it", async () => {
        const onOpenChange = vi.fn();
        await render(
          <City
            onOpenChange={onOpenChange}
            renderItem={(item) => (
              <AutocompleteItem key={item} value={item}>
                {item}
                {item === "Bern" && (
                  <Tooltip onOpenChange={tooltipSpy}>
                    <TooltipTrigger delay={0} closeDelay={0} render={<span data-testid="info" />}>
                      (capital)
                    </TooltipTrigger>
                    <TooltipContent>Capital of Switzerland</TooltipContent>
                  </Tooltip>
                )}
              </AutocompleteItem>
            )}
          />,
        );
        await openByTyping("b");
        await userEvent.hover(page.getByTestId("info"));
        await expect.element(page.getByRole("tooltip")).toBeVisible();
        const tooltip = document.querySelector("[data-slot=tooltip-content]") as HTMLElement;
        await waitForPopupSettled(tooltip);

        await userEvent.keyboard("{Escape}");
        await expect.poll(() => document.querySelector("[data-slot=tooltip-content]")).toBeNull();
        expect(popup()).not.toBeNull();
        expect(appKeys).toEqual(["Escape"]);
        expect(tooltipSpy).toHaveBeenLastCalledWith(
          false,
          expect.objectContaining({ reason: "escape-key" }),
        );
        expect(onOpenChange.mock.calls.filter(([open]) => open === false)).toHaveLength(0);

        await userEvent.keyboard("{Escape}");
        await expect.element(listbox()).not.toBeInTheDocument();
        expect(onOpenChange).toHaveBeenLastCalledWith(
          false,
          expect.objectContaining({ reason: "escape-key" }),
        );
        await userEvent.unhover(page.getByTestId("info"));
      });
    });
  });

  describe("accessibility", () => {
    it.each(["light", "dark"] as const)("has no axe violations while open (%s)", async (theme) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      try {
        await render(
          <div className="bg-background p-16">
            <Field>
              <FieldLabel>City</FieldLabel>
              <Autocomplete items={cities}>
                <AutocompleteInput showClear showTrigger />
                <AutocompleteContent>
                  <AutocompleteEmpty>No city found.</AutocompleteEmpty>
                  <AutocompleteList>
                    {(item: string) => (
                      <AutocompleteItem key={item} value={item}>
                        {item}
                      </AutocompleteItem>
                    )}
                  </AutocompleteList>
                </AutocompleteContent>
              </Autocomplete>
            </Field>
          </div>,
        );
        await userEvent.click(page.getByRole("combobox", { name: "City" }));
        await userEvent.keyboard("b");
        await settled();
        await userEvent.keyboard("{ArrowDown}");
        let result = await auditOpenOverlay();
        expect(result.violations).toEqual([]);
        expect(result.incomplete).toEqual([]);
        await userEvent.keyboard("zzz");
        await expect.element(page.getByText("No city found.")).toBeVisible();
        result = await auditOpenOverlay();
        expect(result.violations).toEqual([]);
        expect(result.incomplete).toEqual([]);
        await userEvent.keyboard("{Escape}");
      } finally {
        document.documentElement.classList.remove("dark");
      }
    });

    it.each(["light", "dark"] as const)(
      "has no axe violations while closed and invalid (%s)",
      async (theme) => {
        if (theme === "dark") document.documentElement.classList.add("dark");
        try {
          const screen = await render(
            <div className="bg-background p-4">
              <Field invalid>
                <FieldLabel>City</FieldLabel>
                <Autocomplete items={cities}>
                  <AutocompleteInput size="sm" placeholder="Search cities" />
                </Autocomplete>
              </Field>
            </div>,
          );
          const results = await axe.run(screen.container);
          expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
          expect(results.incomplete.map((v) => v.id)).toEqual([]);
        } finally {
          document.documentElement.classList.remove("dark");
        }
      },
    );

    const storyNames = [
      "Default",
      "AsyncWithStatus",
      "Grouped",
      "InlineAutocomplete",
      "InField",
      "Sizes",
    ] as const;
    it.each(storyNames)("story %s: the input is named, no axe violations", async (name) => {
      const story = storyByName[name] as { render?: unknown; args?: object };
      const renderStory = (story.render ?? stories.default.render) as unknown as (
        args: object,
      ) => ReactElement;
      const screen = await render(
        <div className="bg-background p-4">
          {renderStory({ ...stories.default.args, ...story.args })}
        </div>,
      );
      const inputs = screen.container.querySelectorAll<HTMLInputElement>("input[role=combobox]");
      expect(inputs.length).toBeGreaterThan(0);
      const results = await axe.run(screen.container);
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      expect(results.incomplete.map((v) => v.id)).toEqual([]);
    });
  });
});
