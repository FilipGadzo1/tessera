import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrdersPage } from "./orders-page";

/**
 * The Phase E components in one admin orders page. A Breadcrumb (Home / Store / Orders) locates
 * it; the toolbar filters by customer (a Combobox inside a Field) and by order total (a range
 * Slider with named thumbs); the Table sorts by Total (`TableSortButton` + `aria-sort` on its
 * `TableHead`) and pages with Pagination (`getPaginationRange`, `<button>` links via `render`).
 * Each row's "View" opens a right Drawer with the order's line items, whose quantities are
 * NumberFields; "Save changes" writes them back to the table, Escape or Cancel discards them.
 *
 * Toggle `loading` to see Skeleton rows stand in for the orders while the list is `aria-busy`.
 */
const meta = {
  title: "Tessera/Examples/Orders",
  component: OrdersPage,
  args: { loading: false },
  argTypes: { loading: { control: "boolean" } },
  parameters: { layout: "padded" },
} satisfies Meta<typeof OrdersPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Orders: Story = { name: "Orders" };

/** The same page while the orders are loading. */
export const Loading: Story = { args: { loading: true } };
