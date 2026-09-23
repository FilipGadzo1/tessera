import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { cn } from "../lib/cn";

const bg = (element: Element) => getComputedStyle(element).backgroundColor;
const fg = (element: Element) => getComputedStyle(element).color;

describe("theme tokens", () => {
  it("binds the primary palette from the nearest data-primary ancestor", async () => {
    const screen = await render(
      <div>
        <div data-testid="default" className="size-4 bg-primary" />
        <div data-primary="malachite">
          <div data-testid="malachite" className="size-4 bg-primary" />
        </div>
        <div data-primary="lapis">
          <div data-testid="lapis" className="size-4 bg-primary" />
          <div
            data-testid="lapis-ref"
            className="size-4"
            style={{ background: "var(--tsr-lapis-600)" }}
          />
        </div>
      </div>,
    );
    const defaultBg = bg(screen.getByTestId("default").element());
    expect(defaultBg).toBe(bg(screen.getByTestId("malachite").element()));
    expect(bg(screen.getByTestId("lapis").element())).toBe(
      bg(screen.getByTestId("lapis-ref").element()),
    );
    expect(bg(screen.getByTestId("lapis").element())).not.toBe(defaultBg);
  });

  it("switches roles to their dark values inside .dark, including nested palette scopes", async () => {
    const screen = await render(
      <div>
        <div data-testid="light" className="size-4 bg-primary" />
        <div className="dark">
          <div data-testid="dark" className="size-4 bg-primary" />
          <div
            data-testid="dark-ref"
            className="size-4"
            style={{ background: "var(--tsr-malachite-400)" }}
          />
          <div data-primary="lapis">
            <div data-testid="dark-lapis" className="size-4 bg-primary" />
            <div
              data-testid="dark-lapis-ref"
              className="size-4"
              style={{ background: "var(--tsr-lapis-400)" }}
            />
          </div>
        </div>
      </div>,
    );
    expect(bg(screen.getByTestId("dark").element())).toBe(
      bg(screen.getByTestId("dark-ref").element()),
    );
    expect(bg(screen.getByTestId("dark").element())).not.toBe(
      bg(screen.getByTestId("light").element()),
    );
    expect(bg(screen.getByTestId("dark-lapis").element())).toBe(
      bg(screen.getByTestId("dark-lapis-ref").element()),
    );
  });

  it("binds the surface palette from data-surface", async () => {
    const screen = await render(
      <div>
        <div data-testid="marble" className="size-4 bg-muted" />
        <div data-surface="slate">
          <div data-testid="slate" className="size-4 bg-muted" />
          <div
            data-testid="slate-ref"
            className="size-4"
            style={{ background: "var(--tsr-slate-100)" }}
          />
        </div>
      </div>,
    );
    expect(bg(screen.getByTestId("slate").element())).toBe(
      bg(screen.getByTestId("slate-ref").element()),
    );
    expect(bg(screen.getByTestId("slate").element())).not.toBe(
      bg(screen.getByTestId("marble").element()),
    );
  });

  it("keeps status roles independent of the primary palette", async () => {
    const screen = await render(
      <div>
        <div data-testid="a" className="size-4 bg-success" />
        <div data-primary="amethyst">
          <div data-testid="b" className="size-4 bg-success" />
        </div>
      </div>,
    );
    expect(bg(screen.getByTestId("a").element())).toBe(bg(screen.getByTestId("b").element()));
  });

  it("tone utilities mirror their role tokens", async () => {
    const screen = await render(
      <div>
        <div data-testid="tone" className="size-4 tone-danger bg-tone text-tone-ink" />
        <div data-testid="role" className="size-4 bg-danger text-danger" />
        <div data-testid="neutral-ink" className="size-4 tone-neutral text-tone-ink" />
        <div data-testid="foreground" className="size-4 text-foreground" />
      </div>,
    );
    expect(bg(screen.getByTestId("tone").element())).toBe(bg(screen.getByTestId("role").element()));
    expect(fg(screen.getByTestId("tone").element())).toBe(fg(screen.getByTestId("role").element()));
    expect(fg(screen.getByTestId("neutral-ink").element())).toBe(
      fg(screen.getByTestId("foreground").element()),
    );
  });

  it("exposes palette scales as utilities", async () => {
    const screen = await render(
      <div data-primary="carnelian">
        <div data-testid="scale" className="size-4 bg-primary-500" />
        <div
          data-testid="ref"
          className="size-4"
          style={{ background: "var(--tsr-carnelian-500)" }}
        />
      </div>,
    );
    expect(bg(screen.getByTestId("scale").element())).toBe(bg(screen.getByTestId("ref").element()));
  });

  it("cn treats tone-* utilities as one conflict group", () => {
    expect(cn("tone-primary bg-tone", "tone-danger")).toBe("bg-tone tone-danger");
  });
});
