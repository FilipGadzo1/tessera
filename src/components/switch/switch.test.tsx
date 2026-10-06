import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Field, FieldLabel } from "../field";
import { Label } from "../label";
import { Switch, type SwitchProps } from "./switch";

function Labelled({ label, ...props }: SwitchProps & { label: string }) {
  return (
    <Label className="flex items-center gap-2">
      <Switch {...props} />
      {label}
    </Label>
  );
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

describe("Switch", () => {
  it("renders a switch named by its wrapping Label, with data-slots", async () => {
    const screen = await render(<Labelled label="Notifications" />);
    const toggle = screen.getByRole("switch", { name: "Notifications" });
    await expect.element(toggle).toBeInTheDocument();
    await expect.element(toggle).toHaveAttribute("data-slot", "switch");
    await expect.element(toggle).toHaveAttribute("aria-checked", "false");
    const thumb = toggle.element().querySelector('[data-slot="switch-thumb"]');
    expect(thumb).not.toBeNull();
  });

  it("toggles aria-checked and data-checked on click and reports true to onCheckedChange", async () => {
    const onCheckedChange = vi.fn();
    const screen = await render(
      <Labelled label="Notifications" onCheckedChange={onCheckedChange} />,
    );
    const toggle = screen.getByRole("switch", { name: "Notifications" });
    await toggle.click();
    await expect.element(toggle).toHaveAttribute("aria-checked", "true");
    await expect.element(toggle).toHaveAttribute("data-checked");
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
    await toggle.click();
    await expect.element(toggle).toHaveAttribute("aria-checked", "false");
    await expect.element(toggle).toHaveAttribute("data-unchecked");
  });

  it("ignores children (type-level: SwitchProps omits children)", async () => {
    const screen = await render(
      // @ts-expect-error -- Tessera renders the thumb; children are not accepted.
      <Switch aria-label="Kids">ignored</Switch>,
    );
    await expect.element(screen.getByRole("switch", { name: "Kids" })).toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("ignored");
  });

  it("toggles when the label text is clicked", async () => {
    const screen = await render(<Labelled label="Notifications" />);
    const toggle = screen.getByRole("switch", { name: "Notifications" });
    await screen.getByText("Notifications").click();
    await expect.element(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("toggles with Space when focused", async () => {
    const screen = await render(<Labelled label="Notifications" />);
    const toggle = screen.getByRole("switch", { name: "Notifications" });
    await userEvent.tab();
    expect(document.activeElement).toBe(toggle.element());
    await userEvent.keyboard(" ");
    await expect.element(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("moves the thumb to the right when checked", async () => {
    const screen = await render(
      <div>
        <Labelled label="Off" />
        <Labelled label="On" defaultChecked />
      </div>,
    );
    await settle();
    const offset = (name: string) => {
      const track = screen.getByRole("switch", { name }).element();
      const thumb = track.querySelector('[data-slot="switch-thumb"]') as HTMLElement;
      return thumb.getBoundingClientRect().left - track.getBoundingClientRect().left;
    };
    const off = offset("Off");
    const on = offset("On");
    // p-0.5 = 2px inset; translate-x-5 = 20px travel.
    expect(off).toBeCloseTo(2, 0);
    expect(on - off).toBeCloseTo(20, 0);
  });

  it("uses the switch-track color unchecked and the primary color checked", async () => {
    const screen = await render(
      <div>
        <Labelled label="Off" />
        <Labelled label="On" defaultChecked />
        <div data-testid="track" className="bg-switch-track" />
        <div data-testid="primary" className="bg-primary" />
      </div>,
    );
    await settle();
    const bg = (el: Element) => getComputedStyle(el).backgroundColor;
    expect(bg(screen.getByRole("switch", { name: "Off" }).element())).toBe(
      bg(screen.getByTestId("track").element()),
    );
    expect(bg(screen.getByRole("switch", { name: "On" }).element())).toBe(
      bg(screen.getByTestId("primary").element()),
    );
  });

  it("ignores clicks when disabled", async () => {
    const onCheckedChange = vi.fn();
    const screen = await render(
      <Labelled label="Off" disabled onCheckedChange={onCheckedChange} />,
    );
    const toggle = screen.getByRole("switch", { name: "Off" });
    await toggle.click({ force: true });
    await expect.element(toggle).toHaveAttribute("aria-checked", "false");
    await expect.element(toggle).toHaveAttribute("data-disabled");
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("shows a pointer cursor, and not-allowed when disabled", async () => {
    const screen = await render(
      <div>
        <Labelled label="Ready" />
        <Labelled label="Off" disabled />
      </div>,
    );
    const cursor = (name: string) =>
      getComputedStyle(screen.getByRole("switch", { name }).element()).cursor;
    expect(cursor("Ready")).toBe("pointer");
    expect(cursor("Off")).toBe("not-allowed");
  });

  it("shows a solid 2px outline on Tab focus and none before", async () => {
    const screen = await render(
      <div>
        <Labelled label="First" />
        <Labelled label="Second" />
      </div>,
    );
    const first = screen.getByRole("switch", { name: "First" }).element() as HTMLElement;
    const second = screen.getByRole("switch", { name: "Second" }).element() as HTMLElement;
    expect(getComputedStyle(first).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(first);
    const style = getComputedStyle(first);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
    expect(getComputedStyle(second).outlineStyle).toBe("none");
  });

  describe("hover", () => {
    const bg = (el: Element) => getComputedStyle(el).backgroundColor;

    it("disabled wins over read-only: a not-allowed cursor", async () => {
      const screen = await render(<Labelled label="Both" readOnly disabled />);
      const toggle = screen.getByRole("switch", { name: "Both" });
      await expect.element(toggle).toHaveAttribute("data-readonly");
      await expect.element(toggle).toHaveAttribute("data-disabled");
      expect(getComputedStyle(toggle.element()).cursor).toBe("not-allowed");
    });

    it.each([
      ["Off", false],
      ["On", true],
    ])("read-only (%s): a default cursor and no hover fill", async (label, checked) => {
      const screen = await render(<Labelled label={label} defaultChecked={checked} readOnly />);
      const toggle = screen.getByRole("switch", { name: label });
      await expect.element(toggle).toHaveAttribute("data-readonly");
      const element = toggle.element();
      expect(getComputedStyle(element).cursor).toBe("default");
      const before = bg(element);
      await userEvent.hover(toggle);
      expect(element.matches(":hover")).toBe(true);
      await expect.poll(() => element.getAnimations().length).toBe(0);
      expect(bg(element)).toBe(before);
    });

    it.each([
      { label: "Off", checked: false, ref: "bg-field-border-hover" },
      { label: "On", checked: true, ref: "bg-primary-hover" },
    ])("fills the $label track with $ref on hover", async ({ label, checked, ref }) => {
      const screen = await render(
        <div>
          <Labelled label={label} defaultChecked={checked} />
          <div data-testid="ref" className={ref} />
        </div>,
      );
      const toggle = screen.getByRole("switch", { name: label });
      await userEvent.hover(toggle);
      await settle();
      expect(bg(toggle.element())).toBe(bg(screen.getByTestId("ref").element()));
    });

    it("keeps the switch-track fill when a disabled switch is hovered", async () => {
      const screen = await render(
        <div>
          <Labelled label="Off" disabled />
          <div data-testid="ref" className="bg-switch-track" />
        </div>,
      );
      const toggle = screen.getByRole("switch", { name: "Off" });
      await userEvent.hover(toggle, { force: true });
      await settle();
      expect(bg(toggle.element())).toBe(bg(screen.getByTestId("ref").element()));
    });
  });

  describe("checked thumb color", () => {
    /** Resolves any CSS color (oklch included) to sRGB bytes via a canvas. */
    function rgb(color: string): [number, number, number] {
      const ctx = document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0];
    }
    function luminance(color: string): number {
      const linear = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const [r, g, b] = rgb(color);
      return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    }
    function contrast(a: string, b: string): number {
      const la = luminance(a);
      const lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    it.each(["light", "dark"] as const)(
      "uses primary-foreground with >= 3:1 against the track in the %s theme",
      async (theme) => {
        const screen = await render(
          <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
            <Labelled label="On" defaultChecked />
            <div data-testid="ref" className="bg-primary-foreground" />
          </div>,
        );
        await settle();
        const track = screen.getByRole("switch", { name: "On" }).element();
        const thumb = track.querySelector('[data-slot="switch-thumb"]') as HTMLElement;
        const thumbBg = getComputedStyle(thumb).backgroundColor;
        expect(thumbBg).toBe(getComputedStyle(screen.getByTestId("ref").element()).backgroundColor);
        const white = rgb("#fff").join(",");
        if (theme === "dark") expect(rgb(thumbBg).join(",")).not.toBe(white);
        else expect(rgb(thumbBg).join(",")).toBe(white);
        expect(contrast(thumbBg, getComputedStyle(track).backgroundColor)).toBeGreaterThanOrEqual(
          3,
        );
      },
    );
  });

  describe("invalid", () => {
    function InvalidSwitch() {
      return (
        <Field invalid>
          <FieldLabel className="flex items-center gap-2">
            <Switch />
            Notifications
          </FieldLabel>
        </Field>
      );
    }

    it("draws a 1px danger outline around the track inside <Field invalid>", async () => {
      const screen = await render(
        <div>
          <InvalidSwitch />
          <div data-testid="ref" className="outline-1 outline-solid outline-danger" />
        </div>,
      );
      const toggle = screen.getByRole("switch", { name: "Notifications" });
      await expect.element(toggle).toHaveAttribute("data-invalid");
      await settle();
      const style = getComputedStyle(toggle.element());
      expect(style.outlineStyle).toBe("solid");
      expect(style.outlineWidth).toBe("1px");
      expect(style.outlineColor).toBe(
        getComputedStyle(screen.getByTestId("ref").element()).outlineColor,
      );
    });

    it("widens to a 2px danger outline on Tab focus (focus width wins, danger color stays)", async () => {
      const screen = await render(
        <div>
          <InvalidSwitch />
          <div data-testid="ref" className="outline-2 outline-solid outline-danger" />
        </div>,
      );
      const toggle = screen.getByRole("switch", { name: "Notifications" });
      await userEvent.tab();
      expect(document.activeElement).toBe(toggle.element());
      await settle();
      const style = getComputedStyle(toggle.element());
      expect(style.outlineStyle).toBe("solid");
      expect(style.outlineWidth).toBe("2px");
      expect(style.outlineColor).toBe(
        getComputedStyle(screen.getByTestId("ref").element()).outlineColor,
      );
    });
  });

  it("submits name=on with a form when checked, and nothing when unchecked", async () => {
    const screen = await render(
      <form data-testid="form">
        <Labelled label="Notifications" name="notify" />
      </form>,
    );
    const form = screen.getByTestId("form").element() as HTMLFormElement;
    expect(new FormData(form).get("notify")).toBeNull();
    const toggle = screen.getByRole("switch", { name: "Notifications" });
    await toggle.click();
    await expect.element(toggle).toHaveAttribute("aria-checked", "true");
    expect(new FormData(form).get("notify")).toBe("on");
  });

  it("merges className strings and accepts a className state function", async () => {
    const screen = await render(
      <div>
        <Labelled label="A" className="w-12" />
        <Labelled label="B" defaultChecked className={(s) => (s.checked ? "is-on" : "")} />
      </div>,
    );
    const a = screen.getByRole("switch", { name: "A" });
    await expect.element(a).toHaveClass("w-12");
    await expect.element(a).not.toHaveClass("w-11");
    await expect.element(screen.getByRole("switch", { name: "B" })).toHaveClass("is-on");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Labelled label="Off" />
        <Labelled label="On" defaultChecked />
        <Labelled label="Disabled" disabled />
        <Labelled label="Disabled on" disabled defaultChecked />
        <Field invalid>
          <FieldLabel className="flex items-center gap-2">
            <Switch />
            Invalid
          </FieldLabel>
        </Field>
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
