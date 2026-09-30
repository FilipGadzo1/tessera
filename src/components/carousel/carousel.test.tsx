import axe from "axe-core";
import { type ReactElement, startTransition, useState } from "react";
import { renderToString } from "react-dom/server";
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

/** One rendered frame: lets effects and a scheduled re-render settle (not a timed wait). */
function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

/** Resolves on the content's next `scrollend`. */
function scrollEnd() {
  return new Promise((resolve) => content().addEventListener("scrollend", resolve, { once: true }));
}

/**
 * Replaces IntersectionObserver with one the test drives: `report()` calls the carousel's latest
 * observer callback, as a late (stale) delivery would. Restored in `afterEach`.
 */
function holdObserver() {
  const callbacks: IntersectionObserverCallback[] = [];
  class HeldObserver {
    constructor(callback: IntersectionObserverCallback) {
      callbacks.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", HeldObserver);
  return {
    /** Delivers entries claiming slide `n` (1-based) is fully visible. */
    report(n: number) {
      const callback = callbacks.at(-1);
      const entry = { target: slide(n), intersectionRatio: 1, isIntersecting: true };
      callback?.([entry as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    },
  };
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
      // Focusable, so it has a role and a name.
      expect(scroller).toBe(page.getByRole("group", { name: "Slides", exact: true }).element());
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
          <CarouselContent className="w-80" aria-label="Folien">
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
      expect(page.getByRole("group", { name: "Folien", exact: true }).element().dataset.slot).toBe(
        "carousel-content",
      );
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

  describe("observer feedback", () => {
    it("a stale observer report does not scroll the content back", async () => {
      const observer = holdObserver();
      await render(<Slides />);
      await expect.poll(() => slide(1).getAttribute("aria-label")).toBe("1 of 5");
      const ended = scrollEnd();
      content().scrollTo({ left: 960, behavior: "instant" });
      await ended;
      await expect.poll(current).toBe(4);
      const scrollTo = vi.spyOn(content(), "scrollTo");
      // Delivered late: computed while the user was passing slide 3.
      observer.report(3);
      await nextFrame();
      expect(scrollTo).not.toHaveBeenCalled();
      expect(content().scrollLeft).toBe(960);
      expect(current()).toBe(4);
    });

    it("a controlled parent committing a reported index after the user scrolled on does not pull the content back", async () => {
      let moveOn = true;
      function Slow() {
        const [index, setIndex] = useState(0);
        return (
          <Slides
            index={index}
            onIndexChange={(next) => {
              // The user keeps scrolling before the parent commits the first report.
              if (moveOn) {
                moveOn = false;
                content().scrollLeft = 960;
              }
              queueMicrotask(() => setIndex(next));
            }}
          />
        );
      }
      await render(<Slow />);
      await expect.poll(() => slide(1).getAttribute("aria-label")).toBe("1 of 5");
      // Instant scrollLeft assignments, standing in for the user's scrolling.
      content().style.scrollBehavior = "auto";
      const scrollTo = vi.spyOn(content(), "scrollTo");
      content().scrollLeft = 640;
      await expect.poll(current).toBe(4);
      await nextFrame();
      await nextFrame();
      expect(scrollTo).not.toHaveBeenCalled();
      expect(content().scrollLeft).toBe(960);
      expect(current()).toBe(4);
    });

    it.each([
      ["queueMicrotask", (commit: () => void) => queueMicrotask(commit)],
      ["a resolved promise", (commit: () => void) => void Promise.resolve().then(commit)],
      ["startTransition", (commit: () => void) => startTransition(commit)],
    ])(
      "a controlled parent committing the scroll-end report via %s keeps the swipe",
      async (_, defer) => {
        // The observer stays silent, so the scroll end's report is the parent's only news.
        holdObserver();
        function Deferred() {
          const [index, setIndex] = useState(0);
          return <Slides index={index} onIndexChange={(value) => defer(() => setIndex(value))} />;
        }
        await render(<Deferred />);
        await expect.poll(() => slide(1).getAttribute("aria-label")).toBe("1 of 5");
        content().style.scrollBehavior = "auto";
        const scrollTo = vi.spyOn(content(), "scrollTo");
        const ended = scrollEnd();
        content().scrollLeft = 640;
        await ended;
        await expect.poll(current).toBe(3);
        await nextFrame();
        await nextFrame();
        expect(scrollTo).not.toHaveBeenCalled();
        expect(content().scrollLeft).toBe(640);
        expect(current()).toBe(3);
      },
    );

    it("a controlled parent that never commits the scroll-end report snaps the content back", async () => {
      holdObserver();
      const onIndexChange = vi.fn();
      await render(<Slides index={0} onIndexChange={onIndexChange} />);
      await expect.poll(() => slide(1).getAttribute("aria-label")).toBe("1 of 5");
      content().style.scrollBehavior = "auto";
      const ended = scrollEnd();
      content().scrollLeft = 640;
      await ended;
      expect(onIndexChange).toHaveBeenLastCalledWith(2);
      await expect.poll(() => content().scrollLeft).toBe(0);
      expect(current()).toBe(1);
    });

    it("a retarget that lands where the content already is clears the pending move", async () => {
      const observer = holdObserver();
      const onIndexChange = vi.fn();
      const screen = await render(<Slides index={0} onIndexChange={onIndexChange} />);
      await expect.poll(() => slide(1).getAttribute("aria-label")).toBe("1 of 5");
      content().style.scrollBehavior = "auto";
      // A programmatic move whose scroll has not started yet…
      const hold = vi.spyOn(content(), "scrollTo").mockImplementation(() => {});
      await screen.rerender(<Slides index={2} onIndexChange={onIndexChange} />);
      expect(hold).toHaveBeenCalled();
      hold.mockRestore();
      // …turned back to where the content is: no scroll, so no scrollend will clear it.
      await screen.rerender(<Slides index={0} onIndexChange={onIndexChange} />);
      // The user now scrolls; the observer's report is honoured, not held for the old target.
      content().scrollLeft = 640;
      observer.report(3);
      expect(onIndexChange).toHaveBeenLastCalledWith(2);
    });
  });

  describe("controlled index", () => {
    it("a parent that rejects a user scroll snaps the content back to its index", async () => {
      await render(<Slides index={1} onIndexChange={() => {}} />);
      await expect.poll(inView).toEqual([2]);
      content().scrollTo({ left: 960, behavior: "instant" });
      await expect.poll(inView).toEqual([2]);
      expect(current()).toBe(2);
    });

    it("a parent that commits the swiped-to index late (after the snap-back) keeps the swipe", async () => {
      let resolve = () => {};
      const committed = new Promise<void>((done) => {
        resolve = done;
      });
      const reported: number[] = [];
      function Late() {
        const [index, setIndex] = useState(0);
        return (
          <Slides
            index={index}
            onIndexChange={(value) => {
              reported.push(value);
              // Commits only when the test releases it, long after the scroll ended.
              void committed.then(() => setIndex(value));
            }}
          />
        );
      }
      await render(<Late />);
      await expect.poll(() => slide(1).getAttribute("aria-label")).toBe("1 of 5");
      content().scrollTo({ left: 640, behavior: "instant" });
      // The parent commits just as the (smooth) snap-back to its old index starts.
      const scroller = content();
      const scrollTo = scroller.scrollTo.bind(scroller);
      vi.spyOn(scroller, "scrollTo").mockImplementation(((options: ScrollToOptions) => {
        scrollTo(options);
        resolve();
      }) as typeof scroller.scrollTo);
      await expect.poll(() => reported.includes(2)).toBe(true);
      await expect.poll(current).toBe(3);
      await expect.poll(inView).toEqual([3]);
      await nextFrame();
      await nextFrame();
      expect(inView()).toEqual([3]);
      expect(reported).not.toContain(0);
    });

    it("reports an index clamped by the slide count or the slides per view", async () => {
      const onIndexChange = vi.fn();
      const screen = await render(<Slides defaultIndex={4} onIndexChange={onIndexChange} />);
      await expect.poll(current).toBe(5);
      expect(onIndexChange).not.toHaveBeenCalled();
      await screen.rerender(<Slides count={3} defaultIndex={4} onIndexChange={onIndexChange} />);
      await expect.poll(() => onIndexChange.mock.lastCall).toEqual([2]);
      await expect.poll(current).toBe(3);
    });

    it("reports an index clamped by the slides per view", async () => {
      const onIndexChange = vi.fn();
      await render(
        <Slides count={5} defaultIndex={4} slidesPerView={2} onIndexChange={onIndexChange} />,
      );
      await expect.poll(() => onIndexChange.mock.lastCall).toEqual([3]);
      await expect.poll(inView).toEqual([4, 5]);
    });

    it("follows a slide-count change while mounted", async () => {
      const screen = await render(<Slides count={3} />);
      await expect.poll(() => slide(1).getAttribute("aria-label")).toBe("1 of 3");
      await screen.rerender(<Slides count={4} />);
      await expect.poll(() => slide(1).getAttribute("aria-label")).toBe("1 of 4");
      expect(slide(4).getAttribute("aria-label")).toBe("4 of 4");
      expect(dots()).toHaveLength(4);
    });

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

    it("focus in a slide that goes out of view moves to the content, not the body", async () => {
      const screen = await render(<Slides index={0} />);
      await expect.poll(live).toEqual([1]);
      const link = slide(1).querySelector("a") as HTMLElement;
      link.focus();
      await screen.rerender(<Slides index={2} />);
      await expect.poll(live).toEqual([3]);
      await expect.poll(() => document.activeElement).toBe(content());
    });

    it("server HTML already labels the slides and makes the off-screen ones inert", async () => {
      const html = renderToString(<Slides count={3} defaultIndex={1} />);
      const host = document.createElement("div");
      host.innerHTML = html;
      const items = Array.from(host.querySelectorAll("[data-slot=carousel-item]"));
      expect(items.map((item) => item.getAttribute("aria-label"))).toEqual([
        "1 of 3",
        "2 of 3",
        "3 of 3",
      ]);
      expect(items.map((item) => item.hasAttribute("inert"))).toEqual([true, false, true]);
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

    it("keyboard focus on the rotation control stops rotation; pressing it starts and stops it", async () => {
      const timer = holdTimer();
      await render(<Slides autoplay />);
      await expect.poll(timer.active).toBe(1);
      const toggle = button("Stop slide rotation");
      toggle.focus();
      // APG: keyboard focus anywhere in the carousel, the control included, stops rotation.
      await expect.poll(() => toggle.getAttribute("aria-label")).toBe("Start slide rotation");
      expect(timer.active()).toBe(0);
      expect(content().getAttribute("aria-live")).toBe("polite");
      await press("{Enter}");
      await expect.poll(() => toggle.getAttribute("aria-label")).toBe("Stop slide rotation");
      // Started by the user with focus on the control: it runs.
      await expect.poll(timer.active).toBe(1);
      expect(content().getAttribute("aria-live")).toBe("off");
      await press("{Enter}");
      await expect.poll(() => toggle.getAttribute("aria-label")).toBe("Start slide rotation");
      expect(timer.active()).toBe(0);
    });

    it("a pointer click on the rotation control toggles it", async () => {
      const timer = holdTimer();
      await render(
        <>
          <Slides autoplay />
          <button type="button">outside</button>
        </>,
      );
      await expect.poll(timer.active).toBe(1);
      const toggle = button("Stop slide rotation");
      await userEvent.click(toggle);
      await expect.poll(() => toggle.getAttribute("aria-label")).toBe("Start slide rotation");
      await userEvent.click(toggle);
      await expect.poll(() => toggle.getAttribute("aria-label")).toBe("Stop slide rotation");
      // Paused while the pointer is over it; runs once the pointer leaves.
      expect(timer.active()).toBe(0);
      await userEvent.hover(page.getByRole("button", { name: "outside" }).element());
      await expect.poll(timer.active).toBe(1);
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

    it("keyboard focus stops rotation, and it stays stopped after focus leaves", async () => {
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
      await expect.poll(() => button("Start slide rotation")).toBeTruthy();
      expect(timer.active()).toBe(0);
      const outside = page.getByRole("button", { name: "outside" }).element() as HTMLElement;
      outside.focus();
      await nextFrame();
      expect(timer.active()).toBe(0);
      expect(button("Start slide rotation")).toBeTruthy();
      // Only the rotation control restarts it.
      await userEvent.click(button("Start slide rotation"));
      await userEvent.hover(outside);
      await expect.poll(timer.active).toBe(1);
    });

    it("a window blur (alt-tab) with keyboard focus in a slide does not restart rotation", async () => {
      const timer = holdTimer();
      await render(<Slides autoplay />);
      await expect.poll(timer.active).toBe(1);
      await userEvent.tab();
      await userEvent.tab();
      const link = slide(1).querySelector("a") as HTMLElement;
      expect(document.activeElement).toBe(link);
      await expect.poll(() => button("Start slide rotation")).toBeTruthy();
      // The window losing focus: focusout with no relatedTarget, the element stays active.
      link.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
      link.dispatchEvent(new FocusEvent("blur", { relatedTarget: null }));
      await nextFrame();
      expect(timer.active()).toBe(0);
      expect(button("Start slide rotation")).toBeTruthy();
      expect(document.activeElement).toBe(link);
      expect(slide(1).inert).toBe(false);
    });

    it("pointer focus in a slide pauses while it stays there, even across a window blur", async () => {
      const timer = holdTimer();
      await render(
        <>
          <Slides autoplay />
          <button type="button">outside</button>
        </>,
      );
      await expect.poll(timer.active).toBe(1);
      const link = slide(1).querySelector("a") as HTMLElement;
      await userEvent.click(link);
      expect(document.activeElement).toBe(link);
      // A pointer focus is a pause, not a stop.
      expect(button("Stop slide rotation")).toBeTruthy();
      const outside = page.getByRole("button", { name: "outside" }).element() as HTMLElement;
      await userEvent.hover(outside);
      await nextFrame();
      expect(timer.active()).toBe(0);
      link.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
      await nextFrame();
      expect(timer.active()).toBe(0);
      outside.focus();
      await expect.poll(timer.active).toBe(1);
    });

    /**
     * A touch tap in Chromium's order: pointerdown and pointerup first, then (as separate tasks)
     * the compat mousedown's focus and the click. Real mouse modality first, so a programmatic
     * focus is not :focus-visible.
     */
    async function tap(target: HTMLElement) {
      const init = { bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true };
      target.dispatchEvent(new PointerEvent("pointerdown", init));
      target.dispatchEvent(new PointerEvent("pointerup", init));
      await nextFrame();
      target.focus();
      await nextFrame();
      target.click();
      await nextFrame();
    }

    it("one touch tap on the rotation control toggles it exactly once", async () => {
      const timer = holdTimer();
      await render(
        <>
          <Slides autoplay />
          <button type="button">outside</button>
        </>,
      );
      await userEvent.click(page.getByRole("button", { name: "outside" }).element());
      await expect.poll(timer.active).toBe(1);
      const toggle = button("Stop slide rotation");
      await tap(toggle);
      expect(toggle.getAttribute("aria-label")).toBe("Start slide rotation");
      expect(timer.active()).toBe(0);
      await tap(toggle);
      expect(toggle.getAttribute("aria-label")).toBe("Stop slide rotation");
      await expect.poll(timer.active).toBe(1);
    });

    it("a touch tap on Next moves the slide and does not stop rotation", async () => {
      const timer = holdTimer();
      await render(
        <>
          <Slides autoplay />
          <button type="button">outside</button>
        </>,
      );
      const outside = page.getByRole("button", { name: "outside" }).element() as HTMLElement;
      await userEvent.click(outside);
      await expect.poll(timer.active).toBe(1);
      await tap(next());
      await expect.poll(current).toBe(2);
      // Paused while focus stays on Next (like hover), not stopped.
      expect(button("Stop slide rotation")).toBeTruthy();
      outside.focus();
      await expect.poll(timer.active).toBe(1);
    });

    it("stops rotation when prefers-reduced-motion turns on", async () => {
      const timer = holdTimer();
      await render(<Slides autoplay />);
      await expect.poll(timer.active).toBe(1);
      await emulateReducedMotion(true);
      await expect.poll(() => button("Start slide rotation")).toBeTruthy();
      expect(timer.active()).toBe(0);
    });

    it("does not rotate when every slide fits in one view", async () => {
      const timer = holdTimer();
      await render(<Slides count={2} slidesPerView={2} autoplay />);
      await expect.poll(() => slide(2).getAttribute("aria-label")).toBe("2 of 2");
      await nextFrame();
      expect(timer.active()).toBe(0);
    });

    it("keeps rotating when a controlled parent rejects a step", async () => {
      const timer = holdTimer();
      const onIndexChange = vi.fn();
      await render(<Slides autoplay index={0} onIndexChange={onIndexChange} />);
      await expect.poll(timer.active).toBe(1);
      timer.fire();
      expect(onIndexChange).toHaveBeenLastCalledWith(1);
      await expect.poll(timer.active).toBe(1);
      expect(current()).toBe(1);
    });

    it("cancels the timer on unmount and reschedules on an interval change", async () => {
      const timer = holdTimer();
      const screen = await render(<Slides autoplay />);
      await expect.poll(timer.intervals).toEqual([5000]);
      await screen.rerender(<Slides autoplay={{ interval: 2000 }} />);
      await expect.poll(timer.intervals).toEqual([2000]);
      screen.unmount();
      expect(timer.active()).toBe(0);
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
