import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/** Default variant/size — shared by cva and the Button's data attributes. */
export const buttonDefaults = { variant: "primary", size: "md" } as const;

const buttonCva = cva(
  [
    "group/button relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md border border-transparent font-medium select-none",
    "transition-[color,background-color,border-color,box-shadow,translate] duration-150 ease-out",
    "outline-hidden focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
    "active:not-data-disabled:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0",
    "data-disabled:pointer-events-none data-disabled:not-data-loading:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border-border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:border-destructive focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 text-sm",
        md: "h-9 px-4 text-sm",
        lg: "h-10 px-5 text-base",
        "icon-xs": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        icon: "size-9",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: buttonDefaults,
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonCva>;

/** Button classes for any element — use on `<a>` / router links, which must not be Buttons. */
export function buttonVariants(options: ButtonVariantProps & { className?: string } = {}): string {
  const { className, ...variants } = options;
  return cn(buttonCva(variants), className);
}
