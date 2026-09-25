import { cloneElement, type ReactElement } from "react";
import { cn } from "./cn";

type RenderElement = ReactElement<{ className?: string } & Record<string, unknown>>;

export interface CloneRenderOptions {
  /** Forced onto the clone as `data-slot`, after `render`'s own props are applied. */
  slot: string;
  /** Merged before the render element's own `className`, so its later utilities win. */
  className: string;
  /**
   * Applied last, after the render element's own props — e.g. to force-disable a custom render
   * element even if it declares its own `onClick`/`href`.
   */
  overrideProps?: Record<string, unknown>;
}

/**
 * Clones `render` with `props` applied underneath the render element's own props (so an explicit
 * prop on the render element wins over ours), then keeps `data-slot` and merges `className` with
 * later Tailwind utilities winning. Server-safe: no directive, no hooks.
 */
export function cloneRender<P extends Record<string, unknown>>(
  render: RenderElement,
  props: P,
  { slot, className, overrideProps }: CloneRenderOptions,
): ReactElement {
  return cloneElement(render, {
    ...props,
    ...render.props,
    ...overrideProps,
    "data-slot": slot,
    className: cn(className, render.props.className),
  });
}
