import { type ReactNode, useRef } from "react";
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
  Select,
  SelectContent,
  type SelectContentProps,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  type SelectProps,
  SelectSeparator,
  SelectTrigger,
  type SelectTriggerProps,
  SelectValue,
} from "./select";

const fruits = {
  apple: "Apple",
  banana: "Banana",
  blueberry: "Blueberry",
  cherry: "Cherry",
  grape: "Grape",
};

interface FruitProps extends Omit<SelectProps<string>, "children"> {
  triggerProps?: SelectTriggerProps;
  contentProps?: SelectContentProps;
  value_?: ReactNode;
  extraItem?: ReactNode;
}

function FruitItems({ extraItem }: { extraItem?: ReactNode }) {
  return (
    <>
      <SelectGroup>
        <SelectGroupLabel>Fruits</SelectGroupLabel>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="blueberry" disabled>
          Blueberry
        </SelectItem>
        <SelectItem value="cherry">Cherry</SelectItem>
      </SelectGroup>
      <SelectSeparator />
      <SelectItem value="grape">Grape</SelectItem>
      {extraItem}
    </>
  );
}

function Fruit({ triggerProps, contentProps, value_, extraItem, ...props }: FruitProps) {
  // Padding leaves room on every side, so the popup never flips away from `side`.
  return (
    <div className="p-16">
      <Select items={fruits} {...props}>
        <SelectTrigger aria-label="Fruit" {...triggerProps}>
          {value_ ?? <SelectValue placeholder="Pick a fruit" />}
        </SelectTrigger>
        <SelectContent {...contentProps}>
          <FruitItems extraItem={extraItem} />
        </SelectContent>
      </Select>
    </div>
  );
}

const trigger = () => page.getByRole("combobox", { name: "Fruit" });
const listbox = () => page.getByRole("listbox");
const popup = () => document.querySelector<HTMLElement>("[data-slot=select-content]");
const option = (name: string) => page.getByRole("option", { name, exact: true });

async function openByClick() {
  await userEvent.click(trigger());
  await expect.element(listbox()).toBeVisible();
  const element = popup() as HTMLElement;
  await waitForPopupSettled(element);
  return element;
}

async function focusTrigger() {
  await userEvent.tab();
  expect(document.activeElement).toBe(trigger().element());
}

afterEach(async () => {
  document.documentElement.classList.remove("dark");
  await resetEmulatedMedia();
});

describe("Select direction", () => {
  const sideways = {
    triggerProps: { "aria-label": "Fruit", className: "w-28" },
    contentProps: { side: "inline-end", className: "w-32" },
  } as const;

  it.each(["ltr", "rtl"] as const)(
    "%s: side inline-end places the list after the trigger in the reading order",
    async (dir) => {
      await render(
        <div dir={dir} className="flex justify-center">
          <Fruit {...sideways} />
        </div>,
      );
      const element = await openByClick();
      const t = trigger().element().getBoundingClientRect();
      const p = element.getBoundingClientRect();
      if (dir === "rtl") expect(p.right).toBeLessThanOrEqual(t.left);
      else expect(p.left).toBeGreaterThanOrEqual(t.right);
    },
  );

  it("follows a dir change on an ancestor after mount", async () => {
    await render(
      <div data-testid="host" className="flex justify-center">
        <Fruit {...sideways} />
      </div>,
    );
    page.getByTestId("host").element().setAttribute("dir", "rtl");
    const element = await openByClick();
    await expect
      .poll(
        () =>
          element.getBoundingClientRect().right - trigger().element().getBoundingClientRect().left,
      )
      .toBeLessThanOrEqual(0);
  });
});

