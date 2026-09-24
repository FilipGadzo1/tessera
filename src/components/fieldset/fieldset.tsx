"use client";

import { Fieldset as BaseFieldset } from "@base-ui/react/fieldset";
import { mergeClassName } from "../../lib/merge-class-name";

export type FieldsetProps = BaseFieldset.Root.Props;
export type FieldsetLegendProps = BaseFieldset.Legend.Props;

/**
 * Groups related controls under a legend, which names the group (`aria-labelledby`).
 * For radios, render the group through it: `<Fieldset render={<RadioGroup />}>`.
 */
export function Fieldset({ className, ...props }: FieldsetProps) {
  return (
    <BaseFieldset.Root
      {...props}
      data-slot="fieldset"
      className={mergeClassName("flex flex-col gap-3", className)}
    />
  );
}

/** The Fieldset's accessible label. */
export function FieldsetLegend({ className, ...props }: FieldsetLegendProps) {
  return (
    <BaseFieldset.Legend
      {...props}
      data-slot="fieldset-legend"
      className={mergeClassName("text-sm font-medium text-foreground", className)}
    />
  );
}
