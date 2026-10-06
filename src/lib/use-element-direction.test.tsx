import { useRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { render } from "vitest-browser-react";
import { isRtl } from "./direction";
import { useElementDirection } from "./use-element-direction";

// Every export keeps its implementation; `isRtl` (the only style read) records its calls.
vi.mock("./direction", { spy: true });

function Probe({ label = "probe" }: { label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const direction = useElementDirection(ref);
  const [count, setCount] = useState(0);
  return (
    <div ref={ref} data-testid={label} data-direction={direction}>
      <button type="button" data-count={count} onClick={() => setCount(count + 1)}>
        Re-render {label}
      </button>
    </div>
  );
}

const direction = (label = "probe") =>
  document.querySelector(`[data-testid=${label}]`)?.getAttribute("data-direction");

/** The `MutationObserver`s this hook created: the ones observing `dir` attributes. */
function dirObservers(observe: MockInstance<MutationObserver["observe"]>) {
  return observe.mock.calls.flatMap((call, index) =>
    call[1]?.attributeFilter?.includes("dir")
      ? [observe.mock.contexts[index] as MutationObserver]
      : [],
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(isRtl).mockClear();
});

describe("useElementDirection", () => {
  it('is "ltr" before mount (server HTML and the first render)', () => {
    const html = renderToString(
      <div dir="rtl">
        <Probe />
      </div>,
    );
    expect(html).toContain('data-direction="ltr"');
  });

  it('reads "rtl" on mount under an ancestor dir="rtl"', async () => {
    await render(
      <div dir="rtl">
        <Probe />
      </div>,
    );
    await expect.poll(() => direction()).toBe("rtl");
  });

  it('stays "ltr" with no dir', async () => {
    await render(<Probe />);
    expect(direction()).toBe("ltr");
    expect(vi.mocked(isRtl)).toHaveBeenCalled();
  });

  it("sees an ancestor's dir change", async () => {
    const screen = await render(
      <div data-testid="wrapper">
        <Probe />
      </div>,
    );
    const wrapper = screen.getByTestId("wrapper").element();
    expect(direction()).toBe("ltr");
    wrapper.setAttribute("dir", "rtl");
    await expect.poll(() => direction()).toBe("rtl");
    wrapper.setAttribute("dir", "ltr");
    await expect.poll(() => direction()).toBe("ltr");
  });

  it("a re-render with no dir change reads no style", async () => {
    const screen = await render(
      <div dir="rtl">
        <Probe />
      </div>,
    );
    await expect.poll(() => direction()).toBe("rtl");
    const probe = screen.getByTestId("probe").element();
    const reads = () => vi.mocked(isRtl).mock.calls.filter(([element]) => element === probe).length;
    const before = reads();
    expect(before).toBeGreaterThan(0);
    const button = screen.getByRole("button");
    for (let i = 1; i <= 3; i++) {
      (button.element() as HTMLButtonElement).click();
      await expect.element(button).toHaveAttribute("data-count", String(i));
    }
    expect(reads()).toBe(before);
  });

  it("shares one observer and disconnects it after the last unmount", async () => {
    // Assumes no subscriber leaks in from an earlier test (each test's render is unmounted after
    // it), so the observer is created here, by the first Probe.
    const observe = vi.spyOn(MutationObserver.prototype, "observe");
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const first = await render(<Probe label="a" />);
    const second = await render(<Probe label="b" />);
    const observers = dirObservers(observe);
    expect(observers).toHaveLength(1);
    const [observer] = observers;
    expect(observe.mock.calls[observe.mock.contexts.indexOf(observer)]?.[0]).toBe(
      document.documentElement,
    );
    const disconnected = () => disconnect.mock.contexts.includes(observer);
    first.unmount();
    expect(disconnected()).toBe(false);
    second.unmount();
    expect(disconnected()).toBe(true);
  });
});
