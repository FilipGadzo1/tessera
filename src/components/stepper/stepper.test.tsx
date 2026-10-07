import axe from "axe-core";
import { type ReactElement, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, emulateReducedMotion, systemColor } from "../../../test/emulation";
import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  type StepperProps,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "./stepper";
import * as stories from "./stepper.stories";

const STEPS = [
  { title: "Account", description: "Your login" },
  { title: "Shipping", description: "Where it goes" },
  { title: "Payment", description: "How you pay" },
  { title: "Review", description: "Check and confirm" },
];

type ItemProps = { completed?: boolean; error?: boolean; disabled?: boolean };

/** The fixture: four steps, each a trigger (indicator, title, description) and a separator. */
function Wizard({
  items = {},
  ...props
}: Omit<StepperProps, "children"> & { items?: Record<number, ItemProps> }) {
  return (
    <Stepper {...props}>
      {STEPS.map((step, index) => (
        <StepperItem key={step.title} step={index} {...items[index]}>
          <StepperTrigger>
            <StepperIndicator />
            <span className="flex flex-col">
              <StepperTitle>{step.title}</StepperTitle>
              <StepperDescription>{step.description}</StepperDescription>
            </span>
          </StepperTrigger>
          {index < STEPS.length - 1 && <StepperSeparator />}
        </StepperItem>
      ))}
    </Stepper>
  );
}

/** A display-only stepper: no triggers (the last item's parts sit inside a fragment). */
function Display({ value }: { value: number }) {
  return (
    <Stepper value={value} aria-label="Order status">
      {STEPS.map((step, index) => (
        <StepperItem key={step.title} step={index}>
          {index === STEPS.length - 1 ? (
            <>
              <StepperIndicator />
              <StepperTitle>{step.title}</StepperTitle>
            </>
          ) : (
            <>
              <StepperIndicator />
              <StepperTitle>{step.title}</StepperTitle>
              <StepperSeparator />
            </>
          )}
        </StepperItem>
      ))}
    </Stepper>
  );
}

const slots = (slot: string, scope: ParentNode = document) => [
  ...scope.querySelectorAll<HTMLElement>(`[data-slot=${slot}]`),
];
const triggers = () => slots("stepper-trigger");
const trigger = (index: number) => triggers()[index] as HTMLElement;
const listItems = () => slots("stepper-item");
const listItem = (index: number) => listItems()[index] as HTMLElement;
const indicator = (index: number) => slots("stepper-indicator")[index] as HTMLElement;
const separator = (index: number) => slots("stepper-separator")[index] as HTMLElement;
const title = (index: number) => slots("stepper-title")[index] as HTMLElement;
const states = () => listItems().map((element) => element.getAttribute("data-state"));
const disabledSteps = () =>
  triggers().flatMap((element, index) =>
    element.getAttribute("aria-disabled") === "true" ? [index] : [],
  );
const reachableSteps = () =>
  triggers().flatMap((element, index) => (element.hasAttribute("aria-disabled") ? [] : [index]));

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Waits (polling, no fixed sleep) until nothing in the document is animating. */
async function animationsSettled() {
  await nextFrame();
  await expect.poll(() => document.getAnimations().length).toBe(0);
}

