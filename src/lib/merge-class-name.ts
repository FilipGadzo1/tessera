import type { CSSProperties } from "react";
import { cn } from "./cn";

/** A Base UI `className` prop: a string, or a function of the part's state returning one. */
export type ClassNameProp<State> = string | ((state: State) => string | undefined) | undefined;

/** A Base UI `style` prop: a style object, or a function of the part's state returning one. */
export type StyleProp<State> =
  | CSSProperties
  | ((state: State) => CSSProperties | undefined)
  | undefined;

/**
 * Returns a Base UI `className` state function that resolves the caller's `className` (string or
 * state function) and merges it after `base`, so conflicting caller utilities win.
 */
export function mergeClassName<State>(
  base: string,
  className: ClassNameProp<State>,
): (state: State) => string {
  return (state) => cn(base, typeof className === "function" ? className(state) : className);
}

/**
 * Returns a Base UI `style` state function that resolves the caller's `style` (object or state
 * function) and spreads it over `base`, so the caller's properties win.
 */
export function mergeStyle<State>(
  base: CSSProperties | undefined,
  style: StyleProp<State>,
): (state: State) => CSSProperties {
  return (state) => ({ ...base, ...(typeof style === "function" ? style(state) : style) });
}
