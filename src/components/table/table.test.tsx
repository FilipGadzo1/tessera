import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulatedMedia,
  systemColor,
} from "../../../test/emulation";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableSortButton,
} from "./table";

function Invoices() {
  return (
    <Table>
      <TableCaption>A list of recent invoices.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>
            <TableSortButton direction="ascending">Total</TableSortButton>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>INV001</TableCell>
          <TableCell>$250.00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>INV002</TableCell>
          <TableCell>$150.00</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell>$400.00</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

afterEach(async () => {
  await resetEmulatedMedia();
});

describe("Table", () => {
  it("renders a table/thead/tbody/tfoot structure with data-slot on every part", async () => {
    const screen = await render(<Invoices />);
    expect(screen.container.querySelector('[data-slot="table-container"]')?.tagName).toBe("DIV");
    expect(screen.container.querySelector('[data-slot="table"]')?.tagName).toBe("TABLE");
    expect(screen.container.querySelector('[data-slot="table-header"]')?.tagName).toBe("THEAD");
    expect(screen.container.querySelector('[data-slot="table-body"]')?.tagName).toBe("TBODY");
    expect(screen.container.querySelector('[data-slot="table-footer"]')?.tagName).toBe("TFOOT");
    expect(screen.container.querySelector('[data-slot="table-caption"]')?.tagName).toBe("CAPTION");
    const rows = screen.container.querySelectorAll('[data-slot="table-row"]');
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row.tagName).toBe("TR");
    const heads = screen.container.querySelectorAll('[data-slot="table-head"]');
    expect(heads).toHaveLength(2);
    for (const head of heads) expect(head.tagName).toBe("TH");
    const cells = screen.container.querySelectorAll('[data-slot="table-cell"]');
    expect(cells).toHaveLength(6);
    for (const cell of cells) expect(cell.tagName).toBe("TD");
  });

  // DataTable names its parts with its own slots (spec Phase K §7); the defaults stay unchanged.
  it("renders each part's default data-slot and lets a passed data-slot replace it", async () => {
    const parts = (slot?: (name: string) => string) => {
      const s = (name: string) => (slot ? { "data-slot": slot(name) } : {});
      return (
        <Table {...s("table")}>
          <TableHeader {...s("table-header")}>
            <TableRow {...s("table-row")}>
              <TableHead {...s("table-head")}>
                <TableSortButton {...s("table-sort-button")}>Total</TableSortButton>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody {...s("table-body")}>
            <TableRow {...s("table-row")}>
              <TableCell {...s("table-cell")}>1</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter {...s("table-footer")}>
            <TableRow {...s("table-row")}>
              <TableCell {...s("table-cell")}>1</TableCell>
            </TableRow>
          </TableFooter>
          <TableCaption {...s("table-caption")}>Totals</TableCaption>
        </Table>
      );
    };
    const tags = {
      table: "TABLE",
      "table-header": "THEAD",
      "table-body": "TBODY",
      "table-footer": "TFOOT",
      "table-caption": "CAPTION",
      "table-row": "TR",
      "table-head": "TH",
      "table-cell": "TD",
      "table-sort-button": "BUTTON",
    };
    const defaults = await render(parts());
    for (const [name, tag] of Object.entries(tags)) {
      expect(defaults.container.querySelector(`[data-slot="${name}"]`)?.tagName).toBe(tag);
    }
    const custom = await render(parts((name) => `custom-${name}`));
    for (const [name, tag] of Object.entries(tags)) {
      expect(custom.container.querySelector(`[data-slot="custom-${name}"]`)?.tagName).toBe(tag);
      expect(custom.container.querySelector(`[data-slot="${name}"]`)).toBeNull();
    }
    // The scroll container keeps its own slot.
    expect(custom.container.querySelector('[data-slot="table-container"]')?.tagName).toBe("DIV");
  });

  it("scopes TableHead columns by default and lets callers override", async () => {
    const screen = await render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead scope="row">Total</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    const heads = screen.container.querySelectorAll('[data-slot="table-head"]');
    expect(heads[0]?.getAttribute("scope")).toBe("col");
    expect(heads[1]?.getAttribute("scope")).toBe("row");
  });

  it("omits aria-sort when sort is undefined and sets it when given", async () => {
    const screen = await render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead sort="descending">Total</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    const heads = screen.container.querySelectorAll('[data-slot="table-head"]');
    expect(heads[0]?.hasAttribute("aria-sort")).toBe(false);
    expect(heads[1]?.getAttribute("aria-sort")).toBe("descending");
  });

  it("renders a distinct icon per TableSortButton direction", async () => {
    const { container: ascending } = await render(<TableSortButton direction="ascending" />);
    const { container: descending } = await render(<TableSortButton direction="descending" />);
    const { container: none } = await render(<TableSortButton direction="none" />);
    const icons = [ascending, descending, none].map(
      (c) => c.querySelector('[data-slot="table-sort-button"] svg')?.outerHTML,
    );
    expect(new Set(icons).size).toBe(3);
    for (const c of [ascending, descending, none]) {
      const svg = c.querySelector('[data-slot="table-sort-button"] svg');
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("passes through props and merges className", async () => {
    const screen = await render(<TableSortButton className="max-w-40">Total</TableSortButton>);
    const button = screen.getByRole("button", { name: /Total/ });
    await expect.element(button).toHaveClass("max-w-40");
    await expect.element(button).toHaveClass("cursor-pointer");
    await expect.element(button).toHaveAttribute("type", "button");
  });

  it("keeps a wide table's horizontal scroll inside its container", async () => {
    const screen = await render(
      <div style={{ width: "200px" }}>
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 20 }, (_, i) => `Column ${i}`).map((label) => (
                <TableHead key={label}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
      </div>,
    );
    const outer = screen.container.querySelector("div");
    const scrollContainer = screen.container.querySelector(
      '[data-slot="table-container"]',
    ) as HTMLElement;
    expect(scrollContainer.className).toContain("overflow-x-auto");
    // The scroll container's own box stays within its parent's width; the overflow is contained,
    // not pushed onto the page (scrollWidth of the parent must not grow past what it was given).
    expect(outer?.scrollWidth).toBeLessThanOrEqual(200);
  });

  it("shows a solid 2px outline on Tab focus of a sort button, none before", async () => {
    const screen = await render(<TableSortButton>Total</TableSortButton>);
    const button = screen.getByRole("button", { name: /Total/ }).element();
    expect(getComputedStyle(button).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    const style = getComputedStyle(button);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it("shows no permanent outline in forced colors, only on focus", async () => {
    await emulateForcedColors(true);
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const screen = await render(<TableSortButton>Total</TableSortButton>);
    const button = screen.getByRole("button", { name: /Total/ }).element();
    expect(getComputedStyle(button).outlineStyle).toBe("none");
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    const style = getComputedStyle(button);
    expect(style.outlineStyle).toBe("solid");
    expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(1);
  });

  // Spec Phase K §7: headers and the sort button's hang follow the inline direction.
  it.each(["ltr", "rtl"] as const)(
    "%s: a header starts at the inline start and the sort button hangs into its start padding",
    async (dir) => {
      const screen = await render(
        <div dir={dir} style={{ width: 400 }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>
                  <TableSortButton>Total</TableSortButton>
                </TableHead>
              </TableRow>
            </TableHeader>
          </Table>
        </div>,
      );
      const [plain, sorted] = screen.container.querySelectorAll<HTMLElement>(
        '[data-slot="table-head"]',
      );
      if (!plain || !sorted) throw new Error("heads missing");
      const button = sorted.querySelector("button") as HTMLElement;
      const box = plain.getBoundingClientRect();
      const text = plain.firstChild as Text;
      const range = document.createRange();
      range.selectNodeContents(text);
      const textBox = range.getBoundingClientRect();
      const sortedBox = sorted.getBoundingClientRect();
      const buttonBox = button.getBoundingClientRect();
      if (dir === "ltr") {
        expect(textBox.left - box.left).toBeCloseTo(12, 0);
        expect(buttonBox.left - sortedBox.left).toBeCloseTo(4, 0);
      } else {
        expect(box.right - textBox.right).toBeCloseTo(12, 0);
        expect(sortedBox.right - buttonBox.right).toBeCloseTo(4, 0);
      }
    },
  );

  it("forced colors: the sort button's focus ring is Highlight", async () => {
    await emulateForcedColors(true);
    const screen = await render(<TableSortButton>Total</TableSortButton>);
    const button = screen.getByRole("button", { name: /Total/ }).element();
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    expect(getComputedStyle(button).outlineColor).toBe(systemColor("Highlight"));
  });

  it("reduced motion: the sort button has no transition", async () => {
    const screen = await render(<TableSortButton>Total</TableSortButton>);
    const button = screen.getByRole("button", { name: /Total/ }).element();
    expect(getComputedStyle(button).transitionProperty).toBe(
      "color, background-color, outline-color",
    );
    await emulateReducedMotion(true);
    expect(getComputedStyle(button).transitionProperty).toBe("none");
  });

  // A bare `border-t` takes `currentColor` (Tessera sets no default border colour), which would
  // draw the footer rule in the text colour instead of the rows' `border-border`.
  it("draws the footer's top border in the row border colour, not currentColor", async () => {
    const screen = await render(<Invoices />);
    const footer = screen.container.querySelector('[data-slot="table-footer"]') as HTMLElement;
    const bodyRow = screen.container.querySelector(
      '[data-slot="table-body"] [data-slot="table-row"]',
    ) as HTMLElement;
    const style = getComputedStyle(footer);
    expect(style.borderTopStyle).toBe("solid");
    expect(style.borderTopColor).toBe(getComputedStyle(bodyRow).borderBottomColor);
    expect(style.borderTopColor).not.toBe(style.color);
  });

  // Forced colors replaces the muted selected background with Canvas, so a selected row would look
  // like every other row; it takes the system "selected" pairing instead, also on hover.
  //
  // *Amended (Task 6 fix round 1, see design-system-v2 spec §4)*: Chromium paints a Canvas-coloured
  // text backplate behind text under forced colors whenever `forced-color-adjust` is `auto` (the
  // default), even when the text's colour is already the explicit system colour `HighlightText` —
  // the backplate sits on top of the `Highlight` fill and hides the glyph. `getComputedStyle`'s
  // `background-color`/`color` checks below cannot detect this (it is a paint-time effect, not a
  // CSS property change), so `forced-color-adjust` itself is checked too, on the row and (since
  // `forced-color-adjust` inherits) on its cell's own text.
  it.each([
    ["aria-selected", { "aria-selected": true }],
    ['data-state="selected"', { "data-state": "selected" }],
  ] as const)(
    "marks a %s row with Highlight / HighlightText in forced colors",
    async (_, attrs) => {
      await emulateForcedColors(true);
      const screen = await render(
        <Table>
          <TableBody>
            <TableRow {...attrs}>
              <TableCell>Selected</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Other</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      const [selected, other] =
        screen.container.querySelectorAll<HTMLElement>('[data-slot="table-row"]');
      if (!selected || !other) throw new Error("rows missing");
      const selectedCell = selected.querySelector<HTMLElement>('[data-slot="table-cell"]');
      const otherCell = other.querySelector<HTMLElement>('[data-slot="table-cell"]');
      if (!selectedCell || !otherCell) throw new Error("cells missing");
      const highlight = systemColor("Highlight");
      const highlightText = systemColor("HighlightText");
      expect(getComputedStyle(selected).backgroundColor).toBe(highlight);
      expect(getComputedStyle(selected).color).toBe(highlightText);
      expect(getComputedStyle(selected).forcedColorAdjust).toBe("none");
      expect(getComputedStyle(selectedCell).forcedColorAdjust).toBe("none");
      expect(getComputedStyle(other).backgroundColor).not.toBe(highlight);
      expect(getComputedStyle(other).color).not.toBe(highlightText);
      expect(getComputedStyle(other).forcedColorAdjust).toBe("auto");
      expect(getComputedStyle(otherCell).forcedColorAdjust).toBe("auto");
      await userEvent.hover(selected);
      expect(getComputedStyle(selected).backgroundColor).toBe(highlight);
      expect(getComputedStyle(selected).color).toBe(highlightText);
    },
  );

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div
        className={
          theme === "dark"
            ? "dark bg-background p-4 text-foreground"
            : "bg-background p-4 text-foreground"
        }
      >
        <Invoices />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
