import type { Ref, RefCallback } from "react";

/**
 * One callback ref that feeds every given ref (object or callback). Server-safe, no hooks: the
 * caller memoises it when a stable identity matters (see `useMergedRefs`).
 *
 * React 19 semantics: a callback ref may return a cleanup, which React runs on detach instead of
 * calling the ref with `null`. If any of the refs returns one, the merged callback returns a
 * cleanup that runs those, and sets the others (object refs and callbacks without a cleanup) to
 * `null`. Without any cleanup nothing is returned and React calls the merged ref with `null`.
 */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (node) => {
    const cleanups: Array<(() => void) | undefined> = [];
    let hasCleanup = false;
    for (const ref of refs) {
      if (typeof ref === "function") {
        const cleanup = ref(node);
        if (typeof cleanup === "function") {
          hasCleanup = true;
          cleanups.push(cleanup);
        } else {
          cleanups.push(undefined);
        }
      } else if (ref) {
        ref.current = node;
        cleanups.push(undefined);
      } else {
        cleanups.push(undefined);
      }
    }
    if (!hasCleanup) return undefined;
    return () => {
      refs.forEach((ref, index) => {
        const cleanup = cleanups[index];
        if (cleanup) cleanup();
        else if (typeof ref === "function") ref(null);
        else if (ref) ref.current = null;
      });
    };
  };
}
