import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPlayPause,
  CarouselPrevious,
  type CarouselProps,
} from "./carousel";

/** Placeholder slides: tone-soft panels with an inline SVG motif, no network images. */
const slides = [
  { title: "Sun", tone: "bg-primary-soft text-primary-soft-foreground", shape: "circle" },
  { title: "Kite", tone: "bg-info-soft text-info-soft-foreground", shape: "diamond" },
  { title: "Peak", tone: "bg-success-soft text-success-soft-foreground", shape: "triangle" },
  { title: "Tile", tone: "bg-danger-soft text-danger-soft-foreground", shape: "square" },
  { title: "Comb", tone: "bg-neutral-soft text-neutral-soft-foreground", shape: "hexagon" },
  { title: "Gem", tone: "bg-primary-soft text-primary-soft-foreground", shape: "diamond" },
] as const;

const shapes = {
  circle: <circle cx="24" cy="24" r="16" />,
  diamond: <path d="M24 6 42 24 24 42 6 24Z" />,
  triangle: <path d="M24 8 42 40H6Z" />,
  square: <rect x="9" y="9" width="30" height="30" rx="4" />,
  hexagon: <path d="M24 5 40.5 14.5v19L24 43 7.5 33.5v-19Z" />,
};

function Slide({ index, className }: { index: number; className?: string }) {
  const slide = slides[index % slides.length] ?? slides[0];
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-3 rounded-lg ${slide.tone} ${className ?? ""}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        className="size-12 opacity-80"
        fill="currentColor"
      >
        {shapes[slide.shape]}
      </svg>
      <p className="text-lg font-semibold">{slide.title}</p>
    </div>
  );
}

function Slides({ count = 5, itemClassName = "h-56 px-1" }) {
  return Array.from({ length: count }, (_, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder slides.
    <CarouselItem key={i} className={itemClassName}>
      <Slide index={i} />
    </CarouselItem>
  ));
}

const meta = {
  title: "Components/Carousel",
  component: Carousel,
  tags: ["autodocs"],
  // Padded, not centred: a centred story shrinks to its content, so `w-full` would not fill a phone.
  parameters: { layout: "padded" },
  args: { "aria-label": "Shapes" },
  argTypes: {
    orientation: { control: "inline-radio", options: ["horizontal", "vertical"] },
  },
  render: (args: CarouselProps) => (
    <Carousel {...args} className="w-full max-w-md">
      <CarouselContent>
        <Slides />
      </CarouselContent>
      <div className="flex items-center justify-between gap-2">
        <CarouselPrevious />
        <CarouselDots />
        <CarouselNext />
      </div>
    </Carousel>
  ),
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Scroll-snap slides with previous/next and dot controls. Swipe, scroll, or focus the slides and
 * use ←/→; the ends are disabled.
 */
export const Basic: Story = {};

/** `loop`: previous on the first slide jumps to the last, next on the last to the first. */
export const Loop: Story = {
  args: { "aria-label": "Shapes, looping", loop: true },
};

/**
 * `slidesPerView={3}`: the index is the leading slide, so there is a dot per reachable position
 * and next stops when the last slide is in view.
 */
export const MultiplePerView: Story = {
  args: { "aria-label": "Shapes, three per view", slidesPerView: 3 },
  render: (args: CarouselProps) => (
    <Carousel {...args} className="w-full max-w-xl">
      <CarouselContent>
        <Slides count={6} itemClassName="h-40 px-1" />
      </CarouselContent>
      <div className="flex items-center justify-between gap-2">
        <CarouselPrevious />
        <CarouselDots />
        <CarouselNext />
      </div>
    </Carousel>
  ),
};

/** `orientation="vertical"`: the content scrolls on the y axis and ↑/↓ move the slides. */
export const Vertical: Story = {
  args: { "aria-label": "Shapes, vertical", orientation: "vertical" },
  render: (args: CarouselProps) => (
    <Carousel {...args} className="w-full max-w-md flex-row items-center">
      <CarouselContent className="h-56 min-w-0 flex-1">
        <Slides itemClassName="py-1" />
      </CarouselContent>
      <div className="flex flex-col items-center gap-2">
        <CarouselPrevious />
        <CarouselDots />
        <CarouselNext />
      </div>
    </Carousel>
  ),
};

/**
 * `autoplay`: rotates every 5 seconds (`{ interval }` to change it). It pauses while hovered or
 * focused and while the tab is hidden, and does not start under reduced motion; the rotation
 * control stops and starts it. The controls come first, so the rotation control is the first Tab
 * stop (APG).
 */
export const AutoplayWithPause: Story = {
  args: { "aria-label": "Shapes, rotating", autoplay: { interval: 5000 } },
  render: (args: CarouselProps) => (
    <Carousel {...args} className="w-full max-w-md">
      <div className="flex items-center justify-between gap-2">
        <CarouselPlayPause />
        <CarouselDots />
        <div className="flex gap-2">
          <CarouselPrevious />
          <CarouselNext />
        </div>
      </div>
      <CarouselContent>
        <Slides />
      </CarouselContent>
    </Carousel>
  ),
};
