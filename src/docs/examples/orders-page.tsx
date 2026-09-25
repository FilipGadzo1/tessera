"use client";

import { useId, useRef, useState } from "react";
import { Badge, type BadgeColor } from "../../components/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../components/breadcrumb";
import { Button } from "../../components/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "../../components/combobox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../../components/drawer";
import { Field, FieldLabel } from "../../components/field";
import { NumberField } from "../../components/number-field";
import {
  getPaginationRange,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../../components/pagination";
import { Skeleton } from "../../components/skeleton";
import { Slider, SliderLabel, SliderValue } from "../../components/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSortButton,
} from "../../components/table";

type Status = "Paid" | "Pending" | "Refunded";

interface LineItem {
  product: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  customer: string;
  date: string;
  status: Status;
  items: LineItem[];
}

const customers = [
  "Ana Horvat",
  "Ben Carter",
  "Chloé Martin",
  "Daniel Kim",
  "Eva Novak",
  "Farah Haddad",
];

const products = [
  { product: "Linen shirt", price: 59 },
  { product: "Wool scarf", price: 34 },
  { product: "Leather boots", price: 189 },
  { product: "Canvas tote", price: 24 },
  { product: "Rain jacket", price: 129 },
  { product: "Merino socks", price: 16 },
  { product: "Denim jeans", price: 89 },
];

const statuses: Status[] = ["Paid", "Paid", "Pending", "Paid", "Refunded"];

const statusColors: Record<Status, BadgeColor> = {
  Paid: "success",
  Pending: "warning",
  Refunded: "neutral",
};

/** 36 deterministic orders: six per customer, one to three line items each. */
const initialOrders: Order[] = Array.from({ length: 36 }, (_, index) => {
  const itemCount = (index % 3) + 1;
  return {
    id: String(1001 + index),
    customer: customers[(index * 5) % customers.length] as string,
    date: `2026-09-${String(24 - Math.floor(index * 0.6)).padStart(2, "0")}`,
    status: statuses[index % statuses.length] as Status,
    items: Array.from({ length: itemCount }, (_, item) => ({
      ...(products[(index * 3 + item * 2) % products.length] as (typeof products)[number]),
      quantity: ((index + item) % 3) + 1,
    })),
  };
});

const priceMax = 1000;
const pageSize = 5;

const currency = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function totalOf(items: LineItem[]) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function formatDate(date: string) {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}

type SortDirection = "ascending" | "descending" | "none";

export interface OrdersPageProps {
  /** Shows Skeleton rows and marks the order list `aria-busy`, as while fetching. @default false */
  loading?: boolean;
}

/**
 * Example only (not exported from the library): an admin orders page composing the Phase E
 * components. A Breadcrumb locates the page; a toolbar filters by customer (Combobox) and order total
 * (range Slider); the Table sorts by Total and pages with Pagination; each row's "View" opens a
 * right Drawer with the order's line items, whose quantities are NumberFields. While `loading`,
 * Skeleton rows stand in for the orders.
 */
