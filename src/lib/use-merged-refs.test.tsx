import { type RefCallback, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { useMergedRefs } from "./use-merged-refs";

describe("useMergedRefs", () => {
  it("keeps the merged callback stable while the refs are, and attaches every ref", async () => {
    const seen: unknown[] = [];
    const object = { current: null as HTMLDivElement | null };
    const callback = vi.fn();
    function Ui() {
      const [, setTick] = useState(0);
      const merged = useMergedRefs<HTMLDivElement>(object, callback);
      seen.push(merged);
      return (
        <div ref={merged} data-testid="target">
          <button type="button" onClick={() => setTick((tick) => tick + 1)}>
            rerender
          </button>
        </div>
      );
    }
    const screen = await render(<Ui />);
    await screen.getByRole("button").click();
    await expect.poll(() => seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
    expect(object.current).toBeInstanceOf(HTMLDivElement);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("re-merges when a ref is swapped: the old one is detached, the new one attached", async () => {
    const object = { current: null as HTMLDivElement | null };
    const first = vi.fn();
    const cleanup = vi.fn();
    const second = vi.fn(() => cleanup);
    const third = vi.fn();
    function Ui({ extra }: { extra: RefCallback<HTMLDivElement> }) {
      const merged = useMergedRefs<HTMLDivElement>(object, extra);
      return <div ref={merged} />;
    }
    const screen = await render(<Ui extra={first} />);
    expect(first).toHaveBeenLastCalledWith(expect.any(HTMLDivElement));
    // Swapping a plain callback: detached with null, the new one attached, the stable one kept.
    await screen.rerender(<Ui extra={second} />);
    expect(first).toHaveBeenLastCalledWith(null);
    expect(second).toHaveBeenCalledTimes(1);
    expect(object.current).toBeInstanceOf(HTMLDivElement);
    // Swapping a callback that returned a cleanup: the cleanup runs, it is not called with null.
    await screen.rerender(<Ui extra={third} />);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).toHaveBeenLastCalledWith(expect.any(HTMLDivElement));
    expect(object.current).toBeInstanceOf(HTMLDivElement);
  });
});
