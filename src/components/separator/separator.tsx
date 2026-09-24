import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export interface SeparatorProps extends ComponentProps<"div"> {
  /** @default "horizontal" */
  orientation?: "horizontal" | "vertical";
  /**
   * A purely visual rule (`role="none"`), hidden from assistive technology. Set `false` when the
   * separator divides content semantically (`role="separator"` + `aria-orientation`).
   * @default true
   */
  decorative?: boolean;
}

/** A thin horizontal or vertical rule between content. Server-safe. */
export function Separator({
  orientation = "horizontal",
  decorative = true,
  className,
  ...props
}: SeparatorProps) {
  const shared = {
    "data-slot": "separator",
    "data-orientation": orientation,
    className: cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch",
      className,
    ),
  };
  return decorative ? (
    <div {...props} role="none" {...shared} />
  ) : (
    // biome-ignore lint/a11y/useSemanticElements: <hr> cannot render the vertical orientation and brings UA borders and margins.
    <div {...props} role="separator" aria-orientation={orientation} {...shared} />
  );
}
