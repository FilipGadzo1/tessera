"use client";

import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { isRtl } from "./direction";

type ElementDirection = "ltr" | "rtl";

/*
 * One MutationObserver for every user: it watches `dir` attributes anywhere in the document, is
 * created for the first subscriber and disconnected after the last. Each subscriber re-reads its
 * own element when it fires.
 */
const subscribers = new Set<() => void>();
let observer: MutationObserver | null = null;

function subscribe(onDirChange: () => void): () => void {
  subscribers.add(onDirChange);
  if (!observer) {
    observer = new MutationObserver(() => {
      for (const subscriber of subscribers) subscriber();
    });
    observer.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ["dir"],
    });
  }
  return () => {
    subscribers.delete(onDirChange);
    if (subscribers.size === 0) {
      observer?.disconnect();
      observer = null;
    }
  };
}

/**
 * The resolved text direction of `ref`'s element (from `dir` on it or any ancestor), for feeding
 * Base UI's `DirectionProvider`. `"ltr"` on the server and in the first client render; the element
 * is read in a layout effect on mount (before paint), then again only when a `dir` attribute
 * changes somewhere in the document, so a commit per pointer move never forces a style read.
 *
 * Limits: a direction set only by a CSS `direction` rule (no `dir` attribute) is read on mount but
 * not observed; moving a mounted element under a different `dir` ancestor is not observed; and if
 * `ref.current` switches to a different element with no `dir` mutation, the new element is not
 * read until the next `dir` change.
 */
export function useElementDirection(ref: RefObject<Element | null>): ElementDirection {
  const [direction, setDirection] = useState<ElementDirection>("ltr");
  const current = useRef<ElementDirection>("ltr");
  useLayoutEffect(() => {
    const read = () => {
      const element = ref.current;
      if (!element) return;
      const next: ElementDirection = isRtl(element) ? "rtl" : "ltr";
      // Only a real change: an unchanged setState could be rebased over a newer one.
      if (next === current.current) return;
      current.current = next;
      setDirection(next);
    };
    read();
    return subscribe(read);
  }, [ref]);
  return direction;
}
