"use client";

import {
  Toast as BaseToast,
  type ToastManager,
  type ToastObject,
  type UseToastManagerReturnValue,
} from "@base-ui/react/toast";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { CloseIcon } from "../../lib/icons";
import { popupSurface } from "../../lib/overlay-classes";
import { type ToneColor, toneClass } from "../../lib/tone";
import { Button } from "../button";

/** Where the toasts stack. */
export type ToastPosition = "bottom-right" | "top-right" | "bottom-center" | "top-center";

/**
 * The toast types Tessera styles. Base UI's `promise()` also sets `loading` (a spinner, no accent)
 * and `error` (styled as `danger`).
 */
export type ToastType = "default" | "success" | "warning" | "danger" | "info";

type SwipeDirection = "up" | "down" | "left" | "right";

/*
 * Per position: the viewport's offsets, and the toasts' anchor edge, transform origin, stacking
 * direction (`--toast-dir`: -1 grows upwards from the bottom, 1 downwards from the top), the hover
 * bridge that fills the gap towards the front toast, and the swipe-to-dismiss directions.
 */
const positions: Record<
  ToastPosition,
  { viewport: string; root: string; swipe: SwipeDirection[] }
> = {
  "bottom-right": {
    viewport: "right-4 bottom-4",
    root: "bottom-0 origin-bottom [--toast-dir:-1] after:top-full",
    swipe: ["down", "right"],
  },
  "top-right": {
    viewport: "top-4 right-4",
    root: "top-0 origin-top [--toast-dir:1] after:bottom-full",
    swipe: ["up", "right"],
  },
  "bottom-center": {
    viewport: "bottom-4 left-1/2 -translate-x-1/2",
    root: "bottom-0 origin-bottom [--toast-dir:-1] after:top-full",
    swipe: ["down"],
  },
  "top-center": {
    viewport: "top-4 left-1/2 -translate-x-1/2",
    root: "top-0 origin-top [--toast-dir:1] after:bottom-full",
    swipe: ["up"],
  },
};

const viewportClasses = "fixed z-(--z-toast) flex w-[calc(100%-2rem)] max-w-sm flex-col";

/*
 * Stacking with Base UI's CSS vars (`--toast-index`, `--toast-offset-y`, `--toast-height`,
 * `--toast-swipe-movement-x/y`, and the viewport's `--toast-frontmost-height`):
 * - Collapsed, every toast takes the front toast's height, shrinks 5% per step back and peeks
 *   `--toast-peek` past the toast in front of it.
 * - Expanded (hover or keyboard focus), toasts sit at their full height, `--toast-gap` apart.
 * - `--toast-y` / `--toast-x` feed one transform; data attributes swap them for enter, exit and
 *   swipe-out. While a finger drags, Base UI sets an inline transform with `transition: none`.
 */
const rootClasses = [
  popupSurface,
  "absolute inset-x-0 z-[calc(1000-var(--toast-index))] p-4",
  "[--toast-gap:0.75rem] [--toast-peek:0.75rem]",
  "[--toast-scale:max(0,calc(1-var(--toast-index)*0.05))] [--toast-shrink:calc(1-var(--toast-scale))]",
  "[--toast-stack-height:var(--toast-frontmost-height,var(--toast-height))]",
  "[--toast-x:var(--toast-swipe-movement-x)]",
  "[--toast-y:calc(var(--toast-swipe-movement-y)+var(--toast-dir)*(var(--toast-index)*var(--toast-peek)+var(--toast-shrink)*var(--toast-stack-height)))]",
  "h-(--toast-stack-height) [transform:translateX(var(--toast-x))_translateY(var(--toast-y))_scale(var(--toast-scale))]",
  "data-expanded:h-(--toast-height) data-expanded:[--toast-scale:1]",
  "data-expanded:[--toast-y:calc(var(--toast-swipe-movement-y)+var(--toast-dir)*(var(--toast-offset-y)+var(--toast-index)*var(--toast-gap)))]",
  // Enter and exit: slide in from (and out past) the anchor edge, and fade.
  "data-starting-style:opacity-0 data-starting-style:[--toast-y:calc(var(--toast-dir)*-150%)]",
  "data-ending-style:opacity-0 data-limited:opacity-0",
  "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[--toast-y:calc(var(--toast-dir)*-150%)]",
  "data-ending-style:data-[swipe-direction=down]:[--toast-y:calc(var(--toast-swipe-movement-y)+150%)]",
  "data-ending-style:data-[swipe-direction=up]:[--toast-y:calc(var(--toast-swipe-movement-y)-150%)]",
  "data-ending-style:data-[swipe-direction=right]:[--toast-x:calc(var(--toast-swipe-movement-x)+150%)]",
  "data-ending-style:data-[swipe-direction=left]:[--toast-x:calc(var(--toast-swipe-movement-x)-150%)]",
  // Keeps the stack expanded while the pointer crosses the gap between two toasts.
  "after:absolute after:inset-x-0 after:h-[calc(var(--toast-gap)+1px)] after:content-['']",
  "transition-[transform,opacity,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring",
].join(" ");

/** Toned types add a left accent in the tone's line colour. */
const accentClasses = "border-l-4 border-l-tone";

/*
 * Behind the front toast (collapsed) the content fades out so stacked texts never overlap; it
 * fades back in when the stack expands.
 */
