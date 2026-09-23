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

  it.each(["marble", "slate", "sandstone"])(
    "resolves field tokens in light and dark for the %s surface",
    async (surface) => {
      const ref = (value: string) => ({ background: value });
      const screen = await render(
        <div data-surface={surface}>
          <div data-testid="light-border" className="size-4 bg-field-border" />
          <div
            data-testid="light-border-ref"
            className="size-4"
            style={ref(`color-mix(in oklab, var(--tsr-${surface}-400), var(--tsr-${surface}-500))`)}
          />
          <div data-testid="light-track" className="size-4 bg-switch-track" />
          <div data-testid="light-hover" className="size-4 bg-field-border-hover" />
          <div
            data-testid="light-hover-ref"
            className="size-4"
            style={ref(`var(--tsr-${surface}-500)`)}
          />
          <div data-testid="light-field" className="size-4 bg-field" />
          <div
            data-testid="light-field-ref"
            className="size-4"
            style={ref(`var(--tsr-${surface}-0)`)}
          />
          <div data-testid="neutral-line" className="size-4 tone-neutral bg-tone-line" />
          <div className="dark">
            <div data-testid="dark-border" className="size-4 bg-field-border" />
            <div data-testid="dark-track" className="size-4 bg-switch-track" />
            <div
              data-testid="dark-border-ref"
              className="size-4"
              style={ref(`var(--tsr-${surface}-500)`)}
            />
            <div data-testid="dark-hover" className="size-4 bg-field-border-hover" />
            <div
              data-testid="dark-hover-ref"
              className="size-4"
              style={ref(`var(--tsr-${surface}-400)`)}
            />
            <div data-testid="dark-field" className="size-4 bg-field" />
            <div
              data-testid="dark-field-ref"
              className="size-4"
              style={ref(`var(--tsr-${surface}-900)`)}
            />
          </div>
        </div>,
      );
      const color = (id: string) => bg(screen.getByTestId(id).element());
      expect(color("light-border")).toBe(color("light-border-ref"));
      expect(color("light-track")).toBe(color("light-border-ref"));
      expect(color("neutral-line")).toBe(color("light-border-ref"));
      expect(color("light-hover")).toBe(color("light-hover-ref"));
      expect(color("light-field")).toBe(color("light-field-ref"));
      expect(color("dark-border")).toBe(color("dark-border-ref"));
      expect(color("dark-track")).toBe(color("dark-border-ref"));
      expect(color("dark-hover")).toBe(color("dark-hover-ref"));
      expect(color("dark-field")).toBe(color("dark-field-ref"));
      expect(color("light-border")).not.toBe(color("dark-border"));
    },
  );

  it("cn treats tone-* utilities as one conflict group", () => {
    expect(cn("tone-primary bg-tone", "tone-danger")).toBe("bg-tone tone-danger");
  });
});
