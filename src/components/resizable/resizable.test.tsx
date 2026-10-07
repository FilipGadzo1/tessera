import axe from "axe-core";
import { type ReactElement, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateMedia,
  emulateReducedMotion,
  systemColor,
} from "../../../test/emulation";
import { isRtl } from "../../lib/direction";
import {
  ResizableHandle,
  type ResizableHandleProps,
  ResizablePanel,
  ResizablePanelGroup,
  type ResizablePanelGroupProps,
  type ResizablePanelProps,
} from "./resizable";
import * as stories from "./resizable.stories";

// Every export keeps its implementation; `isRtl` (the only direction read) records its calls.
vi.mock("../../lib/direction", { spy: true });

afterEach(() => {
  vi.mocked(isRtl).mockClear();
});

/** The panel space of the fixtures in px (each handle is 1px more): 1% is 3px. */
const SPACE = 300;

type TwoProps = Omit<ResizablePanelGroupProps, "children"> & {
  first?: ResizablePanelProps;
  second?: ResizablePanelProps;
  handle?: ResizableHandleProps;
  dir?: "ltr" | "rtl";
};

/** Two panels (the first 50% unless overridden) around one handle, in a 300px panel space. */
function Two({ first, second, handle, dir, orientation = "horizontal", ...props }: TwoProps) {
  const vertical = orientation === "vertical";
  return (
    <div
      dir={dir}
      style={vertical ? { width: 200, height: SPACE + 1 } : { width: SPACE + 1, height: 200 }}
    >
      <ResizablePanelGroup orientation={orientation} {...props}>
        <ResizablePanel defaultSize={50} {...first}>
          One
        </ResizablePanel>
        <ResizableHandle {...handle} />
        <ResizablePanel {...second}>Two</ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

const slots = (slot: string, scope: ParentNode = document) => [
  ...scope.querySelectorAll<HTMLElement>(`[data-slot=${slot}]`),
];
const handle = (index = 0) => slots("resizable-handle")[index] as HTMLElement;
const panel = (index: number) => slots("resizable-panel")[index] as HTMLElement;
const group = () => slots("resizable-panel-group")[0] as HTMLElement;
const valueNow = (index = 0) => Number(handle(index).getAttribute("aria-valuenow"));
const valueMin = (index = 0) => Number(handle(index).getAttribute("aria-valuemin"));
const valueMax = (index = 0) => Number(handle(index).getAttribute("aria-valuemax"));

/** Each panel's rendered size along the group's axis matches `percents` of SPACE (±1px). */
function expectSizes(percents: number[], vertical = false) {
  percents.forEach((percent, index) => {
    const rect = panel(index).getBoundingClientRect();
    const size = vertical ? rect.height : rect.width;
    expect(Math.abs(size - (percent * SPACE) / 100), `panel ${index}: ${size}px`).toBeLessThan(
      1.01,
    );
  });
}

async function press(key: string, index = 0) {
  handle(index).focus();
  await userEvent.keyboard(`{${key}}`);
}

/**
 * A real (Playwright) mouse drag of handle `index` to where the preceding panel would be
 * `percent` of the panel space, in 12 steps. `rtl`: the preceding panel is on the right.
 */
async function dragTo(percent: number, { index = 0, vertical = false, rtl = false } = {}) {
  const target = handle(index).parentElement as HTMLElement;
  const rect = target.getBoundingClientRect();
  const along = (percent * SPACE) / 100 + 0.5;
  const position = vertical
    ? { x: rect.width / 2, y: along }
    : { x: rtl ? rect.width - along : along, y: rect.height / 2 };
  await userEvent.dragAndDrop(page.elementLocator(handle(index)), page.elementLocator(target), {
    force: true,
    targetPosition: position,
    steps: 12,
  } as Parameters<typeof userEvent.dragAndDrop>[2]);
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

describe("Resizable structure and ARIA", () => {
  it("renders the parts with data-slots, the group's orientation and panel ids", async () => {
    await render(<Two first={{ id: "nav" }} />);
    expect(group().getAttribute("data-orientation")).toBe("horizontal");
    expect(slots("resizable-panel")).toHaveLength(2);
    expect(panel(0).id).toBe("nav");
    expect(panel(1).id).not.toBe("");
    expect(handle().getAttribute("data-orientation")).toBe("horizontal");
    expect(handle().tabIndex).toBe(0);
    expect(getComputedStyle(group()).display).toBe("flex");
    expect(getComputedStyle(panel(0)).flexGrow).toBe("50");
    expect(getComputedStyle(panel(0)).overflow).toBe("hidden");
    expect(getComputedStyle(handle()).touchAction).toBe("none");
  });

  it("is a focusable separator controlling the preceding panel, vertical in a horizontal group", async () => {
    await render(<Two first={{ id: "nav", minSize: 20, maxSize: 80 }} />);
    const separator = page.getByRole("separator", { name: "Resize panel" });
    await expect.element(separator).toBeInTheDocument();
    expect(handle().getAttribute("aria-orientation")).toBe("vertical");
    expect(handle().getAttribute("aria-controls")).toBe("nav");
    expect(valueNow()).toBe(50);
    expect(valueMin()).toBe(20);
    expect(valueMax()).toBe(80);
  });

  it("aria-controls names a generated panel id", async () => {
    await render(<Two />);
    await expect.poll(() => handle().getAttribute("aria-controls")).toBe(panel(0).id);
  });

  it("is horizontal in a vertical group", async () => {
    await render(<Two orientation="vertical" />);
    expect(group().getAttribute("data-orientation")).toBe("vertical");
    expect(getComputedStyle(group()).flexDirection).toBe("column");
    expect(handle().getAttribute("aria-orientation")).toBe("horizontal");
  });

  it("takes a custom name, or aria-labelledby instead of the default", async () => {
    await render(
      <>
        <span id="sidebar-label">Sidebar</span>
        <Two handle={{ "aria-label": "Resize sidebar" }} />
        <Two handle={{ "aria-labelledby": "sidebar-label" }} />
      </>,
    );
    await expect
      .element(page.getByRole("separator", { name: "Resize sidebar" }))
      .toBeInTheDocument();
    await expect.element(page.getByRole("separator", { name: "Sidebar" })).toBeInTheDocument();
    expect(handle(1).hasAttribute("aria-label")).toBe(false);
  });

  it("the limits reflect the following panel too", async () => {
    await render(
      <>
        <Two second={{ minSize: 30 }} />
        <Two second={{ maxSize: 60 }} />
      </>,
    );
    expect([valueMin(0), valueMax(0)]).toEqual([0, 70]);
    expect([valueMin(1), valueMax(1)]).toEqual([40, 100]);
  });
});

describe("Resizable keyboard", () => {
  const limits = { minSize: 20, maxSize: 80 };

  it.each([
    ["ArrowLeft", 40],
    ["ArrowRight", 60],
    ["ArrowUp", 50],
    ["ArrowDown", 50],
    ["Home", 20],
    ["End", 80],
    ["Enter", 50],
  ])("horizontal LTR: %s → %i", async (key, expected) => {
    const onLayout = vi.fn();
    await render(<Two first={limits} onLayout={onLayout} />);
    await press(key);
    await expect.poll(() => valueNow()).toBe(expected);
    expectSizes([expected, 100 - expected]);
    if (expected === 50) expect(onLayout).not.toHaveBeenCalled();
    else expect(onLayout).toHaveBeenLastCalledWith([expected, 100 - expected]);
  });

  it.each([
    ["ArrowLeft", 60],
    ["ArrowRight", 40],
    ["ArrowUp", 50],
    ["ArrowDown", 50],
    ["Home", 20],
    ["End", 80],
  ])("horizontal RTL: %s → %i (← and → swapped)", async (key, expected) => {
    await render(<Two dir="rtl" first={limits} />);
    // The preceding panel sits on the right.
    expect(panel(0).getBoundingClientRect().left).toBeGreaterThan(
      panel(1).getBoundingClientRect().left,
    );
    await press(key);
    await expect.poll(() => valueNow()).toBe(expected);
    expectSizes([expected, 100 - expected]);
  });

  it.each([
    ["ArrowUp", 40],
    ["ArrowDown", 60],
    ["ArrowLeft", 50],
    ["ArrowRight", 50],
    ["Home", 20],
    ["End", 80],
  ])("vertical: %s → %i", async (key, expected) => {
    await render(<Two orientation="vertical" first={limits} />);
    await press(key);
    await expect.poll(() => valueNow()).toBe(expected);
    expectSizes([expected, 100 - expected], true);
  });

  it("keyboardStep sets the arrow step", async () => {
    await render(<Two keyboardStep={5} />);
    await press("ArrowRight");
    await expect.poll(() => valueNow()).toBe(55);
  });

  it("keys clamp at the preceding panel's and the following panel's limits", async () => {
    await render(<Two first={{ defaultSize: 75, maxSize: 80 }} second={{ minSize: 10 }} />);
    await press("ArrowRight");
    await expect.poll(() => valueNow()).toBe(80);
    await press("ArrowRight");
    expect(valueNow()).toBe(80);
    await render(<Two first={{ defaultSize: 25 }} second={{ maxSize: 80 }} />);
    await press("ArrowLeft", 1);
    await expect.poll(() => valueNow(1)).toBe(20);
    await press("ArrowLeft", 1);
    expect(valueNow(1)).toBe(20);
  });
});

describe("Resizable collapse consistency", () => {
  /*
   * The preceding panel's effective limits (spec §5): the following panel's collapsed size counts,
   * and a bound that would leave either panel inside its gap (between `collapsedSize` and
   * `minSize`) rounds to that panel's `minSize`. Home and End reach exactly these bounds.
   */
  const rows: {
    name: string;
    first: ResizablePanelProps;
    second: ResizablePanelProps;
    min: number;
    max: number;
  }[] = [
    { name: "plain limits", first: { minSize: 10, maxSize: 70 }, second: {}, min: 10, max: 70 },
    {
      name: "the following panel's limits",
      first: {},
      second: { minSize: 40, maxSize: 70 },
      min: 30,
      max: 60,
    },
    {
      name: "a collapsible following panel: max is T − its collapsedSize",
      first: { minSize: 10 },
      second: { minSize: 30, collapsible: true, collapsedSize: 5 },
      min: 10,
      max: 95,
    },
    {
      name: "a collapsible preceding panel: min is its collapsedSize",
      first: { minSize: 20, collapsible: true },
      second: {},
      min: 0,
      max: 100,
    },
    {
      name: "lo inside the preceding panel's gap rounds up to its minSize",
      first: { minSize: 20, collapsible: true },
      second: { maxSize: 90 },
      min: 20,
      max: 100,
    },
    {
      name: "hi leaving the following panel in its gap rounds down to its minSize",
      first: { maxSize: 85 },
      second: { minSize: 30, collapsible: true },
      min: 0,
      max: 70,
    },
    {
      name: "both collapsible with collapsed sizes",
      first: { minSize: 20, collapsible: true, collapsedSize: 4 },
      second: { minSize: 25, collapsible: true, collapsedSize: 6 },
      min: 4,
      max: 94,
    },
  ];

  it.each(rows)("$name", async ({ first, second, min, max }) => {
    await render(<Two first={first} second={second} />);
    expect([valueMin(), valueMax()]).toEqual([min, max]);
    await press("Home");
    await expect.poll(() => valueNow()).toBe(min);
    expectSizes([min, 100 - min]);
    await press("End");
    await expect.poll(() => valueNow()).toBe(max);
    expectSizes([max, 100 - max]);
  });

  it("End collapses a collapsible following panel, and a drag to the far end reaches the same layout", async () => {
    const second = { minSize: 30, collapsible: true, collapsedSize: 5 };
    const onLayout = vi.fn();
    await render(<Two second={second} onLayout={onLayout} />);
    expect(valueMax()).toBe(95);
    await press("End");
    await expect.poll(() => panel(1).hasAttribute("data-collapsed")).toBe(true);
    expect(onLayout).toHaveBeenLastCalledWith([95, 5]);

    const dragged = vi.fn();
    await render(<Two second={second} onLayout={dragged} />);
    await dragTo(100, { index: 1 });
    await expect.poll(() => dragged.mock.calls.at(-1)?.[0]).toEqual([95, 5]);
    expect(panel(3).hasAttribute("data-collapsed")).toBe(true);
  });

  it("Home collapses a collapsible preceding panel to 0, which is inert", async () => {
    await render(<Two first={{ minSize: 20, collapsible: true }} />);
    expect(valueMin()).toBe(0);
    await press("Home");
    await expect.poll(() => valueNow()).toBe(0);
    expect(panel(0).hasAttribute("data-collapsed")).toBe(true);
    expect(panel(0).inert).toBe(true);
    expect(panel(1).hasAttribute("data-collapsed")).toBe(false);
  });

  it("← from minSize collapses the preceding panel and → from collapsed restores minSize", async () => {
    await render(<Two first={{ defaultSize: 20, minSize: 20, collapsible: true }} />);
    await press("ArrowLeft");
    await expect.poll(() => valueNow()).toBe(0);
    expectSizes([0, 100]);
    await press("ArrowRight");
    await expect.poll(() => valueNow()).toBe(20);
    expect(panel(0).hasAttribute("data-collapsed")).toBe(false);
  });

  it("→ into the following panel's gap collapses it, and ← restores its minSize", async () => {
    await render(<Two first={{ defaultSize: 70 }} second={{ minSize: 30, collapsible: true }} />);
    await press("ArrowRight");
    await expect.poll(() => valueNow()).toBe(100);
    expect(panel(1).hasAttribute("data-collapsed")).toBe(true);
    expect(panel(1).inert).toBe(true);
    await press("ArrowLeft");
    await expect.poll(() => valueNow()).toBe(70);
    expect(panel(1).inert).toBe(false);
  });
});

describe("Resizable Enter", () => {
  it("collapses a collapsible preceding panel and restores the size it had", async () => {
    const onCollapsedChange = vi.fn();
    const onLayout = vi.fn();
    await render(
      <Two
        first={{ defaultSize: 40, minSize: 20, collapsible: true, onCollapsedChange }}
        onLayout={onLayout}
      />,
    );
    await press("Enter");
    await expect.poll(() => panel(0).hasAttribute("data-collapsed")).toBe(true);
    expect(valueNow()).toBe(0);
    expect(panel(0).inert).toBe(true);
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true);
    expect(onLayout).toHaveBeenLastCalledWith([0, 100]);
    await press("Enter");
    await expect.poll(() => valueNow()).toBe(40);
    expect(panel(0).hasAttribute("data-collapsed")).toBe(false);
    expect(panel(0).inert).toBe(false);
    expect(onCollapsedChange).toHaveBeenLastCalledWith(false);
    expect(onCollapsedChange).toHaveBeenCalledTimes(2);
  });

  it("restores minSize when the panel started collapsed, clamped to the following panel's limit", async () => {
    await render(
      <Two first={{ defaultSize: 0, minSize: 20, collapsible: true }} second={{ minSize: 90 }} />,
    );
    expect(panel(0).hasAttribute("data-collapsed")).toBe(true);
    // minSize 20 does not fit next to a following minSize of 90, and 0–10 is the gap: the only
    // resting size is collapsed, so Enter has nowhere to go.
    expect([valueMin(), valueMax()]).toEqual([0, 0]);
    await press("Enter");
    expect(valueNow()).toBe(0);
    await render(<Two first={{ defaultSize: 0, minSize: 20, collapsible: true }} />);
    await press("Enter", 1);
    await expect.poll(() => valueNow(1)).toBe(20);
  });
});

describe("Resizable pointer", () => {
  it("a drag resizes, reports during the drag and commits once, with data-dragging mid-drag", async () => {
    const onLayoutChange = vi.fn();
    const onLayout = vi.fn();
    await render(<Two onLayoutChange={onLayoutChange} onLayout={onLayout} />);
    const seen = { handle: false, group: false };
    const observer = new MutationObserver(() => {
      seen.handle ||= handle().hasAttribute("data-dragging");
      seen.group ||= group().hasAttribute("data-dragging");
    });
    observer.observe(handle(), { attributes: true });
    observer.observe(group(), { attributes: true });
    await dragTo(65);
    observer.disconnect();
    await expect.poll(() => onLayout.mock.calls.length).toBe(1);
    // The commit is the last reported layout, also when the last move is rendered after the up.
    const [committed] = onLayout.mock.calls[0] as [[number, number]];
    expect(committed[0] + committed[1]).toBeCloseTo(100);
    expect(onLayoutChange.mock.calls.at(-1)?.[0]).toEqual(committed);
    expect(Math.abs(committed[0] - 65)).toBeLessThanOrEqual(1);
    await expect.poll(() => valueNow()).toBe(Math.round(committed[0]));
    expect(seen).toEqual({ handle: true, group: true });
    expect(handle().hasAttribute("data-dragging")).toBe(false);
    expect(group().hasAttribute("data-dragging")).toBe(false);
    expect(onLayoutChange.mock.calls.length).toBeGreaterThan(2);
    // Pointer focus on the handle, no ring.
    expect(document.activeElement).toBe(handle());
    expect(getComputedStyle(handle()).outlineStyle).toBe("none");
  });

  it("a drag clamps at the preceding panel's maxSize and the following panel's minSize", async () => {
    await render(<Two first={{ maxSize: 70 }} />);
    await dragTo(95);
    await expect.poll(() => valueNow()).toBe(70);
    expectSizes([70, 30]);
    await render(<Two first={{ minSize: 10 }} second={{ minSize: 40 }} />);
    await dragTo(95, { index: 1 });
    await expect.poll(() => valueNow(1)).toBe(60);
    await dragTo(2, { index: 1 });
    await expect.poll(() => valueNow(1)).toBe(10);
  });

  it("a collapsible panel collapses past its gap midpoint and comes back", async () => {
    const onCollapsedChange = vi.fn();
    await render(
      <Two first={{ minSize: 20, collapsible: true, onCollapsedChange }} keyboardStep={5} />,
    );
    // The gap is (0, 20): its midpoint is 10.
    await dragTo(12);
    await expect.poll(() => valueNow()).toBe(20);
    expect(panel(0).hasAttribute("data-collapsed")).toBe(false);
    await dragTo(8);
    await expect.poll(() => valueNow()).toBe(0);
    expect(panel(0).hasAttribute("data-collapsed")).toBe(true);
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true);
    await dragTo(8);
    expect(valueNow()).toBe(0);
    await dragTo(12);
    await expect.poll(() => valueNow()).toBe(20);
    expect(onCollapsedChange).toHaveBeenLastCalledWith(false);
  });

  it("a collapsible following panel snaps at its gap midpoint", async () => {
    await render(<Two second={{ minSize: 30, collapsible: true }} />);
    // The following panel's gap is (0, 30): it collapses when it would be below 15.
    await dragTo(84);
    await expect.poll(() => valueNow()).toBe(70);
    await dragTo(86);
    await expect.poll(() => valueNow()).toBe(100);
    expect(panel(1).hasAttribute("data-collapsed")).toBe(true);
  });

  it("a disabled handle does not drag and is not focusable", async () => {
    const onLayoutChange = vi.fn();
    await render(
      <>
        <button type="button">Before</button>
        <Two handle={{ disabled: true }} onLayoutChange={onLayoutChange} />
        <button type="button">After</button>
      </>,
    );
    expect(handle().tabIndex).toBe(-1);
    expect(handle().getAttribute("aria-disabled")).toBe("true");
    expect(handle().hasAttribute("data-disabled")).toBe(true);
    expect(getComputedStyle(handle()).cursor).toBe("not-allowed");
    await userEvent.click(page.getByRole("button", { name: "Before" }));
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("After");
    await dragTo(80);
    await nextFrame();
    expect(valueNow()).toBe(50);
    expect(onLayoutChange).not.toHaveBeenCalled();
    handle().focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(valueNow()).toBe(50);
  });

  it("in RTL the drag direction flips", async () => {
    await render(<Two dir="rtl" />);
    await dragTo(65, { rtl: true });
    await expect.poll(() => Math.abs(valueNow() - 65)).toBeLessThanOrEqual(1);
    expectSizes([valueNow(), 100 - valueNow()]);
  });

  it("a vertical drag follows the pointer's y", async () => {
    await render(<Two orientation="vertical" />);
    await dragTo(30, { vertical: true });
    await expect.poll(() => Math.abs(valueNow() - 30)).toBeLessThanOrEqual(1);
  });

  it("a drag reads no direction per move (isRtl is read on mount only)", async () => {
    const onLayoutChange = vi.fn();
    await render(<Two dir="rtl" onLayoutChange={onLayoutChange} />);
    const element = group();
    const readsOfGroup = () =>
      vi.mocked(isRtl).mock.calls.filter(([target]) => target === element).length;
    expect(readsOfGroup()).toBe(1);
    const before = vi.mocked(isRtl).mock.calls.length;
    await dragTo(70, { rtl: true });
    await expect.poll(() => onLayoutChange.mock.calls.length).toBeGreaterThan(4);
    expect(vi.mocked(isRtl).mock.calls.length).toBe(before);
  });

  it("a touch drag resizes (pointer events, touch-action none)", async () => {
    await render(<Two />);
    const target = handle();
    const rect = target.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      pointerType: "touch",
      isPrimary: true,
      pointerId: 1,
      button: 0,
      buttons: 1,
      clientY: rect.top + 10,
    };
    target.dispatchEvent(new PointerEvent("pointerdown", { ...init, clientX: rect.left }));
    target.dispatchEvent(new PointerEvent("pointermove", { ...init, clientX: rect.left + 30 }));
    target.dispatchEvent(new PointerEvent("pointerup", { ...init, clientX: rect.left + 30 }));
    await expect.poll(() => valueNow()).toBe(60);
    expect(getComputedStyle(target).touchAction).toBe("none");
  });
});