const contentClasses =
  "flex items-start gap-3 transition-opacity duration-200 data-behind:not-data-expanded:pointer-events-none data-behind:not-data-expanded:opacity-0 motion-reduce:transition-none";

const titleClasses = "text-sm font-semibold";
const descriptionClasses = "text-sm text-muted-foreground";
const iconClasses = "mt-0.5 size-4 shrink-0";

const typeTones: Record<string, ToneColor> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  error: "danger",
  info: "info",
};

export interface ToasterProps {
  /** Where toasts appear. @default "bottom-right" */
  position?: ToastPosition;
  /** How many toasts show at once; older ones are marked `data-limited` and hidden. @default 3 */
  limit?: number;
  /** Default auto-dismiss time in ms; `0` keeps toasts until closed. @default 5000 */
  timeout?: number;
  /** A manager from `createToaster()`, to add toasts from outside React. */
  toastManager?: ToastManager;
  /**
   * Element to portal into (default `document.body`). Pass an element inside a nested theme scope
   * so the toasts inherit it.
   */
  container?: BaseToast.Portal.Props["container"];
  /** Classes for the viewport (the fixed region holding the toasts). */
  className?: string;
  /** The app: components inside can call `useToast()`. */
  children?: ReactNode;
}

/**
 * Renders the toasts: a fixed, labelled `role="region"` live region ("Notifications") in a corner
 * of the screen. Wrap the app in it so `useToast()` works anywhere inside, or pass a
 * `createToaster()` manager to add toasts from outside React.
 */
export function Toaster({
  position = "bottom-right",
  limit = 3,
  timeout = 5000,
  toastManager,
  container,
  className,
  children,
}: ToasterProps) {
  return (
    <BaseToast.Provider limit={limit} timeout={timeout} toastManager={toastManager}>
      {children}
      <BaseToast.Portal container={container}>
        <BaseToast.Viewport
          data-slot="toaster"
          data-position={position}
          className={cn(viewportClasses, positions[position].viewport, className)}
        >
          <ToastList position={position} />
        </BaseToast.Viewport>
      </BaseToast.Portal>
    </BaseToast.Provider>
  );
}

function ToastList({ position }: { position: ToastPosition }) {
  const { toasts } = BaseToast.useToastManager();
  return toasts.map((toast) => <ToastItem key={toast.id} toast={toast} position={position} />);
}

function ToastItem({ toast, position }: { toast: ToastObject<object>; position: ToastPosition }) {
  const tone = toast.type ? typeTones[toast.type] : undefined;
  return (
    <BaseToast.Root
      toast={toast}
      swipeDirection={positions[position].swipe}
      data-slot="toast"
      className={cn(
        rootClasses,
        positions[position].root,
        tone && [toneClass[tone], accentClasses],
      )}
    >
      <BaseToast.Content data-slot="toast-content" className={contentClasses}>
        <ToastIcon type={toast.type} toned={tone !== undefined} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <BaseToast.Title data-slot="toast-title" className={titleClasses} />
          <BaseToast.Description data-slot="toast-description" className={descriptionClasses} />
        </div>
        {/* Button always sets its own `data-slot="button"`, so the slots live on wrappers. */}
        {toast.actionProps && (
          <span data-slot="toast-action" className="flex shrink-0">
            <BaseToast.Action render={<Button size="sm" variant="outline" color="neutral" />} />
          </span>
        )}
        <span data-slot="toast-close" className="-mt-1 -mr-1 flex shrink-0">
          <BaseToast.Close
            render={<Button variant="ghost" color="neutral" size="icon-xs" aria-label="Close" />}
          >
            <CloseIcon />
          </BaseToast.Close>
        </span>
      </BaseToast.Content>
    </BaseToast.Root>
  );
}

/**
 * Returns the toast manager of the enclosing `Toaster` (Base UI's `useToastManager`): `add`,
 * `close`, `update`, `promise`, `toasts`. Toasts default to `priority: "low"` (announced politely);
 * pass `priority: "high"` only for urgent messages.
 */
export function useToast<Data extends object = object>(): UseToastManagerReturnValue<Data> {
  return BaseToast.useToastManager<Data>();
}

/**
 * Creates a toast manager for use outside React (API clients, stores), wrapping Base UI's
 * `createToastManager`. Pass it to `<Toaster toastManager={toaster}>`; toasts added before that
 * Toaster mounts are dropped.
 */
export function createToaster<Data extends object = object>(): ToastManager<Data> {
  return BaseToast.createToastManager<Data>();
}

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/*
 * The loading spinner keeps spinning under reduced motion, like Button's: it is essential status
 * motion (spec §2 Toast).
 */
function ToastIcon({ type, toned }: { type: string | undefined; toned: boolean }) {
  if (type === "loading") {
    return (
      <svg
        aria-hidden="true"
        {...svgProps}
        data-slot="toast-icon"
        className={cn(iconClasses, "animate-spin text-muted-foreground")}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    );
  }
  if (!toned || type === undefined) return null;
  const tone = typeTones[type];
  return (
    <svg
      aria-hidden="true"
      {...svgProps}
      data-slot="toast-icon"
      className={cn(iconClasses, "text-tone-ink")}
    >
      {tone === "success" && (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </>
      )}
      {tone === "warning" && (
        <>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </>
      )}
      {tone === "danger" && (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="m15 9-6 6" />
          <path d="m9 9 6 6" />
        </>
      )}
      {tone === "info" && (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </>
      )}
    </svg>
  );
}
