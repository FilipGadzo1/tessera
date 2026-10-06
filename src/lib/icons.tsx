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

export function ChevronUpIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="m18 15-6-6-6 6" />
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

/** A document with a folded corner: a file in a Tree. */
export function FileIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </StrokeIcon>
  );
}

/** A folder: a directory in a Tree. */
export function FolderIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </StrokeIcon>
  );
}

/** A panel with a left column: the Sidebar toggle. */
export function PanelLeftIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
    </StrokeIcon>
  );
}

/** An eyedropper: pick a colour from the screen (the ColorPicker's `ColorEyeDropper`). */
export function PipetteIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
    </StrokeIcon>
  );
}

/** Two bars: pause (a Carousel's "Stop slide rotation"). */
export function PauseIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <rect x="14" y="4" width="4" height="16" rx="1" />
      <rect x="6" y="4" width="4" height="16" rx="1" />
    </StrokeIcon>
  );
}

/** A right-pointing triangle: play (a Carousel's "Start slide rotation"). */
export function PlayIcon(props: ComponentProps<"svg">) {
  return (
    <StrokeIcon {...props}>
      <path d="M6 3v18l14-9Z" />
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
