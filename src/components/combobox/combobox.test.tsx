import axe from "axe-core";
import { type ReactElement, type ReactNode, useRef } from "react";
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
  Combobox,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxCollection,
  ComboboxContent,
  type ComboboxContentProps,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  type ComboboxInputProps,
  ComboboxItem,
  ComboboxList,
  type ComboboxProps,
  ComboboxSeparator,
  ComboboxStatus,
  ComboboxValue,
} from "./combobox";
import * as stories from "./combobox.stories";

const fruits = ["Apple", "Banana", "Blueberry", "Cherry", "Grape"];

interface FruitProps extends Omit<ComboboxProps<string>, "children"> {
  inputProps?: ComboboxInputProps;
  contentProps?: ComboboxContentProps;
  renderItem?: (item: string) => ReactNode;
}

function Fruit({ inputProps, contentProps, renderItem, ...props }: FruitProps) {
  // Padding leaves room on every side, so the popup never flips away from `side`.
  return (
    <div className="p-16">
      <Combobox items={fruits} {...props}>
        <ComboboxInput aria-label="Fruit" placeholder="Search fruit" {...inputProps} />
        <ComboboxContent {...contentProps}>
          <ComboboxEmpty>No fruit found.</ComboboxEmpty>
          <ComboboxList>
            {(item: string) =>
              renderItem?.(item) ?? (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )
            }
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

const toppings = ["Cheese", "Mushrooms", "Olives", "Onions", "Peppers"];

function Toppings(props: Omit<ComboboxProps<string, true>, "children" | "multiple">) {
  return (
    <div className="p-16">
      <Combobox items={toppings} multiple {...props}>
        <ComboboxChips>
          <ComboboxValue>
            {(values: string[]) =>
              values.map((value) => (
                <ComboboxChip key={value}>
                  {value}
                  <ComboboxChipRemove />
                </ComboboxChip>
              ))
            }
          </ComboboxValue>
          <ComboboxInput aria-label="Toppings" placeholder="Add toppings" />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxEmpty>No toppings found.</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

const input = (name = "Fruit") =>
  page.getByRole("combobox", { name }).element() as HTMLInputElement;
const listbox = () => page.getByRole("listbox");
const popup = () => document.querySelector<HTMLElement>("[data-slot=combobox-content]");
const option = (name: string) => page.getByRole("option", { name, exact: true });
const optionNames = () =>
  [...document.querySelectorAll("[role=option]")].map((element) => element.textContent);
const groupOf = (element: Element) =>
  element.closest("[data-slot=combobox-input-group]") as HTMLElement;
const chipsOf = (element: Element) => element.closest("[data-slot=combobox-chips]") as HTMLElement;
const chipTexts = () =>
  [...document.querySelectorAll("[data-slot=combobox-chip]")].map((chip) => chip.textContent);

async function settled() {
  await expect.element(listbox()).toBeVisible();
  const element = popup() as HTMLElement;
  await waitForPopupSettled(element);
  return element;
}

async function openByClick(name = "Fruit") {
  await userEvent.click(input(name));
  return settled();
}

afterEach(async () => {
  document.documentElement.classList.remove("dark");
  await resetEmulatedMedia();
});

describe("Combobox", () => {
  describe("filtering and selecting", () => {
    it("wires aria-expanded / aria-controls and opens the listbox as the user types", async () => {
      await render(<Fruit />);
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

    it("typing filters the list", async () => {
      await render(<Fruit />);
      await openByClick();
      expect(optionNames()).toEqual(fruits);
      await userEvent.keyboard("an");
      await expect.poll(optionNames).toEqual(["Banana"]);
      await userEvent.keyboard("{Backspace}{Backspace}ber");
      await expect.poll(optionNames).toEqual(["Blueberry"]);
    });

    it("ArrowDown highlights, Enter selects, fills the input and closes", async () => {
      const onValueChange = vi.fn();
      await render(<Fruit onValueChange={onValueChange} />);
      await userEvent.tab();
      await userEvent.keyboard("ch");
      await settled();
      await userEvent.keyboard("{ArrowDown}");
      await expect.element(option("Cherry")).toHaveAttribute("data-highlighted");
      await userEvent.keyboard("{Enter}");
      await expect.element(listbox()).not.toBeInTheDocument();
      expect(input().value).toBe("Cherry");
      expect(onValueChange).toHaveBeenLastCalledWith("Cherry", expect.anything());
      expect(document.activeElement).toBe(input());
    });

    it("selects on click", async () => {
      await render(<Fruit />);
      await openByClick();
      await userEvent.click(option("Grape"));
      await expect.element(listbox()).not.toBeInTheDocument();
      expect(input().value).toBe("Grape");
    });

    it("Escape closes the list and keeps focus in the input", async () => {
      await render(<Fruit />);
      await openByClick();
      await userEvent.keyboard("{Escape}");
      await expect.element(listbox()).not.toBeInTheDocument();
      expect(document.activeElement).toBe(input());
      expect(input().getAttribute("aria-expanded")).toBe("false");
    });

    it("renders the empty state only when nothing matches, collapsing it otherwise", async () => {
      await render(<Fruit />);
      await openByClick();
      const empty = document.querySelector("[data-slot=combobox-empty]") as HTMLElement;
      expect(empty.getAttribute("role")).toBe("status");
      expect(empty.textContent).toBe("");
      expect(empty.getBoundingClientRect().height).toBe(0);
      await userEvent.keyboard("zzz");
      await expect.element(page.getByText("No fruit found.")).toBeVisible();
      expect(optionNames()).toEqual([]);
      expect(getComputedStyle(empty).paddingTop).toBe("24px");
      // An empty listbox is hidden (a listbox must own options); the input still controls it.
      const list = document.querySelector("[data-slot=combobox-list]") as HTMLElement;
      expect(getComputedStyle(list).display).toBe("none");
      expect(input().getAttribute("aria-controls")).toBe(list.id);
      expect(getComputedStyle(empty).textAlign).toBe("center");
    });

    it("marks only the selected item with aria-selected, the check indicator and font-medium", async () => {
      await render(<Fruit defaultValue="Banana" />);
      await userEvent.click(page.getByRole("button", { name: "Show options" }));
      await settled();
      const selected = option("Banana").element() as HTMLElement;
      expect(selected.getAttribute("aria-selected")).toBe("true");
      expect(selected.querySelector("[data-slot=combobox-item-indicator] svg")).not.toBeNull();
      expect(getComputedStyle(selected).fontWeight).toBe("500");
      for (const name of ["Apple", "Cherry"]) {
        const other = option(name).element() as HTMLElement;
        expect(other.getAttribute("aria-selected")).toBe("false");
        expect(other.querySelector("[data-slot=combobox-item-indicator]")).toBeNull();
        expect(getComputedStyle(other).fontWeight).toBe("400");
      }
      expect(getComputedStyle(selected).cursor).toBe("pointer");
      expect(getComputedStyle(selected).paddingLeft).toBe("32px");
    });

    it("never selects a disabled item", async () => {
      const onValueChange = vi.fn();
      await render(
        <Fruit
          onValueChange={onValueChange}
          renderItem={(item) => (
            <ComboboxItem key={item} value={item} disabled={item === "Banana"}>
              {item}
            </ComboboxItem>
          )}
        />,
      );
      await openByClick();
      const disabled = option("Banana");
      await expect.element(disabled).toHaveAttribute("aria-disabled", "true");
      expect(getComputedStyle(disabled.element()).cursor).toBe("not-allowed");
      await userEvent.click(disabled, { force: true });
      expect(onValueChange).not.toHaveBeenCalled();
      await userEvent.keyboard("{Escape}");
    });

    it("uses itemToStringLabel for the input and itemToStringValue for the form", async () => {
      interface Country {
        code: string;
        name: string;
      }
      const countries: Country[] = [
        { code: "de", name: "Germany" },
        { code: "fr", name: "France" },
        { code: "hr", name: "Croatia" },
      ];
      let data: FormData | null = null;
      await render(
        <form
          onSubmit={(event) => {
            event.preventDefault();
            data = new FormData(event.currentTarget);
          }}
        >
          <div className="p-16">
            <Combobox
              items={countries}
              name="country"
              itemToStringLabel={(country: Country) => country.name}
              itemToStringValue={(country: Country) => country.code}
            >
              <ComboboxInput aria-label="Country" />
              <ComboboxContent>
                <ComboboxList>
                  {(country: Country) => (
                    <ComboboxItem key={country.code} value={country}>
                      {country.name}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <button type="submit">Save</button>
        </form>,
      );
      await openByClick("Country");
      await userEvent.keyboard("cro");
      await expect.poll(optionNames).toEqual(["Croatia"]);
      await userEvent.click(option("Croatia"));
      expect(input("Country").value).toBe("Croatia");
      await userEvent.click(page.getByRole("button", { name: "Save" }));
      await expect.poll(() => data?.get("country")).toBe("hr");
    });

    it("submits the value through the hidden input (FormData)", async () => {
      let data: FormData | null = null;
      await render(
        <form
          onSubmit={(event) => {
            event.preventDefault();
            data = new FormData(event.currentTarget);
          }}
        >
          <Fruit name="fruit" defaultValue="Cherry" />
          <button type="submit">Save</button>
        </form>,
      );
      await userEvent.click(page.getByRole("button", { name: "Save" }));
      await expect.poll(() => data?.get("fruit")).toBe("Cherry");
    });

    it("filters grouped items and hides groups without matches", async () => {
      const produce = [
        { value: "Fruits", items: ["Apple", "Banana"] },
        { value: "Vegetables", items: ["Carrot", "Spinach"] },
      ];
      await render(
        <div className="p-16">
          <Combobox items={produce}>
            <ComboboxInput aria-label="Produce" />
            <ComboboxContent>
              <ComboboxList>
                {(group: (typeof produce)[number]) => (
                  <ComboboxGroup key={group.value} items={group.items}>
                    <ComboboxGroupLabel>{group.value}</ComboboxGroupLabel>
                    <ComboboxCollection>
                      {(item: string) => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxCollection>
                  </ComboboxGroup>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>,
      );
      await openByClick("Produce");
      expect(page.getByRole("group", { name: "Fruits" }).element()).toBeTruthy();
      expect(page.getByRole("group", { name: "Vegetables" }).element()).toBeTruthy();
      await userEvent.keyboard("spin");
      await expect.poll(optionNames).toEqual(["Spinach"]);
      await expect.element(page.getByRole("group", { name: "Fruits" })).not.toBeInTheDocument();
    });
  });

  describe("trigger and clear", () => {
    it("a disabled trigger keeps its colour on hover", async () => {
      await render(<Fruit disabled />);
      const trigger = document.querySelector("[data-slot=combobox-trigger]") as HTMLElement;
      expect(trigger.hasAttribute("data-disabled")).toBe(true);
      const color = getComputedStyle(trigger).color;
      await userEvent.hover(trigger);
      expect(trigger.matches(":hover")).toBe(true);
      expect(getComputedStyle(trigger).color).toBe(color);
    });

    it("the trigger is named, out of the Tab order, and toggles the list", async () => {
      await render(<Fruit />);
      const trigger = page.getByRole("button", { name: "Show options" });
      const element = trigger.element() as HTMLButtonElement;
      expect(element.tabIndex).toBe(-1);
      expect(element.getAttribute("data-slot")).toBe("combobox-trigger");
      expect(getComputedStyle(element).cursor).toBe("pointer");
      await userEvent.click(trigger);
      await settled();
      expect(optionNames()).toEqual(fruits);
      // Base UI hides the trigger from assistive tech (aria-hidden) while the list is open.
      expect(element.getAttribute("aria-hidden")).toBe("true");
      await userEvent.click(element);
      await expect.element(listbox()).not.toBeInTheDocument();
      // Pressing the trigger keeps focus in the input; Tab then leaves the field.
      expect(document.activeElement).toBe(input());
      await userEvent.tab();
      expect(document.activeElement).not.toBe(element);
      expect(groupOf(input()).contains(document.activeElement)).toBe(false);
    });

    it("showTrigger={false} hides the trigger", async () => {
      await render(<Fruit inputProps={{ showTrigger: false }} />);
      await expect
        .element(page.getByRole("button", { name: "Show options" }))
        .not.toBeInTheDocument();
    });

    it("the clear button appears with a value, clears it and refocuses the input", async () => {
      const onValueChange = vi.fn();
      await render(
        <Fruit
          defaultValue="Apple"
          onValueChange={onValueChange}
          inputProps={{ showClear: true }}
        />,
      );
      const clear = page.getByRole("button", { name: "Clear" });
      await expect.element(clear).toBeVisible();
      expect((clear.element() as HTMLButtonElement).tabIndex).toBe(-1);
      expect(clear.element().getAttribute("data-slot")).toBe("combobox-clear");
      expect(input().value).toBe("Apple");
      await userEvent.click(clear);
      expect(input().value).toBe("");
      expect(onValueChange).toHaveBeenLastCalledWith(null, expect.anything());
      expect(document.activeElement).toBe(input());
      await expect.element(clear).not.toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
    });
  });

  describe("multiple with chips", () => {
    it("adds a chip per selected item and keeps the list open", async () => {
      const onValueChange = vi.fn();
      await render(<Toppings defaultValue={[]} onValueChange={onValueChange} />);
      await openByClick("Toppings");
      await expect.element(listbox()).toHaveAttribute("aria-multiselectable", "true");
      await userEvent.click(option("Cheese"));
      await userEvent.click(option("Olives"));
      await expect.element(listbox()).toBeVisible();
      expect(chipTexts()).toEqual(["Cheese", "Olives"]);
      expect(onValueChange).toHaveBeenLastCalledWith(["Cheese", "Olives"], expect.anything());
      await userEvent.keyboard("{Escape}");
    });

    it("Backspace in the empty input removes the last chip", async () => {
      await render(<Toppings defaultValue={["Cheese", "Olives", "Onions"]} />);
      await userEvent.tab();
      expect(document.activeElement).toBe(input("Toppings"));
      await userEvent.keyboard("{Backspace}");
      await expect.poll(chipTexts).toEqual(["Cheese", "Olives"]);
    });

    it("a chip's remove button removes that chip and refocuses the input", async () => {
      await render(<Toppings defaultValue={["Cheese", "Olives"]} />);
      const removes = page.getByRole("button", { name: "Remove" });
      const first = removes.first().element() as HTMLButtonElement;
      expect(first.tabIndex).toBe(-1);
      expect(first.getAttribute("data-slot")).toBe("combobox-chip-remove");
      await userEvent.click(removes.first());
      await expect.poll(chipTexts).toEqual(["Olives"]);
      expect(document.activeElement).toBe(input("Toppings"));
      await userEvent.keyboard("{Escape}");
    });

    it("ArrowLeft moves focus onto the last chip with a 2px focus ring; Delete removes it", async () => {
      await render(<Toppings defaultValue={["Cheese", "Olives"]} />);
      await userEvent.tab();
      await userEvent.keyboard("{ArrowLeft}");
      const chips = document.querySelectorAll<HTMLElement>("[data-slot=combobox-chip]");
      const last = chips[1] as HTMLElement;
      expect(getComputedStyle(chips[0] as HTMLElement).outlineStyle).toBe("none");
      await expect.poll(() => document.activeElement).toBe(last);
      const style = getComputedStyle(last);
      expect(style.outlineStyle).toBe("solid");
      expect(style.outlineWidth).toBe("2px");
      await userEvent.keyboard("{Delete}");
      await expect.poll(chipTexts).toEqual(["Cheese"]);
    });

    it("submits every value (FormData)", async () => {
      let data: FormData | null = null;
      await render(
        <form
          onSubmit={(event) => {
            event.preventDefault();
            data = new FormData(event.currentTarget);
          }}
        >
          <Toppings name="toppings" defaultValue={["Cheese", "Onions"]} />
          <button type="submit">Save</button>
        </form>,
      );
      await userEvent.click(page.getByRole("button", { name: "Save" }));
      await expect.poll(() => data?.getAll("toppings")).toEqual(["Cheese", "Onions"]);
    });

    it("anchors the list to the chips field (full width), not the inner input", async () => {
      await render(<Toppings defaultValue={["Cheese"]} />);
      const element = await openByClick("Toppings");
      const chips = chipsOf(input("Toppings")).getBoundingClientRect();
      const p = element.getBoundingClientRect();
      expect(Math.round(p.left)).toBe(Math.round(chips.left));
      expect(Math.round(p.top - chips.bottom)).toBe(6);
      expect(p.width).toBeGreaterThanOrEqual(Math.floor(chips.width));
      await userEvent.keyboard("{Escape}");
    });

    it("forwards a ref to the chips element and still anchors the list to it", async () => {
      const objectRef = { current: null as HTMLDivElement | null };
      const callbackRef = vi.fn();
      function Both() {
        return (
          <div className="p-16">
            {(
              [
                ["Toppings 0", objectRef],
                ["Toppings 1", callbackRef],
              ] as const
            ).map(([name, ref]) => (
              <Combobox key={name} items={toppings} multiple defaultValue={["Cheese"]}>
                <ComboboxChips ref={ref}>
                  <ComboboxInput aria-label={name} />
                </ComboboxChips>
                <ComboboxContent>
                  <ComboboxList>
                    {(item: string) => (
                      <ComboboxItem key={item} value={item}>
                        {item}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            ))}
          </div>
        );
      }
      const screen = await render(<Both />);
      expect(objectRef.current).toBe(chipsOf(input("Toppings 0")));
      expect(callbackRef).toHaveBeenLastCalledWith(chipsOf(input("Toppings 1")));
      const element = await openByClick("Toppings 0");
      const chips = chipsOf(input("Toppings 0")).getBoundingClientRect();
      expect(Math.round(element.getBoundingClientRect().left)).toBe(Math.round(chips.left));
      expect(element.getBoundingClientRect().width).toBeGreaterThanOrEqual(Math.floor(chips.width));
      await userEvent.keyboard("{Escape}");
      await screen.unmount();
      expect(objectRef.current).toBeNull();
      expect(callbackRef).toHaveBeenLastCalledWith(null);
    });

    it("the chips field matches Input's height and look, with a focus-within ring", async () => {
      const screen = await render(
        <div>
          <Input aria-label="Reference" />
          <Toppings defaultValue={[]} />
        </div>,
      );
      const chips = chipsOf(input("Toppings"));
      const reference = getComputedStyle(screen.getByRole("textbox").element());
      expect(chips.getBoundingClientRect().height).toBe(40);
      const style = getComputedStyle(chips);
      expect(style.backgroundColor).toBe(reference.backgroundColor);
      expect(style.borderTopColor).toBe(reference.borderTopColor);
      expect(style.outlineStyle).toBe("none");
      (page.getByRole("textbox", { name: "Reference" }).element() as HTMLInputElement).focus();
      await userEvent.tab();
      expect(document.activeElement).toBe(input("Toppings"));
      expect(getComputedStyle(chips).outlineStyle).toBe("solid");
      expect(getComputedStyle(chips).outlineWidth).toBe("1px");
      await userEvent.keyboard("{Escape}");
    });

    it("disabled dims the chips field; read-only gives it the muted background", async () => {
      const screen = await render(
        <div>
          <Combobox items={toppings} multiple disabled defaultValue={["Cheese"]}>
            <ComboboxChips>
              <ComboboxInput aria-label="Disabled toppings" />
            </ComboboxChips>
          </Combobox>
          <Combobox items={toppings} multiple readOnly defaultValue={["Cheese"]}>
            <ComboboxChips>
              <ComboboxInput aria-label="Read-only toppings" />
            </ComboboxChips>
          </Combobox>
          <div data-testid="ref" className="bg-muted" />
        </div>,
      );
      const disabled = chipsOf(input("Disabled toppings"));
      expect(input("Disabled toppings").disabled).toBe(true);
      expect(getComputedStyle(disabled).opacity).toBe("0.5");
      expect(getComputedStyle(disabled).cursor).toBe("not-allowed");
      expect(getComputedStyle(chipsOf(input("Read-only toppings"))).backgroundColor).toBe(
        getComputedStyle(screen.getByTestId("ref").element()).backgroundColor,
      );
    });

    // v2 §4: hover styles are gated with `not-data-disabled:`.
    it("a disabled chip remove button keeps its background and colour on hover", async () => {
      await render(<Toppings disabled defaultValue={["Cheese"]} />);
      const remove = document.querySelector("[data-slot=combobox-chip-remove]") as HTMLElement;
      expect(remove.hasAttribute("data-disabled")).toBe(true);
      const before = getComputedStyle(remove);
      const [background, color] = [before.backgroundColor, before.color];
      await userEvent.hover(remove);
      expect(remove.matches(":hover")).toBe(true);
      expect(getComputedStyle(remove).backgroundColor).toBe(background);
      expect(getComputedStyle(remove).color).toBe(color);
    });

    it("inside an invalid Field: named by the label, danger border on the chips field", async () => {
      const screen = await render(
        <div>
          <Field invalid>
            <FieldLabel>Toppings</FieldLabel>
            <Combobox items={toppings} multiple defaultValue={["Cheese"]}>
              <ComboboxChips>
                <ComboboxValue>
                  {(values: string[]) =>
                    values.map((value) => (
                      <ComboboxChip key={value}>
                        {value}
                        <ComboboxChipRemove />
                      </ComboboxChip>
                    ))
                  }
                </ComboboxValue>
                <ComboboxInput />
              </ComboboxChips>
            </Combobox>
          </Field>
          <div data-testid="ref" className="border border-danger" />
        </div>,
      );
      const element = input("Toppings");
      expect(element.getAttribute("aria-invalid")).toBe("true");
      expect(getComputedStyle(chipsOf(element)).borderTopColor).toBe(
        getComputedStyle(screen.getByTestId("ref").element()).borderTopColor,
      );
    });
  });

  describe("field look", () => {
    it("matches Input: heights per size, start padding, background and border", async () => {
      const screen = await render(
        <div className="flex flex-col gap-2">
          {(["sm", "md", "lg"] as const).map((size) => (
            <div key={size} className="flex gap-2">
              <Input aria-label={`input-${size}`} size={size} />
              <Combobox items={fruits}>
                <ComboboxInput aria-label={`combobox-${size}`} size={size} />
              </Combobox>
            </div>
          ))}
          <Combobox items={fruits}>
            <ComboboxInput aria-label="combobox-default" />
          </Combobox>
        </div>,
      );
      const heights = { sm: 32, md: 40, lg: 48 };
      for (const size of ["sm", "md", "lg"] as const) {
        const reference = screen.getByRole("textbox", { name: `input-${size}` }).element();
        const group = groupOf(input(`combobox-${size}`));
        expect(group.getBoundingClientRect().height).toBe(heights[size]);
        expect(group.getAttribute("data-size")).toBe(size);
        const i = getComputedStyle(reference);
        const g = getComputedStyle(group);
        expect(g.paddingLeft).toBe(i.paddingLeft);
        expect(getComputedStyle(input(`combobox-${size}`)).fontSize).toBe(i.fontSize);
        expect(g.backgroundColor).toBe(i.backgroundColor);
        expect(g.borderTopColor).toBe(i.borderTopColor);
        expect(g.borderRadius).toBe(i.borderRadius);
        // The input's text starts where Input's does.
        const offset = input(`combobox-${size}`).getBoundingClientRect().left;
        expect(offset - group.getBoundingClientRect().left).toBe(
          Number.parseFloat(i.paddingLeft) + Number.parseFloat(i.borderLeftWidth),
        );
      }
      const fallback = groupOf(input("combobox-default"));
      expect(fallback.getAttribute("data-size")).toBe("md");
      expect(fallback.getBoundingClientRect().height).toBe(40);
    });

    it("shows a solid 1px focus-within ring on the group on Tab focus, none before", async () => {
      await render(<Fruit />);
      const group = groupOf(input());
      expect(getComputedStyle(group).outlineStyle).toBe("none");
      expect(getComputedStyle(input()).outlineStyle).toBe("none");
      await userEvent.tab();
      expect(document.activeElement).toBe(input());
      const style = getComputedStyle(group);
      expect(style.outlineStyle).toBe("solid");
      expect(style.outlineWidth).toBe("1px");
      // The ring is the group's; the input itself draws none.
      expect(getComputedStyle(input()).outlineStyle).toBe("none");
      await userEvent.keyboard("{Escape}");
    });

    it("forced colors: no permanent outline on any part; the focus ring is Highlight", async () => {
      await emulateForcedColors(true);
      await render(
        <div>
          <Fruit defaultValue="Apple" inputProps={{ showClear: true }} />
          <Toppings defaultValue={["Cheese"]} />
        </div>,
      );
      const group = groupOf(input());
      const chips = chipsOf(input("Toppings"));
      const parts = [
        group,
        input(),
        chips,
        input("Toppings"),
        page.getByRole("button", { name: "Show options" }).element(),
        page.getByRole("button", { name: "Clear" }).element(),
        page.getByRole("button", { name: "Remove" }).element(),
        document.querySelector("[data-slot=combobox-chip]") as HTMLElement,
      ];
      for (const part of parts) expect(getComputedStyle(part).outlineStyle).toBe("none");
      await userEvent.tab();
      expect(document.activeElement).toBe(input());
      expect(getComputedStyle(group).outlineStyle).toBe("solid");
      expect(getComputedStyle(group).outlineColor).toBe(systemColor("Highlight"));
      await userEvent.tab();
      expect(document.activeElement).toBe(input("Toppings"));
      expect(getComputedStyle(chips).outlineStyle).toBe("solid");
      expect(getComputedStyle(chips).outlineColor).toBe(systemColor("Highlight"));
      await userEvent.keyboard("{ArrowLeft}");
      const chip = document.querySelector("[data-slot=combobox-chip]") as HTMLElement;
      await expect.poll(() => document.activeElement).toBe(chip);
      expect(getComputedStyle(chip).outlineStyle).toBe("solid");
      expect(getComputedStyle(chip).outlineColor).toBe(systemColor("Highlight"));
    });

    it("forced colors: an invalid, focused group or chips container rings Highlight", async () => {
      await emulateForcedColors(true);
      await render(
        <div>
          <Field invalid>
            <FieldLabel>In field</FieldLabel>
            <Fruit inputProps={{ "aria-label": undefined }} />
          </Field>
          <Fruit inputProps={{ "aria-label": "Bare", "aria-invalid": true }} />
          <Field invalid>
            <FieldLabel>Chips in field</FieldLabel>
            <Combobox items={toppings} multiple>
              <ComboboxChips>
                <ComboboxInput />
              </ComboboxChips>
            </Combobox>
          </Field>
          <Combobox items={toppings} multiple>
            <ComboboxChips>
              <ComboboxInput aria-label="Bare chips" aria-invalid />
            </ComboboxChips>
          </Combobox>
        </div>,
      );
      for (const [name, containerOf] of [
        ["In field", groupOf],
        ["Bare", groupOf],
        ["Chips in field", chipsOf],
        ["Bare chips", chipsOf],
      ] as const) {
        const element = page.getByRole("combobox", { name, exact: true }).element() as HTMLElement;
        element.focus();
        const style = getComputedStyle(containerOf(element));
        expect(style.outlineStyle, name).toBe("solid");
        // The danger outline is more specific than `forced-colors:focus-within:`; without the
        // restated forced-colors rule Chromium forces it to CanvasText.
        expect(style.outlineColor, name).toBe(systemColor("Highlight"));
      }
    });

    it("read-only uses the muted background; disabled dims and blocks input", async () => {
      const screen = await render(
        <div>
          <Fruit readOnly defaultValue="Apple" inputProps={{ "aria-label": "Read-only" }} />
          <Fruit disabled inputProps={{ "aria-label": "Disabled" }} />
          <div data-testid="ref" className="bg-muted" />
        </div>,
      );
      const readOnly = groupOf(input("Read-only"));
      expect(readOnly.hasAttribute("data-readonly")).toBe(true);
      expect(getComputedStyle(readOnly).backgroundColor).toBe(
        getComputedStyle(screen.getByTestId("ref").element()).backgroundColor,
      );
      const disabled = groupOf(input("Disabled"));
      expect(disabled.hasAttribute("data-disabled")).toBe(true);
      expect(getComputedStyle(disabled).opacity).toBe("0.5");
      expect(input("Disabled").disabled).toBe(true);
      expect(getComputedStyle(input("Disabled")).cursor).toBe("not-allowed");
    });

    it("inside an invalid Field: named by the label, described, danger border on the group", async () => {
      const screen = await render(
        <div>
          <Field invalid>
            <FieldLabel>Fruit</FieldLabel>
            <Combobox items={fruits}>
              <ComboboxInput placeholder="Search fruit" />
            </Combobox>
            <FieldDescription>Pick your favourite.</FieldDescription>
          </Field>
          <div data-testid="ref" className="border border-danger" />
        </div>,
      );
      const combobox = page.getByRole("combobox", { name: "Fruit" });
      await expect.element(combobox).toHaveAccessibleDescription("Pick your favourite.");
      await expect.element(combobox).toHaveAttribute("aria-invalid", "true");
      const group = groupOf(combobox.element());
      expect(group.hasAttribute("data-invalid")).toBe(true);
      expect(getComputedStyle(group).borderTopColor).toBe(
        getComputedStyle(screen.getByTestId("ref").element()).borderTopColor,
      );
    });

    it("an aria-invalid input outside a Field also gets the danger border", async () => {
      const screen = await render(
        <div>
          <Fruit inputProps={{ "aria-invalid": true }} />
          <div data-testid="ref" className="border border-danger" />
        </div>,
      );
      expect(getComputedStyle(groupOf(input())).borderTopColor).toBe(
        getComputedStyle(screen.getByTestId("ref").element()).borderTopColor,
      );
    });
  });

  describe("status", () => {
    it("renders a muted polite live region that collapses when empty", async () => {
      function Async({ message }: { message: string }) {
        return (
          <div className="p-16">
            <Combobox items={fruits} defaultOpen>
              <ComboboxInput aria-label="Fruit" />
              <ComboboxContent>
                <ComboboxStatus>{message}</ComboboxStatus>
                <ComboboxList>
                  {(item: string) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <span data-testid="muted" className="text-muted-foreground" />
          </div>
        );
      }
      const screen = await render(<Async message="" />);
      await settled();
      const status = document.querySelector("[data-slot=combobox-status]") as HTMLElement;
      expect(status.getAttribute("role")).toBe("status");
      expect(status.getAttribute("aria-live")).toBe("polite");
      expect(status.getBoundingClientRect().height).toBe(0);
      await screen.rerender(<Async message="3 results" />);
      await expect.poll(() => status.textContent).toBe("3 results");
      expect(status.getBoundingClientRect().height).toBeGreaterThan(0);
      expect(getComputedStyle(status).color).toBe(
        getComputedStyle(screen.getByTestId("muted").element()).color,
      );
    });
  });

  describe("structure", () => {
    it("sets data-slot on every part and merges className", async () => {
      const screen = await render(
        <div className="p-16">
          <Combobox items={fruits} defaultValue="Apple" defaultOpen>
            <ComboboxInput aria-label="Fruit" className="italic" groupClassName="w-64" showClear />
            <ComboboxContent className="p-2">
              <ComboboxStatus className="text-xs">Loaded</ComboboxStatus>
              <ComboboxEmpty className="py-2">None</ComboboxEmpty>
              <ComboboxList className="gap-1">
                <ComboboxGroup className="py-1">
                  <ComboboxGroupLabel className="text-sm">Fruits</ComboboxGroupLabel>
                  <ComboboxItem value="Apple" className="text-base">
                    Apple
                  </ComboboxItem>
                </ComboboxGroup>
                <ComboboxSeparator className="my-2" />
                <ComboboxItem value="Grape">Grape</ComboboxItem>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>,
      );
      const element = input();
      expect(element.getAttribute("data-slot")).toBe("combobox-input");
      expect(element.classList.contains("italic")).toBe(true);
      const group = groupOf(element);
      expect(group.classList.contains("w-64")).toBe(true);
      expect(group.classList.contains("w-full")).toBe(false);
      const content = await settled();
      expect(screen.container.contains(content)).toBe(false);
      expect(content.classList.contains("p-2")).toBe(true);
      expect(content.classList.contains("p-1")).toBe(false);
      for (const cls of ["bg-popover", "rounded-lg", "border", "shadow-lg", "overflow-y-auto"]) {
        expect(content.classList.contains(cls)).toBe(true);
      }
      const list = content.querySelector("[data-slot=combobox-list]") as HTMLElement;
      expect(list.getAttribute("role")).toBe("listbox");
      expect(list.classList.contains("gap-1")).toBe(true);
      const status = content.querySelector("[data-slot=combobox-status]") as HTMLElement;
      expect(status.classList.contains("text-xs")).toBe(true);
      expect(status.classList.contains("text-sm")).toBe(false);
      const empty = content.querySelector("[data-slot=combobox-empty]") as HTMLElement;
      expect(empty.classList.contains("py-2")).toBe(true);
      expect(empty.classList.contains("py-6")).toBe(false);
      const g = content.querySelector("[data-slot=combobox-group]") as HTMLElement;
      expect(g.getAttribute("role")).toBe("group");
      expect(g.classList.contains("py-1")).toBe(true);
      const label = content.querySelector("[data-slot=combobox-group-label]") as HTMLElement;
      expect(label.classList.contains("text-sm")).toBe(true);
      expect(label.classList.contains("text-xs")).toBe(false);
      expect(g.getAttribute("aria-labelledby")).toBe(label.id);
      const item = option("Apple").element();
      expect(item.getAttribute("data-slot")).toBe("combobox-item");
      expect(item.classList.contains("text-base")).toBe(true);
      expect(item.classList.contains("text-sm")).toBe(false);
      expect(item.querySelector("[data-slot=combobox-item-indicator]")).not.toBeNull();
      const separator = content.querySelector("[data-slot=combobox-separator]") as HTMLElement;
      expect(separator.getAttribute("role")).toBe("presentation");
      expect(separator.classList.contains("my-2")).toBe(true);
      expect(separator.classList.contains("my-1")).toBe(false);
      expect(group.querySelector("[data-slot=combobox-trigger]")).not.toBeNull();
      expect(group.querySelector("[data-slot=combobox-clear]")).not.toBeNull();
      await userEvent.keyboard("{Escape}");
    });

    it("chips parts set data-slot and merge className", async () => {
      await render(
        <Combobox items={toppings} multiple defaultValue={["Cheese"]}>
          <ComboboxChips className="p-2">
            <ComboboxValue>
              {(values: string[]) =>
                values.map((value) => (
                  <ComboboxChip key={value} className="text-sm">
                    {value}
                    <ComboboxChipRemove className="size-5" />
                  </ComboboxChip>
                ))
              }
            </ComboboxValue>
            <ComboboxInput aria-label="Toppings" className="min-w-24" />
          </ComboboxChips>
        </Combobox>,
      );
      const element = input("Toppings");
      expect(element.getAttribute("data-slot")).toBe("combobox-input");
      expect(element.classList.contains("min-w-24")).toBe(true);
      expect(element.classList.contains("min-w-16")).toBe(false);
      // Inside chips the input renders bare: no group of its own, no trigger.
      expect(element.closest("[data-slot=combobox-input-group]")).toBeNull();
      const chips = chipsOf(element);
      expect(chips.classList.contains("p-2")).toBe(true);
      expect(chips.classList.contains("p-1")).toBe(false);
      const chip = chips.querySelector("[data-slot=combobox-chip]") as HTMLElement;
      expect(chip.classList.contains("text-sm")).toBe(true);
      expect(chip.classList.contains("text-xs")).toBe(false);
      const remove = chip.querySelector("[data-slot=combobox-chip-remove]") as HTMLElement;
      expect(remove.getAttribute("aria-label")).toBe("Remove");
      expect(remove.classList.contains("size-5")).toBe(true);
      expect(remove.classList.contains("size-4")).toBe(false);
      expect(getComputedStyle(remove).cursor).toBe("pointer");
    });

    it("sits below the input group, start-aligned, 6px away, at least as wide", async () => {
      await render(<Fruit />);
      const element = await openByClick();
      expect(element.getAttribute("data-side")).toBe("bottom");
      expect(element.getAttribute("data-align")).toBe("start");
      const g = groupOf(input()).getBoundingClientRect();
      const p = element.getBoundingClientRect();
      expect(Math.round(p.top - g.bottom)).toBe(6);
      expect(Math.round(p.left)).toBe(Math.round(g.left));
      expect(p.width).toBeGreaterThanOrEqual(Math.floor(g.width));
      await userEvent.keyboard("{Escape}");
    });

    it("uses the popover surface colours and the overlay z-index, portalled to body", async () => {
      const screen = await render(
        <div>
          <Fruit />
          <div data-testid="ref" className="bg-popover text-popover-foreground" />
        </div>,
      );
      const element = await openByClick();
      expect(getComputedStyle(element).backgroundColor).toBe(
        getComputedStyle(screen.getByTestId("ref").element()).backgroundColor,
      );
      expect(getComputedStyle(element.parentElement as HTMLElement).zIndex).toBe("50");
      expect(screen.container.contains(element)).toBe(false);
      expect(document.body.contains(element)).toBe(true);
      await userEvent.keyboard("{Escape}");
    });

    it("caps the popup height at 20rem and scrolls", async () => {
      const many = Array.from({ length: 40 }, (_, index) => `Item ${index + 1}`);
      await render(
        <div className="p-16">
          <Combobox items={many}>
            <ComboboxInput aria-label="Fruit" />
            <ComboboxContent>
              <ComboboxList>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>,
      );
      const element = await openByClick();
      expect(element.getBoundingClientRect().height).toBeLessThanOrEqual(320);
      expect(element.scrollHeight).toBeGreaterThan(element.clientHeight);
      await userEvent.keyboard("{Escape}");
    });

    it("inherits a nested theme scope through `container`", async () => {
      function Scoped() {
        const scope = useRef<HTMLDivElement>(null);
        return (
          <div ref={scope} data-primary="lapis" data-testid="scope">
            <Fruit
              contentProps={{ container: scope }}
              renderItem={(item) => (
                <ComboboxItem key={item} value={item}>
                  <span data-testid={`swatch-${item}`} className="block size-4 bg-primary" />
                  {item}
                </ComboboxItem>
              )}
            />
          </div>
        );
      }
      const screen = await render(
        <div>
          <Scoped />
          <div data-testid="default-ref" className="bg-primary" />
          <div data-primary="lapis">
            <div data-testid="lapis-ref" className="bg-primary" />
          </div>
        </div>,
      );
      const element = await openByClick();
      expect(screen.getByTestId("scope").element().contains(element)).toBe(true);
      const lapis = getComputedStyle(screen.getByTestId("lapis-ref").element()).backgroundColor;
      const fallback = getComputedStyle(
        screen.getByTestId("default-ref").element(),
      ).backgroundColor;
      expect(lapis).not.toBe(fallback);
      expect(getComputedStyle(page.getByTestId("swatch-Apple").element()).backgroundColor).toBe(
        lapis,
      );
      await userEvent.keyboard("{Escape}");
    });

    it("keeps ComboboxSeparator visible in forced colors", async () => {
      await emulateForcedColors(true);
      expect(matchMedia("(forced-colors: active)").matches).toBe(true);
      await render(
        <div className="p-16">
          <Combobox items={fruits} defaultOpen>
            <ComboboxInput aria-label="Fruit" />
            <ComboboxContent>
              <ComboboxEmpty>No fruit found.</ComboboxEmpty>
              <ComboboxList>
                <ComboboxGroup>
                  <ComboboxGroupLabel>Fruits</ComboboxGroupLabel>
                  <ComboboxItem value="Apple">Apple</ComboboxItem>
                </ComboboxGroup>
                <ComboboxSeparator data-testid="sep" />
                <ComboboxItem value="Banana">Banana</ComboboxItem>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>,
      );
      const sep = document.querySelector('[data-testid="sep"]') as HTMLElement;
      const style = getComputedStyle(sep);
      expect(style.backgroundColor).toBe(systemColor("CanvasText"));
      expect(style.backgroundColor).not.toBe(systemColor("Canvas"));
    });
  });

  describe("layering", () => {
    it("works inside a modal Dialog, and Escape closes only the combobox", async () => {
      const onDialogOpenChange = vi.fn();
      await render(
        <Dialog onOpenChange={onDialogOpenChange}>
          <DialogTrigger render={<Button variant="outline" />}>Edit order</DialogTrigger>
          <DialogContent>
            <DialogTitle>Edit order</DialogTitle>
            <DialogDescription>Choose a fruit.</DialogDescription>
            <Fruit />
          </DialogContent>
        </Dialog>,
      );
      await userEvent.click(page.getByRole("button", { name: "Edit order" }));
      await expect.element(page.getByRole("dialog")).toBeVisible();
      await openByClick();
      await userEvent.click(option("Cherry"));
      await expect.element(listbox()).not.toBeInTheDocument();
      expect(input().value).toBe("Cherry");
      await expect.element(page.getByRole("dialog")).toBeVisible();

      await userEvent.keyboard("{ArrowDown}");
      await settled();
      await userEvent.keyboard("{Escape}");
      await expect.element(listbox()).not.toBeInTheDocument();
      await expect.element(page.getByRole("dialog")).toBeVisible();
      expect(onDialogOpenChange.mock.calls.filter(([open]) => open === false)).toHaveLength(0);
      expect(document.activeElement).toBe(input());

      // Base UI: Escape on a closed combobox with a value clears it first (and stops there).
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

      it("the first Escape closes only the tooltip, the second the combobox; the app still hears it", async () => {
        const onOpenChange = vi.fn();
        await render(
          <Fruit
            onOpenChange={onOpenChange}
            renderItem={(item) => (
              <ComboboxItem key={item} value={item}>
                {item}
                {item === "Cherry" && (
                  <Tooltip onOpenChange={tooltipSpy}>
                    <TooltipTrigger delay={0} closeDelay={0} render={<span data-testid="info" />}>
                      (seasonal)
                    </TooltipTrigger>
                    <TooltipContent>Available in June</TooltipContent>
                  </Tooltip>
                )}
              </ComboboxItem>
            )}
          />,
        );
        await openByClick();
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
              <FieldLabel>Fruit</FieldLabel>
              <Combobox items={fruits} defaultValue="Banana">
                <ComboboxInput showClear />
                <ComboboxContent>
                  <ComboboxEmpty>No fruit found.</ComboboxEmpty>
                  <ComboboxList>
                    {(item: string) => (
                      <ComboboxItem key={item} value={item}>
                        {item}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
          </div>,
        );
        await userEvent.click(page.getByRole("button", { name: "Fruit" }));
        await settled();
        const { violations, incomplete } = await auditOpenOverlay();
        expect(violations).toEqual([]);
        expect(incomplete).toEqual([]);
        await userEvent.keyboard("{Escape}");
      } finally {
        document.documentElement.classList.remove("dark");
      }
    });

    it.each(["light", "dark"] as const)(
      "has no axe violations with chips, open, and with the empty state (%s)",
      async (theme) => {
        if (theme === "dark") document.documentElement.classList.add("dark");
        try {
          await render(
            <div className="bg-background">
              <Toppings defaultValue={["Cheese", "Olives"]} />
            </div>,
          );
          await openByClick("Toppings");
          let result = await auditOpenOverlay();
          expect(result.violations).toEqual([]);
          expect(result.incomplete).toEqual([]);
          await userEvent.keyboard("zzz");
          await expect.element(page.getByText("No toppings found.")).toBeVisible();
          result = await auditOpenOverlay();
          expect(result.violations).toEqual([]);
          expect(result.incomplete).toEqual([]);
          await userEvent.keyboard("{Escape}");
        } finally {
          document.documentElement.classList.remove("dark");
        }
      },
    );

    it.each(["light", "dark"] as const)(
      "has no axe violations while closed, invalid, with a placeholder (%s)",
      async (theme) => {
        if (theme === "dark") document.documentElement.classList.add("dark");
        try {
          const screen = await render(
            <div className="bg-background p-4">
              <Field invalid>
                <FieldLabel>Fruit</FieldLabel>
                <Combobox items={fruits}>
                  <ComboboxInput size="sm" placeholder="Search fruit" />
                </Combobox>
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
      "ObjectsWithLabels",
      "Groups",
      "MultipleWithChips",
      "AsyncWithStatus",
      "InField",
      "Sizes",
    ] as const;
    it.each(storyNames)(
      "story %s: every combobox input is named, no axe violations",
      async (name) => {
        const story = stories[name] as { render?: unknown; args?: object };
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
      },
    );
  });
});
