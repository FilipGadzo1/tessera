"use client";

import {
  type ComponentProps,
  createContext,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { isRtl } from "../../lib/direction";
import { toggleFocusClasses } from "../../lib/focus-classes";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  PauseIcon,
  PlayIcon,
} from "../../lib/icons";
import { useControllableState } from "../../lib/use-controllable-state";
import { useMergedRefs } from "../../lib/use-merged-refs";
import { buttonVariants } from "../button/button-variants";

/*
 * A hand-built WAI-ARIA APG carousel (spec Phase I §4): Base UI 1.8 has none.
 *
 * - The content is a native CSS scroll-snap container, so touch, trackpad and wheel scrolling are
 *   the browser's. JS only tracks the active slide and drives previous/next with `scrollTo`.
 * - The index is the leading slide: the first item at least 60% inside the content, read from an
 *   IntersectionObserver. With several slides per view the last index is `count - perView` (the
 *   last full view), so the dots are one per reachable position.
 * - A programmatic move (button, dot, key, autoplay, a controlled `index`) sets the index first and
 *   then scrolls; while that scroll runs, the observer's intermediate slides are ignored until the
 *   target arrives or the scroll ends (`scrollend`, e.g. a user interrupting it).
 * - `perView` is measured (content size ÷ first item size), so CSS basis classes, responsive ones
 *   included, work as well as the `slidesPerView` prop.
 */

/** The share of a slide inside the content that makes it "visible" (APG-style ≥ 60%). */
const VISIBLE = 0.6;
/** IntersectionObserver ratios land a hair under their threshold. */
const VISIBLE_EPSILON = 0.01;
const DEFAULT_INTERVAL = 5000;

/**
 * The autoplay timer: one rotation step after `ms`, cancelled by the returned function. An object,
 * so tests can hold exactly this timer (`vi.spyOn(carouselTimer, "schedule")`) and no other (the
 * Checkout example's `fakeServer` pattern).
 */
export const carouselTimer = {
  schedule(callback: () => void, ms: number): () => void {
    const id = setTimeout(callback, ms);
    return () => clearTimeout(id);
  },
};

export type CarouselOrientation = "horizontal" | "vertical";

export interface CarouselAutoplay {
  /** Milliseconds per slide. Default 5000. */
  interval?: number;
}

interface CarouselContextValue {
  orientation: CarouselOrientation;
  /** The clamped current (leading) slide index. */
  index: number;
  count: number;
  maxIndex: number;
  /** Slides that fit in one view (measured). */
  perView: number;
  /** The `slidesPerView` prop, which sets the items' basis. */
  slidesPerView: number;
  items: HTMLElement[];
  register: (element: HTMLElement | null) => (() => void) | undefined;
  contentRef: RefObject<HTMLDivElement | null>;
  contentId: string;
  goTo: (index: number) => void;
  canPrevious: boolean;
  canNext: boolean;
  previous: () => void;
  next: () => void;
  slideLabel: (position: number, count: number) => string;
  autoplay: boolean;
  /** The user's rotation choice (the rotation control's state). */
  rotating: boolean;
  setRotating: (rotating: boolean) => void;
  /** Rotation is on and not paused (hover, focus, hidden tab). */
  running: boolean;
}

const CarouselContext = createContext<CarouselContextValue | null>(null);

function useCarousel(part: string) {
  const context = use(CarouselContext);
  if (!context) throw new Error(`${part} must be used inside a <Carousel>.`);
  return context;
}

/** The index of the first slide at least 60% inside the content, from geometry; -1 if none. */
function firstVisible(content: HTMLElement, items: HTMLElement[], vertical: boolean) {
  const box = content.getBoundingClientRect();
  return items.findIndex((item) => {
    const rect = item.getBoundingClientRect();
    const size = vertical ? rect.height : rect.width;
    if (!size) return false;
    const overlap = vertical
      ? Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top)
      : Math.min(rect.right, box.right) - Math.max(rect.left, box.left);
    return overlap / size >= VISIBLE - VISIBLE_EPSILON;
  });
}

/**
 * Scrolls `content` so `item`'s start edge meets the content's start edge. Relative to the current
 * position, so it works mid-scroll, in RTL (Chromium's scrollLeft runs from 0 to negative, and
 * moving by a delta is direction-agnostic) and vertically. No `behavior`: the CSS
 * `scroll-behavior` decides (smooth, or instant under reduced motion).
 */
