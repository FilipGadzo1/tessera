import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Checkbox } from "../checkbox";
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

const meta = {
  title: "Components/Table",
  component: Table,
  tags: ["autodocs"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const invoices = [
  { invoice: "INV001", status: "Paid", method: "Credit Card", total: 250 },
  { invoice: "INV002", status: "Pending", method: "PayPal", total: 150 },
  { invoice: "INV003", status: "Unpaid", method: "Bank Transfer", total: 350 },
  { invoice: "INV004", status: "Paid", method: "Credit Card", total: 450 },
  { invoice: "INV005", status: "Paid", method: "PayPal", total: 550 },
];

const total = invoices.reduce((sum, invoice) => sum + invoice.total, 0);

export const Basic: Story = {
  render: () => (
    <Table>
      <TableCaption>A list of recent invoices.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.invoice}>
            <TableCell className="font-medium">{invoice.invoice}</TableCell>
            <TableCell>{invoice.status}</TableCell>
            <TableCell>{invoice.method}</TableCell>
            <TableCell className="text-right">${invoice.total.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className="text-right">${total.toFixed(2)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};

type SortDirection = "ascending" | "descending" | "none";

/** `TableSortButton` is presentational; the story owns sort state and does the sorting itself. */
function SortableTable() {
  const [direction, setDirection] = useState<SortDirection>("none");
  const sorted = [...invoices].sort((a, b) => {
    if (direction === "ascending") return a.total - b.total;
    if (direction === "descending") return b.total - a.total;
    return 0;
  });
  const nextDirection: Record<SortDirection, SortDirection> = {
    none: "ascending",
    ascending: "descending",
    descending: "none",
  };
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead sort={direction}>
            <TableSortButton
              direction={direction}
              onClick={() => setDirection(nextDirection[direction])}
            >
              Total
            </TableSortButton>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((invoice) => (
          <TableRow key={invoice.invoice}>
            <TableCell className="font-medium">{invoice.invoice}</TableCell>
            <TableCell>{invoice.status}</TableCell>
            <TableCell>${invoice.total.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Clicking the "Total" header cycles none → ascending → descending → none, sorting the rows. */
export const Sortable: Story = {
  render: () => <SortableTable />,
};

/** Row selection composed from Tessera `Checkbox`, with a header checkbox for select-all. */
function SelectableTable() {
  const [selected, setSelected] = useState<string[]>([]);
  const all = selected.length === invoices.length;
  const some = selected.length > 0 && !all;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              aria-label="Select all invoices"
              checked={all}
              indeterminate={some}
              onCheckedChange={(checked) =>
                setSelected(checked ? invoices.map((invoice) => invoice.invoice) : [])
              }
            />
          </TableHead>
          <TableHead>Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => {
          const isSelected = selected.includes(invoice.invoice);
          return (
            <TableRow key={invoice.invoice} aria-selected={isSelected}>
              <TableCell>
                <Checkbox
                  aria-label={`Select ${invoice.invoice}`}
                  checked={isSelected}
                  onCheckedChange={(checked) =>
                    setSelected((prev) =>
                      checked
                        ? [...prev, invoice.invoice]
                        : prev.filter((id) => id !== invoice.invoice),
                    )
                  }
                />
              </TableCell>
              <TableCell className="font-medium">{invoice.invoice}</TableCell>
              <TableCell>{invoice.status}</TableCell>
              <TableCell className="text-right">${invoice.total.toFixed(2)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export const Selectable: Story = {
  render: () => <SelectableTable />,
};

/** In a narrow parent, the table scrolls horizontally instead of overflowing the page. */
export const WideTableScrolling: Story = {
  render: () => (
    <div className="max-w-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Shipping address</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.invoice}>
              <TableCell className="font-medium">{invoice.invoice}</TableCell>
              <TableCell>Ada Lovelace</TableCell>
              <TableCell>{invoice.status}</TableCell>
              <TableCell>{invoice.method}</TableCell>
              <TableCell>221B Baker Street, London</TableCell>
              <TableCell>Leave at the front desk</TableCell>
              <TableCell className="text-right">${invoice.total.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};

/** A single row spanning every column communicates there is nothing to show. */
export const Empty: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
            No invoices yet.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
