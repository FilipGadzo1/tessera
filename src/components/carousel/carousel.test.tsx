import axe from "axe-core";
import { type ReactElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, emulateReducedMotion, systemColor } from "../../../test/emulation";
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPlayPause,
  CarouselPrevious,
  type CarouselProps,
  carouselTimer,
} from "./carousel";
import * as stories from "./carousel.stories";

/**
 * Five 320px slides (or `count`), with every part. Offset from the page's top-left corner, where
 * the pointer is parked: Chromium sends a synthetic mouse move after a scroll or layout change,
 * which would otherwise "hover" (and so pause) the carousel.
 */
function Slides({
  count = 5,
  contentClassName = "w-80",
  itemClassName = "h-40",
  ...props
}: Partial<CarouselProps> & { count?: number; contentClassName?: string; itemClassName?: string }) {
  return (
    <Carousel aria-label="Photos" className="m-8" {...props}>
      <CarouselContent className={contentClassName}>
        {Array.from({ length: count }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a static fixture.
          <CarouselItem key={i} className={itemClassName}>
            <a href={`#slide-${i + 1}`}>Slide {i + 1}</a>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselDots />
      <CarouselNext />
      <CarouselPlayPause />
    </Carousel>
  );
}

/** Renders a story with the meta's args under its own, through its render (or the meta's). */
function StoryView({ story }: { story: { args?: object; render?: unknown } }) {
  const Render = (story.render ?? stories.default.render) as (args: object) => ReactElement;
  return <Render {...stories.default.args} {...story.args} />;
}

const root = () => page.getByRole("region", { name: "Photos" }).element() as HTMLElement;
const content = () => root().querySelector("[data-slot=carousel-content]") as HTMLElement;
const slides = () => Array.from(root().querySelectorAll<HTMLElement>("[data-slot=carousel-item]"));
const slide = (n: number) => slides()[n - 1] as HTMLElement;
const button = (name: string) =>
  page.getByRole("button", { name, exact: true }).element() as HTMLElement;
const prev = () => button("Previous slide");
const next = () => button("Next slide");
const dot = (n: number) => button(`Go to slide ${n}`);
const dots = () => Array.from(root().querySelectorAll<HTMLElement>("[data-slot=carousel-dot]"));
/** The 1-based slide whose dot is current. */
const current = () => dots().findIndex((d) => d.getAttribute("aria-current") === "true") + 1;
/** The 1-based slides that are not inert. */
const live = () =>
  slides()
    .map((s, i) => (s.inert ? 0 : i + 1))
    .filter(Boolean);
/** The 1-based slides at least 60% inside the scroll container (geometry). */
function inView() {
  const box = content().getBoundingClientRect();
  const vertical = content().dataset.orientation === "vertical";
  return slides()
    .map((s, i) => {
      const r = s.getBoundingClientRect();
      const size = vertical ? r.height : r.width;
      const overlap = vertical
        ? Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top)
        : Math.min(r.right, box.right) - Math.max(r.left, box.left);
      return overlap / size >= 0.6 ? i + 1 : 0;
    })
    .filter(Boolean);
}

/**
 * Holds the carousel's autoplay timer (`carouselTimer.schedule`): nothing runs until `fire()`, no
 * real timer is touched. `active()` is how many rotations are scheduled. Restored in `afterEach`.
 */
function holdTimer() {
  const pending = new Set<{ callback: () => void; ms: number }>();
  vi.spyOn(carouselTimer, "schedule").mockImplementation((callback, ms) => {
    const entry = { callback, ms };
    pending.add(entry);
    return () => {
      pending.delete(entry);
    };
  });
  return {
    active: () => pending.size,
    intervals: () => Array.from(pending, (entry) => entry.ms),
    fire() {
      const entries = Array.from(pending);
      pending.clear();
      for (const entry of entries) entry.callback();
    },
  };
}

async function press(key: string) {
  await userEvent.keyboard(key);
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
  vi.restoreAllMocks();
});

