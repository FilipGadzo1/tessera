"use client";

import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import { createContext, useContext } from "react";
import { cn } from "../../lib/cn";
import { mergeClassName } from "../../lib/merge-class-name";

export type AvatarSize = "sm" | "md" | "lg";

const sizeClasses: Record<AvatarSize, string> = {
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
};

const AvatarSizeContext = createContext<AvatarSize>("md");

export interface AvatarProps extends BaseAvatar.Root.Props {
  /** @default "md" */
  size?: AvatarSize;
}

/** A round user picture with a fallback (initials or an icon). */
export function Avatar({ size = "md", className, ...props }: AvatarProps) {
  return (
    <AvatarSizeContext.Provider value={size}>
      <BaseAvatar.Root
        {...props}
        data-slot="avatar"
        data-size={size}
        className={mergeClassName(
          cn(
            "relative inline-flex shrink-0 overflow-hidden rounded-full bg-muted align-middle",
            sizeClasses[size],
          ),
          className,
        )}
      />
    </AvatarSizeContext.Provider>
  );
}

export type AvatarImageProps = BaseAvatar.Image.Props;

/** The picture. Rendered only once it has loaded; until then (or on error) the fallback shows. */
export function AvatarImage({ className, ...props }: AvatarImageProps) {
  return (
    <BaseAvatar.Image
      {...props}
      data-slot="avatar-image"
      className={mergeClassName("size-full object-cover", className)}
    />
  );
}

export type AvatarFallbackProps = BaseAvatar.Fallback.Props;

/** Shown while there is no loaded image — initials are uppercased. `delay` avoids a flash. */
export function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  const size = useContext(AvatarSizeContext);
  return (
    <BaseAvatar.Fallback
      {...props}
      data-slot="avatar-fallback"
      className={mergeClassName(
        cn(
          "flex size-full items-center justify-center text-sm font-medium text-muted-foreground uppercase select-none",
          size === "sm" && "text-xs",
        ),
        className,
      )}
    />
  );
}
