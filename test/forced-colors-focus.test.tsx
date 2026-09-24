import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "../src/components/accordion";
import { Button } from "../src/components/button";
import { Checkbox } from "../src/components/checkbox";
import { Input } from "../src/components/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../src/components/menu";
import { Radio, RadioGroup } from "../src/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../src/components/select";
import { Switch } from "../src/components/switch";
import { Tabs, TabsList, type TabsListProps, TabsPanel, TabsTab } from "../src/components/tabs";
import { Textarea } from "../src/components/textarea";
import { Toaster, useToast } from "../src/components/toast";
import { emulateForcedColors, systemColor } from "./emulation";
import { waitForPopupSettled } from "./overlay";

/*
 * Spec Phase E §0: in forced colors (emulated for real via CDP) an interactive control shows no
 * outline until it gets keyboard focus, then a solid system-colour ring. Tailwind's
 * `outline-hidden` failed this: it leaves a transparent 2px outline that Chromium paints as
 * CanvasText, so every control looked focused all the time.
 */

beforeEach(async () => {
  await emulateForcedColors(true);
  expect(matchMedia("(forced-colors: active)").matches).toBe(true);
});

afterEach(async () => {
  await emulateForcedColors(false);
});

const outlineOf = (element: Element) => {
  const style = getComputedStyle(element);
  return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
};

function expectNoOutline(element: Element) {
  expect(outlineOf(element).style).toBe("none");
}

function expectFocusRing(element: Element) {
  const { style, width } = outlineOf(element);
  expect(style).toBe("solid");
  expect(width).toBeGreaterThanOrEqual(1);
}

/** Renders `ui`, checks the first tabbable control has no outline, Tabs to it, checks the ring. */
async function expectFocusOnlyOnTab(ui: ReactElement, name: string, role = "button") {
  await render(ui);
  const control = page.getByRole(role as "button", { name }).element();
  expectNoOutline(control);
  await userEvent.tab();
  expect(document.activeElement).toBe(control);
  expectFocusRing(control);
  return control;
}