export function OrdersPage({ loading = false }: OrdersPageProps) {
  const headingId = useId();
  const [orders, setOrders] = useState(initialOrders);
  const [customer, setCustomer] = useState<string | null>(null);
  const [range, setRange] = useState<number[]>([0, priceMax]);
  const [sort, setSort] = useState<SortDirection>("none");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Kept after closing so the drawer's content stays put during its exit slide.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LineItem[]>([]);
  // The drawer opens from a row's button, not a DrawerTrigger, so it names the element to return
  // focus to. Without `finalFocus` Base UI returns focus to whatever was focused before opening:
  // the View button after Enter or a click in Chromium, but not where a click does not focus
  // buttons (Safari), where focus would fall back to the page. When a Save moves the order off
  // the current page (e.g. while sorted by Total), its View button unmounts; focus then goes to
  // the results status line, which says where the list now stands.
  const viewButtons = useRef(new Map<string, HTMLButtonElement>());
  const statusRef = useRef<HTMLParagraphElement>(null);

  const [min = 0, max = priceMax] = range;
  const filtered = orders.filter((order) => {
    const total = totalOf(order.items);
    return (!customer || order.customer === customer) && total >= min && total <= max;
  });
  const sorted =
    sort === "none"
      ? filtered
      : [...filtered].sort((a, b) => {
          const difference = totalOf(a.items) - totalOf(b.items);
          return sort === "ascending" ? difference : -difference;
        });
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = orders.find((order) => order.id === selectedId);

  function openDrawer(order: Order) {
    setSelectedId(order.id);
    setDraft(order.items);
    setDrawerOpen(true);
  }

  function saveDraft() {
    setOrders((current) =>
      current.map((order) => (order.id === selectedId ? { ...order, items: draft } : order)),
    );
    setDrawerOpen(false);
  }

  function goTo(next: number) {
    setPage(Math.min(Math.max(next, 1), pageCount));
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Store</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Orders</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-col gap-1">
          <h1 id={headingId} className="font-semibold text-2xl tracking-tight">
            Orders
          </h1>
          <p className="text-muted-foreground text-sm">
            Recent orders from the storefront. Filter, sort by total and open one to adjust it.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <Field className="sm:w-64">
          <FieldLabel>Customer</FieldLabel>
          <Combobox
            items={customers}
            value={customer}
            onValueChange={(value: string | null) => {
              setCustomer(value);
              setPage(1);
            }}
          >
            <ComboboxInput placeholder="All customers" showClear />
            <ComboboxContent>
              <ComboboxEmpty>No customer found.</ComboboxEmpty>
              <ComboboxList>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>
        <Slider
          className="sm:w-72"
          value={range}
          onValueChange={(value) => {
            setRange([...value]);
            setPage(1);
          }}
          min={0}
          max={priceMax}
          step={25}
          thumbLabels={["Minimum total", "Maximum total"]}
          format={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
        >
          <SliderLabel>Order total</SliderLabel>
          <SliderValue>{(formatted) => `${formatted[0]} – ${formatted[1]}`}</SliderValue>
        </Slider>
      </div>

      <section aria-label="Order list" aria-busy={loading || undefined}>
        <Table aria-labelledby={headingId}>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead sort={sort} className="text-right">
                <TableSortButton
                  direction={sort}
                  className="-mr-2 ml-0"
                  onClick={() => {
                    setSort((current) => (current === "ascending" ? "descending" : "ascending"));
                    setPage(1);
                  }}
                >
                  Total
                </TableSortButton>
              </TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: pageSize }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity.
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ms-auto h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ms-auto h-8 w-14" />
                  </TableCell>
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No orders match these filters.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium tabular-nums">#{order.id}</TableCell>
                  <TableCell className="whitespace-nowrap">{order.customer}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(order.date)}
                  </TableCell>
                  <TableCell>
                    <Badge color={statusColors[order.status]}>{order.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {currency.format(totalOf(order.items))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      ref={(element) => {
                        if (element) viewButtons.current.set(order.id, element);
                        else viewButtons.current.delete(order.id);
                      }}
                      size="sm"
                      variant="outline"
                      color="neutral"
                      aria-label={`View order #${order.id}`}
                      onClick={() => openDrawer(order)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p ref={statusRef} tabIndex={-1} className="text-muted-foreground text-sm tabular-nums">
          {loading
            ? "Loading orders…"
            : sorted.length === 0
              ? "No orders"
              : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(
                  currentPage * pageSize,
                  sorted.length,
                )} of ${sorted.length} orders`}
        </p>
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                render={<button type="button" />}
                disabled={currentPage === 1}
                onClick={() => goTo(currentPage - 1)}
              />
            </PaginationItem>
            {getPaginationRange({ page: currentPage, pageCount }).map((item) =>
              typeof item === "number" ? (
                <PaginationItem key={item}>
                  <PaginationLink
                    render={<button type="button" />}
                    isActive={item === currentPage}
                    aria-label={`Page ${item}`}
                    onClick={() => goTo(item)}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationEllipsis />
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                render={<button type="button" />}
                disabled={currentPage === pageCount}
                onClick={() => goTo(currentPage + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent
          finalFocus={() =>
            (selectedId && viewButtons.current.get(selectedId)) || statusRef.current || true
          }
        >
          {selected && (
            <>
              <DrawerHeader>
                <DrawerTitle>Order #{selected.id}</DrawerTitle>
                <DrawerDescription>
                  {selected.customer} · {formatDate(selected.date)} · {selected.status}
                </DrawerDescription>
              </DrawerHeader>
              <ul className="flex flex-col gap-4 px-4">
                {draft.map((item, index) => (
                  <li key={item.product} className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium text-sm">{item.product}</span>
                      <span className="text-muted-foreground text-sm tabular-nums">
                        {currency.format(item.price)} each
                      </span>
                    </div>
                    <div className="w-32 shrink-0">
                      <NumberField
                        aria-label={`Quantity, ${item.product}`}
                        value={item.quantity}
                        min={0}
                        max={99}
                        onValueChange={(value) =>
                          setDraft((current) =>
                            current.map((line, i) =>
                              i === index ? { ...line, quantity: value ?? 0 } : line,
                            ),
                          )
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mx-4 flex items-center justify-between border-border border-t pt-4 text-sm">
                <span className="font-medium">Total</span>
                <span className="font-medium tabular-nums">{currency.format(totalOf(draft))}</span>
              </div>
              <DrawerFooter>
                <DrawerClose render={<Button variant="outline" color="neutral" />}>
                  Cancel
                </DrawerClose>
                <Button onClick={saveDraft}>Save changes</Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
