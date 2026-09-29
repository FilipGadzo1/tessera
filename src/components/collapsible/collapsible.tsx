"use client";

import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";
import { mergeClassName } from "../../lib/merge-class-name";
import { panelHeightMotionClasses } from "../../lib/panel-height-classes";

const panelClasses = `h-(--collapsible-panel-height) ${panelHeightMotionClasses}`;

/** Base UI Collapsible.Root props: `open` / `defaultOpen` + `onOpenChange`, `disabled`. */
export type CollapsibleProps = BaseCollapsible.Root.Props;

/** One section that shows or hides its panel. Unstyled; lay it out with `className`. */
export function Collapsible(props: CollapsibleProps) {
  return <BaseCollapsible.Root {...props} data-slot="collapsible" />;
}

export type CollapsibleTriggerProps = BaseCollapsible.Trigger.Props;

/**
 * Toggles the panel. Renders a `<button>` with no classes besides the cursor; compose a styled
 * trigger with `render={<Button variant="ghost" />}`. Base UI sets `data-panel-open` while open.
 */
export function CollapsibleTrigger({ className, ...props }: CollapsibleTriggerProps) {
  return (
    <BaseCollapsible.Trigger
      {...props}
      data-slot="collapsible-trigger"
      className={mergeClassName("cursor-pointer", className)}
    />
  );
}

/** Base UI Collapsible.Panel props (`keepMounted`, `hiddenUntilFound`). The height animates. */
export type CollapsiblePanelProps = BaseCollapsible.Panel.Props;

/** The content that opens and closes. The height animates (instant under reduced motion). */
export function CollapsiblePanel({ className, ...props }: CollapsiblePanelProps) {
  return (
    <BaseCollapsible.Panel
      {...props}
      data-slot="collapsible-panel"
      className={mergeClassName(panelClasses, className)}
    />
  );
}
