import { useFormContext } from "@base-ui/react/internals/form-context";
import axe from "axe-core";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, emulateReducedMotion, systemColor } from "../../../test/emulation";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { Rating } from "./rating";

const radio = (name: string) => page.getByRole("radio", { name, exact: true });
const group = (name = "Rating") => page.getByRole("radiogroup", { name, exact: true });
const root = () => document.querySelector<HTMLElement>("[data-slot=rating]") as HTMLElement;
const items = () => [...document.querySelectorAll<HTMLElement>("[data-slot=rating-item]")];
const item = (index: number) => items()[index - 1] as HTMLElement;
const filledStar = (index: number) =>
  item(index).querySelector<SVGElement>("[data-slot=rating-star-filled]") as SVGElement;
const emptyStar = (index: number) =>
  item(index).querySelector<SVGElement>("[data-slot=rating-star-empty]") as SVGElement;
const checked = () =>
  [...document.querySelectorAll('[role="radio"][aria-checked="true"]')].map((r) =>
    r.getAttribute("aria-label"),
  );
/** The indices (1-based) of the items carrying `attribute`. */
const marked = (attribute: string) =>
  items()
    .map((element, index) => (element.hasAttribute(attribute) ? index + 1 : 0))
    .filter(Boolean);

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Waits (polling, no fixed sleep) until nothing in the document is animating. */
async function animationsSettled() {
  await nextFrame();
  await expect.poll(() => document.getAnimations().length).toBe(0);
}

type Rgb = [number, number, number];

/**
 * Screenshots `element` (real Chromium pixels) and returns one row of it, `rowAt` of the way down,
 * as one colour per CSS pixel column.
 */
async function screenshotRow(element: Element, rowAt: number): Promise<Rgb[]> {
  await animationsSettled();
  const base64 = await page.screenshot({ element, save: false });
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  context.drawImage(image, 0, 0);
  const rect = element.getBoundingClientRect();
  const scale = image.naturalWidth / rect.width;
  const y = Math.floor(rect.height * rowAt * scale);
  return Array.from({ length: Math.round(rect.width) }, (_, x) => {
    const data = context.getImageData(Math.floor((x + 0.5) * scale), y, 1, 1).data;
    return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0] as Rgb;
  });
}

const distance = (a: Rgb, b: Rgb) =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

/*
 * The star's widest solid row sits at 11/24 of its height (just below the arms), where the filled
 * shape spans about 3.6 to 20.4 of the 24 units. A column counts as filled when its pixel is the
 * fill colour, read from the middle of a fully filled star on the same row.
 */
const ROW = 11 / 24;

/** The first and last filled columns of `partial`, and of the fully filled `full`, in CSS px. */
async function filledRun(partial: HTMLElement, full: HTMLElement) {
  const fullRow = await screenshotRow(full, ROW);
  const fill = fullRow[Math.floor(fullRow.length / 2)] as Rgb;
  const run = (row: Rgb[]) => {
    const columns = row.flatMap((pixel, x) => (distance(pixel, fill) <= 48 ? [x] : []));
    return { first: Math.min(...columns), last: Math.max(...columns), count: columns.length };
  };
  return { partial: run(await screenshotRow(partial, ROW)), full: run(fullRow) };
}

/** A touch tap as a real touchscreen sends it (Phase I's carousel `tap()`), plus the hover pair. */
async function tap(target: HTMLElement) {
  const init = { bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true };
  target.dispatchEvent(new PointerEvent("pointerover", init));
  target.dispatchEvent(new PointerEvent("pointerenter", { ...init, bubbles: false }));
  target.dispatchEvent(new PointerEvent("pointerdown", init));
  target.dispatchEvent(new PointerEvent("pointerup", init));
  await nextFrame();
  target.focus();
  await nextFrame();
  target.click();
  await nextFrame();
}

function RegisteredControls({ onRead }: { onRead: (count: number) => void }) {
  const { formRef } = useFormContext();
  return (
    <button type="button" onClick={() => onRead(formRef.current.fields.size)}>
      Count controls
    </button>
  );
}

