import axe from "axe-core";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, resetEmulatedMedia, systemColor } from "../../../test/emulation";
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

  it("does not fire onClick on a disabled <a> link", async () => {
    const onClick = vi.fn();
    const screen = await render(
      <PaginationLink disabled href="#2" onClick={onClick}>
        2
      </PaginationLink>,
    );
    const link = screen.container.querySelector('[data-slot="pagination-link"]') as HTMLElement;
    expect(link.tagName).toBe("A");
    expect(link.hasAttribute("href")).toBe(false);
    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.hasAttribute("tabindex")).toBe(false);
    await userEvent.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });

  // The README recommends `render={<button type="button" />}` for client-side paging; a disabled
  // one must leave the tab order and ignore clicks like the `<a>` path does.
  it("makes a disabled <button> render element non-interactive: not tabbable, no onClick", async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const screen = await render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious render={<button type="button" />} disabled onClick={onPrevious} />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext render={<button type="button" />} onClick={onNext} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );
    const previous = screen.container.querySelector(
      '[data-slot="pagination-previous"]',
    ) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: "Go to next page" }).element();
    expect(previous.tagName).toBe("BUTTON");
    expect(previous.tabIndex).toBe(-1);
    expect(previous.getAttribute("aria-disabled")).toBe("true");
    expect(previous.hasAttribute("data-disabled")).toBe(true);
    expect(getComputedStyle(previous).opacity).toBe("0.5");
    await userEvent.tab();
    expect(document.activeElement).toBe(next);
    await userEvent.click(previous, { force: true });
    expect(onPrevious).not.toHaveBeenCalled();
    await userEvent.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  // Native `disabled` would blur a focused button the moment it disables (Chromium moves focus to
  // the body), so a keyboard user paging with Next would lose their place on the last page.
  it("keeps focus on a <button> Next that disables under the keyboard", async () => {
    function ButtonPager() {
      const [page, setPage] = useState(1);
      return (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationNext
                render={<button type="button" />}
                disabled={page === 2}
                onClick={() => setPage((current) => current + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      );
    }
    const screen = await render(<ButtonPager />);
    const next = screen.getByRole("button", { name: "Go to next page" });
    await userEvent.tab();
    expect(document.activeElement).toBe(next.element());
    await userEvent.keyboard("{Enter}");
    await expect.element(next).toHaveAttribute("aria-disabled", "true");
    expect(document.activeElement).toBe(next.element());
  });

  it("takes a disabled non-button render element (e.g. a router link) out of the tab order", async () => {
    const onClick = vi.fn();
    const screen = await render(
      <PaginationLink disabled render={<a href="/orders?page=2" onClick={onClick} />}>
        2
      </PaginationLink>,
    );
    const link = screen.container.querySelector('[data-slot="pagination-link"]') as HTMLElement;
    expect(link.hasAttribute("href")).toBe(false);
    expect(link.tabIndex).toBe(-1);
    await userEvent.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("lets callers localise Previous / Next: aria-label and visible text", async () => {
    const screen = await render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" aria-label="Zur vorherigen Seite">
              Zurück
            </PaginationPrevious>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" aria-label="Zur nächsten Seite">
              Weiter
            </PaginationNext>
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );
    const previous = screen.getByRole("link", { name: "Zur vorherigen Seite" }).element();
    const next = screen.getByRole("link", { name: "Zur nächsten Seite" }).element();
    expect(previous.textContent).toBe("Zurück");
    expect(next.textContent).toBe("Weiter");
  });

  it("keeps the default Previous / Next visible text", async () => {
    const screen = await render(<Pager page={2} />);
    expect(screen.getByRole("link", { name: "Go to previous page" }).element().textContent).toBe(
      "Previous",
    );
    expect(screen.getByRole("link", { name: "Go to next page" }).element().textContent).toBe(
      "Next",
    );
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

  it("keeps the component's data-slot even when the render element carries its own", async () => {
    const screen = await render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink render={<button type="button" data-slot="my-router-link" />}>
              4
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );
    const el = screen.getByRole("button", { name: "4" }).element();
    expect(el.getAttribute("data-slot")).toBe("pagination-link");
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

  // Forced colors replaces author backgrounds and borders with system colours, so without its own
  // treatment the active page looks exactly like the others. It takes the system "selected"
  // pairing, as the active segmented tab does (Phase D): Highlight fill, HighlightText text.
  it("marks the active page with Highlight / HighlightText in forced colors, also on hover", async () => {
    await emulateForcedColors(true);
    const screen = await render(<Pager page={2} />);
    const active = screen.getByRole("link", { name: "2" });
    const inactive = screen.getByRole("link", { name: "1" }).element();
    const highlight = systemColor("Highlight");
    const highlightText = systemColor("HighlightText");
    expect(getComputedStyle(active.element()).backgroundColor).toBe(highlight);
    expect(getComputedStyle(active.element()).color).toBe(highlightText);
    expect(getComputedStyle(inactive).backgroundColor).not.toBe(highlight);
    expect(getComputedStyle(inactive).color).not.toBe(highlightText);
    await userEvent.hover(active);
    expect(getComputedStyle(active.element()).backgroundColor).toBe(highlight);
    expect(getComputedStyle(active.element()).color).toBe(highlightText);
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
