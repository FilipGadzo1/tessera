"use client";

import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";

export type ScrollAreaOrientation = "vertical" | "horizontal" | "both";

export interface ScrollAreaProps extends BaseScrollArea.Root.Props {
  /** Which scrollbar(s) to render. @default "vertical" */
  orientation?: ScrollAreaOrientation;
}

const scrollbarBaseClass =
  "flex touch-none select-none p-0.5 transition-opacity duration-150 motion-reduce:transition-none opacity-0 data-hovering:opacity-100 data-scrolling:opacity-100";
const scrollbarOrientationClass: Record<"vertical" | "horizontal", string> = {
  vertical: "h-full w-2.5 border-l border-l-transparent",
  horizontal: "h-2.5 flex-col border-t border-t-transparent",
};
const thumbClass =
  "relative flex-1 rounded-full bg-border hover:bg-muted-foreground/50 forced-colors:bg-[CanvasText]";

/**
 * A scrollable area with custom (visual-only, pointer-draggable) scrollbars: Root → Viewport →
 * Content → children, plus a ScrollBar per `orientation`. Native wheel, touch and keyboard
 * scrolling on the viewport keep working (Base UI); the bars never intercept them.
 * `orientation="both"` adds the corner where the two bars meet.
 */
export function ScrollArea({
  orientation = "vertical",
  className,
  children,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaRoot {...props} className={className}>
      <ScrollAreaViewport>
        <ScrollAreaContent>{children}</ScrollAreaContent>
      </ScrollAreaViewport>
      {(orientation === "vertical" || orientation === "both") && (
        <ScrollBar orientation="vertical" />
      )}
      {(orientation === "horizontal" || orientation === "both") && (
        <ScrollBar orientation="horizontal" />
      )}
      {orientation === "both" && <ScrollAreaCorner />}
    </ScrollAreaRoot>
  );
}

export type ScrollAreaRootProps = BaseScrollArea.Root.Props;

/**
 * The bare root, exported for a custom layout (your own Viewport/Content/ScrollBar composition)
 * that still shares Tessera's Base UI `ScrollArea` copy — Tessera is pinned to `~1.8.0`, so a
 * consumer's own, different copy of Base UI's `ScrollArea.Root` would not share context with
 * Tessera's `ScrollBar` / `ScrollAreaViewport` / `ScrollAreaContent`.
 */
export function ScrollAreaRoot({ className, ...props }: ScrollAreaRootProps) {
  return (
    <BaseScrollArea.Root
      {...props}
      data-slot="scroll-area"
      className={mergeClassName("relative overflow-hidden", className)}
    />
  );
}

export type ScrollAreaCornerProps = BaseScrollArea.Corner.Props;

/** The square where a vertical and a horizontal scrollbar meet, exported for a custom layout. */
export function ScrollAreaCorner({ className, ...props }: ScrollAreaCornerProps) {
  return (
    <BaseScrollArea.Corner {...props} data-slot="scroll-area-corner" className={className} />
  );
}

export type ScrollAreaViewportProps = BaseScrollArea.Viewport.Props;

/**
 * The actual scrollable container. Base UI makes it focusable (`tabIndex=0`) whenever it
 * overflows, and keeps it out of the tab order (`tabIndex=-1`) otherwise — verified against the
 * `.js` implementation, not just the types (see the task report for the evidence).
 */
export function ScrollAreaViewport({ className, ...props }: ScrollAreaViewportProps) {
  return (
    <BaseScrollArea.Viewport
      {...props}
      data-slot="scroll-area-viewport"
      className={mergeClassName(
        "size-full rounded-[inherit] overscroll-contain outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:-outline-offset-2",
        className,
      )}
    />
  );
}

export type ScrollAreaContentProps = BaseScrollArea.Content.Props;

/** The scrolling content itself, unstyled (style it with `className`). */
export function ScrollAreaContent(props: ScrollAreaContentProps) {
  return <BaseScrollArea.Content {...props} data-slot="scroll-area-content" />;
}

export type ScrollBarProps = BaseScrollArea.Scrollbar.Props;

/**
 * A vertical or horizontal scrollbar, exported so a custom layout (its own Root/Viewport
 * composition) can still get Tessera's styling. `ScrollArea` renders one per `orientation`.
 */
export function ScrollBar({ orientation = "vertical", className, ...props }: ScrollBarProps) {
  return (
    <BaseScrollArea.Scrollbar
      {...props}
      orientation={orientation}
      data-slot="scroll-area-scrollbar"
      className={mergeClassName(
        cn(scrollbarBaseClass, scrollbarOrientationClass[orientation]),
        className,
      )}
    >
      <BaseScrollArea.Thumb data-slot="scroll-area-thumb" className={thumbClass} />
    </BaseScrollArea.Scrollbar>
  );
}
