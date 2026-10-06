import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

const kbdBase =
  "inline-flex h-5 min-w-5 select-none items-center justify-center gap-0.5 rounded-sm border border-border bg-muted px-1 font-sans text-xs font-medium tabular-nums text-muted-foreground [&_svg]:size-3 forced-colors:border-[CanvasText]";

/** `KbdGroup`'s classes, shared with `KbdShortcut` (which renders a group of its own slot). */
export const kbdGroupBase = "inline-flex items-center gap-1";

export type KbdProps = ComponentProps<"kbd">;

/** One key, as a small keycap (`<kbd>`): text or an icon. CanvasText border in forced colors. */
export function Kbd({ className, ...props }: KbdProps) {
  return <kbd {...props} data-slot="kbd" className={cn(kbdBase, className)} />;
}

export type KbdGroupProps = ComponentProps<"kbd">;

/**
 * A key combination: `Kbd`s side by side in a `<kbd>` (HTML nests `<kbd>` for a combination),
 * separated by a gap. For a `modifier+key` shortcut labelled for the platform, use `KbdShortcut`.
 */
export function KbdGroup({ className, ...props }: KbdGroupProps) {
  return <kbd {...props} data-slot="kbd-group" className={cn(kbdGroupBase, className)} />;
}