function scrollToItem(
  content: HTMLElement,
  item: HTMLElement,
  vertical: boolean,
  behavior?: ScrollBehavior,
) {
  const box = content.getBoundingClientRect();
  const rect = item.getBoundingClientRect();
  if (vertical) {
    content.scrollTo({ top: content.scrollTop + rect.top - box.top - content.clientTop, behavior });
  } else if (isRtl(content)) {
    const innerRight = box.left + content.clientLeft + content.clientWidth;
    content.scrollTo({ left: content.scrollLeft + rect.right - innerRight, behavior });
  } else {
    content.scrollTo({
      left: content.scrollLeft + rect.left - box.left - content.clientLeft,
      behavior,
    });
  }
}

function inDocumentOrder(elements: Iterable<HTMLElement>) {
  return Array.from(elements).sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

const defaultSlideLabel = (position: number, count: number) => `${position} of ${count}`;
const defaultDotLabel = (position: number) => `Go to slide ${position}`;

export interface CarouselProps extends ComponentProps<"section"> {
  /** The scroll axis; vertical uses ↑/↓. Default horizontal. */
  orientation?: CarouselOrientation;
  /** Previous on the first slide jumps to the last, next on the last to the first. */
  loop?: boolean;
  /** The current (leading) slide, 0-based; controlled. */
  index?: number;
  /** The initial slide when uncontrolled. Default 0. */
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /**
   * Automatic rotation: `true` or `{ interval }` (ms, default 5000). Off by default. Pauses on
   * hover, focus inside and a hidden tab; not started under `prefers-reduced-motion` (the
   * `CarouselPlayPause` control still starts it).
   */
  autoplay?: boolean | CarouselAutoplay;
  /**
   * Slides per view: sets each item's flex basis to `100% / n`. CSS basis classes on the items
   * work too; the carousel measures how many fit either way. Whole numbers. Default 1.
   */
  slidesPerView?: number;
  /** Each slide's `aria-label`; localise it. Default "3 of 8". */
  slideLabel?: (position: number, count: number) => string;
}

/**
 * The carousel root: a `section` with `aria-roledescription="carousel"`. Give it an `aria-label`.
 * Compose `CarouselContent` > `CarouselItem`s with `CarouselPrevious`, `CarouselNext`,
 * `CarouselDots` and (with `autoplay`) `CarouselPlayPause`.
 */
export function Carousel({
  orientation = "horizontal",
  loop = false,
  index: indexProp,
  defaultIndex = 0,
  onIndexChange,
  autoplay = false,
  slidesPerView = 1,
  slideLabel = defaultSlideLabel,
  className,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...props
}: CarouselProps) {
  const vertical = orientation === "vertical";
  const [rawIndex, setIndex] = useControllableState(indexProp, defaultIndex, onIndexChange);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const contentId = useId();

  const itemSet = useRef(new Set<HTMLElement>());
  const [items, setItems] = useState<HTMLElement[]>([]);
  const register = useCallback((element: HTMLElement | null) => {
    if (!element) return undefined;
    const sync = () =>
      setItems((previous) => {
        const next = inDocumentOrder(itemSet.current);
        return next.length === previous.length && next.every((item, i) => item === previous[i])
          ? previous
          : next;
      });
    itemSet.current.add(element);
    sync();
    return () => {
      itemSet.current.delete(element);
      sync();
    };
  }, []);

  const perViewProp = Math.max(1, Math.floor(slidesPerView));
  const [perView, setPerView] = useState(perViewProp);
  const count = items.length;
  const maxIndex = Math.max(0, count - perView);
  const index = count ? Math.min(Math.max(rawIndex, 0), maxIndex) : rawIndex;

  const goTo = (target: number) => {
    if (target !== index) setIndex(target);
  };
  const canPrevious = loop || index > 0;
  const canNext = loop || index < maxIndex;
  const previous = () => {
    if (index > 0) goTo(index - 1);
    else if (loop) goTo(maxIndex);
  };
  const next = (wrap = loop) => {
    if (index < maxIndex) goTo(index + 1);
    else if (wrap) goTo(0);
  };

  // The latest index and setter for the observer and timer callbacks.
  const latest = useRef({ index, goTo, next });
  useLayoutEffect(() => {
    latest.current = { index, goTo, next };
  });

  // Measure how many slides fit in one view.
  useLayoutEffect(() => {
    const content = contentRef.current;
    const first = items[0];
    if (!content || !first) return;
    const measure = () => {
      const view = vertical ? content.clientHeight : content.clientWidth;
      const rect = first.getBoundingClientRect();
      const size = vertical ? rect.height : rect.width;
      setPerView(size > 0 ? Math.max(1, Math.floor((view + 1) / size)) : 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    observer.observe(first);
    return () => observer.disconnect();
  }, [items, vertical]);

  // Scroll to the index when it changes and the slide is not already in view. The first scroll
  // (a `defaultIndex` or controlled `index` at mount) is instant.
  const pending = useRef<number | null>(null);
  const scrolled = useRef(false);
  useLayoutEffect(() => {
    const content = contentRef.current;
    const item = items[index];
    if (!content || !item) return;
    const first = !scrolled.current;
    scrolled.current = true;
    // Already in view — unless an earlier programmatic scroll is still carrying the content away.
    if (pending.current === null && firstVisible(content, items, vertical) === index) return;
    pending.current = index;
    scrollToItem(content, item, vertical, first ? "instant" : undefined);
  }, [index, items, vertical]);

  // Track the visible slide: an IntersectionObserver while scrolling, geometry once it ends.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || !items.length) return;
    const sync = (visible: number) => {
      if (visible < 0) return;
      if (pending.current !== null) {
        if (visible !== pending.current) return;
        pending.current = null;
      }
      latest.current.goTo(visible);
    };
    const ratios = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) ratios.set(entry.target, entry.intersectionRatio);
        sync(items.findIndex((item) => (ratios.get(item) ?? 0) >= VISIBLE - VISIBLE_EPSILON));
      },
      { root: content, threshold: [0, VISIBLE, 1] },
    );
    for (const item of items) observer.observe(item);
    const onScrollEnd = () => {
      pending.current = null;
      sync(firstVisible(content, items, vertical));
    };
    content.addEventListener("scrollend", onScrollEnd);
    return () => {
      observer.disconnect();
      content.removeEventListener("scrollend", onScrollEnd);
    };
  }, [items, vertical]);

  // Autoplay.
  const autoplayOn = autoplay !== false;
  const interval = (typeof autoplay === "object" && autoplay.interval) || DEFAULT_INTERVAL;
  const [rotating, setRotating] = useState(autoplayOn);
  useLayoutEffect(() => {
    setRotating(autoplayOn && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, [autoplayOn]);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!autoplayOn) return;
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [autoplayOn]);
  const running = autoplayOn && rotating && !hovered && !focusWithin && !hidden && count > 1;
  // biome-ignore lint/correctness/useExhaustiveDependencies: each index change restarts the step.
  useEffect(() => {
    if (!running) return;
    return carouselTimer.schedule(() => latest.current.next(true), interval);
  }, [running, interval, index]);

  return (
    <CarouselContext
      value={{
        orientation,
        index,
        count,
        maxIndex,
        perView,
        slidesPerView: perViewProp,
        items,
        register,
        contentRef,
        contentId,
        goTo,
        canPrevious,
        canNext,
        previous,
        next: () => next(),
        slideLabel,
        autoplay: autoplayOn,
        rotating,
        setRotating,
        running,
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useAriaPropsSupportedByRole: a labelled section is a region (which takes aria-roledescription, APG); hover and focus-within only pause autoplay. */}
      <section
        aria-roledescription="carousel"
        {...props}
        data-orientation={orientation}
        data-slot="carousel"
        className={cn("relative flex flex-col gap-3", className)}
        onPointerEnter={(event: PointerEvent<HTMLElement>) => {
          onPointerEnter?.(event);
          setHovered(true);
        }}
        onPointerLeave={(event: PointerEvent<HTMLElement>) => {
          onPointerLeave?.(event);
          setHovered(false);
        }}
        onFocus={(event: FocusEvent<HTMLElement>) => {
          onFocus?.(event);
          // Focus on the rotation control itself does not pause rotation (APG).
          setFocusWithin(!(event.target as Element).closest("[data-slot=carousel-play-pause]"));
        }}
        onBlur={(event: FocusEvent<HTMLElement>) => {
          onBlur?.(event);
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setFocusWithin(false);
        }}
      />
    </CarouselContext>
  );
}

