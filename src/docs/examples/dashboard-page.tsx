"use client";

import { Box, ChevronsUpDown, LayoutDashboard, ShoppingCart, Users } from "lucide-react";
import { type ComponentType, Fragment, useState } from "react";
import { Avatar, AvatarFallback } from "../../components/avatar";
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
import { Card, CardContent, CardHeader, CardTitle } from "../../components/card";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../../components/command";
import { DatePicker, DateRangePicker } from "../../components/date-picker";
import { Field, FieldLabel } from "../../components/field";
import { Form } from "../../components/form";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "../../components/menu";
import { Meter, MeterLabel, MeterValue } from "../../components/meter";
import { Progress, ProgressLabel, ProgressValue } from "../../components/progress";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "../../components/sidebar";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/table";
import { SearchIcon } from "../../lib/icons";

type PageId = "overview" | "orders" | "customers" | "products";

const pages: { id: PageId; label: string; icon: ComponentType; badge?: string }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "orders", label: "Orders", icon: ShoppingCart, badge: "24" },
  { id: "customers", label: "Customers", icon: Users },
  { id: "products", label: "Products", icon: Box },
];

const titleOf = (id: PageId) => pages.find((page) => page.id === id)?.label ?? "Overview";

const workspaces = ["Acme Inc.", "Globex", "Initech"];

interface Command {
  value: string;
  label: string;
  hint: string;
  page?: PageId;
}

const commands: { value: string; items: Command[] }[] = [
  {
    value: "Go to",
    items: pages.map((page) => ({
      value: `go-${page.id}`,
      label: page.label,
      hint: "Page",
      page: page.id,
    })),
  },
  {
    value: "Actions",
    items: [
      { value: "export", label: "Export orders as CSV", hint: "Orders" },
      { value: "invite", label: "Invite a teammate", hint: "Team" },
    ],
  },
];

type Status = "Paid" | "Pending" | "Refunded";
const statusColor: Record<Status, BadgeColor> = {
  Paid: "success",
  Pending: "warning",
  Refunded: "neutral",
};

const orders: { id: string; customer: string; date: string; status: Status; total: string }[] = [
  { id: "#1042", customer: "Ana Horvat", date: "2026-09-28", status: "Paid", total: "€128.00" },
  { id: "#1041", customer: "Ben Carter", date: "2026-09-27", status: "Pending", total: "€64.50" },
  { id: "#1040", customer: "Chloé Martin", date: "2026-09-25", status: "Paid", total: "€212.90" },
  { id: "#1039", customer: "Daniel Kim", date: "2026-09-21", status: "Refunded", total: "€39.00" },
  { id: "#1038", customer: "Eva Novak", date: "2026-09-18", status: "Paid", total: "€87.20" },
];

/**
 * What the filter Form reports through `onFormSubmit`, keyed by Field name: DatePicker's
 * `YYYY-MM-DD` (`""` when empty) and DateRangePicker's `{ start, end }` of the same.
 */
type Applied = {
  from: string;
  period: { start: string; end: string };
};

function summary(applied: Applied) {
  const parts: string[] = [];
  if (applied.from) parts.push(`From ${applied.from}`);
  const { start, end } = applied.period;
  if (start && end) parts.push(`Period ${start} – ${end}`);
  return parts.length ? `Filtered: ${parts.join(" · ")}` : "No filters applied";
}