describe("Select", () => {
  describe("opening", () => {
    it("opens a listbox on click, wired to the trigger", async () => {
      await render(<Fruit />);
      await expect.element(listbox()).not.toBeInTheDocument();
      await expect.element(trigger()).toHaveAttribute("aria-expanded", "false");
      await expect.element(trigger()).toHaveAttribute("aria-haspopup", "listbox");
      await openByClick();
      await expect.element(trigger()).toHaveAttribute("aria-expanded", "true");
      await expect.element(trigger()).toHaveAttribute("aria-controls", listbox().element().id);
    });

    it.each([
      ["Enter", "{Enter}"],
      ["Space", " "],
      ["ArrowDown", "{ArrowDown}"],
    ])("opens with %s on the focused trigger", async (_, key) => {
      await render(<Fruit />);
      await focusTrigger();
      await userEvent.keyboard(key);
      await expect.element(listbox()).toBeVisible();
    });

    it("highlights the matching item on typeahead", async () => {
      await render(<Fruit />);
      await focusTrigger();
      await userEvent.keyboard("{Enter}");
      await expect.element(listbox()).toBeVisible();
      await waitForPopupSettled(popup() as HTMLElement);
      await userEvent.keyboard("ch");
      await expect.element(option("Cherry")).toHaveAttribute("data-highlighted");
      await expect.element(option("Apple")).not.toHaveAttribute("data-highlighted");
    });

    it("sits below the trigger, start-aligned, 6px away — even with a selected value (no alignItemWithTrigger)", async () => {
      await render(<Fruit defaultValue="cherry" />);
      const element = await openByClick();
      expect(element.getAttribute("data-side")).toBe("bottom");
      expect(element.getAttribute("data-align")).toBe("start");
      const t = trigger().element().getBoundingClientRect();
      const p = element.getBoundingClientRect();
      expect(Math.round(p.top - t.bottom)).toBe(6);
      expect(Math.round(p.left)).toBe(Math.round(t.left));
      // At least as wide as the trigger.
      expect(p.width).toBeGreaterThanOrEqual(Math.floor(t.width));
    });

    it("can opt back into alignItemWithTrigger", async () => {
      await render(<Fruit defaultValue="cherry" contentProps={{ alignItemWithTrigger: true }} />);
      const element = await openByClick();
      expect(element.getAttribute("data-side")).toBe("none");
    });
  });

  describe("selecting", () => {
    it("Enter selects the highlighted item, closes, updates the value and returns focus", async () => {
      const onValueChange = vi.fn();
      await render(<Fruit onValueChange={onValueChange} />);
      await focusTrigger();
      await userEvent.keyboard("{Enter}");
      await expect.element(listbox()).toBeVisible();
      await waitForPopupSettled(popup() as HTMLElement);
      await userEvent.keyboard("ch");
      await expect.element(option("Cherry")).toHaveAttribute("data-highlighted");
      await userEvent.keyboard("{Enter}");
      await expect.element(listbox()).not.toBeInTheDocument();
      await expect.element(trigger()).toHaveTextContent("Cherry");
      expect(onValueChange).toHaveBeenLastCalledWith("cherry", expect.anything());
      await expect.poll(() => document.activeElement).toBe(trigger().element());
    });

    it("selects on click", async () => {
      await render(<Fruit />);
      await openByClick();
      await userEvent.click(option("Grape"));
      await expect.element(listbox()).not.toBeInTheDocument();
      await expect.element(trigger()).toHaveTextContent("Grape");
    });

    it("marks only the selected item with aria-selected, the check indicator and font-medium", async () => {
      await render(<Fruit defaultValue="banana" />);
      await openByClick();
      const selected = option("Banana").element() as HTMLElement;
      expect(selected.getAttribute("aria-selected")).toBe("true");
      expect(selected.hasAttribute("data-selected")).toBe(true);
      expect(selected.querySelector("[data-slot=select-item-indicator] svg")).not.toBeNull();
      expect(getComputedStyle(selected).fontWeight).toBe("500");
      for (const name of ["Apple", "Cherry", "Grape"]) {
        const other = option(name).element() as HTMLElement;
        expect(other.getAttribute("aria-selected")).not.toBe("true");
        expect(other.querySelector("[data-slot=select-item-indicator]")).toBeNull();
        expect(getComputedStyle(other).fontWeight).toBe("400");
      }
      // The indicator sits in the leading slot, left of the text.
      const indicator = selected.querySelector("[data-slot=select-item-indicator]") as HTMLElement;
      const text = selected.querySelector("[data-slot=select-item-text]") as HTMLElement;
      expect(indicator.getBoundingClientRect().right).toBeLessThanOrEqual(
        text.getBoundingClientRect().left,
      );
    });

    it("never selects a disabled item", async () => {
      const onValueChange = vi.fn();
      await render(<Fruit defaultValue="apple" onValueChange={onValueChange} />);
      await openByClick();
      const disabled = option("Blueberry");
      await expect.element(disabled).toHaveAttribute("aria-disabled", "true");
      await expect.element(disabled).toHaveAttribute("data-disabled");
      expect(getComputedStyle(disabled.element()).cursor).toBe("not-allowed");
      await userEvent.click(disabled, { force: true });
      await userEvent.keyboard("{Escape}");
      await expect.element(listbox()).not.toBeInTheDocument();
      expect(onValueChange).not.toHaveBeenCalled();
      await expect.element(trigger()).toHaveTextContent("Apple");
    });

    it("multiple: keeps the popup open and shows a comma-joined value", async () => {
      const onValueChange = vi.fn();
      await render(
        <div className="p-16">
          <Select items={fruits} multiple defaultValue={[]} onValueChange={onValueChange}>
            <SelectTrigger aria-label="Fruit">
              <SelectValue placeholder="Pick fruits" />
            </SelectTrigger>
            <SelectContent>
              <FruitItems />
            </SelectContent>
          </Select>
        </div>,
      );
      await openByClick();
      await expect.element(listbox()).toHaveAttribute("aria-multiselectable", "true");
      await userEvent.click(option("Apple"));
      await userEvent.click(option("Cherry"));
      await expect.element(listbox()).toBeVisible();
      expect(onValueChange).toHaveBeenLastCalledWith(["apple", "cherry"], expect.anything());
      await expect.element(trigger()).toHaveTextContent("Apple, Cherry");
      await expect.element(option("Apple")).toHaveAttribute("aria-selected", "true");
      await expect.element(option("Cherry")).toHaveAttribute("aria-selected", "true");
    });

    it("SelectValue accepts a render function", async () => {
      await render(
        <Fruit
          defaultValue="grape"
          value_={
            <SelectValue>
              {(value: string | null) => (value ? `Fruit: ${value}` : "Nothing")}
            </SelectValue>
          }
        />,
      );
      await expect.element(trigger()).toHaveTextContent("Fruit: grape");
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
          <Fruit name="fruit" defaultValue="cherry" />
          <button type="submit">Save</button>
        </form>,
      );
      await userEvent.click(page.getByRole("button", { name: "Save" }));
      await expect.poll(() => data?.get("fruit")).toBe("cherry");
    });
  });

  describe("trigger", () => {
    it("shows the placeholder in the muted colour, and the value in the foreground colour", async () => {
      const screen = await render(
        <div>
          <Fruit />
          <span data-testid="muted" className="text-muted-foreground" />
          <span data-testid="fg" className="text-foreground" />
        </div>,
      );
      const value = trigger().element().querySelector("[data-slot=select-value]") as HTMLElement;
      expect(value.textContent).toBe("Pick a fruit");
      expect(value.hasAttribute("data-placeholder")).toBe(true);
      const muted = getComputedStyle(screen.getByTestId("muted").element()).color;
      const fg = getComputedStyle(screen.getByTestId("fg").element()).color;
      expect(getComputedStyle(value).color).toBe(muted);
      await openByClick();
      await userEvent.click(option("Apple"));
      await expect.element(trigger()).toHaveTextContent("Apple");
      expect(value.hasAttribute("data-placeholder")).toBe(false);
      expect(getComputedStyle(value).color).toBe(fg);
    });

    it("looks like an Input: same heights per size, background and border", async () => {
      const screen = await render(
        <div className="flex flex-col gap-2">
          {(["sm", "md", "lg"] as const).map((size) => (
            <div key={size} className="flex gap-2">
              <Input aria-label={`input-${size}`} size={size} />
              <Select items={fruits}>
                <SelectTrigger aria-label={`select-${size}`} size={size}>
                  <SelectValue placeholder="Pick" />
                </SelectTrigger>
                <SelectContent>
                  <FruitItems />
                </SelectContent>
              </Select>
            </div>
          ))}
          <Select items={fruits}>
            <SelectTrigger aria-label="select-default">
              <SelectValue placeholder="Pick" />
            </SelectTrigger>
            <SelectContent>
              <FruitItems />
            </SelectContent>
          </Select>
        </div>,
      );
      const heights = { sm: 32, md: 40, lg: 48 };
      for (const size of ["sm", "md", "lg"] as const) {
        const input = screen.getByRole("textbox", { name: `input-${size}` }).element();
        const select = screen.getByRole("combobox", { name: `select-${size}` }).element();
        expect(select.getBoundingClientRect().height).toBe(heights[size]);
        expect(select.getAttribute("data-size")).toBe(size);
        const i = getComputedStyle(input);
        const s = getComputedStyle(select);
        expect(s.paddingLeft).toBe(i.paddingLeft);
        expect(s.fontSize).toBe(i.fontSize);
        // A <button> matches :read-only, so the text-field `read-only:bg-muted` must not apply.
        expect(s.backgroundColor).toBe(i.backgroundColor);
        expect(s.borderTopColor).toBe(i.borderTopColor);
        expect(s.borderRadius).toBe(i.borderRadius);
        expect(s.cursor).toBe("pointer");
      }
      const fallback = screen.getByRole("combobox", { name: "select-default" }).element();
      expect(fallback.getAttribute("data-size")).toBe("md");
      expect(fallback.getBoundingClientRect().height).toBe(40);
    });

    it("renders a muted chevron icon after the value", async () => {
      await render(<Fruit />);
      const icon = trigger().element().querySelector("[data-slot=select-icon]") as HTMLElement;
      expect(icon).not.toBeNull();
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.querySelector("svg")).not.toBeNull();
      expect(icon.classList.contains("text-muted-foreground")).toBe(true);
      const value = trigger().element().querySelector("[data-slot=select-value]") as HTMLElement;
      expect(icon.getBoundingClientRect().left).toBeGreaterThan(value.getBoundingClientRect().left);
    });

    it("shows a solid 1px ring outline on Tab focus and none before", async () => {
      await render(<Fruit />);
      expect(getComputedStyle(trigger().element()).outlineStyle).toBe("none");
      await focusTrigger();
      const style = getComputedStyle(trigger().element());
      expect(style.outlineStyle).toBe("solid");
      expect(style.outlineWidth).toBe("1px");
    });

    it("is disabled: not focusable, not-allowed cursor, never opens", async () => {
      await render(<Fruit disabled />);
      const element = trigger().element() as HTMLButtonElement;
      expect(element.disabled).toBe(true);
      expect(getComputedStyle(element).cursor).toBe("not-allowed");
      await userEvent.click(trigger(), { force: true });
      await expect.element(listbox()).not.toBeInTheDocument();
    });

    it("read-only uses the muted background", async () => {
      const screen = await render(
        <div>
          <Fruit readOnly defaultValue="apple" />
          <div data-testid="ref" className="bg-muted" />
        </div>,
      );
      await expect.element(trigger()).toHaveAttribute("data-readonly");
      expect(getComputedStyle(trigger().element()).backgroundColor).toBe(
        getComputedStyle(screen.getByTestId("ref").element()).backgroundColor,
      );
    });
  });

  describe("inside Field", () => {
    it("is named by FieldLabel, described by FieldDescription, and invalid shows the danger border", async () => {
      const screen = await render(
        <div>
          <Field invalid>
            <FieldLabel>Language</FieldLabel>
            <Select items={fruits}>
              <SelectTrigger>
                <SelectValue placeholder="Pick" />
              </SelectTrigger>
              <SelectContent>
                <FruitItems />
              </SelectContent>
            </Select>
            <FieldDescription>Used across the app.</FieldDescription>
          </Field>
          <div data-testid="ref" className="border border-danger" />
        </div>,
      );
      const combobox = page.getByRole("combobox", { name: "Language" });
      await expect.element(combobox).toBeInTheDocument();
      await expect.element(combobox).toHaveAccessibleDescription("Used across the app.");
      await expect.element(combobox).toHaveAttribute("data-invalid");
      await expect.element(combobox).toHaveAttribute("aria-invalid", "true");
      expect(getComputedStyle(combobox.element()).borderTopColor).toBe(
        getComputedStyle(screen.getByTestId("ref").element()).borderTopColor,
      );
    });
  });

  describe("structure", () => {
    it("sets data-slot on every part and merges className", async () => {
      const screen = await render(
        <div className="p-16">
          <Select items={fruits} defaultValue="apple">
            <SelectTrigger aria-label="Fruit" className="w-64">
              <SelectValue className="italic" />
            </SelectTrigger>
            <SelectContent className="p-2">
              <SelectGroup className="py-1">
                <SelectGroupLabel className="text-sm">Fruits</SelectGroupLabel>
                <SelectItem value="apple" className="text-base">
                  Apple
                </SelectItem>
              </SelectGroup>
              <SelectSeparator className="my-2" />
              <SelectItem value="grape">Grape</SelectItem>
            </SelectContent>
          </Select>
        </div>,
      );
      const t = trigger().element();
      expect(t.getAttribute("data-slot")).toBe("select-trigger");
      expect(t.classList.contains("w-64")).toBe(true);
      expect(t.classList.contains("w-full")).toBe(false);
      const value = t.querySelector("[data-slot=select-value]") as HTMLElement;
      expect(value.classList.contains("italic")).toBe(true);
      expect(t.querySelector("[data-slot=select-icon]")).not.toBeNull();
      const element = await openByClick();
      expect(screen.container.contains(element)).toBe(false);
      expect(element.classList.contains("p-2")).toBe(true);
      expect(element.classList.contains("p-1")).toBe(false);
      for (const cls of ["bg-popover", "rounded-lg", "border", "shadow-lg", "overflow-y-auto"]) {
        expect(element.classList.contains(cls)).toBe(true);
      }
      expect(element.querySelector("[data-slot=select-list]")?.getAttribute("role")).toBe(
        "listbox",
      );
      const group = element.querySelector("[data-slot=select-group]") as HTMLElement;
      expect(group.getAttribute("role")).toBe("group");
      expect(group.classList.contains("py-1")).toBe(true);
      const label = element.querySelector("[data-slot=select-group-label]") as HTMLElement;
      expect(label.classList.contains("text-sm")).toBe(true);
      expect(label.classList.contains("text-xs")).toBe(false);
      expect(group.getAttribute("aria-labelledby")).toBe(label.id);
      const item = option("Apple").element();
      expect(item.getAttribute("data-slot")).toBe("select-item");
      expect(item.classList.contains("text-base")).toBe(true);
      expect(item.classList.contains("text-sm")).toBe(false);
      expect(item.classList.contains("pl-8")).toBe(true);
      expect(item.querySelector("[data-slot=select-item-text]")?.textContent).toBe("Apple");
      expect(item.querySelector("[data-slot=select-item-indicator]")).not.toBeNull();
      const separator = element.querySelector("[data-slot=select-separator]") as HTMLElement;
      // Base UI: a listbox may only own options and groups, so the separator is presentational.
      expect(separator.getAttribute("role")).toBe("presentation");
      expect(separator.classList.contains("my-2")).toBe(true);
      expect(separator.classList.contains("my-1")).toBe(false);
    });

    it("uses the popover surface colours and the overlay z-index", async () => {
      const screen = await render(
        <div>
          <Fruit />
          <div data-testid="ref" className="bg-popover text-popover-foreground" />
        </div>,
      );
      const element = await openByClick();
      const reference = screen.getByTestId("ref").element();
      expect(getComputedStyle(element).backgroundColor).toBe(
        getComputedStyle(reference).backgroundColor,
      );
      const positioner = element.parentElement as HTMLElement;
      expect(getComputedStyle(positioner).zIndex).toBe("50");
    });

    it("portals the content to document.body, outside the render container", async () => {
      const screen = await render(<Fruit />);
      const element = await openByClick();
      expect(screen.container.contains(element)).toBe(false);
      expect(document.body.contains(element)).toBe(true);
    });

    it("inherits a nested theme scope through `container`", async () => {
      function Scoped() {
        const scope = useRef<HTMLDivElement>(null);
        return (
          <div ref={scope} data-primary="lapis" data-testid="scope">
            <Fruit
              contentProps={{ container: scope }}
              extraItem={
                <SelectItem value="swatch">
                  <span data-testid="swatch" className="block size-4 bg-primary" />
                  Swatch
                </SelectItem>
              }
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
      expect(getComputedStyle(page.getByTestId("swatch").element()).backgroundColor).toBe(lapis);
    });
  });

  describe("layering", () => {
    it("works inside a modal Dialog, and Escape closes only the select", async () => {
      const onDialogOpenChange = vi.fn();
      await render(
        <Dialog onOpenChange={onDialogOpenChange}>
          <DialogTrigger render={<Button variant="outline" />}>Edit profile</DialogTrigger>
          <DialogContent>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Choose a fruit.</DialogDescription>
            <Fruit />
          </DialogContent>
        </Dialog>,
      );
      await userEvent.click(page.getByRole("button", { name: "Edit profile" }));
      await expect.element(page.getByRole("dialog")).toBeVisible();
      await openByClick();
      await userEvent.click(option("Cherry"));
      await expect.element(listbox()).not.toBeInTheDocument();
      await expect.element(trigger()).toHaveTextContent("Cherry");
      await expect.element(page.getByRole("dialog")).toBeVisible();

      await openByClick();
      await userEvent.keyboard("{Escape}");
      await expect.element(listbox()).not.toBeInTheDocument();
      await expect.element(page.getByRole("dialog")).toBeVisible();
      expect(onDialogOpenChange.mock.calls.filter(([open]) => open === false)).toHaveLength(0);
      await expect.poll(() => document.activeElement).toBe(trigger().element());

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

      it("the first Escape closes only the tooltip, the second the select; the app still hears it", async () => {
        const onOpenChange = vi.fn();
        await render(
          <Fruit
            onOpenChange={onOpenChange}
            extraItem={
              <SelectItem value="kiwi" label="Kiwi">
                Kiwi
                <Tooltip onOpenChange={tooltipSpy}>
                  <TooltipTrigger delay={0} closeDelay={0} render={<span data-testid="info" />}>
                    (seasonal)
                  </TooltipTrigger>
                  <TooltipContent>Available from October</TooltipContent>
                </Tooltip>
              </SelectItem>
            }
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
        // The select's cancelled close is not forwarded.
        expect(onOpenChange.mock.calls.filter(([open]) => open === false)).toHaveLength(0);

        await userEvent.keyboard("{Escape}");
        await expect.element(listbox()).not.toBeInTheDocument();
        expect(onOpenChange).toHaveBeenLastCalledWith(
          false,
          expect.objectContaining({ reason: "escape-key" }),
        );
      });
    });
  });

  it.each(["light", "dark"] as const)("has no axe violations while open (%s)", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    try {
      await render(
        <div className="bg-background p-16">
          <Field>
            <FieldLabel>Fruit</FieldLabel>
            <Select items={fruits} defaultValue="banana">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <FruitItems />
              </SelectContent>
            </Select>
            <FieldDescription>Pick one.</FieldDescription>
          </Field>
        </div>,
      );
      await userEvent.click(page.getByRole("combobox", { name: "Fruit" }));
      await expect.element(listbox()).toBeVisible();
      await waitForPopupSettled(popup() as HTMLElement);
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations while closed with a placeholder (%s)",
    async (theme) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      try {
        await render(
          <div className="bg-background p-4">
            <Field invalid>
              <FieldLabel>Fruit</FieldLabel>
              <Select items={fruits}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Pick a fruit" />
                </SelectTrigger>
                <SelectContent>
                  <FruitItems />
                </SelectContent>
              </Select>
            </Field>
          </div>,
        );
        const { violations, incomplete } = await auditOpenOverlay();
        expect(violations).toEqual([]);
        expect(incomplete).toEqual([]);
      } finally {
        document.documentElement.classList.remove("dark");
      }
    },
  );

  it("keeps SelectSeparator visible in forced colors", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    await render(<Fruit defaultOpen />);
    const sep = popup()?.querySelector('[data-slot="select-separator"]') as HTMLElement;
    const style = getComputedStyle(sep);
    expect(style.backgroundColor).toBe(systemColor("CanvasText"));
    expect(style.backgroundColor).not.toBe(systemColor("Canvas"));
  });
});