describe("Rating structure", () => {
  it("renders max radios named 1 star … 5 stars in one radiogroup, with data-slots", async () => {
    await render(<Rating />);
    await expect.element(group()).toBeInTheDocument();
    expect(root()).toBe(group().element());
    expect(root().getAttribute("data-size")).toBe("md");
    const radios = page.getByRole("radio").elements();
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual([
      "1 star",
      "2 stars",
      "3 stars",
      "4 stars",
      "5 stars",
    ]);
    for (const r of radios) expect(r.getAttribute("data-slot")).toBe("rating-radio");
    expect(items()).toHaveLength(5);
    for (const element of items()) {
      expect(element.querySelector("[data-slot=rating-star-empty]")).not.toBeNull();
      expect(element.querySelector("[data-slot=rating-star-filled]")).not.toBeNull();
      for (const svg of element.querySelectorAll("svg")) {
        expect(svg.getAttribute("aria-hidden")).toBe("true");
      }
    }
    expect(checked()).toEqual([]);
  });

  it("is named by aria-label, aria-labelledby or a Field label (default Rating)", async () => {
    await render(
      <>
        <Rating aria-label="Food" />
        <span id="service-label">Service</span>
        <Rating aria-labelledby="service-label" />
        <Field>
          <FieldLabel>Ambience</FieldLabel>
          <Rating />
          <FieldDescription>How did the room feel?</FieldDescription>
        </Field>
      </>,
    );
    await expect.element(group("Food")).toBeInTheDocument();
    await expect.element(group("Service")).toBeInTheDocument();
    const field = group("Ambience");
    await expect.element(field).toBeInTheDocument();
    expect(field.element().hasAttribute("aria-label")).toBe(false);
    await expect.element(field).toHaveAccessibleDescription("How did the room feel?");
    // The radios inside the Field keep their own names (not the Field label).
    const inField = field.element().querySelectorAll('[role="radio"]');
    expect(inField).toHaveLength(5);
    await expect
      .element(page.elementLocator(inField[2] as Element))
      .toHaveAccessibleName("3 stars");
  });

  it("max={10} renders ten radios", async () => {
    await render(<Rating max={10} />);
    const radios = page.getByRole("radio").elements();
    expect(radios).toHaveLength(10);
    expect(radios[9]?.getAttribute("aria-label")).toBe("10 stars");
  });

  it("itemLabel localises the radio names", async () => {
    await render(
      <Rating
        aria-label="Bewertung"
        allowHalf
        itemLabel={(value, max) => `${String(value).replace(".", ",")} von ${max} Sternen`}
      />,
    );
    await expect.element(radio("2,5 von 5 Sternen")).toBeInTheDocument();
    await expect.element(radio("5 von 5 Sternen")).toBeInTheDocument();
  });
});