const contentBase = [
  "flex snap-mandatory scroll-smooth motion-reduce:scroll-auto rounded-lg",
  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  toggleFocusClasses,
  "forced-colors:focus-visible:outline-[Highlight]",
];

export type CarouselContentProps = ComponentProps<"div">;

/**
 * The scroll-snap container of the slides. Focusable: ←/→ (↑/↓ when vertical; RTL flips ←/→)
 * move the slides. `aria-live="polite"`, `off` while autoplay is rotating (APG).
 */
export function CarouselContent({ className, onKeyDown, ref, ...props }: CarouselContentProps) {
  const carousel = useCarousel("CarouselContent");
  const mergedRef = useMergedRefs(ref, carousel.contentRef);
  const vertical = carousel.orientation === "vertical";
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the scroll container takes the APG ←/→ keys.
    <div
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a focusable scroll container, so keyboard users can scroll it (axe scrollable-region-focusable).
      tabIndex={0}
      {...props}
      ref={mergedRef}
      id={carousel.contentId}
      aria-live={carousel.running ? "off" : "polite"}
      data-orientation={carousel.orientation}
      data-slot="carousel-content"
      className={cn(
        contentBase,
        vertical ? "flex-col snap-y overflow-y-auto" : "snap-x overflow-x-auto",
        className,
      )}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        // Only on the content itself: keys on a control inside a slide are that control's.
        if (event.defaultPrevented || event.target !== event.currentTarget) return;
        const rtl = !vertical && isRtl(event.currentTarget);
        const back = vertical ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
        const forward = vertical ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
        if (event.key === back) {
          event.preventDefault();
          carousel.previous();
        } else if (event.key === forward) {
          event.preventDefault();
          carousel.next();
        }
      }}
    />
  );
}

