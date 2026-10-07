import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { useStatusMessage } from "./use-status-message";

let announceRef: ((text: string) => void) | null = null;

function Status() {
  const [message, announce] = useStatusMessage();
  announceRef = announce;
  return (
    <span role="status" data-testid="status">
      {message}
    </span>
  );
}

const announce = (text: string) => {
  if (!announceRef) throw new Error("not rendered");
  announceRef(text);
};

describe("useStatusMessage", () => {
  it("starts empty and shows an announcement", async () => {
    const screen = await render(<Status />);
    const status = screen.getByTestId("status");
    expect(status.element().textContent).toBe("");
    announce("react added");
    await expect.poll(() => status.element().textContent).toBe("react added");
  });

  it("an identical announcement changes the DOM text (a trailing no-break space toggles)", async () => {
    const screen = await render(<Status />);
    const status = screen.getByTestId("status");
    announce("react added");
    await expect.poll(() => status.element().textContent).toBe("react added");
    announce("react added");
    await expect.poll(() => status.element().textContent).toBe("react added ");
    announce("react added");
    await expect.poll(() => status.element().textContent).toBe("react added");
  });

  it("a different announcement replaces the message", async () => {
    const screen = await render(<Status />);
    const status = screen.getByTestId("status");
    announce("react added");
    await expect.poll(() => status.element().textContent).toBe("react added");
    announce("react removed");
    await expect.poll(() => status.element().textContent).toBe("react removed");
  });

  it("sets no timer: the message stays until the next one", async () => {
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    try {
      const screen = await render(<Status />);
      const callsBefore = setTimeoutSpy.mock.calls.length + setIntervalSpy.mock.calls.length;
      announce("react added");
      // Two frames (not a timer, which the spy would count) for React to commit.
      for (let frame = 0; frame < 2; frame++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      expect(setTimeoutSpy.mock.calls.length + setIntervalSpy.mock.calls.length).toBe(callsBefore);
      expect(screen.getByTestId("status").element().textContent).toBe("react added");
    } finally {
      vi.restoreAllMocks();
    }
  });
});