describe("forced colors: focus is shown only on focus", () => {
  it("Button", async () => {
    await expectFocusOnlyOnTab(<Button>Save</Button>, "Save");
  });

  it("Checkbox", async () => {
    await expectFocusOnlyOnTab(<Checkbox aria-label="Accept" />, "Accept", "checkbox");
  });

  it("Switch", async () => {
    await expectFocusOnlyOnTab(<Switch aria-label="Wi-Fi" />, "Wi-Fi", "switch");
  });

  it("Radio", async () => {
    await expectFocusOnlyOnTab(
      <RadioGroup aria-label="Plan" defaultValue="free">
        <Radio value="free" aria-label="Free" />
        <Radio value="pro" aria-label="Pro" />
      </RadioGroup>,
      "Free",
      "radio",
    );
    expectNoOutline(page.getByRole("radio", { name: "Pro" }).element());
  });

  it("Accordion trigger", async () => {
    await expectFocusOnlyOnTab(
      <Accordion>
        <AccordionItem value="shipping">
          <AccordionTrigger>Shipping</AccordionTrigger>
          <AccordionPanel>Ships in two days.</AccordionPanel>
        </AccordionItem>
      </Accordion>,
      "Shipping",
    );
  });

  describe.each(["underline", "segmented"] as const)("Tabs (%s)", (variant) => {
    const Account = ({ variant: v }: { variant: TabsListProps["variant"] }) => (
      <Tabs defaultValue="profile">
        <TabsList aria-label="Account" variant={v}>
          <TabsTab value="profile">Profile</TabsTab>
          <TabsTab value="billing">Billing</TabsTab>
        </TabsList>
        <TabsPanel value="profile">Profile settings</TabsPanel>
        <TabsPanel value="billing">Billing settings</TabsPanel>
      </Tabs>
    );

    it("tab and panel", async () => {
      const tab = await expectFocusOnlyOnTab(<Account variant={variant} />, "Profile", "tab");
      const panel = page.getByRole("tabpanel").element();
      expectNoOutline(panel);
      expectNoOutline(page.getByRole("tab", { name: "Billing" }).element());
      await userEvent.tab();
      expect(document.activeElement).toBe(panel);
      expectFocusRing(panel);
      expectNoOutline(tab);
    });
  });

  it("keeps HighlightText on the hovered active segmented tab", async () => {
    await render(
      <Tabs defaultValue="profile">
        <TabsList aria-label="Account" variant="segmented">
          <TabsTab value="profile">Profile</TabsTab>
          <TabsTab value="billing">Billing</TabsTab>
        </TabsList>
        <TabsPanel value="profile">Profile settings</TabsPanel>
        <TabsPanel value="billing">Billing settings</TabsPanel>
      </Tabs>,
    );
    const profile = page.getByRole("tab", { name: "Profile" });
    await userEvent.hover(profile);
    expect(profile.element().matches(":hover")).toBe(true);
    const style = getComputedStyle(profile.element());
    expect(style.backgroundColor).toBe(systemColor("Highlight"));
    expect(style.color).toBe(systemColor("HighlightText"));
  });

  /*
   * Text fields have no outline offset: a CanvasText ring would merge with the CanvasText border,
   * so the focused ring is painted in Highlight.
   */
  describe("text fields (ring in Highlight)", () => {
    it("Input", async () => {
      const input = await expectFocusOnlyOnTab(<Input aria-label="Email" />, "Email", "textbox");
      expect(getComputedStyle(input).outlineColor).toBe(systemColor("Highlight"));
    });

    it("Textarea", async () => {
      const textarea = await expectFocusOnlyOnTab(<Textarea aria-label="Bio" />, "Bio", "textbox");
      expect(getComputedStyle(textarea).outlineColor).toBe(systemColor("Highlight"));
    });

    it("Select trigger", async () => {
      const trigger = await expectFocusOnlyOnTab(
        <Select items={{ apple: "Apple" }}>
          <SelectTrigger aria-label="Fruit">
            <SelectValue placeholder="Pick a fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
          </SelectContent>
        </Select>,
        "Fruit",
        "combobox",
      );
      expect(getComputedStyle(trigger).outlineColor).toBe(systemColor("Highlight"));
    });
  });

  it("Menu item: only the highlighted item has a ring", async () => {
    await render(
      <Menu>
        <MenuTrigger render={<Button variant="outline" />}>Actions</MenuTrigger>
        <MenuContent>
          <MenuItem>Edit</MenuItem>
          <MenuItem>Archive</MenuItem>
        </MenuContent>
      </Menu>,
    );
    await userEvent.click(page.getByRole("button", { name: "Actions" }));
    const popup = document.querySelector("[data-slot=menu-content]") as HTMLElement;
    await waitForPopupSettled(popup);
    const edit = page.getByRole("menuitem", { name: "Edit" }).element();
    const archive = page.getByRole("menuitem", { name: "Archive" }).element();
    expectNoOutline(edit);
    expectNoOutline(archive);
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(() => edit.hasAttribute("data-highlighted")).toBe(true);
    expectFocusRing(edit);
    expectNoOutline(archive);
  });

  it("Select item: only the highlighted item has a ring", async () => {
    await render(
      <div className="p-16">
        <Select items={{ apple: "Apple", banana: "Banana", cherry: "Cherry" }}>
          <SelectTrigger aria-label="Fruit">
            <SelectValue placeholder="Pick a fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="cherry">Cherry</SelectItem>
          </SelectContent>
        </Select>
      </div>,
    );
    await userEvent.click(page.getByRole("combobox", { name: "Fruit" }));
    const popup = document.querySelector("[data-slot=select-content]") as HTMLElement;
    await waitForPopupSettled(popup);
    const option = (name: string) => page.getByRole("option", { name, exact: true }).element();
    for (const name of ["Apple", "Banana", "Cherry"]) {
      if (!option(name).hasAttribute("data-highlighted")) expectNoOutline(option(name));
    }
    await userEvent.keyboard("{ArrowDown}");
    const highlighted = () =>
      ["Apple", "Banana", "Cherry"].map(option).filter((o) => o.hasAttribute("data-highlighted"));
    await expect.poll(() => highlighted().length).toBe(1);
    const active = highlighted()[0] as Element;
    expectFocusRing(active);
    for (const name of ["Apple", "Banana", "Cherry"]) {
      if (option(name) !== active) expectNoOutline(option(name));
    }
  });

  it("Toast root: the focus ring is distinguishable from the unfocused surface", async () => {
    let api: ReturnType<typeof useToast> | undefined;
    function Capture() {
      api = useToast();
      return null;
    }
    await render(
      <Toaster>
        <Capture />
      </Toaster>,
    );
    await expect.poll(() => api).toBeDefined();
    api?.add({ title: "Saved", timeout: 0 });
    const toastRoot = () => document.body.querySelector<HTMLElement>('[data-slot="toast"]');
    await expect.poll(toastRoot).not.toBeNull();
    const root = toastRoot() as HTMLElement;
    const idle = getComputedStyle(root);
    const before = `${idle.outlineStyle} ${idle.outlineWidth} ${idle.outlineColor}`;
    await userEvent.keyboard("{F6}");
    await expect
      .poll(() => document.activeElement)
      .toBe(document.body.querySelector('[data-slot="toaster"]'));
    await userEvent.tab();
    await expect.poll(() => document.activeElement).toBe(root);
    expectFocusRing(root);
    const focused = getComputedStyle(root);
    expect(`${focused.outlineStyle} ${focused.outlineWidth} ${focused.outlineColor}`).not.toBe(
      before,
    );
  });
});