function WorkspaceSwitcher({
  workspace,
  onChange,
}: {
  workspace: string;
  onChange: (w: string) => void;
}) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Menu>
          <MenuTrigger
            // No aria-label: the name is the visible text ("Acme Inc. Workspace"), WCAG 2.5.3.
            render={<SidebarMenuButton size="lg" tooltip={workspace} />}
          >
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
            >
              {workspace[0]}
            </span>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="font-semibold">{workspace}</span>
              <span className="text-xs text-muted-foreground">Workspace</span>
            </span>
            <ChevronsUpDown aria-hidden="true" className="ms-auto size-4" />
          </MenuTrigger>
          <MenuContent side="right" align="start">
            {workspaces.map((name) => (
              <MenuItem key={name} onClick={() => onChange(name)}>
                {name}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function AppSidebar({
  page,
  onNavigate,
  workspace,
  onWorkspace,
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  workspace: string;
  onWorkspace: (w: string) => void;
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <WorkspaceSwitcher workspace={workspace} onChange={onWorkspace} />
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Main">
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {pages.map(({ id, label, icon: Icon, badge }) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      render={
                        <a
                          href={`#${id}`}
                          onClick={(event) => {
                            event.preventDefault();
                            onNavigate(id);
                          }}
                        />
                      }
                      isActive={page === id}
                      tooltip={label}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                    {badge && <SidebarMenuBadge>{badge}</SidebarMenuBadge>}
                    {id === "products" && (
                      <SidebarMenuSub>
                        {["All products", "Inventory"].map((name) => (
                          <SidebarMenuSubItem key={name}>
                            <SidebarMenuSubButton
                              href="#products"
                              onClick={(event) => {
                                event.preventDefault();
                                onNavigate("products");
                              }}
                            >
                              {name}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
        <SidebarSeparator />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Menu>
              <MenuTrigger render={<SidebarMenuButton size="lg" tooltip="Ada Lovelace" />}>
                <Avatar size="sm">
                  <AvatarFallback>AL</AvatarFallback>
                </Avatar>
                <span className="flex flex-col leading-tight">
                  <span className="font-medium">Ada Lovelace</span>
                  <span className="text-xs text-muted-foreground">ada@acme.test</span>
                </span>
              </MenuTrigger>
              <MenuContent side="right" align="end">
                <MenuItem>Profile</MenuItem>
                <MenuItem>Billing</MenuItem>
                <MenuSeparator />
                <MenuItem>Sign out</MenuItem>
              </MenuContent>
            </Menu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function CommandPalette({
  open,
  onOpenChange,
  onRun,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRun: (command: Command) => void;
}) {
  return (
    // Ctrl/⌘+K opens it too; running an item closes it, and Escape clears the query before closing.
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Type to filter commands, use the arrow keys to move and Enter to run one."
      label="Search commands"
    >
      <CommandInput placeholder="Search for a command…" />
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandList>
        {commands.map((group, index) => (
          <Fragment key={group.value}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup>
              <CommandGroupLabel>{group.value}</CommandGroupLabel>
              {group.items.map((command) => (
                <CommandItem
                  key={command.value}
                  value={command.label}
                  onSelect={() => onRun(command)}
                >
                  <span className="flex-1">{command.label}</span>
                  <span className="text-xs text-muted-foreground">{command.hint}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

function Stats() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Revenue
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-2xl font-semibold">€48,200</p>
          <Progress value={64}>
            <ProgressLabel>Monthly goal</ProgressLabel>
            <ProgressValue />
          </Progress>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Orders
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-2xl font-semibold">1,042</p>
          <Progress value={82}>
            <ProgressLabel>Fulfilled</ProgressLabel>
            <ProgressValue />
          </Progress>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-2xl font-semibold">7.4 GB</p>
          <Meter value={74} color="warning">
            <MeterLabel>Used of 10 GB</MeterLabel>
            <MeterValue />
          </Meter>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Conversion
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-2xl font-semibold">3.2%</p>
          <Meter value={64}>
            <MeterLabel>Of the 5% target</MeterLabel>
            <MeterValue />
          </Meter>
        </CardContent>
      </Card>
    </div>
  );
}

function FilterRow({ onApply }: { onApply: (applied: Applied) => void }) {
  return (
    <Form<Applied>
      aria-label="Filter orders"
      className="flex flex-wrap items-end gap-4"
      onFormSubmit={onApply}
    >
      <Field name="from">
        <FieldLabel>From</FieldLabel>
        <DatePicker editable locale="en-US" />
      </Field>
      <Field name="period">
        <FieldLabel>Period</FieldLabel>
        <DateRangePicker locale="en-US" numberOfMonths={1} />
      </Field>
      <Button type="submit">Apply</Button>
    </Form>
  );
}

function RecentOrders() {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Recent orders
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption className="sr-only">The five latest orders</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-end">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.id}</TableCell>
                <TableCell>{order.customer}</TableCell>
                <TableCell>{order.date}</TableCell>
                <TableCell>
                  <Badge color={statusColor[order.status]}>{order.status}</Badge>
                </TableCell>
                <TableCell className="text-end">{order.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export interface DashboardPageProps {
  /** Whether the sidebar starts expanded. @default true */
  defaultOpen?: boolean;
}

/**
 * An app shell: a collapsible Sidebar, an inset with a top bar and a content grid. The Ctrl/⌘+B
 * shortcut stays on here because this is the only provider on the page.
 */
export function DashboardPage({ defaultOpen = true }: DashboardPageProps) {
  const [page, setPage] = useState<PageId>("overview");
  const [workspace, setWorkspace] = useState(workspaces[0] ?? "Acme Inc.");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [applied, setApplied] = useState<Applied | null>(null);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        page={page}
        onNavigate={setPage}
        workspace={workspace}
        onWorkspace={setWorkspace}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#overview">{workspace}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{titleOf(page)}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Button
            variant="outline"
            color="neutral"
            size="sm"
            aria-keyshortcuts="Control+K Meta+K"
            onClick={() => setPaletteOpen(true)}
          >
            <SearchIcon aria-hidden="true" />
            Search
          </Button>
        </header>
        <div className="flex flex-col gap-6 p-4 md:p-6">
          <h1 className="text-2xl font-semibold">{titleOf(page)}</h1>
          <Stats />
          <FilterRow onApply={setApplied} />
          {applied && (
            <p role="status">
              <Badge color="primary">{summary(applied)}</Badge>
            </p>
          )}
          <RecentOrders />
        </div>
      </SidebarInset>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onRun={(command) => {
          if (command.page) setPage(command.page);
        }}
      />
    </SidebarProvider>
  );
}
