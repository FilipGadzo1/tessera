"use client";

import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";

/** Base UI Switch.Root props. Tessera renders the thumb, so `children` is ignored. */
export type SwitchProps = Omit<BaseSwitch.Root.Props, "children">;

/*
 * Outlines: the track has no border, so invalid is a 1px danger outline. Tailwind emits
 * `data-invalid:*` after `focus-visible:*`, so while an invalid switch is focused the
 * `data-invalid:focus-visible:outline-2` compound restores the 2px focus width; the danger
 * color stays (like text fields' `data-invalid:focus:outline-danger`).
 * Hover changes the track fill (the shared hover rule targets a border the track lacks).
 * The checked thumb uses primary-foreground: white in light, primary-950 in dark (WCAG 1.4.11).
 */
const trackClasses = cn(
  "inline-flex shrink-0 items-center",
  "h-6 w-11 rounded-full bg-switch-track p-0.5",
  "data-checked:bg-primary",
  "not-data-disabled:not-data-checked:hover:bg-field-border-hover not-data-disabled:data-checked:hover:bg-primary-hover",
  "cursor-pointer data-disabled:cursor-not-allowed data-disabled:opacity-50",
  "outline-hidden outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid",
  "data-invalid:outline-1 data-invalid:outline-solid data-invalid:outline-danger data-invalid:focus-visible:outline-2",
  "transition-[translate,background-color] duration-150 ease-out motion-reduce:transition-none",
);

const thumbClasses = cn(
  "block size-5 rounded-full bg-surface-0 shadow-sm data-checked:bg-primary-foreground",
  "translate-x-0 data-checked:translate-x-5",
  "transition-[translate,background-color] duration-150 ease-out motion-reduce:transition-none",
);

/** An on/off switch. Pair with Label or use inside a Field. */
export function Switch({ className, ...props }: SwitchProps) {
  return (
    <BaseSwitch.Root
      {...props}
      data-slot="switch"
      className={mergeClassName(trackClasses, className)}
    >
      <BaseSwitch.Thumb data-slot="switch-thumb" className={thumbClasses} />
    </BaseSwitch.Root>
  );
}
