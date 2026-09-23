import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

export const badgeDefaults = { variant: "soft", color: "neutral", size: "md" } as const;

const badgeCva = cva(
  [
    "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-transparent font-medium",
    "[&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        solid: "bg-tone text-tone-foreground",
        soft: "bg-tone-soft text-tone-soft-foreground",
        outline: "border-tone-line text-tone-ink",
      },
      color: {
        primary: "tone-primary",
        neutral: "tone-neutral",
        success: "tone-success",
        warning: "tone-warning",
        danger: "tone-danger",
        info: "tone-info",
      },
      size: {
        sm: "h-5 px-1.5 text-xs",
        md: "h-6 px-2 text-xs",
      },
    },
    defaultVariants: badgeDefaults,
  },
);

export type BadgeVariantProps = VariantProps<typeof badgeCva>;

/** Badge classes for any element. */
export function badgeVariants(options: BadgeVariantProps & { className?: string } = {}): string {
  const { className, ...variants } = options;
  return cn(badgeCva(variants), className);
}