describe("Rating keyboard", () => {
  it("Tab focuses the first radio when there is no value, the checked one otherwise", async () => {
    await render(
      <>
        <Rating aria-label="Empty" />
        <Rating aria-label="Three" defaultValue={3} />
      </>,
    );
    await userEvent.tab();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("1 star");
    expect(document.activeElement?.closest("[data-slot=rating]")?.getAttribute("aria-label")).toBe(
      "Empty",
    );
    await userEvent.tab();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("3 stars");
    expect(document.activeElement?.getAttribute("aria-checked")).toBe("true");
  });

  it("→ / ↓ check the next value, ← / ↑ the previous", async () => {
    const onValueChange = vi.fn();
    await render(<Rating defaultValue={3} onValueChange={onValueChange} />);
    await userEvent.tab();
    const steps: [string, string][] = [
      ["{ArrowRight}", "4 stars"],
      ["{ArrowDown}", "5 stars"],
      ["{ArrowLeft}", "4 stars"],
      ["{ArrowUp}", "3 stars"],
    ];
    for (const [key, name] of steps) {
      await userEvent.keyboard(key);
      await expect.element(radio(name)).toHaveAttribute("aria-checked", "true");
      expect(document.activeElement).toBe(radio(name).element());
    }
    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([4, 5, 4, 3]);
  });

  // Pinned: Base UI's RadioGroup wraps at the ends (its composite root's `loopFocus` defaults to
  // true and RadioGroup does not turn it off), as the APG radio group does.
  it("wraps at the ends: → on the last checks the first, ← on the first checks the last", async () => {
    await render(<Rating defaultValue={5} />);
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(radio("1 star")).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(radio("1 star").element());
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(radio("5 stars")).toHaveAttribute("aria-checked", "true");
    expect(document.activeElement).toBe(radio("5 stars").element());
  });

  it("Home and End do nothing (Base UI's RadioGroup leaves them off)", async () => {
    await render(<Rating defaultValue={3} />);
    await userEvent.tab();
    await userEvent.keyboard("{Home}");
    await userEvent.keyboard("{End}");
    expect(checked()).toEqual(["3 stars"]);
    expect(document.activeElement).toBe(radio("3 stars").element());
  });

  it("Space checks the focused radio", async () => {
    const onValueChange = vi.fn();
    await render(<Rating onValueChange={onValueChange} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(radio("1 star").element());
    await userEvent.keyboard(" ");
    await expect.element(radio("1 star")).toHaveAttribute("aria-checked", "true");
    expect(onValueChange).toHaveBeenLastCalledWith(1);
  });

  it("with clearable, Space on the checked radio clears to null", async () => {
    const onValueChange = vi.fn();
    await render(<Rating clearable defaultValue={3} onValueChange={onValueChange} />);
    await userEvent.tab();
    await userEvent.keyboard(" ");
    await expect.poll(checked).toEqual([]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(marked("data-filled")).toEqual([]);
  });

  it("without clearable, Space on the checked radio keeps the value", async () => {
    const onValueChange = vi.fn();
    await render(<Rating defaultValue={3} onValueChange={onValueChange} />);
    await userEvent.tab();
    await userEvent.keyboard(" ");
    await nextFrame();
    expect(checked()).toEqual(["3 stars"]);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("Tab leaves the group", async () => {
    await render(
      <>
        <Rating defaultValue={2} />
        <button type="button">After</button>
      </>,
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(radio("2 stars").element());
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "After" }).element());
  });
});

describe("Rating allowHalf", () => {
  it("renders 10 radios, 0.5 stars … 5 stars, two per item, and → steps by 0.5", async () => {
    const onValueChange = vi.fn();
    await render(<Rating allowHalf defaultValue={2} onValueChange={onValueChange} />);
    const names = page
      .getByRole("radio")
      .elements()
      .map((r) => r.getAttribute("aria-label"));
    expect(names).toEqual([
      "0.5 stars",
      "1 star",
      "1.5 stars",
      "2 stars",
      "2.5 stars",
      "3 stars",
      "3.5 stars",
      "4 stars",
      "4.5 stars",
      "5 stars",
    ]);
    for (const element of items()) {
      expect(element.querySelectorAll('[role="radio"]')).toHaveLength(2);
    }
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(radio("2.5 stars")).toHaveAttribute("aria-checked", "true");
    expect(onValueChange).toHaveBeenLastCalledWith(2.5);
    expect(marked("data-filled")).toEqual([1, 2]);
    expect(marked("data-half")).toEqual([3]);
    expect(item(3).style.getPropertyValue("--rating-fill")).toBe("50%");
    expect(item(2).style.getPropertyValue("--rating-fill")).toBe("100%");
    expect(item(4).style.getPropertyValue("--rating-fill")).toBe("0%");
  });

  it.each([
    { dir: "ltr", side: "left" },
    { dir: "rtl", side: "right" },
  ] as const)(
    "a click on the inline-start ($side) half of star 3 sets 2.5 ($dir)",
    async ({ dir }) => {
      const onValueChange = vi.fn();
      await render(
        <div dir={dir}>
          <Rating allowHalf size="lg" onValueChange={onValueChange} />
        </div>,
      );
      const star = item(3);
      const { width, height } = star.getBoundingClientRect();
      const x = dir === "ltr" ? width * 0.25 : width * 0.75;
      await userEvent.click(page.elementLocator(star), { position: { x, y: height / 2 } });
      await expect.element(radio("2.5 stars")).toHaveAttribute("aria-checked", "true");
      expect(onValueChange).toHaveBeenLastCalledWith(2.5);
      // And the inline-end half sets the whole star.
      const endX = dir === "ltr" ? width * 0.75 : width * 0.25;
      await userEvent.click(page.elementLocator(star), { position: { x: endX, y: height / 2 } });
      await expect.element(radio("3 stars")).toHaveAttribute("aria-checked", "true");
    },
  );

  it.each(["ltr", "rtl"] as const)(
    "a half star's visible fill is its inline-start half (%s)",
    async (dir) => {
      await render(
        <div dir={dir} className="bg-background p-2">
          <Rating allowHalf size="lg" defaultValue={2.5} />
        </div>,
      );
      expect(item(3).style.getPropertyValue("--rating-fill")).toBe("50%");
      const { partial, full } = await filledRun(item(3), item(1));
      const width = item(3).getBoundingClientRect().width;
      expect(width).toBe(24);
      expect(full.count).toBeGreaterThan(14);
      if (dir === "ltr") {
        expect(Math.abs(partial.first - full.first)).toBeLessThanOrEqual(1);
        expect(Math.abs(partial.last + 1 - width / 2)).toBeLessThanOrEqual(1.5);
      } else {
        expect(Math.abs(partial.last - full.last)).toBeLessThanOrEqual(1);
        expect(Math.abs(partial.first - width / 2)).toBeLessThanOrEqual(1.5);
      }
    },
  );
});

describe("Rating RTL", () => {
  it("← checks the next value, → the previous; star 1 sits right of star 2", async () => {
    await render(
      <div dir="rtl">
        <Rating defaultValue={2} />
      </div>,
    );
    expect(item(1).getBoundingClientRect().left).toBeGreaterThan(
      item(2).getBoundingClientRect().left,
    );
    await userEvent.tab();
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(radio("3 stars")).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(radio("2 stars")).toHaveAttribute("aria-checked", "true");
  });

  it("follows a dir change on an ancestor after mount", async () => {
    await render(
      <div data-testid="host">
        <Rating defaultValue={2} />
      </div>,
    );
    page.getByTestId("host").element().setAttribute("dir", "rtl");
    await userEvent.tab();
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(radio("3 stars")).toHaveAttribute("aria-checked", "true");
  });
});

describe("Rating pointer", () => {
  it("a click on star 3 sets 3; with clearable a second click clears it", async () => {
    const onValueChange = vi.fn();
    await render(<Rating clearable onValueChange={onValueChange} />);
    await userEvent.click(radio("3 stars"));
    await expect.element(radio("3 stars")).toHaveAttribute("aria-checked", "true");
    await userEvent.click(radio("3 stars"));
    await expect.poll(checked).toEqual([]);
    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([3, null]);
  });

  it("without clearable a second click keeps the value", async () => {
    const onValueChange = vi.fn();
    await render(<Rating onValueChange={onValueChange} />);
    await userEvent.click(radio("3 stars"));
    await userEvent.click(radio("3 stars"));
    await nextFrame();
    expect(checked()).toEqual(["3 stars"]);
    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([3]);
  });

  it("mouse hover previews; leaving restores the value", async () => {
    await render(
      <>
        <Rating defaultValue={2} />
        <button type="button">Elsewhere</button>
      </>,
    );
    expect(marked("data-filled")).toEqual([1, 2]);
    await userEvent.hover(radio("4 stars"));
    await expect.poll(() => marked("data-filled")).toEqual([1, 2, 3, 4]);
    expect(root().hasAttribute("data-preview")).toBe(true);
    expect(checked()).toEqual(["2 stars"]);
    await userEvent.hover(page.getByRole("button", { name: "Elsewhere" }));
    await expect.poll(() => root().hasAttribute("data-preview")).toBe(false);
    expect(marked("data-filled")).toEqual([1, 2]);
  });

  it("hovering a half radio previews a half star", async () => {
    await render(<Rating allowHalf />);
    await userEvent.hover(radio("3.5 stars"));
    await expect.poll(() => marked("data-filled")).toEqual([1, 2, 3]);
    expect(marked("data-half")).toEqual([4]);
    expect(item(4).style.getPropertyValue("--rating-fill")).toBe("50%");
  });

  it("a touch tap sets the value and leaves no hover preview", async () => {
    const onValueChange = vi.fn();
    await render(<Rating onValueChange={onValueChange} />);
    await tap(radio("3 stars").element() as HTMLElement);
    await expect.element(radio("3 stars")).toHaveAttribute("aria-checked", "true");
    expect(onValueChange).toHaveBeenLastCalledWith(3);
    expect(root().hasAttribute("data-preview")).toBe(false);
    expect(marked("data-filled")).toEqual([1, 2, 3]);
    // A touch "hover" over another star previews nothing either.
    const other = radio("5 stars").element();
    other.dispatchEvent(
      new PointerEvent("pointerover", { bubbles: true, pointerType: "touch", isPrimary: true }),
    );
    await nextFrame();
    expect(root().hasAttribute("data-preview")).toBe(false);
    expect(marked("data-filled")).toEqual([1, 2, 3]);
  });

  it("a keyboard change while the mouse rests on a star shows the new value, not the preview", async () => {
    await render(<Rating defaultValue={2} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(radio("2 stars").element());
    await userEvent.hover(radio("5 stars"));
    await expect.poll(() => marked("data-filled")).toEqual([1, 2, 3, 4, 5]);
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(radio("3 stars")).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => root().hasAttribute("data-preview")).toBe(false);
    expect(marked("data-filled")).toEqual([1, 2, 3]);
  });
});

describe("Rating controlled and uncontrolled", () => {
  it("an off-step value fills fractionally, checks no radio, and Tab lands on the first", async () => {
    await render(
      <>
        <Rating aria-label="Controlled" value={3.7} />
        <Rating aria-label="Whole steps" defaultValue={3.5} />
      </>,
    );
    expect(checked()).toEqual([]);
    expect(items()[3]?.style.getPropertyValue("--rating-fill")).toBe("70%");
    expect(items()[8]?.style.getPropertyValue("--rating-fill")).toBe("50%");
    await userEvent.tab();
    expect(document.activeElement).toBe(
      group("Controlled").element().querySelector('[role="radio"]'),
    );
    expect(document.activeElement?.getAttribute("aria-label")).toBe("1 star");
  });

  it("defaultValue seeds an uncontrolled rating that then follows its own changes", async () => {
    await render(<Rating defaultValue={2} />);
    expect(checked()).toEqual(["2 stars"]);
    await userEvent.click(radio("4 stars"));
    await expect.poll(checked).toEqual(["4 stars"]);
  });

  it("value + onValueChange: the parent's state drives the rating", async () => {
    function Controlled() {
      const [value, setValue] = useState<number | null>(1);
      return (
        <>
          <Rating value={value} onValueChange={setValue} />
          <output>{String(value)}</output>
          <button type="button" onClick={() => setValue(null)}>
            Reset
          </button>
        </>
      );
    }
    await render(<Controlled />);
    expect(checked()).toEqual(["1 star"]);
    await userEvent.click(radio("4 stars"));
    await expect.element(page.getByRole("status")).toHaveTextContent("4");
    expect(checked()).toEqual(["4 stars"]);
    await userEvent.click(page.getByRole("button", { name: "Reset" }));
    await expect.poll(checked).toEqual([]);
    expect(marked("data-filled")).toEqual([]);
  });

  it("a controlled parent that ignores changes keeps its value", async () => {
    const onValueChange = vi.fn();
    await render(
      <>
        <Rating value={2} onValueChange={onValueChange} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await userEvent.click(radio("4 stars"));
    expect(onValueChange).toHaveBeenLastCalledWith(4);
    // Move off the stars so the hover preview does not hide the value.
    await userEvent.hover(page.getByRole("button", { name: "Elsewhere" }));
    await expect.poll(() => root().hasAttribute("data-preview")).toBe(false);
    expect(checked()).toEqual(["2 stars"]);
    expect(marked("data-filled")).toEqual([1, 2]);
  });
});

describe("Rating display mode", () => {
  it("is an img named by the value, with no radios and no Tab stop", async () => {
    await render(
      <>
        <button type="button">Before</button>
        <Rating readOnly value={3.5} name="ignored" required />
        <button type="button">After</button>
      </>,
    );
    const img = page.getByRole("img", { name: "3.5 out of 5 stars" });
    await expect.element(img).toBeInTheDocument();
    expect(img.element()).toBe(root());
    expect(root().tagName).toBe("SPAN");
    expect(root().hasAttribute("data-readonly")).toBe(true);
    expect(root().getAttribute("data-size")).toBe("md");
    expect(document.querySelectorAll('[role="radio"], input')).toHaveLength(0);
    expect(marked("data-filled")).toEqual([1, 2, 3]);
    expect(marked("data-half")).toEqual([4]);
    await userEvent.click(page.getByRole("button", { name: "Before" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(page.getByRole("button", { name: "After" }).element());
    expect(getComputedStyle(root()).cursor).toBe("auto");
  });

  it("4.3 fills the fifth item to 30%", async () => {
    await render(<Rating readOnly value={4.3} />);
    await expect.element(page.getByRole("img", { name: "4.3 out of 5 stars" })).toBeInTheDocument();
    expect(item(5).style.getPropertyValue("--rating-fill")).toBe("30%");
    expect(item(4).style.getPropertyValue("--rating-fill")).toBe("100%");
  });

  it.each(["ltr", "rtl"] as const)(
    "the 30% fill is visible from the inline start (%s)",
    async (dir) => {
      await render(
        <div dir={dir} className="bg-background p-2">
          <Rating readOnly size="lg" value={4.3} />
        </div>,
      );
      const { partial, full } = await filledRun(item(5), item(1));
      const width = item(5).getBoundingClientRect().width;
      expect(width).toBe(24);
      if (dir === "ltr") {
        expect(Math.abs(partial.first - full.first)).toBeLessThanOrEqual(1);
        expect(Math.abs(partial.last + 1 - width * 0.3)).toBeLessThanOrEqual(1.5);
      } else {
        expect(Math.abs(partial.last - full.last)).toBeLessThanOrEqual(1);
        expect(Math.abs(partial.first - width * 0.7)).toBeLessThanOrEqual(1.5);
      }
    },
  );

  it("valueLabel overrides; null reads No rating", async () => {
    await render(
      <>
        <Rating
          readOnly
          value={4}
          max={10}
          valueLabel={(value, max) => `Note ${value} sur ${max}`}
        />
        <Rating readOnly value={null} />
      </>,
    );
    await expect.element(page.getByRole("img", { name: "Note 4 sur 10" })).toBeInTheDocument();
    await expect.element(page.getByRole("img", { name: "No rating" })).toBeInTheDocument();
  });

  it("ignores name and required: nothing is submitted", async () => {
    let data: FormData | null = null;
    await render(
      <form
        aria-label="Review"
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <Rating readOnly value={4} name="rating" required />
        <button type="submit">Send</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(data).not.toBeNull());
    expect([...(data as unknown as FormData).keys()]).toEqual([]);
  });
});

describe("Rating disabled", () => {
  // Base UI 1.8 keeps a disabled RadioGroup's roving radio in the Tab order (`aria-disabled`), so
  // the focusable-disabled convention applies: muted stars at opacity 1, not a fade.
  it("stays focusable (aria-disabled) but ignores keys and clicks; muted, opacity 1, not-allowed", async () => {
    const onValueChange = vi.fn();
    await render(
      <div className="bg-background">
        <button type="button">Before</button>
        <Rating disabled defaultValue={2} onValueChange={onValueChange} />
        <button type="button">After</button>
        <span data-testid="muted" className="text-muted-foreground" />
      </div>,
    );
    await userEvent.click(page.getByRole("button", { name: "Before" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(radio("2 stars").element());
    await expect.element(radio("2 stars")).toHaveAttribute("aria-disabled", "true");
    for (const key of ["{ArrowRight}", " ", "{ArrowLeft}"]) await userEvent.keyboard(key);
    await userEvent.click(radio("4 stars"), { force: true });
    await nextFrame();
    expect(checked()).toEqual(["2 stars"]);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(root().hasAttribute("data-disabled")).toBe(true);
    expect(getComputedStyle(root()).opacity).toBe("1");
    expect(getComputedStyle(root()).cursor).toBe("not-allowed");
    expect(getComputedStyle(radio("4 stars").element()).cursor).toBe("not-allowed");
    // The filled stars are muted (solid), the empty ones muted outlines.
    const muted = getComputedStyle(page.getByTestId("muted").element()).color;
    await animationsSettled();
    expect(getComputedStyle(filledStar(1)).fill).toBe(muted);
    expect(getComputedStyle(emptyStar(4)).stroke).toBe(muted);
    expect(getComputedStyle(emptyStar(4)).fill).toBe("none");
  });

  it("forced colors: a disabled rating is GrayText (solid filled, outlined empty)", async () => {
    await emulateForcedColors(true);
    await render(<Rating disabled defaultValue={2} />);
    const grayText = systemColor("GrayText");
    expect(getComputedStyle(filledStar(1)).fill).toBe(grayText);
    expect(getComputedStyle(emptyStar(4)).stroke).toBe(grayText);
    expect(getComputedStyle(emptyStar(4)).fill).toBe("none");
  });

  it("a disabled rating previews nothing on hover", async () => {
    await render(<Rating disabled defaultValue={1} />);
    await userEvent.hover(radio("4 stars"), { force: true });
    await nextFrame();
    expect(root().hasAttribute("data-preview")).toBe(false);
    expect(marked("data-filled")).toEqual([1]);
  });

  it("a disabled Field disables it", async () => {
    await render(
      <Field disabled>
        <FieldLabel>Score</FieldLabel>
        <Rating defaultValue={2} />
      </Field>,
    );
    await expect.element(radio("3 stars")).toHaveAttribute("data-disabled");
    expect(root().hasAttribute("data-disabled")).toBe(true);
  });
});

describe("Rating in a form", () => {
  it("name submits the value through native FormData", async () => {
    let data: FormData | null = null;
    await render(
      <form
        aria-label="Review"
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <Rating name="rating" defaultValue={4} />
        <button type="submit">Send</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(data).not.toBeNull());
    expect((data as unknown as FormData).getAll("rating")).toEqual(["4"]);
  });

  it("form associates the radios with a form elsewhere in the document", async () => {
    let data: FormData | null = null;
    await render(
      <>
        <form
          id="review-form"
          aria-label="Review"
          onSubmit={(event) => {
            event.preventDefault();
            data = new FormData(event.currentTarget);
          }}
        >
          <button type="submit">Send</button>
        </form>
        <Rating name="rating" form="review-form" allowHalf defaultValue={3.5} />
      </>,
    );
    await userEvent.click(page.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(data).not.toBeNull());
    expect((data as unknown as FormData).getAll("rating")).toEqual(["3.5"]);
  });

  it("in a Field in a Form: one control, one FormData entry, onFormSubmit reports the number", async () => {
    const onFormSubmit = vi.fn();
    let native: FormData | null = null;
    let controls = -1;
    await render(
      <Form
        aria-label="Review"
        onFormSubmit={onFormSubmit}
        onSubmit={(event) => {
          native = new FormData(event.currentTarget);
        }}
      >
        <Field name="rating">
          <FieldLabel>Your rating</FieldLabel>
          <Rating allowHalf defaultValue={4} />
        </Field>
        <RegisteredControls
          onRead={(count) => {
            controls = count;
          }}
        />
        <Button type="submit">Send</Button>
      </Form>,
    );
    await expect.element(group("Your rating")).toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "Count controls" }));
    expect(controls).toBe(1);
    await userEvent.click(page.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({ rating: 4 });
    expect((native as unknown as FormData).getAll("rating")).toEqual(["4"]);
    expect([...(native as unknown as FormData).keys()]).toEqual(["rating"]);
  });

  it("required with no value blocks submit and focuses the first radio", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <Form aria-label="Review" onFormSubmit={onFormSubmit}>
        <Field name="rating">
          <FieldLabel>Your rating</FieldLabel>
          <Rating required />
          <FieldError />
        </Field>
        <Button type="submit">Send</Button>
      </Form>,
    );
    await expect.element(group("Your rating")).toHaveAttribute("aria-required", "true");
    await userEvent.click(page.getByRole("button", { name: "Send" }));
    await expect.poll(() => document.activeElement).toBe(radio("1 star").element());
    expect(onFormSubmit).not.toHaveBeenCalled();
    // Rating it lets the form submit.
    await userEvent.click(radio("2 stars"));
    await userEvent.click(page.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({ rating: 2 });
  });

  it("<Field invalid> shows its FieldError and marks the radios invalid", async () => {
    await render(
      <Field invalid>
        <FieldLabel>Your rating</FieldLabel>
        <Rating defaultValue={1} />
        <FieldError>Rate at least two stars.</FieldError>
      </Field>,
    );
    await expect.element(page.getByText("Rate at least two stars.")).toBeVisible();
    await expect.element(radio("1 star")).toHaveAttribute("data-invalid");
  });

  // Pinned: the radios sit in their own labelling scope, so a click on the Field label neither
  // selects "1 star" (as a plain Base UI RadioGroup's first radio would) nor moves focus into it.
  it("a click on the Field label selects nothing and does not focus a radio", async () => {
    const onValueChange = vi.fn();
    await render(
      <Field>
        <FieldLabel>Your rating</FieldLabel>
        <Rating onValueChange={onValueChange} />
      </Field>,
    );
    await userEvent.click(page.getByText("Your rating"));
    await nextFrame();
    expect(checked()).toEqual([]);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.activeElement?.getAttribute("role")).not.toBe("radio");
  });
});

describe("Rating styles", () => {
  it("sizes: the item box is 16 / 20 / 24px", async () => {
    await render(
      <>
        <Rating aria-label="Small" size="sm" />
        <Rating aria-label="Medium" />
        <Rating aria-label="Large" size="lg" />
      </>,
    );
    const all = items();
    const box = (index: number) => {
      const rect = (all[index] as HTMLElement).getBoundingClientRect();
      return [rect.width, rect.height];
    };
    expect(box(0)).toEqual([16, 16]);
    expect(box(5)).toEqual([20, 20]);
    expect(box(10)).toEqual([24, 24]);
    expect(group("Large").element().getAttribute("data-size")).toBe("lg");
  });

  it("the half radios cover the inline-start and inline-end halves of the item", async () => {
    await render(<Rating allowHalf size="lg" />);
    const box = item(1).getBoundingClientRect();
    const start = radio("0.5 stars").element().getBoundingClientRect();
    const end = radio("1 star").element().getBoundingClientRect();
    expect([start.left, start.width, start.height]).toEqual([box.left, 12, 24]);
    expect([end.left, end.width]).toEqual([box.left + 12, 12]);
  });

  it("Tab shows a 2px solid ring round the whole item, none before", async () => {
    await render(<Rating allowHalf defaultValue={2.5} />);
    const star = item(3);
    expect(getComputedStyle(star).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(radio("2.5 stars").element());
    const style = getComputedStyle(star);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
    expect(getComputedStyle(radio("2.5 stars").element()).outlineStyle).toBe("none");
    expect(getComputedStyle(item(2)).outlineStyle).toBe("none");
  });

  it("forced colors: filled stars are solid CanvasText, empty ones CanvasText outlines", async () => {
    await emulateForcedColors(true);
    await render(<Rating defaultValue={2} />);
    const canvasText = systemColor("CanvasText");
    expect(getComputedStyle(item(1)).forcedColorAdjust).toBe("none");
    const filled = getComputedStyle(filledStar(1));
    expect(filled.fill).toBe(canvasText);
    expect(filled.stroke).toBe(canvasText);
    const empty = getComputedStyle(emptyStar(4));
    expect(empty.fill).toBe("none");
    expect(empty.stroke).toBe(canvasText);
    // Item 4's filled star is clipped away entirely.
    expect(item(4).style.getPropertyValue("--rating-fill")).toBe("0%");
  });

  it("forced colors: the hover preview turns Highlight", async () => {
    await emulateForcedColors(true);
    await render(<Rating defaultValue={1} />);
    await userEvent.hover(radio("3 stars"));
    await expect.poll(() => root().hasAttribute("data-preview")).toBe(true);
    // The colour change transitions (150ms); read it once it has run.
    await animationsSettled();
    expect(getComputedStyle(filledStar(2)).fill).toBe(systemColor("Highlight"));
  });

  it("forced colors: the ring is none until focused, then Highlight", async () => {
    await emulateForcedColors(true);
    await render(<Rating defaultValue={2} />);
    expect(getComputedStyle(item(2)).outlineStyle).toBe("none");
    await userEvent.tab();
    const style = getComputedStyle(item(2));
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineColor).toBe(systemColor("Highlight"));
  });

  it("the fill transitions, and not under reduced motion", async () => {
    await render(<Rating defaultValue={2} />);
    const star = filledStar(1);
    expect(getComputedStyle(star).transitionProperty).toBe("clip-path, color");
    expect(getComputedStyle(star).transitionDuration).toBe("0.15s");
    await emulateReducedMotion(true);
    expect(getComputedStyle(star).transitionProperty).toBe("none");
  });
});

describe("Rating axe", () => {
  async function audit(container: Element) {
    const results = await axe.run(container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  }

  it.each(["light", "dark"] as const)("has no violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Rating aria-label="Empty" />
        <Rating aria-label="Three" defaultValue={3} name="three" />
        <Rating aria-label="Half" allowHalf defaultValue={3.5} />
        <Rating readOnly value={4.3} />
        <Rating aria-label="Off" disabled defaultValue={2} />
        <Field>
          <FieldLabel>Your rating</FieldLabel>
          <Rating clearable defaultValue={4} />
          <FieldDescription>Tap a star again to clear it.</FieldDescription>
        </Field>
      </div>,
    );
    await expect.element(group("Your rating")).toBeInTheDocument();
    await audit(screen.container);
  });
});
