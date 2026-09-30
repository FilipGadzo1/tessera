import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { mergeRefs } from "./merge-refs";

const node = document.createElement("div");

function objectRef(): RefObject<HTMLDivElement | null> {
  return { current: null };
}

describe("mergeRefs", () => {
  it("sets object refs and callback refs, then clears them on null", () => {
    const object = objectRef();
    const callback = vi.fn();
    const merged = mergeRefs<HTMLDivElement>(object, callback);
    expect(merged(node)).toBeUndefined();
    expect(object.current).toBe(node);
    expect(callback).toHaveBeenLastCalledWith(node);
    merged(null);
    expect(object.current).toBeNull();
    expect(callback).toHaveBeenLastCalledWith(null);
  });

  it("skips undefined and null refs", () => {
    const object = objectRef();
    const merged = mergeRefs<HTMLDivElement>(undefined, object, null);
    merged(node);
    expect(object.current).toBe(node);
  });

  it("returns a cleanup when a callback ref returns one, and runs it instead of passing null", () => {
    const object = objectRef();
    const cleanup = vi.fn();
    const withCleanup = vi.fn(() => cleanup);
    const plain = vi.fn();
    const merged = mergeRefs<HTMLDivElement>(object, withCleanup, plain);
    const detach = merged(node);
    expect(typeof detach).toBe("function");
    expect(withCleanup).toHaveBeenCalledTimes(1);
    (detach as () => void)();
    // The cleanup-returning ref is cleaned up, never called with null (React semantics).
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(withCleanup).toHaveBeenCalledTimes(1);
    // The others are set to null.
    expect(object.current).toBeNull();
    expect(plain).toHaveBeenLastCalledWith(null);
  });

  it("only cleans up when a cleanup exists; two cleanups both run", () => {
    const first = vi.fn();
    const second = vi.fn();
    const merged = mergeRefs<HTMLDivElement>(
      () => first,
      () => second,
    );
    (merged(node) as () => void)();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