describe("Carousel", () => {
  describe("structure", () => {
    it("renders the APG carousel roles, labels and data-slots", async () => {
      await render(<Slides />);
      const section = root();
      expect(section.tagName).toBe("SECTION");
      expect(section.dataset.slot).toBe("carousel");
      expect(section.getAttribute("aria-roledescription")).toBe("carousel");
      const scroller = content();
      expect(scroller.getAttribute("aria-live")).toBe("polite");
      expect(scroller.id).not.toBe("");
      await expect
        .poll(() => slides().map((s) => s.getAttribute("aria-label")))
        .toEqual(["1 of 5", "2 of 5", "3 of 5", "4 of 5", "5 of 5"]);
      for (const s of slides()) {
        expect(s.getAttribute("role")).toBe("group");
        expect(s.getAttribute("aria-roledescription")).toBe("slide");
      }
      expect(prev().dataset.slot).toBe("carousel-previous");
      expect(next().dataset.slot).toBe("carousel-next");
      expect(prev().getAttribute("aria-controls")).toBe(scroller.id);
      expect(next().getAttribute("aria-controls")).toBe(scroller.id);
      expect(root().querySelector("[data-slot=carousel-dots]")).not.toBeNull();
      expect(dots()).toHaveLength(5);
      // No autoplay: no rotation control.
      expect(root().querySelector("[data-slot=carousel-play-pause]")).toBeNull();
    });

    it("uses scroll-snap classes on the content and the items", async () => {
      await render(<Slides />);
      const scroller = content();
      for (const cls of ["flex", "snap-x", "snap-mandatory", "overflow-x-auto", "scroll-smooth"])
        expect(scroller.classList).toContain(cls);
      expect(getComputedStyle(scroller).scrollSnapType).toBe("x mandatory");
      expect(getComputedStyle(scroller).scrollBehavior).toBe("smooth");
      expect(getComputedStyle(scroller).scrollbarWidth).toBe("none");
      for (const cls of ["snap-start", "shrink-0", "basis-full"])
        expect(slide(1).classList).toContain(cls);
      expect(slide(1).getBoundingClientRect().width).toBe(320);
    });

    it("localises every label", async () => {
      await render(
        <Carousel aria-label="Photos" slideLabel={(n, total) => `Folie ${n} von ${total}`}>
          <CarouselContent className="w-80">
            <CarouselItem>A</CarouselItem>
            <CarouselItem>B</CarouselItem>
          </CarouselContent>
          <CarouselPrevious aria-label="Vorherige Folie" />
          <CarouselNext aria-label="Nächste Folie" />
          <CarouselDots aria-label="Folie wählen" dotLabel={(n) => `Gehe zu Folie ${n}`} />
        </Carousel>,
      );
      await expect.poll(() => slide(2).getAttribute("aria-label")).toBe("Folie 2 von 2");
      expect(button("Vorherige Folie")).toBeTruthy();
      expect(button("Nächste Folie")).toBeTruthy();
      expect(button("Gehe zu Folie 2")).toBeTruthy();
      expect(page.getByRole("group", { name: "Folie wählen" }).element()).toBeTruthy();
    });
  });

  describe("navigation", () => {
    it("next, previous and the dots move the index, the current dot and the live slides", async () => {
      const onIndexChange = vi.fn();
      await render(<Slides onIndexChange={onIndexChange} />);
      await expect.poll(current).toBe(1);
      expect(live()).toEqual([1]);

      await userEvent.click(next());
      await expect.poll(current).toBe(2);
      expect(onIndexChange).toHaveBeenLastCalledWith(1);
      await expect.poll(inView).toEqual([2]);
      expect(live()).toEqual([2]);

      await userEvent.click(dot(4));
      await expect.poll(current).toBe(4);
      await expect.poll(inView).toEqual([4]);
      expect(live()).toEqual([4]);
      expect(onIndexChange).toHaveBeenLastCalledWith(3);

      await userEvent.click(prev());
      await expect.poll(current).toBe(3);
      await expect.poll(inView).toEqual([3]);
      expect(onIndexChange).toHaveBeenLastCalledWith(2);
    });

    it("the ends are disabled without loop, focusable, and do nothing", async () => {
      await render(<Slides count={3} />);
      await expect.poll(() => prev().getAttribute("aria-disabled")).toBe("true");
      expect(next().getAttribute("aria-disabled")).toBeNull();
      expect(getComputedStyle(prev()).cursor).toBe("not-allowed");
      await userEvent.click(prev(), { force: true });
      expect(current()).toBe(1);

      await userEvent.click(next());
      await expect.poll(current).toBe(2);
      await userEvent.click(next());
      await expect.poll(current).toBe(3);
      await expect.poll(() => next().getAttribute("aria-disabled")).toBe("true");
      expect(prev().getAttribute("aria-disabled")).toBeNull();
      // Still focused: a disabled end keeps a keyboard user's place.
      expect(document.activeElement).toBe(next());
      await userEvent.click(next(), { force: true });
      await expect.poll(inView).toEqual([3]);
      expect(current()).toBe(3);
    });

    it("with loop the ends wrap around", async () => {
      await render(<Slides count={3} loop />);
      await expect.poll(current).toBe(1);
      expect(prev().getAttribute("aria-disabled")).toBeNull();
      await userEvent.click(prev());
      await expect.poll(current).toBe(3);
      await expect.poll(inView).toEqual([3]);
      await userEvent.click(next());
      await expect.poll(current).toBe(1);
      await expect.poll(inView).toEqual([1]);
    });

    it("defaultIndex starts on that slide without animating", async () => {
      await render(<Slides defaultIndex={3} />);
      await expect.poll(current).toBe(4);
      await expect.poll(inView).toEqual([4]);
      expect(live()).toEqual([4]);
    });

    it("a move during a running scroll retargets it, even back to the slide it left", async () => {
      await render(<Slides />);
      next().click();
      await expect.poll(current).toBe(2);
      next().click();
      await expect.poll(current).toBe(3);
      // The content is still near slide 1: the running scroll must be turned around.
      expect(inView()).toEqual([1]);
      const ended = new Promise((resolve) =>
        content().addEventListener("scrollend", resolve, { once: true }),
      );
      dot(1).click();
      await expect.poll(current).toBe(1);
      // Settled: once the scroll has ended the content and the index are on slide 1.
      await ended;
      expect(content().scrollLeft).toBe(0);
      expect(inView()).toEqual([1]);
      expect(current()).toBe(1);
    });

    it("a user scroll updates the index (IntersectionObserver)", async () => {
      const onIndexChange = vi.fn();
      await render(<Slides onIndexChange={onIndexChange} />);
      content().scrollTo({ left: 640, behavior: "instant" });
      await expect.poll(current).toBe(3);
      expect(onIndexChange).toHaveBeenLastCalledWith(2);
      expect(live()).toEqual([3]);
    });
  });

  describe("controlled index", () => {
    it("follows the index prop and reports changes without moving itself", async () => {
      const onIndexChange = vi.fn();
      const screen = await render(<Slides index={1} onIndexChange={onIndexChange} />);
      await expect.poll(current).toBe(2);
      await expect.poll(inView).toEqual([2]);
      await userEvent.click(next());
      expect(onIndexChange).toHaveBeenLastCalledWith(2);
      // The parent did not accept it: still slide 2.
      expect(current()).toBe(2);
      await screen.rerender(<Slides index={4} onIndexChange={onIndexChange} />);
      await expect.poll(current).toBe(5);
      await expect.poll(inView).toEqual([5]);
    });

    it("works with a state-owning parent", async () => {
      function Controlled() {
        const [index, setIndex] = useState(0);
        return (
          <>
            <Slides index={index} onIndexChange={setIndex} />
            <output>index {index}</output>
          </>
        );
      }
      await render(<Controlled />);
      await userEvent.click(next());
      await expect.poll(() => document.querySelector("output")?.textContent).toBe("index 1");
      await expect.poll(inView).toEqual([2]);
      await userEvent.click(dot(5));
      await expect.poll(() => document.querySelector("output")?.textContent).toBe("index 4");
      await expect.poll(inView).toEqual([5]);
    });
  });

  describe("keyboard", () => {
    it("the content is focusable with a 2px solid ring; ←/→ move the slides", async () => {
      await render(<Slides />);
      const scroller = content();
      expect(scroller.tabIndex).toBe(0);
      scroller.focus();
      await press("{ArrowRight}");
      await expect.poll(current).toBe(2);
      await press("{ArrowRight}");
      await expect.poll(current).toBe(3);
      await press("{ArrowLeft}");
      await expect.poll(current).toBe(2);
      await expect.poll(inView).toEqual([2]);
      // ↑/↓ belong to the vertical orientation.
      await press("{ArrowDown}");
      expect(current()).toBe(2);
    });

    it("keyboard focus draws the ring on the content", async () => {
      await render(<Slides />);
      const scroller = content();
      expect(getComputedStyle(scroller).outlineStyle).toBe("none");
      await userEvent.tab();
      await expect.poll(() => document.activeElement).toBe(scroller);
      await expect.poll(() => getComputedStyle(scroller).outlineStyle).toBe("solid");
      expect(getComputedStyle(scroller).outlineWidth).toBe("2px");
    });

    it("keys on a control inside a slide are left alone", async () => {
      await render(<Slides />);
      (slide(1).querySelector("a") as HTMLElement).focus();
      await press("{ArrowRight}");
      expect(current()).toBe(1);
    });

    it("vertical uses ↑/↓ and scrolls on the y axis", async () => {
      await render(<Slides orientation="vertical" contentClassName="h-40 w-80" itemClassName="" />);
      const scroller = content();
      expect(scroller.dataset.orientation).toBe("vertical");
      expect(root().dataset.orientation).toBe("vertical");
      expect(getComputedStyle(scroller).scrollSnapType).toBe("y mandatory");
      expect(getComputedStyle(scroller).flexDirection).toBe("column");
      expect(slide(1).getBoundingClientRect().height).toBe(160);
      scroller.focus();
      await press("{ArrowDown}");
      await expect.poll(current).toBe(2);
      await expect.poll(inView).toEqual([2]);
      expect(scroller.scrollTop).toBeGreaterThan(0);
      await press("{ArrowRight}");
      expect(current()).toBe(2);
      await press("{ArrowUp}");
      await expect.poll(current).toBe(1);
      await userEvent.click(next());
      await expect.poll(inView).toEqual([2]);
    });
  });

  describe("RTL", () => {
    it("← is next, → is previous, and next scrolls towards the left", async () => {
      await render(
        <div dir="rtl">
          <Slides />
        </div>,
      );
      const scroller = content();
      scroller.focus();
      await press("{ArrowLeft}");
      await expect.poll(current).toBe(2);
      await expect.poll(inView).toEqual([2]);
      // Chromium's RTL scrollLeft runs from 0 to negative.
      expect(scroller.scrollLeft).toBeLessThan(0);
      await press("{ArrowRight}");
      await expect.poll(current).toBe(1);
      await expect.poll(inView).toEqual([1]);
      await userEvent.click(dot(4));
      await expect.poll(inView).toEqual([4]);
      await userEvent.click(next());
      await expect.poll(inView).toEqual([5]);
    });

    it("the chevrons mirror", async () => {
      await render(
        <div dir="rtl">
          <Slides />
        </div>,
      );
      expect(getComputedStyle(prev().querySelector("svg") as Element).scale).toBe("-1 1");
      expect(getComputedStyle(next().querySelector("svg") as Element).scale).toBe("-1 1");
    });
  });

  describe("multiple per view", () => {
    it("slidesPerView sizes the items; the index is the leading slide and the ends stop at the last full view", async () => {
      await render(<Slides count={5} slidesPerView={2} />);
      expect(slide(1).getBoundingClientRect().width).toBe(160);
      await expect.poll(() => dots().length).toBe(4);
      await expect.poll(live).toEqual([1, 2]);
      await userEvent.click(dot(4));
      await expect.poll(inView).toEqual([4, 5]);
      await expect.poll(live).toEqual([4, 5]);
      await expect.poll(() => next().getAttribute("aria-disabled")).toBe("true");
    });

    it("measures the slides per view from CSS basis classes too", async () => {
      await render(<Slides count={6} itemClassName="h-40 basis-1/3" />);
      await expect.poll(() => dots().length).toBe(4);
      await expect.poll(live).toEqual([1, 2, 3]);
    });

    it("with loop, previous from the start goes to the last full view", async () => {
      await render(<Slides count={5} slidesPerView={2} loop />);
      await expect.poll(() => dots().length).toBe(4);
      await userEvent.click(prev());
      await expect.poll(current).toBe(4);
      await expect.poll(inView).toEqual([4, 5]);
      await userEvent.click(next());
      await expect.poll(current).toBe(1);
    });
  });

  describe("inert", () => {
    it("Tab reaches only the visible slide's controls", async () => {
      await render(<Slides />);
      await expect.poll(live).toEqual([1]);
      await userEvent.tab();
      expect(document.activeElement).toBe(content());
      await userEvent.tab();
      expect(document.activeElement?.textContent).toBe("Slide 1");
      await userEvent.tab();
      expect(document.activeElement).toBe(prev());
    });
  });

  describe("autoplay", () => {
    it("advances on the injected timer, wraps, and turns the live region off", async () => {
      const timer = holdTimer();
      await render(<Slides count={3} autoplay />);
      await expect.poll(timer.active).toBe(1);
      expect(timer.intervals()).toEqual([5000]);
      expect(content().getAttribute("aria-live")).toBe("off");
      expect(button("Stop slide rotation").dataset.slot).toBe("carousel-play-pause");
      timer.fire();
      await expect.poll(current).toBe(2);
      await expect.poll(timer.active).toBe(1);
      timer.fire();
      await expect.poll(current).toBe(3);
      timer.fire();
      await expect.poll(current).toBe(1);
      await expect.poll(inView).toEqual([1]);
    });

    it("takes a custom interval", async () => {
      const timer = holdTimer();
      await render(<Slides autoplay={{ interval: 2000 }} />);
      await expect.poll(timer.intervals).toEqual([2000]);
    });

    it("the play/pause toggle stops and starts rotation", async () => {
      const timer = holdTimer();
      await render(<Slides autoplay />);
      await expect.poll(timer.active).toBe(1);
      const toggle = button("Stop slide rotation");
      toggle.focus();
      await press("{Enter}");
      await expect.poll(() => toggle.getAttribute("aria-label")).toBe("Start slide rotation");
      expect(timer.active()).toBe(0);
      expect(content().getAttribute("aria-live")).toBe("polite");
      await press("{Enter}");
      await expect.poll(() => toggle.getAttribute("aria-label")).toBe("Stop slide rotation");
      // Focus on the rotation control itself does not pause.
      await expect.poll(timer.active).toBe(1);
      expect(content().getAttribute("aria-live")).toBe("off");
    });

    it("pauses while hovered", async () => {
      const timer = holdTimer();
      await render(<Slides autoplay />);
      await expect.poll(timer.active).toBe(1);
      await userEvent.hover(slide(1));
      await expect.poll(timer.active).toBe(0);
      expect(content().getAttribute("aria-live")).toBe("polite");
      expect(button("Stop slide rotation")).toBeTruthy();
      await userEvent.unhover(slide(1));
      await expect.poll(timer.active).toBe(1);
    });

    it("pauses while focus is inside", async () => {
      const timer = holdTimer();
      await render(
        <>
          <Slides autoplay />
          <button type="button">outside</button>
        </>,
      );
      await expect.poll(timer.active).toBe(1);
      await userEvent.tab();
      expect(document.activeElement).toBe(content());
      await expect.poll(timer.active).toBe(0);
      (page.getByRole("button", { name: "outside" }).element() as HTMLElement).focus();
      await expect.poll(timer.active).toBe(1);
    });

    it("pauses while the document is hidden", async () => {
      const timer = holdTimer();
      await render(<Slides autoplay />);
      await expect.poll(timer.active).toBe(1);
      const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
      document.dispatchEvent(new Event("visibilitychange"));
      await expect.poll(timer.active).toBe(0);
      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event("visibilitychange"));
      await expect.poll(timer.active).toBe(1);
    });
  });

  describe("reduced motion", () => {
    it("scrolls without smoothing", async () => {
      await emulateReducedMotion(true);
      await render(<Slides />);
      expect(getComputedStyle(content()).scrollBehavior).toBe("auto");
      const positions: number[] = [];
      content().addEventListener("scroll", () => positions.push(content().scrollLeft));
      await userEvent.click(next());
      await expect.poll(inView).toEqual([2]);
      // Instant: every scroll event is already at slide 2 (a smooth scroll has steps between).
      expect(positions.length).toBeGreaterThan(0);
      expect(new Set(positions)).toEqual(new Set([320]));
    });

    it("does not start autoplay, but the user can start it", async () => {
      await emulateReducedMotion(true);
      const timer = holdTimer();
      await render(<Slides autoplay />);
      const toggle = button("Start slide rotation");
      expect(timer.active()).toBe(0);
      expect(content().getAttribute("aria-live")).toBe("polite");
      toggle.focus();
      await press("{Enter}");
      await expect.poll(() => toggle.getAttribute("aria-label")).toBe("Stop slide rotation");
      await expect.poll(timer.active).toBe(1);
    });
  });

  describe("forced colors", () => {
    it("the current dot is Highlight with no backplate; the others are CanvasText", async () => {
      await emulateForcedColors(true);
      await render(<Slides />);
      await expect.poll(current).toBe(1);
      const mark = (n: number) => dot(n).querySelector("[data-slot=carousel-dot-mark]") as Element;
      const on = getComputedStyle(mark(1));
      expect(on.backgroundColor).toBe(systemColor("Highlight"));
      expect(on.getPropertyValue("forced-color-adjust")).toBe("none");
      const off = getComputedStyle(mark(2));
      expect(off.borderColor).toBe(systemColor("CanvasText"));
      expect(off.getPropertyValue("forced-color-adjust")).toBe("auto");
    });

    it("focus rings are Highlight and show only on focus", async () => {
      await emulateForcedColors(true);
      await render(<Slides />);
      for (const target of [content(), next(), dot(2)]) {
        expect(getComputedStyle(target).outlineStyle).toBe("none");
        target.focus();
        await expect.poll(() => getComputedStyle(target).outlineStyle).toBe("solid");
        await expect
          .poll(() => getComputedStyle(target).outlineColor)
          .toBe(systemColor("Highlight"));
      }
    });
  });

  it("stays within a 390px viewport", async () => {
    await page.viewport(390, 800);
    try {
      await render(
        <div className="p-4">
          <StoryView story={stories.Basic} />
        </div>,
      );
      await expect.poll(() => document.querySelectorAll("[data-slot=carousel-dot]").length).toBe(5);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
      const carousel = document.querySelector("[data-slot=carousel]") as HTMLElement;
      expect(carousel.getBoundingClientRect().right).toBeLessThanOrEqual(390);
      for (const control of carousel.querySelectorAll("button"))
        expect(control.getBoundingClientRect().right).toBeLessThanOrEqual(390);
    } finally {
      await page.viewport(1280, 720);
    }
  });

  it.each(["light", "dark"] as const)("has no axe violations (%s)", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    const timer = holdTimer();
    const screen = await render(
      <div className="bg-background p-4 text-foreground">
        <StoryView story={stories.Basic} />
        <StoryView story={stories.MultiplePerView} />
        <StoryView story={stories.Vertical} />
        <StoryView story={stories.AutoplayWithPause} />
      </div>,
    );
    await expect
      .poll(() => document.querySelectorAll("[data-slot=carousel-dot][aria-current=true]").length)
      .toBe(4);
    expect(timer.active()).toBe(1);
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(
      results.incomplete.map(
        (v) => `${v.id}: ${v.help} (${v.nodes.map((node) => node.html).join(", ")})`,
      ),
    ).toEqual([]);
  });
});
