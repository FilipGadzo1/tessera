import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { type ToneColor, toneClass } from "../../lib/tone";

/** Defaults — shared by cva and the Button's data attributes. */
export const buttonDefaults = { variant: "solid", color: "primary", size: "md" } as const;

const buttonCva = cva(
  [
    "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md border border-transparent font-medium select-none",
    "transition-[color,background-color,border-color,outline-color,box-shadow,translate] duration-150 ease-out motion-reduce:transition-none",
    "outline-hidden outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid",
    "active:not-data-disabled:translate-y-px motion-reduce:active:translate-y-0",
    "data-disabled:not-data-loading:cursor-not-allowed data-disabled:not-data-loading:opacity-50 data-loading:cursor-progress",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        solid:
          "bg-tone text-tone-foreground shadow-xs not-data-disabled:hover:bg-tone-hover not-data-disabled:active:bg-tone-active",
        soft: "bg-tone-soft text-tone-soft-foreground not-data-disabled:hover:bg-tone-soft-hover",
        outline:
          "border-tone-line bg-transparent text-tone-ink not-data-disabled:hover:bg-tone-soft not-data-disabled:hover:text-tone-soft-foreground",
        ghost:
          "bg-transparent text-tone-ink not-data-disabled:hover:bg-tone-soft not-data-disabled:hover:text-tone-soft-foreground",
        link: "bg-transparent text-tone-ink underline-offset-4 not-data-disabled:hover:underline",
      },
      color: toneClass,
      size: {
        xs: "h-7 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 gap-2.5 px-6 text-base [&_svg:not([class*='size-'])]:size-5",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        icon: "size-10",
        "icon-lg": "size-12 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: buttonDefaults,
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonCva>;
/** Alias of ToneColor, kept for compatibility. */
export type ButtonColor = ToneColor;

/** Button classes for any element — use on `<a>` / router links, which must not be Buttons. */
export function buttonVariants(options: ButtonVariantProps & { className?: string } = {}): string {
  const { className, ...variants } = options;
  return cn(buttonCva(variants), className);
}