export type CarouselItemProps = ComponentProps<"div">;

/**
 * One slide: `role="group"`, `aria-roledescription="slide"`, `aria-label` "3 of 8" (the root's
 * `slideLabel`). Slides out of view are `inert`, so Tab reaches only the visible slides.
 */
export function CarouselItem({
  className,
  style,
  ref,
  "aria-label": ariaLabel,
  ...props
}: CarouselItemProps) {
  const carousel = useCarousel("CarouselItem");
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, setElement, carousel.register);
  const position = element ? carousel.items.indexOf(element) : -1;
  const offscreen =
    position >= 0 && (position < carousel.index || position >= carousel.index + carousel.perView);
  return (
    // biome-ignore lint/a11y/useSemanticElements: the APG slide is a div group; a <fieldset> brings UA borders, padding and min-width.
    <div
      {...props}
      ref={mergedRef}
      role="group"
      aria-roledescription="slide"
      aria-label={
        ariaLabel ?? (position >= 0 ? carousel.slideLabel(position + 1, carousel.count) : undefined)
      }
      inert={offscreen || undefined}
      data-slot="carousel-item"
      className={cn("min-h-0 min-w-0 snap-start shrink-0 basis-full", className)}
      style={
        carousel.slidesPerView > 1
          ? { flexBasis: `calc(100% / ${carousel.slidesPerView})`, ...style }
          : style
      }
    />
  );
}

const controlClasses = "forced-colors:focus-visible:outline-[Highlight]";

function controlVariants(className: string | undefined) {
  return buttonVariants({
    variant: "outline",
    color: "neutral",
    size: "icon-sm",
    className: cn(controlClasses, className),
  });
}

export type CarouselPreviousProps = ComponentProps<"button">;

/**
 * Scrolls to the previous slide. `aria-label` "Previous slide" (localise it). At the first slide
 * without `loop` it is `aria-disabled` but stays focusable, so a keyboard user keeps their place.
 */
export function CarouselPrevious({
  className,
  onClick,
  children,
  "aria-label": ariaLabel = "Previous slide",
  ...props
}: CarouselPreviousProps) {
  const carousel = useCarousel("CarouselPrevious");
  const disabled = !carousel.canPrevious;
  return (
    <button
      type="button"
      {...props}
      aria-label={ariaLabel}
      aria-controls={carousel.contentId}
      aria-disabled={disabled || undefined}
      data-disabled={disabled ? "" : undefined}
      data-slot="carousel-previous"
      className={controlVariants(className)}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented && !disabled) carousel.previous();
      }}
    >
      {children ??
        (carousel.orientation === "vertical" ? (
          <ChevronUpIcon />
        ) : (
          <ChevronLeftIcon className="rtl:-scale-x-100" />
        ))}
    </button>
  );
}

export type CarouselNextProps = ComponentProps<"button">;

