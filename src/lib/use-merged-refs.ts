"use client";

import { type Ref, type RefCallback, useMemo } from "react";
import { mergeRefs } from "./merge-refs";

/**
 * `mergeRefs`, memoised on the refs' identities: the callback stays the same across renders while
 * every ref is unchanged, so React does not detach and re-attach it. Pass the same number of refs
 * on every render.
 */
export function useMergedRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs are the dependencies.
  return useMemo(() => mergeRefs(...refs), refs);
}
