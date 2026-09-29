import type { ComponentProps, ReactNode } from "react";

/**
 * Shared 24×24 icons used across components. Server-safe (no directive, no hooks). Every icon is
 * `aria-hidden="true"` by default and forwards the rest of its props onto the `<svg>` — pass
 * `className` for sizing/colour, or any other attribute (e.g. `data-slot`) a call site needs to
 * keep its rendered output identical to before this module existed.
 */

function StrokeIcon({ children, ...props }: ComponentProps<"svg"> & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CalendarIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </StrokeIcon>
  );
}

export function CheckIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </StrokeIcon>
  );
}

export function ChevronLeftIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="m15 18-6-6 6-6" />
    </StrokeIcon>
  );
}

export function ChevronRightIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="m9 18 6-6-6-6" />
    </StrokeIcon>
  );
}

export function ChevronDownIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </StrokeIcon>
  );
}

export function CloseIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </StrokeIcon>
  );
}

export function SearchIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </StrokeIcon>
  );
}

export function MinusIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="M5 12h14" />
    </StrokeIcon>
  );
}

export function PlusIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="M12 5v14M5 12h14" />
    </StrokeIcon>
  );
}

export function EllipsisIcon(props: ComponentProps<"svg">) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  );
}

export function DotIcon(props: ComponentProps<"svg">) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}