/**
 * Scrolls to the next slide. `aria-label` "Next slide" (localise it). At the last slide (the last
 * full view) without `loop` it is `aria-disabled` but stays focusable.
 */
export function CarouselNext({
  className,
  onClick,
  children,
  "aria-label": ariaLabel = "Next slide",
  ...props
}: CarouselNextProps) {
  const carousel = useCarousel("CarouselNext");
  const disabled = !carousel.canNext;
  return (
    <button
      type="button"
      {...props}
      aria-label={ariaLabel}
      aria-controls={carousel.contentId}
      aria-disabled={disabled || undefined}
      data-disabled={disabled ? "" : undefined}
      data-slot="carousel-next"
      className={controlVariants(className)}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented && !disabled) carousel.next();
      }}
    >
      {children ??
        (carousel.orientation === "vertical" ? (
          <ChevronDownIcon />
        ) : (
          <ChevronRightIcon className="rtl:-scale-x-100" />
        ))}
    </button>
  );
}

const dotClasses = cn(
  "group/dot inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full",
  toggleFocusClasses,
  "forced-colors:focus-visible:outline-[Highlight]",
);

const dotMarkClasses = [
  "block size-2 rounded-full border border-transparent bg-foreground/30",
  "transition-[background-color,border-color,width,height] duration-150 ease-out motion-reduce:transition-none",
  "group-hover/dot:bg-foreground/60 group-data-current/dot:bg-primary",
  "forced-colors:border-[CanvasText]",
  "forced-colors:group-data-current/dot:border-[Highlight] forced-colors:group-data-current/dot:bg-[Highlight] forced-colors:group-data-current/dot:forced-color-adjust-none",
].join(" ");

export interface CarouselDotsProps extends ComponentProps<"div"> {
  /** Each dot's `aria-label`; localise it. Default "Go to slide N". */
  dotLabel?: (position: number) => string;
}

/**
 * A `role="group"` of picker buttons, one per reachable position ("Go to slide N"); the current one
 * has `aria-current="true"`. Label the group with `aria-label` (default "Choose slide").
 */
export function CarouselDots({
  className,
  dotLabel = defaultDotLabel,
  "aria-label": ariaLabel = "Choose slide",
  ...props
}: CarouselDotsProps) {
  const carousel = useCarousel("CarouselDots");
  const positions = carousel.count ? carousel.maxIndex + 1 : 0;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a div group of picker buttons; a <fieldset> brings UA borders, padding and min-width.
    <div
      {...props}
      role="group"
      aria-label={ariaLabel}
      data-slot="carousel-dots"
      className={cn(
        "flex items-center justify-center gap-1",
        carousel.orientation === "vertical" && "flex-col",
        className,
      )}
    >
      {Array.from({ length: positions }, (_, position) => {
        const current = position === carousel.index;
        return (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: a dot is its position.
            key={position}
            type="button"
            aria-label={dotLabel(position + 1)}
            aria-controls={carousel.contentId}
            aria-current={current ? "true" : undefined}
            data-current={current ? "" : undefined}
            data-slot="carousel-dot"
            className={dotClasses}
            onClick={() => carousel.goTo(position)}
          >
            <span data-slot="carousel-dot-mark" className={dotMarkClasses} />
          </button>
        );
      })}
    </div>
  );
}

export interface CarouselPlayPauseProps extends ComponentProps<"button"> {
  /** The label while rotating; localise it. Default "Stop slide rotation". */
  stopLabel?: string;
  /** The label while stopped; localise it. Default "Start slide rotation". */
  startLabel?: string;
}

/**
 * The rotation control (APG): renders only with `autoplay`. Put it first in the carousel so it is
 * the first Tab stop. Focus on it does not pause rotation.
 */
export function CarouselPlayPause({
  className,
  onClick,
  children,
  stopLabel = "Stop slide rotation",
  startLabel = "Start slide rotation",
  ...props
}: CarouselPlayPauseProps) {
  const carousel = useCarousel("CarouselPlayPause");
  if (!carousel.autoplay) return null;
  return (
    <button
      type="button"
      {...props}
      aria-label={carousel.rotating ? stopLabel : startLabel}
      aria-controls={carousel.contentId}
      data-slot="carousel-play-pause"
      className={controlVariants(className)}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) carousel.setRotating(!carousel.rotating);
      }}
    >
      {children ?? (carousel.rotating ? <PauseIcon /> : <PlayIcon />)}
    </button>
  );
}
