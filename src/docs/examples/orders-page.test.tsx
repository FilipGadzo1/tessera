import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { OrdersPage } from "./orders-page";

const region = () => page.getByRole("region", { name: "Order list" });
const bodyRows = () => [
  ...document.querySelectorAll<HTMLTableRowElement>('[data-slot="table-body"] > tr'),
];
/** The "Total" column (5th) of every visible order row. */
const totals = () => bodyRows().map((row) => row.cells[4]?.textContent);
const customersShown = () => bodyRows().map((row) => row.cells[1]?.textContent);
const drawer = () => document.querySelector<HTMLElement>('[data-slot="drawer-content"]');

async function tabTo(element: Element, key: "{Tab}" | "{Shift>}{Tab}{/Shift}" = "{Tab}") {
  for (let i = 0; i < 30 && document.activeElement !== element; i++) await userEvent.keyboard(key);
  expect(document.activeElement).toBe(element);
}

// A desktop-width viewport: the admin page's intended layout. At the default 414px the table
// scrolls horizontally and axe cannot compute the contrast of cells scrolled out of view.
beforeEach(async () => {
  await page.viewport(1024, 768);
});

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("OrdersPage example", () => {
  it("renders the breadcrumb, the first page of orders and the pager", async () => {
    await render(<OrdersPage />);
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect.element(breadcrumb.getByRole("link", { name: "Home" })).toBeVisible();
    await expect.element(breadcrumb.getByRole("link", { name: "Store" })).toBeVisible();
    await expect.element(breadcrumb.getByText("Orders")).toHaveAttribute("aria-current", "page");
    await expect.element(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
    await expect.element(page.getByRole("table", { name: "Orders" })).toBeVisible();
    expect(bodyRows()).toHaveLength(5);
    await expect.element(page.getByText("Showing 1–5 of 36 orders")).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Page 1" }))
      .toHaveAttribute("aria-current", "page");
    await expect
      .element(page.getByRole("button", { name: "Go to previous page" }))
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(page.getByRole("slider", { name: "Minimum total" })).toBeVisible();
    await expect.element(page.getByRole("slider", { name: "Maximum total" })).toBeVisible();
    expect(region().element().hasAttribute("aria-busy")).toBe(false);
  });

  it("filters, sorts, pages and edits an order with the keyboard only", async () => {
    await render(<OrdersPage />);

    // Combobox: type to filter the customers, ArrowDown + Enter picks Ben Carter.
    const customer = page.getByRole("combobox", { name: "Customer" });
    await tabTo(customer.element());
    await userEvent.keyboard("Ben");
    await expect.element(page.getByRole("option", { name: "Ben Carter" })).toBeVisible();
    await waitForPopupSettled(
      document.querySelector('[data-slot="combobox-content"]') as HTMLElement,
    );
    await userEvent.keyboard("{ArrowDown}");
    await expect
      .element(page.getByRole("option", { name: "Ben Carter" }))
      .toHaveAttribute("data-highlighted");
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("listbox")).not.toBeInTheDocument();
    await expect.poll(customersShown).toEqual(Array(5).fill("Ben Carter"));
    await expect.element(page.getByText("Showing 1–5 of 6 orders")).toBeVisible();

    // Sort by Total: aria-sort flips from none to ascending to descending and back.
    const totalHead = page.getByRole("columnheader", { name: "Total" });
    const sortButton = page.getByRole("button", { name: "Total" });
    await expect.element(totalHead).toHaveAttribute("aria-sort", "none");
    await tabTo(sortButton.element());
    await userEvent.keyboard("{Enter}");
    await expect.element(totalHead).toHaveAttribute("aria-sort", "ascending");
    expect(totals()).toEqual(["€158.00", "€206.00", "€349.00", "€485.00", "€624.00"]);
    await userEvent.keyboard("{Enter}");
    await expect.element(totalHead).toHaveAttribute("aria-sort", "descending");
    expect(totals()[0]).toBe("€874.00");
    await userEvent.keyboard("{Enter}");
    await expect.element(totalHead).toHaveAttribute("aria-sort", "ascending");

    // Pagination: page 2 holds the sixth (most expensive) order.
    const pageTwo = page.getByRole("button", { name: "Page 2" });
    await tabTo(pageTwo.element());
    await userEvent.keyboard("{Enter}");
    await expect.element(pageTwo).toHaveAttribute("aria-current", "page");
    await expect.poll(totals).toEqual(["€874.00"]);
    await expect
      .element(page.getByRole("button", { name: "Go to next page" }))
      .toHaveAttribute("aria-disabled", "true");

    // Drawer: open the row's View button, Tab to the first quantity, ArrowUp adds one.
    const view = page.getByRole("button", { name: "View order #1018" });
    await tabTo(view.element(), "{Shift>}{Tab}{/Shift}");
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("dialog", { name: "Order #1018" })).toBeVisible();
    await waitForPopupSettled(drawer() as HTMLElement);
    expect(drawer()?.contains(document.activeElement)).toBe(true);
    const boots = page.getByRole("textbox", { name: "Quantity, Leather boots" });
    await tabTo(boots.element());
    await expect.element(boots).toHaveValue("3");
    await userEvent.keyboard("{ArrowUp}");
    await expect.element(boots).toHaveValue("4");
    await expect
      .element(page.getByRole("dialog").getByText("€1,063.00", { exact: true }))
      .toBeVisible();

    // Escape closes the drawer (discarding the draft) and returns focus to the View button.
    await userEvent.keyboard("{Escape}");
    await expect.poll(drawer).toBeNull();
    await expect.poll(() => document.activeElement).toBe(view.element());
    expect(totals()).toEqual(["€874.00"]);
  });

  it("saves quantity changes back to the table", async () => {
    await render(<OrdersPage />);
    await userEvent.click(page.getByRole("button", { name: "View order #1001" }));
    const shirt = page.getByRole("textbox", { name: "Quantity, Linen shirt" });
    await expect.element(shirt).toHaveValue("1");
    await userEvent.fill(shirt, "2");
    await userEvent.click(page.getByRole("button", { name: "Save changes" }));
    await expect.poll(drawer).toBeNull();
    expect(totals()[0]).toBe("€118.00");
  });

  it("after a Save moves the order off the page, focus lands on the results status, not the body", async () => {
    await render(<OrdersPage />);
    await userEvent.click(page.getByRole("button", { name: "Total" }));
    await expect.poll(() => totals()[0]).toBe("€16.00");
    await userEvent.click(page.getByRole("button", { name: "View order #1019" }));
    const socks = page.getByRole("textbox", { name: "Quantity, Merino socks" });
    await userEvent.fill(socks, "10");
    await userEvent.click(page.getByRole("button", { name: "Save changes" }));
    await expect.poll(drawer).toBeNull();
    // €160.00 now sorts after page 1's last total (€59.00), so the row and its View button are gone.
    expect(page.getByRole("button", { name: "View order #1019" }).elements()).toHaveLength(0);
    await expect
      .poll(() => document.activeElement)
      .toBe(page.getByText("Showing 1–5 of 36 orders").element());
  });

  it("narrows the orders with the total range slider", async () => {
    await render(<OrdersPage />);
    const maximum = page.getByRole("slider", { name: "Maximum total" });
    (maximum.element() as HTMLElement).focus();
    // Home on the upper thumb moves it down to the lower thumb's value (0): nothing matches.
    await userEvent.keyboard("{Home}");
    await expect.element(page.getByText("No orders match these filters.")).toBeVisible();
    await expect.element(page.getByText("No orders", { exact: true })).toBeVisible();
  });

  it("while loading, shows Skeleton rows and marks the order list aria-busy", async () => {
    await render(<OrdersPage loading />);
    await expect.element(region()).toHaveAttribute("aria-busy", "true");
    expect(bodyRows()).toHaveLength(5);
    const skeletons = region().element().querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(30);
    for (const skeleton of skeletons) expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    await expect.element(page.getByText("Loading orders…")).toBeVisible();
    expect(page.getByRole("button", { name: /^View order/ }).elements()).toHaveLength(0);
  });

  describe.each(["light", "dark"] as const)("axe (%s)", (theme) => {
    it.each([
      ["with the drawer closed", false],
      ["while loading", true],
    ] as const)("has no violations %s", async (_name, loading) => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      try {
        await render(
          <div className="bg-background p-4">
            <OrdersPage loading={loading} />
          </div>,
        );
        // Skeletons pulse forever; otherwise wait for every transition to finish.
        if (!loading) await expect.poll(() => document.getAnimations().length).toBe(0);
        const { violations, incomplete } = await auditOpenOverlay();
        expect(violations).toEqual([]);
        expect(incomplete).toEqual([]);
      } finally {
        document.documentElement.classList.remove("dark");
      }
    });

    it("has no violations with the drawer open", async () => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      try {
        await render(
          <div className="bg-background p-4">
            <OrdersPage />
          </div>,
        );
        await userEvent.click(page.getByRole("button", { name: "View order #1003" }));
        await expect.element(page.getByRole("dialog", { name: "Order #1003" })).toBeVisible();
        await waitForPopupSettled(drawer() as HTMLElement);
        await expect.poll(() => document.getAnimations().length).toBe(0);
        const { violations, incomplete } = await auditOpenOverlay();
        expect(violations).toEqual([]);
        expect(incomplete).toEqual([]);
      } finally {
        document.documentElement.classList.remove("dark");
      }
    });
  });
});
