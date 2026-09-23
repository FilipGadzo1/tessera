import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/** Defaults — shared by cva and the Card's data attributes. */
export const cardDefaults = { variant: "outlined" } as const;

const cardCva = cva("flex flex-col gap-6 rounded-xl bg-card py-6 text-card-foreground", {
  variants: {
    variant: {
      outlined: "border border-border",
      elevated: "border border-transparent shadow-md",
    },
  },
  defaultVariants: cardDefaults,
});

export type CardVariantProps = VariantProps<typeof cardCva>;

/** Card classes for any element. */
export function cardVariants(options: CardVariantProps & { className?: string } = {}): string {
  const { className, ...variants } = options;
  return cn(cardCva(variants), className);
}
