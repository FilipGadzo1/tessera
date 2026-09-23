import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge<"tone">({
  extend: {
    classGroups: {
      tone: [{ tone: ["primary", "neutral", "success", "warning", "danger", "info"] }],
    },
  },
});

/** Compose class names; later Tailwind utilities (including tone-*) win over conflicting earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
