import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia } from "../../../test/emulation";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";

function Trail() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/store">Store</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Orders</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

afterEach(async () => {
  await resetEmulatedMedia();
});

describe("Breadcrumb", () => {
  it("is a nav landmark named Breadcrumb by default", async () => {
    const screen = await render(<Trail />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    await expect.element(nav).toHaveAttribute("data-slot", "breadcrumb");
  });

  it("overrides the landmark name", async () => {
    const screen = await render(
      <Breadcrumb aria-label="You are here">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Orders</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    await expect.element(screen.getByRole("navigation", { name: "You are here" })).toBeVisible();
  });

  it("renders an ol/li structure with data-slot on every part", async () => {
    const screen = await render(<Trail />);
    const list = screen.container.querySelector('[data-slot="breadcrumb-list"]');
    expect(list?.tagName).toBe("OL");
    const items = screen.container.querySelectorAll('[data-slot="breadcrumb-item"]');
    expect(items).toHaveLength(3);
    for (const item of items) expect(item.tagName).toBe("LI");
    expect(screen.container.querySelector('[data-slot="breadcrumb-link"]')?.tagName).toBe("A");
    expect(screen.container.querySelector('[data-slot="breadcrumb-page"]')?.tagName).toBe("SPAN");
    expect(screen.container.querySelector('[data-slot="breadcrumb-separator"]')?.tagName).toBe(
      "LI",
    );
  });

  it("marks the current page with aria-current and no href", async () => {
    const screen = await render(<Trail />);
    const page1 = screen.getByText("Orders");
    await expect.element(page1).toHaveAttribute("aria-current", "page");
    expect(page1.element().tagName).toBe("SPAN");
  });

  it("hides separators from assistive technology", async () => {
    const screen = await render(<Trail />);
    const separators = screen.container.querySelectorAll('[data-slot="breadcrumb-separator"]');
    expect(separators).toHaveLength(2);
    for (const separator of separators) {
      expect(separator.getAttribute("role")).toBe("presentation");
      expect(separator.getAttribute("aria-hidden")).toBe("true");
    }
    expect(separators[0]?.querySelector("svg")).not.toBeNull();
  });

  it("overrides the default separator with children", async () => {
    const screen = await render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>Orders</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    const separator = screen.container.querySelector('[data-slot="breadcrumb-separator"]');
    expect(separator?.textContent).toBe("/");
  });

  it("renders BreadcrumbEllipsis hidden from AT with visually-hidden text", async () => {
    const screen = await render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    const ellipsis = screen.container.querySelector('[data-slot="breadcrumb-ellipsis"]');
    expect(ellipsis?.getAttribute("role")).toBe("presentation");
    expect(ellipsis?.getAttribute("aria-hidden")).toBe("true");
    expect(ellipsis?.querySelector("svg")).not.toBeNull();
    expect(ellipsis?.querySelector(".sr-only")?.textContent).toBe("More");
  });

  it("clones onto a render element instead of an <a>, merging classes", async () => {
    const screen = await render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              className="text-primary"
              render={<button type="button" className="my-router-link" />}
            >
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    const el = screen.getByRole("button", { name: "Home" }).element();
    expect(el.tagName).toBe("BUTTON");
    expect(el.getAttribute("data-slot")).toBe("breadcrumb-link");
    expect(el.classList).toContain("my-router-link");
    expect(el.classList).toContain("text-primary");
    expect(el.classList).toContain("cursor-pointer");
  });

  it("passes through props and merges className on BreadcrumbLink", async () => {
    const screen = await render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/" className="max-w-40">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    const link = screen.getByRole("link", { name: "Home" });
    await expect.element(link).toHaveAttribute("href", "/");
    await expect.element(link).toHaveClass("max-w-40");
    await expect.element(link).toHaveClass("cursor-pointer");
  });

  it("shows a solid 2px outline on Tab focus of a link, none before", async () => {
    const screen = await render(<Trail />);
    const home = screen.getByRole("link", { name: "Home" }).element();
    expect(getComputedStyle(home).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(home);
    const style = getComputedStyle(home);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it("shows no permanent outline in forced colors, only on focus", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(<Trail />);
    const home = screen.getByRole("link", { name: "Home" }).element();
    expect(getComputedStyle(home).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(home);
    const style = getComputedStyle(home);
    expect(style.outlineStyle).toBe("solid");
    expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(1);
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/store">Store</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Orders</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
