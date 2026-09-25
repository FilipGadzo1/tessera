import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DotIcon,
  EllipsisIcon,
  MinusIcon,
  PlusIcon,
} from "./icons";

const icons = {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DotIcon,
  EllipsisIcon,
  MinusIcon,
  PlusIcon,
};

describe("icons", () => {
  for (const [name, Icon] of Object.entries(icons)) {
    it(`${name} is aria-hidden with a 24×24 viewBox`, async () => {
      const screen = await render(
        <div data-testid="wrapper">
          <Icon />
        </div>,
      );
      const svg = screen.getByTestId("wrapper").element().querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    });

    it(`${name} forwards className onto the svg`, async () => {
      const screen = await render(
        <div data-testid="wrapper">
          <Icon className="size-4 text-danger" />
        </div>,
      );
      const svg = screen.getByTestId("wrapper").element().querySelector("svg");
      expect(svg?.getAttribute("class")).toBe("size-4 text-danger");
    });

    it(`${name} forwards arbitrary svg props (e.g. data-slot)`, async () => {
      const screen = await render(
        <div data-testid="wrapper">
          <Icon data-slot="my-icon" />
        </div>,
      );
      const svg = screen.getByTestId("wrapper").element().querySelector("svg");
      expect(svg?.getAttribute("data-slot")).toBe("my-icon");
    });
  }

  it("CloseIcon renders two crossing paths", async () => {
    const screen = await render(<CloseIcon />);
    const paths = screen.container.querySelectorAll("path");
    expect(paths.length).toBe(2);
  });

  it("EllipsisIcon and DotIcon are filled (no stroke)", async () => {
    const ellipsis = await render(<EllipsisIcon />);
    const ellipsisSvg = ellipsis.container.querySelector("svg");
    expect(ellipsisSvg?.getAttribute("fill")).toBe("currentColor");
    expect(ellipsisSvg?.getAttribute("stroke")).toBeNull();

    const dot = await render(<DotIcon />);
    const dotSvg = dot.container.querySelector("svg");
    expect(dotSvg?.getAttribute("fill")).toBe("currentColor");
    expect(dotSvg?.getAttribute("stroke")).toBeNull();
  });
});
