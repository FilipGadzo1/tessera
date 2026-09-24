import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia } from "../../../test/emulation";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./pagination";

function Pager({ page }: { page: number }) {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" disabled={page === 1} />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#1" isActive={page === 1}>
            1
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#2" isActive={page === 2}>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" disabled={page === 3} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

afterEach(async () => {
  await resetEmulatedMedia();
});

describe("Pagination", () => {
  it("is a nav landmark named Pagination by default", async () => {
    const screen = await render(<Pager page={1} />);
    await expect
      .element(screen.getByRole("navigation", { name: "Pagination" }))
      .toHaveAttribute("data-slot", "pagination");
  });

  it("renders a ul/li structure with data-slot on every part", async () => {
    const screen = await render(<Pager page={1} />);
    expect(screen.container.querySelector('[data-slot="pagination-content"]')?.tagName).toBe("UL");
    const items = screen.container.querySelectorAll('[data-slot="pagination-item"]');
    expect(items).toHaveLength(5);
    for (const item of items) expect(item.tagName).toBe("LI");
  });

  it("marks the active link with aria-current=page", async () => {
    const screen = await render(<Pager page={2} />);
    await expect
      .element(screen.getByRole("link", { name: "2" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "1" }).element().hasAttribute("aria-current")).toBe(
      false,
    );
  });

  it("names previous/next Go to previous/next page", async () => {
    const screen = await render(<Pager page={2} />);
    await expect
      .element(screen.getByRole("link", { name: "Go to previous page" }))
      .toBeInTheDocument();
    await expect.element(screen.getByRole("link", { name: "Go to next page" })).toBeInTheDocument();
  });

  it("disables previous at the start and next at the end: aria-disabled, no href", async () => {
    // A disabled link has no `href`, so it has no implicit link role — queried by data-slot.
    const start = await render(<Pager page={1} />);
    const previous = start.container.querySelector('[data-slot="pagination-previous"]');
    expect(previous?.getAttribute("aria-label")).toBe("Go to previous page");
    expect(previous?.getAttribute("aria-disabled")).toBe("true");
    expect(previous?.hasAttribute("data-disabled")).toBe(true);
    expect(previous?.hasAttribute("href")).toBe(false);
    const next = start.getByRole("link", { name: "Go to next page" }).element();
    expect(next.hasAttribute("aria-disabled")).toBe(false);
    expect(next.getAttribute("href")).toBe("#");
  });

  it("hides the ellipsis from assistive technology with visible sr text", async () => {
    const screen = await render(<Pager page={1} />);
    const ellipsis = screen.container.querySelector('[data-slot="pagination-ellipsis"]');
    expect(ellipsis?.getAttribute("aria-hidden")).toBe("true");
    expect(ellipsis?.querySelector("svg")).not.toBeNull();
    expect(ellipsis?.querySelector(".sr-only")?.textContent).toBe("More pages");
  });

  it("clones onto a render element instead of an <a>", async () => {
    const screen = await render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink render={<button type="button" className="my-router-link" />}>
              3
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );
    const el = screen.getByRole("button", { name: "3" }).element();
    expect(el.tagName).toBe("BUTTON");
    expect(el.getAttribute("data-slot")).toBe("pagination-link");
    expect(el.classList).toContain("my-router-link");
    expect(el.classList).toContain("cursor-pointer");
  });

  it("passes through props and merges className on PaginationLink", async () => {
    const screen = await render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#1" className="max-w-40">
              1
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );
    const link = screen.getByRole("link", { name: "1" });
    await expect.element(link).toHaveClass("max-w-40");
    await expect.element(link).toHaveClass("cursor-pointer");
  });

  it("shows a solid 2px outline on Tab focus of a link, none before", async () => {
    // page 1: PaginationPrevious is disabled (no href), so Tab from the body lands on link "1".
    const screen = await render(<Pager page={1} />);
    const link = screen.getByRole("link", { name: "1" }).element();
    expect(getComputedStyle(link).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(link);
    const style = getComputedStyle(link);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it("shows no permanent outline in forced colors, only on focus", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(<Pager page={1} />);
    const link = screen.getByRole("link", { name: "1" }).element();
    expect(getComputedStyle(link).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(link);
    const style = getComputedStyle(link);
    expect(style.outlineStyle).toBe("solid");
    expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(1);
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Pager page={2} />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