describe("Resizable layout", () => {
  it("a valid defaultLayout wins over the panels' defaultSize", async () => {
    await render(<Two defaultLayout={[30, 70]} />);
    expect(valueNow()).toBe(30);
    expectSizes([30, 70]);
  });

  it("panel defaultSizes, with an unsized panel taking the rest", async () => {
    await render(
      <div style={{ width: SPACE + 2, height: 200 }}>
        <ResizablePanelGroup>
          <ResizablePanel defaultSize={20}>A</ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>B</ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={30}>C</ResizablePanel>
        </ResizablePanelGroup>
      </div>,
    );
    expectSizes([20, 50, 30]);
    expect([valueNow(0), valueNow(1)]).toEqual([20, 50]);
  });

  it("panels with no sizes share equally, and sizes are clamped to the limits", async () => {
    await render(
      <div style={{ width: SPACE + 2, height: 200 }}>
        <ResizablePanelGroup>
          <ResizablePanel minSize={50}>A</ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>B</ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>C</ResizablePanel>
        </ResizablePanelGroup>
      </div>,
    );
    // Equal thirds, A clamped up to 50, the excess taken from B and C in proportion.
    expect([valueNow(0), valueNow(1)]).toEqual([50, 25]);
    expectSizes([50, 25, 25]);
  });

  it("an invalid defaultLayout falls back to the defaults and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await render(<Two defaultLayout={[10, 10]} first={{ defaultSize: 40 }} />);
      expect(valueNow()).toBe(40);
      await expect.poll(() => warn.mock.calls.length).toBe(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain("defaultLayout");
    } finally {
      warn.mockRestore();
    }
  });

  it("a controlled layout follows onLayoutChange", async () => {
    function Controlled() {
      const [layout, setLayout] = useState([30, 70]);
      return (
        <>
          <output>{layout.join(",")}</output>
          <Two layout={layout} onLayoutChange={setLayout} />
        </>
      );
    }
    await render(<Controlled />);
    expect(valueNow()).toBe(30);
    await press("ArrowRight");
    await expect.element(page.getByRole("status")).toHaveTextContent("40,60");
    expect(valueNow()).toBe(40);
    expectSizes([40, 60]);
  });

  it("a controlled parent that ignores changes keeps the layout", async () => {
    const onLayoutChange = vi.fn();
    const onLayout = vi.fn();
    await render(<Two layout={[50, 50]} onLayoutChange={onLayoutChange} onLayout={onLayout} />);
    await press("ArrowRight");
    expect(onLayoutChange).toHaveBeenLastCalledWith([60, 40]);
    expect(onLayout).toHaveBeenLastCalledWith([60, 40]);
    expect(valueNow()).toBe(50);
    await dragTo(80);
    await nextFrame();
    expect(valueNow()).toBe(50);
    expectSizes([50, 50]);
  });

  it("a controlled layout of the wrong length is normalised and reported", async () => {
    const onLayoutChange = vi.fn();
    await render(<Two layout={[30, 30, 40]} onLayoutChange={onLayoutChange} />);
    await expect.poll(() => onLayoutChange.mock.calls.length).toBeGreaterThan(0);
    const [reported] = onLayoutChange.mock.calls.at(-1) as [number[]];
    expect(reported).toHaveLength(2);
    expect((reported[0] ?? 0) + (reported[1] ?? 0)).toBeCloseTo(100);
    expect(valueNow()).toBe(Math.round(reported[0] ?? 0));
  });

  it("three panels and two handles: each handle moves only its two neighbours", async () => {
    const onLayout = vi.fn();
    await render(
      <div style={{ width: SPACE + 2, height: 200 }}>
        <ResizablePanelGroup defaultLayout={[30, 40, 30]} onLayout={onLayout}>
          <ResizablePanel minSize={10}>A</ResizablePanel>
          <ResizableHandle />
          <ResizablePanel minSize={20}>B</ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>C</ResizablePanel>
        </ResizablePanelGroup>
      </div>,
    );
    expect([valueNow(0), valueMax(0)]).toEqual([30, 50]);
    expect([valueNow(1), valueMin(1), valueMax(1)]).toEqual([40, 20, 70]);
    await press("ArrowRight", 1);
    await expect.poll(() => onLayout.mock.calls.at(-1)?.[0]).toEqual([30, 50, 20]);
    expectSizes([30, 50, 20]);
    await press("End", 0);
    await expect.poll(() => onLayout.mock.calls.at(-1)?.[0]).toEqual([60, 20, 20]);
  });

  it("a conditional third panel mounting and unmounting keeps the sum at 100 and reports it", async () => {
    const onLayout = vi.fn();
    const onLayoutChange = vi.fn();
    function Conditional() {
      const [extra, setExtra] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setExtra(!extra)}>
            Toggle
          </button>
          <div style={{ width: SPACE + 2, height: 200 }}>
            <ResizablePanelGroup
              defaultLayout={[25, 75]}
              onLayout={onLayout}
              onLayoutChange={onLayoutChange}
            >
              <ResizablePanel>A</ResizablePanel>
              <ResizableHandle />
              <ResizablePanel>B</ResizablePanel>
              {extra && (
                <>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={20}>C</ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </div>
        </>
      );
    }
    const warn = vi.spyOn(console, "warn");
    onTestFinished(() => warn.mockRestore());
    await render(<Conditional />);
    expect(onLayout).not.toHaveBeenCalled();
    await userEvent.click(page.getByRole("button", { name: "Toggle" }));
    await expect.poll(() => slots("resizable-panel").length).toBe(3);
    await expect.poll(() => onLayout.mock.calls.length).toBe(1);
    // The new panel takes its defaultSize; A and B keep their 1:3 ratio in the rest.
    expect(onLayout.mock.calls[0]?.[0]).toEqual([20, 60, 20]);
    expect(onLayoutChange).toHaveBeenLastCalledWith([20, 60, 20]);
    expectSizes([20, 60, 20]);
    await userEvent.click(page.getByRole("button", { name: "Toggle" }));
    await expect.poll(() => onLayout.mock.calls.length).toBe(2);
    expect(onLayout.mock.calls[1]?.[0]).toEqual([25, 75]);
    // The two-entry defaultLayout was valid at mount: a later third panel is no reason to warn.
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("Resizable server HTML", () => {
  const Fixture = () => (
    <ResizablePanelGroup>
      <ResizablePanel id="nav" defaultSize={30} minSize={10}>
        Nav
      </ResizablePanel>
      <ResizableHandle withHandle />
      {/* biome-ignore lint/complexity/noUselessFragments: the group's guess flattens fragments. */}
      <>
        <ResizablePanel>Main</ResizablePanel>
        <ResizableHandle />
      </>
      <ResizablePanel defaultSize={20}>Aside</ResizablePanel>
    </ResizablePanelGroup>
  );

  it("renders each panel's flex-grow and each handle's values from the defaults", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Fixture />);
    const grows = slots("resizable-panel", container).map((element) => element.style.flexGrow);
    expect(grows).toEqual(["30", "50", "20"]);
    const handles = slots("resizable-handle", container);
    expect(handles.map((element) => element.getAttribute("aria-valuenow"))).toEqual(["30", "50"]);
    expect(handles.map((element) => element.getAttribute("aria-valuemin"))).toEqual(["10", "0"]);
    expect(handles[0]?.getAttribute("aria-valuemax")).toBe("80");
    expect(handles[0]?.getAttribute("aria-controls")).toBe("nav");
  });

  it("hydrates with no recoverable error and keeps the sizes", async () => {
    const container = document.createElement("div");
    container.style.width = `${SPACE + 2}px`;
    container.style.height = "200px";
    container.innerHTML = renderToString(<Fixture />);
    document.body.append(container);
    const before = slots("resizable-panel", container).map((element) => element.style.flexGrow);
    const onRecoverableError = vi.fn();
    const root = hydrateRoot(container, <Fixture />, { onRecoverableError });
    try {
      await expect
        .poll(() => slots("resizable-handle", container)[1]?.getAttribute("aria-controls"))
        .toBe(slots("resizable-panel", container)[1]?.id);
      expect(slots("resizable-panel", container).map((element) => element.style.flexGrow)).toEqual(
        before,
      );
      expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
      root.unmount();
      container.remove();
    }
  });
});

describe("Resizable grip and styles", () => {
  afterEach(async () => {
    await emulateMedia([]);
  });

  it("withHandle renders an aria-hidden grip; vertical groups rotate it", async () => {
    await render(
      <>
        <Two handle={{ withHandle: true }} />
        <Two orientation="vertical" handle={{ withHandle: true }} />
      </>,
    );
    const grips = slots("resizable-handle-grip");
    expect(grips).toHaveLength(2);
    expect(grips[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(grips[0]?.querySelector("svg")).not.toBeNull();
    expect(getComputedStyle(grips[0] as HTMLElement).rotate).toBe("none");
    expect(getComputedStyle(grips[1] as HTMLElement).rotate).toBe("90deg");
    expect(slots("resizable-handle-grip", handle(0))).toHaveLength(1);
  });

  it("a horizontal group nested in a vertical one keeps its grip upright", async () => {
    await render(
      <div style={{ width: 300, height: 300 }}>
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel>
            <ResizablePanelGroup>
              <ResizablePanel>A</ResizablePanel>
              <ResizableHandle withHandle aria-label="Inner" />
              <ResizablePanel>B</ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle aria-label="Outer" />
          <ResizablePanel>C</ResizablePanel>
        </ResizablePanelGroup>
      </div>,
    );
    const inner = page.getByRole("separator", { name: "Inner" }).element();
    const outer = page.getByRole("separator", { name: "Outer" }).element();
    const grip = (element: Element) =>
      element.querySelector("[data-slot=resizable-handle-grip]") as HTMLElement;
    expect(getComputedStyle(grip(inner)).rotate).toBe("none");
    expect(getComputedStyle(grip(outer)).rotate).toBe("90deg");
    expect(inner.getAttribute("aria-orientation")).toBe("vertical");
    expect(outer.getAttribute("aria-orientation")).toBe("horizontal");
  });

  it("Tab shows a 2px solid focus ring on the handle", async () => {
    await render(<Two />);
    await userEvent.tab();
    expect(document.activeElement).toBe(handle());
    const style = getComputedStyle(handle());
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it("forced colors: the handle is CanvasText, Highlight when focused and while dragging", async () => {
    await emulateMedia([
      { name: "forced-colors", value: "active" },
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    await render(<Two handle={{ withHandle: true }} />);
    const element = handle();
    expect(getComputedStyle(element).backgroundColor).toBe(systemColor("CanvasText"));
    expect(getComputedStyle(element).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(getComputedStyle(element).outlineStyle).toBe("solid");
    expect(getComputedStyle(element).outlineColor).toBe(systemColor("Highlight"));
    const grip = slots("resizable-handle-grip")[0] as HTMLElement;
    expect(getComputedStyle(grip).borderTopColor).toBe(systemColor("CanvasText"));
    let draggingBackground = "";
    const observer = new MutationObserver(() => {
      if (element.hasAttribute("data-dragging"))
        draggingBackground = getComputedStyle(element).backgroundColor;
    });
    observer.observe(element, { attributes: true });
    await dragTo(60);
    observer.disconnect();
    expect(draggingBackground).toBe(systemColor("Highlight"));
  });

  it("forced colors: the handle line stays visible (CanvasText), also when hovered", async () => {
    await emulateForcedColors(true);
    await render(<Two />);
    // No colour transition in forced colors: Chromium interpolates CanvasText → Highlight through
    // Canvas, which blanks the line at a drag's start and end.
    expect(getComputedStyle(handle()).transitionProperty).toBe("none");
    // Reduced motion too, so the hover check below reads the final colour, not a transition frame.
    await emulateMedia([
      { name: "forced-colors", value: "active" },
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    await expect
      .poll(() => getComputedStyle(handle()).backgroundColor)
      .toBe(systemColor("CanvasText"));
    // Hover must not swap the line for the (forced-away) ring colour.
    await userEvent.hover(page.elementLocator(handle()), { force: true });
    expect(handle().matches(":hover")).toBe(true);
    await expect
      .poll(() => getComputedStyle(handle()).backgroundColor)
      .toBe(systemColor("CanvasText"));
  });

  it("reduced motion: the handle has no transition; panels never animate", async () => {
    await render(<Two />);
    expect(getComputedStyle(handle()).transitionProperty).toBe("background-color, outline-color");
    expect(getComputedStyle(handle()).transitionDuration).toBe("0.15s");
    // Panels have no transition at all: collapse and restore are instant.
    expect(getComputedStyle(panel(0)).transitionDuration).toBe("0s");
    await emulateReducedMotion(true);
    // `motion-reduce:transition-none` is `transition-property: none` (the duration stays 0.15s).
    expect(getComputedStyle(handle()).transitionProperty).toBe("none");
  });
});

describe("Resizable stories", () => {
  function StoryView({ story }: { story: { args?: object; render?: unknown } }) {
    const Render = story.render as (args: object) => ReactElement;
    return <Render {...story.args} />;
  }

  it("the collapsible sidebar's button collapses and restores the sidebar", async () => {
    await render(<StoryView story={stories.CollapsibleSidebar} />);
    const toggle = page.getByRole("button", { name: "Collapse sidebar" });
    await userEvent.click(toggle);
    await expect.poll(() => panel(0).hasAttribute("data-collapsed")).toBe(true);
    await userEvent.click(page.getByRole("button", { name: "Expand sidebar" }));
    await expect.poll(() => panel(0).hasAttribute("data-collapsed")).toBe(false);
  });

  it("the persisted story stores onLayout and reads it back as defaultLayout", async () => {
    const key = "tessera-resizable-persisted";
    localStorage.removeItem(key);
    const first = await render(<StoryView story={stories.Persisted} />);
    await press("ArrowRight");
    await expect.poll(() => localStorage.getItem(key)).toBe("[43,57]");
    await first.unmount();
    await render(<StoryView story={stories.Persisted} />);
    expect(valueNow()).toBe(43);
    localStorage.removeItem(key);
  });

  it("the persisted story survives storage that throws", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    try {
      await render(<StoryView story={stories.Persisted} />);
      expect(valueNow()).toBe(33);
      await press("ArrowRight");
      await expect.poll(() => valueNow()).toBe(43);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

describe("Resizable hardening", () => {
  /** Dispatches a PointerEvent of `type` on the handle at viewport x `clientX`. */
  function pointer(
    type: string,
    clientX: number,
    { pointerId = 1, isPrimary = true, pointerType = "mouse", target = handle() } = {},
  ) {
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        isPrimary,
        pointerType,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
        clientX,
        clientY: rect.top + 10,
      }),
    );
  }

  it("a second pointer during a drag neither moves the panel nor resets the drag", async () => {
    const onLayout = vi.fn();
    await render(<Two onLayout={onLayout} />);
    const x = handle().getBoundingClientRect().left;
    pointer("pointerdown", x);
    pointer("pointermove", x + 30);
    await expect.poll(() => valueNow()).toBe(60);
    // A second touch lands on the handle and moves: ignored.
    const second = { pointerId: 2, isPrimary: false, pointerType: "touch" };
    pointer("pointerdown", x + 30, second);
    pointer("pointermove", x + 90, second);
    await nextFrame();
    expect(valueNow()).toBe(60);
    pointer("pointerup", x + 90, second);
    expect(handle().hasAttribute("data-dragging")).toBe(true);
    // The first pointer still drags from the original start.
    pointer("pointermove", x + 60);
    await expect.poll(() => valueNow()).toBe(70);
    pointer("pointerup", x + 60);
    await expect.poll(() => handle().hasAttribute("data-dragging")).toBe(false);
    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(onLayout).toHaveBeenLastCalledWith([70, 30]);
  });

  it("a move flushed together with the up commits the moved layout", async () => {
    const onLayoutChange = vi.fn();
    const onLayout = vi.fn();
    await render(<Two onLayoutChange={onLayoutChange} onLayout={onLayout} />);
    const x = handle().getBoundingClientRect().left;
    pointer("pointerdown", x);
    await expect.poll(() => handle().hasAttribute("data-dragging")).toBe(true);
    // No await between the move and the up: React has not re-rendered the move when the up runs.
    pointer("pointermove", x + 30);
    pointer("pointerup", x + 30);
    await expect.poll(() => onLayout.mock.calls.length).toBe(1);
    expect(onLayout).toHaveBeenLastCalledWith([60, 40]);
    expect(onLayoutChange).toHaveBeenLastCalledWith([60, 40]);
    await expect.poll(() => valueNow()).toBe(60);
  });

  it("a quick back-and-forth before a render ends where the pointer is", async () => {
    const onLayout = vi.fn();
    await render(<Two onLayout={onLayout} />);
    const x = handle().getBoundingClientRect().left;
    pointer("pointerdown", x);
    await expect.poll(() => handle().hasAttribute("data-dragging")).toBe(true);
    pointer("pointermove", x + 30);
    pointer("pointermove", x);
    pointer("pointerup", x);
    await nextFrame();
    await expect.poll(() => handle().hasAttribute("data-dragging")).toBe(false);
    expect(valueNow()).toBe(50);
    // The drag ended where it started: nothing to commit.
    expect(onLayout).not.toHaveBeenCalled();
  });

  it("a handle unmounting mid-drag clears the group's data-dragging", async () => {
    const error = vi.spyOn(console, "error");
    onTestFinished(() => error.mockRestore());
    function Conditional() {
      const [extra, setExtra] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setExtra(false)}>
            Remove
          </button>
          <div style={{ width: SPACE + 2, height: 200 }}>
            <ResizablePanelGroup defaultLayout={[30, 40, 30]}>
              <ResizablePanel>A</ResizablePanel>
              <ResizableHandle />
              <ResizablePanel>B</ResizablePanel>
              {extra && (
                <>
                  <ResizableHandle />
                  <ResizablePanel>C</ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </div>
        </>
      );
    }
    await render(<Conditional />);
    const target = handle(1);
    const x = target.getBoundingClientRect().left;
    pointer("pointerdown", x, { target });
    pointer("pointermove", x + 6, { target });
    await expect.poll(() => group().hasAttribute("data-dragging")).toBe(true);
    // A DOM click: a real one would be retargeted to the handle, which holds pointer 1's capture.
    (page.getByRole("button", { name: "Remove" }).element() as HTMLElement).click();
    await expect.poll(() => slots("resizable-handle").length).toBe(1);
    await expect.poll(() => group().hasAttribute("data-dragging")).toBe(false);
    expect(getComputedStyle(group()).userSelect).not.toBe("none");
    expect(error).not.toHaveBeenCalled();
  });

  it("the panel follows the pointer when the group resizes mid-drag", async () => {
    const screen = await render(<Two />);
    const wrapper = screen.container.firstElementChild as HTMLElement;
    const x = handle().getBoundingClientRect().left;
    pointer("pointerdown", x);
    // The group shrinks from 300px to 200px of panel space while the pointer is down.
    wrapper.style.width = "201px";
    await nextFrame();
    const left = group().getBoundingClientRect().left;
    pointer("pointermove", left + 50);
    // The preceding panel's end edge is under the pointer: 50px of 200px.
    await expect.poll(() => valueNow()).toBe(25);
    expect(Math.abs(handle().getBoundingClientRect().left - (left + 50))).toBeLessThanOrEqual(1);
    pointer("pointerup", left + 50);
  });

  it("warns once in development about constraints that cannot hold", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    await render(<Two first={{ minSize: 10, collapsible: true, collapsedSize: 10 }} />);
    await expect.poll(() => warn.mock.calls.length).toBe(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("collapsedSize");
    await render(<Two second={{ minSize: 60, maxSize: 40 }} />);
    await expect.poll(() => warn.mock.calls.length).toBe(2);
    expect(String(warn.mock.calls[1]?.[0])).toContain("minSize");
  });

  it("valid constraints do not warn", async () => {
    const warn = vi.spyOn(console, "warn");
    onTestFinished(() => warn.mockRestore());
    await render(<Two first={{ minSize: 20, collapsible: true }} second={{ maxSize: 80 }} />);
    await nextFrame();
    expect(warn).not.toHaveBeenCalled();
  });

  it("a controlled group reports nothing on mount", async () => {
    const onLayoutChange = vi.fn();
    const onLayout = vi.fn();
    await render(<Two layout={[30, 70]} onLayoutChange={onLayoutChange} onLayout={onLayout} />);
    await expect.poll(() => handle().getAttribute("aria-controls")).toBe(panel(0).id);
    await nextFrame();
    expect(valueNow()).toBe(30);
    expect(onLayoutChange).not.toHaveBeenCalled();
    expect(onLayout).not.toHaveBeenCalled();
  });

  it("a click does not focus a disabled handle", async () => {
    await render(<Two handle={{ disabled: true }} />);
    await userEvent.click(page.elementLocator(handle()), { force: true });
    expect(document.activeElement).not.toBe(handle());
    expect(valueNow()).toBe(50);
  });
});

describe("Resizable axe", () => {
  async function audit(container: Element) {
    const results = await axe.run(container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  }

  it.each(["light", "dark"] as const)("has no violations in the %s theme", async (theme) => {
    const screen = await render(
      <div
        className={
          theme === "dark"
            ? "dark flex flex-col gap-4 bg-background p-2 text-foreground"
            : "flex flex-col gap-4 bg-background p-2 text-foreground"
        }
      >
        <Two handle={{ withHandle: true, "aria-label": "Resize horizontal" }} />
        <Two orientation="vertical" handle={{ "aria-label": "Resize vertical" }} />
        <Two
          first={{ defaultSize: 0, minSize: 20, collapsible: true }}
          handle={{ withHandle: true, "aria-label": "Resize collapsed" }}
        />
      </div>,
    );
    expect(panel(4).hasAttribute("data-collapsed")).toBe(true);
    await audit(screen.container);
  });
});
