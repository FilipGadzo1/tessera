import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { useControllableState } from "./use-controllable-state";

function Uncontrolled({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useControllableState<string>(undefined, "off", onChange);
  return (
    <button type="button" onClick={() => setValue(value === "off" ? "on" : "off")}>
      {value}
    </button>
  );
}

function Controlled({
  value,
  onChange,
}: {
  value: string;
  onChange?: (value: string) => void;
}) {
  const [current, setValue] = useControllableState<string>(value, "off", onChange);
  return (
    <button type="button" onClick={() => setValue(current === "off" ? "on" : "off")}>
      {current}
    </button>
  );
}

describe("useControllableState", () => {
  it("is uncontrolled without a value prop: internal state updates on set", async () => {
    const screen = await render(<Uncontrolled />);
    const button = screen.getByRole("button");
    await expect.element(button).toHaveTextContent("off");
    await button.click();
    await expect.element(button).toHaveTextContent("on");
  });

  it("stays at the controlled value: set does not change what's displayed", async () => {
    const screen = await render(<Controlled value="off" />);
    const button = screen.getByRole("button");
    await expect.element(button).toHaveTextContent("off");
    await button.click();
    // The parent never re-rendered with a new `value`, so the displayed value is unchanged —
    // controlled state ignores the internal set.
    await expect.element(button).toHaveTextContent("off");
  });

  it("calls onChange when uncontrolled", async () => {
    const onChange = vi.fn();
    const screen = await render(<Uncontrolled onChange={onChange} />);
    await screen.getByRole("button").click();
    expect(onChange).toHaveBeenCalledWith("on");
  });

  it("calls onChange when controlled too (the caller decides whether to apply it)", async () => {
    const onChange = vi.fn();
    const screen = await render(<Controlled value="off" onChange={onChange} />);
    await screen.getByRole("button").click();
    expect(onChange).toHaveBeenCalledWith("on");
  });

  it("an explicit null is a valid controlled value, distinct from undefined (uncontrolled)", async () => {
    function NullableControlled({ value }: { value: string | null | undefined }) {
      const [current] = useControllableState<string | null>(value, "default");
      return <span>{current === null ? "null" : (current ?? "undefined-fallback")}</span>;
    }
    const controlledNull = await render(<NullableControlled value={null} />);
    await expect.element(page.getByText("null")).toBeVisible();

    const uncontrolled = await render(<NullableControlled value={undefined} />);
    await expect.element(uncontrolled.getByText("default")).toBeVisible();
  });
});
