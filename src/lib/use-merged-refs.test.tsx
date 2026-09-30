import { useState } from "react";
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
});
