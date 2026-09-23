import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

const cardVariants = cva("flex flex-col gap-6 rounded-xl bg-card py-6 text-card-foreground", {
  variants: {
    variant: {
      outlined: "border border-border",
      elevated: "border border-transparent shadow-md",
    },
  },
  defaultVariants: { variant: "outlined" },
});

export interface CardProps extends ComponentProps<"div">, VariantProps<typeof cardVariants> {}

/** A surface that groups related content. `elevated` lifts it with a shadow instead of a border. */
export function Card({ variant, className, ...props }: CardProps) {
  return (
    <div
      {...props}
      data-slot="card"
      data-variant={variant ?? "outlined"}
      className={cn(cardVariants({ variant }), className)}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 px-6", className)}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      data-slot="card-title"
      className={cn("font-semibold text-base leading-snug", className)}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} data-slot="card-content" className={cn("px-6 text-sm", className)} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      data-slot="card-footer"
      className={cn("flex items-center gap-2 px-6", className)}
    />
  );
}
