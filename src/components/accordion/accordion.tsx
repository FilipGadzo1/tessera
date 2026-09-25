"use client";

import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import { ChevronDownIcon } from "../../lib/icons";
import { mergeClassName } from "../../lib/merge-class-name";

const itemClasses = "border-b border-border";

const triggerClasses = [
  "flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-sm font-medium not-data-disabled:hover:underline underline-offset-4",
  "outline-none outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50",
].join(" ");

/*
 * `in-data-panel-open:` matches while any ancestor carries `data-panel-open` — here the Trigger,
 * which Base UI marks while its panel is open. `motion-reduce:transition-none` is not in the
 * spec's original string; without it the chevron still spins under reduced motion.
 */
const chevronClasses =
  "size-4 shrink-0 text-muted-foreground transition-transform duration-200 in-data-panel-open:rotate-180 motion-reduce:transition-none";

/*
 * Base UI sets `--accordion-panel-height` to the measured content height (px while animating,
 * `auto` once open) and adds `data-starting-style` / `data-ending-style` around the transition.
 * The panel clips for the height animation, but a plain `overflow-hidden` would also clip the
 * focus ring of content flush with its side edges. Instead:
 * - `overflow-clip` + `overflow-clip-margin: 4px` paints up to 4px (2px outline + 2px offset)
 *   past the box on every side without making the panel wider (no negative margins, so no
 *   horizontal scrollbar in a zero-padding scroll parent) and without a scroll container;
 * - `clip-path: inset(0 -4px)` trims the top and bottom back to the box, so the collapsing
 *   panel shows no 4px sliver below the trigger. Horizontally it keeps the same 4px.
 * Browsers without `overflow-clip-margin` clip flush rings (Safari at the time of writing).
 */
const panelClasses =
  "h-(--accordion-panel-height) overflow-clip text-sm transition-[height] duration-200 ease-out [overflow-clip-margin:4px] [clip-path:inset(0_-4px)] data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none";

/**
 * Base UI Accordion.Root props: `defaultValue` / `value` + `onValueChange` (arrays of item values),
 * `multiple`, `disabled`, `hiddenUntilFound`, `keepMounted`.
 */
export type AccordionProps = BaseAccordion.Root.Props;

/** A stack of collapsible sections. One open at a time unless `multiple`. */
export function Accordion({ className, ...props }: AccordionProps) {
  return <BaseAccordion.Root {...props} data-slot="accordion" className={className} />;
}

/** Base UI Accordion.Item props: `value`, `disabled`, `onOpenChange`. */
export type AccordionItemProps = BaseAccordion.Item.Props;

/** One section: an AccordionTrigger and its AccordionPanel, with a rule underneath. */
export function AccordionItem({ className, ...props }: AccordionItemProps) {
  return (
    <BaseAccordion.Item
      {...props}
      data-slot="accordion-item"
      className={mergeClassName(itemClasses, className)}
    />
  );
}

export interface AccordionTriggerProps extends BaseAccordion.Trigger.Props {
  /**
   * The level of the heading that wraps the trigger. Match it to the page outline.
   * @default 3
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}

const headings = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h5",
  6: "h6",
} as const;

/**
 * The heading plus the button that toggles the panel, with a chevron that turns when open.
 * Props go to the button; `headingLevel` picks the heading element.
 */
export function AccordionTrigger({
  headingLevel = 3,
  className,
  children,
  ...props
}: AccordionTriggerProps) {
  const Heading = headings[headingLevel];
  return (
    <BaseAccordion.Header data-slot="accordion-header" render={<Heading />}>
      <BaseAccordion.Trigger
        {...props}
        data-slot="accordion-trigger"
        className={mergeClassName(triggerClasses, className)}
      >
        {children}
        <ChevronDownIcon data-slot="accordion-chevron" className={chevronClasses} />
      </BaseAccordion.Trigger>
    </BaseAccordion.Header>
  );
}

/** Base UI Accordion.Panel props (`keepMounted`, `hiddenUntilFound`). The height animates. */
export type AccordionPanelProps = BaseAccordion.Panel.Props;

/** The collapsible content of an item. Children sit in a wrapper that pads the bottom. */
export function AccordionPanel({ className, children, ...props }: AccordionPanelProps) {
  return (
    <BaseAccordion.Panel
      {...props}
      data-slot="accordion-panel"
      className={mergeClassName(panelClasses, className)}
    >
      <div data-slot="accordion-panel-content" className="pb-4">
        {children}
      </div>
    </BaseAccordion.Panel>
  );
}