const center = (rect: DOMRect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

describe("Stepper structure", () => {
  it("is an ol role=list named Progress, an li per item, with data-slots", async () => {
    await render(<Wizard />);
    const list = page.getByRole("list", { name: "Progress" });
    await expect.element(list).toBeInTheDocument();
    const root = list.element() as HTMLElement;
    expect(root.tagName).toBe("OL");
    expect(root.getAttribute("role")).toBe("list");
    expect(root.getAttribute("data-slot")).toBe("stepper");
    expect(root.getAttribute("data-orientation")).toBe("horizontal");
    expect(page.getByRole("listitem").elements()).toHaveLength(4);
    for (const element of listItems()) {
      expect(element.tagName).toBe("LI");
      expect(element.getAttribute("data-orientation")).toBe("horizontal");
    }
    expect(triggers()).toHaveLength(4);
    for (const element of triggers()) {
      expect(element.tagName).toBe("BUTTON");
      expect(element.getAttribute("type")).toBe("button");
    }
    expect(slots("stepper-indicator")).toHaveLength(4);
    for (const element of slots("stepper-indicator")) {
      expect(element.getAttribute("aria-hidden")).toBe("true");
    }
    expect(slots("stepper-title")).toHaveLength(4);
    expect(slots("stepper-description")).toHaveLength(4);
    expect(slots("stepper-separator")).toHaveLength(3);
    for (const element of slots("stepper-separator")) {
      expect(element.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("aria-label or aria-labelledby replaces the default name", async () => {
    await render(
      <>
        <Wizard aria-label="Checkout" />
        <h2 id="setup-heading">Setup</h2>
        <Wizard aria-labelledby="setup-heading" />
      </>,
    );
    await expect.element(page.getByRole("list", { name: "Checkout" })).toBeInTheDocument();
    const setup = page.getByRole("list", { name: "Setup" });
    await expect.element(setup).toBeInTheDocument();
    expect(setup.element().hasAttribute("aria-label")).toBe(false);
  });

  it.each([
    {
      label: "value 0",
      value: 0,
      items: {},
      expected: ["current", "upcoming", "upcoming", "upcoming"],
    },
    {
      label: "value 2",
      value: 2,
      items: {},
      expected: ["complete", "complete", "current", "upcoming"],
    },
    {
      label: "the last",
      value: 3,
      items: {},
      expected: ["complete", "complete", "complete", "current"],
    },
    {
      label: "an error on 1",
      value: 2,
      items: { 1: { error: true } },
      expected: ["complete", "error", "current", "upcoming"],
    },
    {
      label: "completed={false} on an earlier step",
      value: 2,
      items: { 0: { completed: false } },
      expected: ["upcoming", "complete", "current", "upcoming"],
    },
    {
      label: "completed on a later step",
      value: 0,
      items: { 2: { completed: true } },
      expected: ["current", "upcoming", "complete", "upcoming"],
    },
    {
      label: "completed on the current step",
      value: 1,
      items: { 1: { completed: true } },
      expected: ["complete", "complete", "upcoming", "upcoming"],
    },
    {
      label: "an error that is also completed",
      value: 2,
      items: { 0: { completed: true, error: true } },
      expected: ["error", "complete", "current", "upcoming"],
    },
  ] as { label: string; value: number; items: Record<number, ItemProps>; expected: string[] }[])(
    "data-state per item: $label",
    async ({ value, items, expected }) => {
      await render(<Wizard value={value} items={items} />);
      expect(states()).toEqual(expected);
      for (const [index, state] of expected.entries()) {
        expect(indicator(index).getAttribute("data-state")).toBe(state);
        if (index < 3) expect(separator(index).getAttribute("data-state")).toBe(state);
      }
    },
  );

  it("aria-current=step is on the current trigger only, even when it is complete", async () => {
    await render(<Wizard value={1} items={{ 1: { completed: true } }} />);
    const current = triggers().map((element) => element.getAttribute("aria-current"));
    expect(current).toEqual([null, "step", null, null]);
    expect(listItem(1).getAttribute("data-state")).toBe("complete");
    for (const element of listItems()) expect(element.hasAttribute("aria-current")).toBe(false);
  });

  it("display-only: no buttons, aria-current on the li (also when its parts sit in a fragment)", async () => {
    const screen = await render(<Display value={1} />);
    expect(document.querySelectorAll("button")).toHaveLength(0);
    expect(listItems().map((element) => element.getAttribute("aria-current"))).toEqual([
      null,
      "step",
      null,
      null,
    ]);
    expect(states()).toEqual(["complete", "current", "upcoming", "upcoming"]);
    await screen.rerender(<Display value={3} />);
    expect(listItems().map((element) => element.getAttribute("aria-current"))).toEqual([
      null,
      null,
      null,
      "step",
    ]);
  });

  it("server HTML: display-only aria-current and the linear reachability are decided from the children", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Display value={2} />);
    expect(
      [...container.querySelectorAll("li")].map((element) => element.getAttribute("aria-current")),
    ).toEqual([null, null, "step", null]);
    container.innerHTML = renderToString(<Wizard value={0} items={{ 0: { completed: true } }} />);
    expect(
      [...container.querySelectorAll("button")].map((element) =>
        element.getAttribute("aria-disabled"),
      ),
    ).toEqual([null, null, "true", "true"]);
  });
});

describe("Stepper names", () => {
  it("a complete step is named with its state; the current one by its title; described by its description", async () => {
    await render(<Wizard value={2} />);
    await expect
      .element(page.getByRole("button", { name: "Shipping Completed" }))
      .toBeInTheDocument();
    const payment = page.getByRole("button", { name: "Payment", exact: true });
    await expect.element(payment).toHaveAccessibleName("Payment");
    await expect.element(payment).toHaveAccessibleDescription("How you pay");
    await expect
      .element(page.getByRole("button", { name: "Review", exact: true }))
      .toBeInTheDocument();
  });

  it("an error step is named with Error", async () => {
    await render(<Wizard value={2} items={{ 1: { error: true } }} />);
    await expect.element(page.getByRole("button", { name: "Shipping Error" })).toBeInTheDocument();
  });

  it("stateLabel localises the state text", async () => {
    await render(
      <Wizard
        value={2}
        items={{ 0: { error: true } }}
        stateLabel={(state) =>
          ({ complete: "Erledigt", error: "Fehler", current: "Aktuell", upcoming: "" })[state]
        }
      />,
    );
    await expect.element(page.getByRole("button", { name: "Account Fehler" })).toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Shipping Erledigt" }))
      .toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Payment Aktuell" })).toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Review", exact: true }))
      .toBeInTheDocument();
  });

  it("without a description the trigger has no aria-describedby", async () => {
    await render(
      <Stepper>
        <StepperItem step={0}>
          <StepperTrigger>
            <StepperIndicator />
            <StepperTitle>Only</StepperTitle>
          </StepperTrigger>
        </StepperItem>
      </Stepper>,
    );
    await expect.element(page.getByRole("button", { name: "Only" })).toBeInTheDocument();
    expect(trigger(0).hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("Stepper reachability", () => {
  // Spec §4's examples (linear, 4 steps).
  it.each([
    { label: "value 0, nothing completed", value: 0, items: {}, reachable: [0] },
    {
      label: "value 0, completed {0}",
      value: 0,
      items: { 0: { completed: true } },
      reachable: [0, 1],
    },
    {
      label: "value 0 after going Back, completed {0, 1, 2}",
      value: 0,
      items: { 0: { completed: true }, 1: { completed: true }, 2: { completed: true } },
      reachable: [0, 1, 2, 3],
    },
    { label: "value 2, error on 1", value: 2, items: { 1: { error: true } }, reachable: [0, 1, 2] },
    {
      label: "value 1, completed {0, 2}",
      value: 1,
      items: { 0: { completed: true }, 2: { completed: true } },
      reachable: [0, 1],
    },
    {
      label: "value 1, an error on the current step",
      value: 1,
      items: { 1: { error: true, completed: true } },
      reachable: [0, 1],
    },
  ] as { label: string; value: number; items: Record<number, ItemProps>; reachable: number[] }[])(
    "$label → reachable $reachable",
    async ({ value, items, reachable }) => {
      const onValueChange = vi.fn();
      await render(<Wizard value={value} items={items} onValueChange={onValueChange} />);
      expect(reachableSteps()).toEqual(reachable);
      const unreachable = [0, 1, 2, 3].filter((step) => !reachable.includes(step));
      expect(disabledSteps()).toEqual(unreachable);
      for (const step of [0, 1, 2, 3]) {
        expect(listItem(step).hasAttribute("data-disabled")).toBe(unreachable.includes(step));
        expect(trigger(step).hasAttribute("data-disabled")).toBe(unreachable.includes(step));
        // Focusable, never the native disabled attribute.
        expect(trigger(step).hasAttribute("disabled")).toBe(false);
      }
      for (const step of unreachable) {
        await userEvent.click(page.elementLocator(trigger(step)), { force: true });
        trigger(step).focus();
        await userEvent.keyboard("{Enter}");
        await userEvent.keyboard(" ");
      }
      await nextFrame();
      expect(onValueChange).not.toHaveBeenCalled();
    },
  );

  it("non-linear: every enabled step is reachable; a disabled one never is", async () => {
    const onValueChange = vi.fn();
    await render(
      <Wizard
        linear={false}
        value={0}
        items={{ 2: { disabled: true } }}
        onValueChange={onValueChange}
      />,
    );
    expect(disabledSteps()).toEqual([2]);
    await userEvent.click(page.elementLocator(trigger(2)), { force: true });
    expect(onValueChange).not.toHaveBeenCalled();
    await userEvent.click(page.elementLocator(trigger(3)));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(3);
  });

  it("linear: a disabled step is unreachable even before the current one", async () => {
    const onValueChange = vi.fn();
    await render(
      <Wizard value={3} items={{ 1: { disabled: true } }} onValueChange={onValueChange} />,
    );
    expect(disabledSteps()).toEqual([1]);
    await userEvent.click(page.elementLocator(trigger(1)), { force: true });
    await nextFrame();
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("Stepper keyboard", () => {
  it("Tab visits every trigger in order, the aria-disabled ones included", async () => {
    await render(
      <>
        <button type="button">Before</button>
        <Wizard value={1} items={{ 1: { completed: true } }} />
        <button type="button">After</button>
      </>,
    );
    expect(disabledSteps()).toEqual([3]);
    await userEvent.click(page.getByRole("button", { name: "Before" }));
    for (const step of [0, 1, 2, 3]) {
      await userEvent.tab();
      expect(document.activeElement).toBe(trigger(step));
    }
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "After" }).element());
    for (const step of [3, 2, 1, 0]) {
      await userEvent.tab({ shift: true });
      expect(document.activeElement).toBe(trigger(step));
    }
  });

  it("Enter and Space activate a reachable step; on the current one they call nothing", async () => {
    const onValueChange = vi.fn();
    await render(
      <Wizard value={1} items={{ 1: { completed: true } }} onValueChange={onValueChange} />,
    );
    trigger(1).focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onValueChange).not.toHaveBeenCalled();
    trigger(0).focus();
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith(0);
    trigger(2).focus();
    await userEvent.keyboard(" ");
    expect(onValueChange).toHaveBeenLastCalledWith(2);
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  // Pinned (scope ruling): plain buttons, every step a Tab stop, no arrow-key navigation.
  it("← / → / ↑ / ↓ / Home / End do nothing", async () => {
    const onValueChange = vi.fn();
    await render(
      <Wizard
        linear={false}
        defaultValue={1}
        onValueChange={onValueChange}
        orientation="horizontal"
      />,
    );
    trigger(1).focus();
    for (const key of [
      "{ArrowRight}",
      "{ArrowLeft}",
      "{ArrowDown}",
      "{ArrowUp}",
      "{Home}",
      "{End}",
    ]) {
      await userEvent.keyboard(key);
      expect(document.activeElement).toBe(trigger(1));
    }
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger(1).getAttribute("aria-current")).toBe("step");
  });
});

describe("Stepper controlled and uncontrolled", () => {
  it("defaultValue seeds an uncontrolled stepper that follows its own changes, one call per change", async () => {
    const onValueChange = vi.fn();
    await render(<Wizard defaultValue={2} onValueChange={onValueChange} />);
    expect(trigger(2).getAttribute("aria-current")).toBe("step");
    await userEvent.click(page.elementLocator(trigger(0)));
    await expect.poll(() => trigger(0).getAttribute("aria-current")).toBe("step");
    expect(states()).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(0);
    // The current step again: no change, no call.
    await userEvent.click(page.elementLocator(trigger(0)));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    // Going Back made the later steps unreachable (the Stepper does not remember completion).
    expect(disabledSteps()).toEqual([1, 2, 3]);
  });

  it("value + onValueChange: the parent's state drives the stepper", async () => {
    function Controlled() {
      const [value, setValue] = useState(0);
      return (
        <>
          <Wizard value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue((current) => current + 1)}>
            Next
          </button>
          <output>{value}</output>
        </>
      );
    }
    await render(<Controlled />);
    await userEvent.click(page.getByRole("button", { name: "Next" }));
    await userEvent.click(page.getByRole("button", { name: "Next" }));
    await expect.poll(() => trigger(2).getAttribute("aria-current")).toBe("step");
    await userEvent.click(page.elementLocator(trigger(0)));
    await expect.element(page.getByRole("status")).toHaveTextContent("0");
    expect(trigger(0).getAttribute("aria-current")).toBe("step");
  });

  it("a controlled parent that ignores the change keeps the current step", async () => {
    const onValueChange = vi.fn();
    await render(<Wizard value={1} onValueChange={onValueChange} />);
    await userEvent.click(page.elementLocator(trigger(0)));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(0);
    await nextFrame();
    expect(trigger(1).getAttribute("aria-current")).toBe("step");
    expect(trigger(0).hasAttribute("aria-current")).toBe(false);
  });
});

describe("Stepper indicator", () => {
  it("shows the number, a check when complete, an alert when in error; children override", async () => {
    await render(
      <>
        <Wizard value={2} items={{ 1: { error: true } }} />
        <Stepper aria-label="Custom">
          <StepperItem step={0}>
            <StepperTrigger>
              <StepperIndicator>A</StepperIndicator>
              <StepperTitle>Custom</StepperTitle>
            </StepperTrigger>
          </StepperItem>
        </Stepper>
      </>,
    );
    expect(indicator(0).querySelector("[data-slot=stepper-check-icon]")).not.toBeNull();
    expect(indicator(0).textContent).toBe("");
    expect(indicator(1).querySelector("[data-slot=stepper-alert-icon]")).not.toBeNull();
    expect(indicator(1).querySelector("[data-slot=stepper-check-icon]")).toBeNull();
    expect(indicator(2).textContent).toBe("3");
    expect(indicator(2).querySelector("svg")).toBeNull();
    expect(indicator(3).textContent).toBe("4");
    expect(indicator(4).textContent).toBe("A");
  });
});

describe("Stepper orientation and RTL", () => {
  it.each(["ltr", "rtl"] as const)(
    "horizontal (%s): separators are 2px tall, stretch between the triggers and line up with the indicators",
    async (dir) => {
      await render(
        <div dir={dir} style={{ width: 800 }}>
          <Wizard value={1} />
        </div>,
      );
      for (const index of [0, 1, 2]) {
        const line = separator(index).getBoundingClientRect();
        expect(line.height).toBe(2);
        expect(line.width).toBeGreaterThan(40);
        const own = trigger(index).getBoundingClientRect();
        const next = trigger(index + 1).getBoundingClientRect();
        expect(
          Math.abs(center(line).y - center(indicator(index).getBoundingClientRect()).y),
        ).toBeLessThanOrEqual(0.5);
        if (dir === "ltr") {
          expect(line.left).toBeGreaterThanOrEqual(own.right);
          expect(next.left).toBeGreaterThanOrEqual(line.right);
        } else {
          expect(line.right).toBeLessThanOrEqual(own.left);
          expect(next.right).toBeLessThanOrEqual(line.left);
        }
      }
    },
  );

  it("horizontal: when the titles fill the row, separators keep 24px and the triggers wrap instead", async () => {
    await render(
      <div style={{ width: 560 }}>
        <Wizard value={1} />
      </div>,
    );
    for (const index of [0, 1, 2]) {
      const line = separator(index).getBoundingClientRect();
      expect(line.width).toBeGreaterThanOrEqual(24);
      expect(
        Math.abs(center(line).y - center(indicator(index).getBoundingClientRect()).y),
      ).toBeLessThanOrEqual(0.5);
    }
    const list = (slots("stepper")[0] as HTMLElement).getBoundingClientRect();
    expect(list.width).toBe(560);
    expect(trigger(3).getBoundingClientRect().right).toBeLessThanOrEqual(list.right);
  });

  it.each(["ltr", "rtl"] as const)(
    "vertical (%s): separators are 2px wide, centred under the indicator, between the triggers",
    async (dir) => {
      await render(
        <div dir={dir}>
          <Wizard value={1} orientation="vertical" />
        </div>,
      );
      expect(slots("stepper")[0]?.getAttribute("data-orientation")).toBe("vertical");
      expect(listItem(0).getAttribute("data-orientation")).toBe("vertical");
      for (const index of [0, 1, 2]) {
        const line = separator(index).getBoundingClientRect();
        const dot = indicator(index).getBoundingClientRect();
        expect(line.width).toBe(2);
        expect(line.height).toBeGreaterThanOrEqual(24);
        expect(Math.abs(center(line).x - center(dot).x)).toBeLessThanOrEqual(0.5);
        expect(line.top).toBeGreaterThanOrEqual(trigger(index).getBoundingClientRect().bottom);
        expect(trigger(index + 1).getBoundingClientRect().top).toBeGreaterThanOrEqual(line.bottom);
      }
      const first = indicator(0).getBoundingClientRect();
      const list = (slots("stepper")[0] as HTMLElement).getBoundingClientRect();
      if (dir === "ltr") expect(first.left).toBe(list.left);
      else expect(first.right).toBe(list.right);
    },
  );

  it("under dir=rtl the first item sits right of the second", async () => {
    await render(
      <div dir="rtl">
        <Wizard />
      </div>,
    );
    expect(listItem(0).getBoundingClientRect().left).toBeGreaterThan(
      listItem(1).getBoundingClientRect().left,
    );
  });
});

describe("Stepper styles", () => {
  it("a focused aria-disabled trigger: opacity 1, a full-strength 2px ring, muted title, not-allowed", async () => {
    await render(
      <div className="bg-background">
        <button type="button">Before</button>
        <Wizard value={0} />
        <span data-testid="muted" className="text-muted-foreground" />
        <span data-testid="foreground" className="text-foreground" />
      </div>,
    );
    await userEvent.click(page.getByRole("button", { name: "Before" }));
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger(1));
    expect(trigger(1).getAttribute("aria-disabled")).toBe("true");
    const style = getComputedStyle(trigger(1));
    expect(style.opacity).toBe("1");
    expect(style.cursor).toBe("not-allowed");
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
    const ring = style.outlineColor;
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(trigger(0));
    // The same ring as on a reachable trigger.
    expect(getComputedStyle(trigger(0)).outlineColor).toBe(ring);
    expect(getComputedStyle(trigger(0)).cursor).toBe("pointer");
    expect(getComputedStyle(title(1)).color).toBe(
      getComputedStyle(page.getByTestId("muted").element()).color,
    );
    expect(getComputedStyle(title(0)).color).toBe(
      getComputedStyle(page.getByTestId("foreground").element()).color,
    );
  });

  it("forced colors: current indicator Highlight/HighlightText, unadjusted", async () => {
    await emulateForcedColors(true);
    await render(<Wizard value={1} />);
    await animationsSettled();
    const style = getComputedStyle(indicator(1));
    expect(style.backgroundColor).toBe(systemColor("Highlight"));
    expect(style.color).toBe(systemColor("HighlightText"));
    expect(style.borderTopColor).toBe(systemColor("Highlight"));
    expect(style.forcedColorAdjust).toBe("none");
  });

  it.each(["horizontal", "vertical"] as const)(
    "forced colors (%s): a complete step shows the check and a 4px CanvasText separator",
    async (orientation) => {
      await emulateForcedColors(true);
      await render(<Wizard value={1} orientation={orientation} />);
      await animationsSettled();
      expect(indicator(0).querySelector("[data-slot=stepper-check-icon]")).not.toBeNull();
      const thickness = (index: number) => {
        const rect = separator(index).getBoundingClientRect();
        return orientation === "horizontal" ? rect.height : rect.width;
      };
      expect(thickness(0)).toBe(4);
      expect(thickness(1)).toBe(2);
      // Still centred on the indicator.
      for (const index of [0, 1]) {
        const line = center(separator(index).getBoundingClientRect());
        const dot = center(indicator(index).getBoundingClientRect());
        const offset = orientation === "horizontal" ? line.y - dot.y : line.x - dot.x;
        expect(Math.abs(offset)).toBeLessThanOrEqual(0.5);
      }
      expect(getComputedStyle(separator(0)).backgroundColor).toBe(systemColor("CanvasText"));
      expect(getComputedStyle(separator(1)).backgroundColor).toBe(systemColor("CanvasText"));
      await emulateForcedColors(false);
      expect(thickness(0)).toBe(2);
    },
  );

  it("forced colors: the ring is none until focused, then Highlight; an aria-disabled title is GrayText", async () => {
    await emulateForcedColors(true);
    await render(<Wizard value={0} />);
    expect(getComputedStyle(trigger(0)).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger(0));
    const style = getComputedStyle(trigger(0));
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineColor).toBe(systemColor("Highlight"));
    expect(getComputedStyle(title(1)).color).toBe(systemColor("GrayText"));
    expect(getComputedStyle(title(0)).color).toBe(systemColor("CanvasText"));
  });

  it("the indicator and separator colours transition, and not under reduced motion", async () => {
    await render(<Wizard value={1} />);
    const dot = indicator(0);
    const line = separator(0);
    expect(getComputedStyle(dot).transitionProperty).toBe("color, background-color, border-color");
    expect(getComputedStyle(dot).transitionDuration).toBe("0.15s");
    expect(getComputedStyle(line).transitionProperty).toBe("background-color");
    expect(getComputedStyle(line).transitionDuration).toBe("0.15s");
    await emulateReducedMotion(true);
    expect(getComputedStyle(dot).transitionProperty).toBe("none");
    expect(getComputedStyle(line).transitionProperty).toBe("none");
  });

  it("an error step's title is danger-coloured and its indicator holds the alert icon", async () => {
    await render(
      <div className="bg-background">
        <Wizard value={2} items={{ 1: { error: true } }} />
        <span data-testid="danger" className="text-danger" />
      </div>,
    );
    expect(getComputedStyle(title(1)).color).toBe(
      getComputedStyle(page.getByTestId("danger").element()).color,
    );
  });
});

describe("Stepper stories", () => {
  /** Renders a story through its render (or the meta's). */
  function StoryView({ story }: { story: { args?: object; render?: unknown } }) {
    const Render = story.render as (args: object) => ReactElement;
    return <Render {...story.args} />;
  }

  it("the horizontal wizard stays within a 390px viewport (vertical when narrow)", async () => {
    await page.viewport(390, 800);
    onTestFinished(() => page.viewport(414, 896));
    await render(
      <div className="p-4">
        <StoryView story={stories.HorizontalWizard} />
      </div>,
    );
    await expect.poll(() => slots("stepper")[0]?.getAttribute("data-orientation")).toBe("vertical");
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
    for (const element of [...triggers(), ...slots("stepper-title")]) {
      expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(390);
    }
  });

  it("the wizard's Next marks the step complete, and Back keeps it reachable", async () => {
    await page.viewport(1024, 900);
    onTestFinished(() => page.viewport(414, 896));
    await render(<StoryView story={stories.HorizontalWizard} />);
    expect(slots("stepper")[0]?.getAttribute("data-orientation")).toBe("horizontal");
    await userEvent.click(page.getByRole("button", { name: "Next" }));
    await userEvent.click(page.getByRole("button", { name: "Next" }));
    await expect.poll(() => trigger(2).getAttribute("aria-current")).toBe("step");
    await userEvent.click(page.getByRole("button", { name: "Back" }));
    await userEvent.click(page.getByRole("button", { name: "Back" }));
    await expect.poll(() => trigger(0).getAttribute("aria-current")).toBe("step");
    expect(states()).toEqual(["complete", "complete", "upcoming", "upcoming"]);
    expect(reachableSteps()).toEqual([0, 1, 2]);
    await userEvent.click(page.elementLocator(trigger(2)));
    await expect.poll(() => trigger(2).getAttribute("aria-current")).toBe("step");
  });
});

describe("Stepper axe", () => {
  async function audit(container: Element) {
    const results = await axe.run(container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  }

  // Four titled steps need more than the default 414px test viewport in a row (see the 390px test).
  it.each(["light", "dark"] as const)("has no violations in the %s theme", async (theme) => {
    await page.viewport(1024, 900);
    onTestFinished(() => page.viewport(414, 896));
    const screen = await render(
      <div
        className={
          theme === "dark"
            ? "dark flex flex-col gap-6 bg-background p-4"
            : "flex flex-col gap-6 bg-background p-4"
        }
      >
        <Wizard aria-label="Horizontal" value={1} items={{ 1: { completed: true } }} />
        <Wizard
          aria-label="Vertical"
          orientation="vertical"
          value={2}
          items={{ 1: { error: true } }}
        />
        <Display value={1} />
      </div>,
    );
    await expect.element(page.getByRole("list", { name: "Vertical" })).toBeInTheDocument();
    await animationsSettled();
    await audit(screen.container);
  });
});
