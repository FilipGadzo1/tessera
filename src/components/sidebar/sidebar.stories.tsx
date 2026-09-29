import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  BarChart3,
  Box,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  type SidebarProps,
  SidebarProvider,
  type SidebarProviderProps,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from ".";

const meta = {
  title: "Components/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    // Each story is a full app shell (min-h-svh, a sticky column): give it its own frame in Docs.
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const nav = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Orders", icon: ShoppingCart, badge: "24" },
  { label: "Customers", icon: Users },
  { label: "Reports", icon: BarChart3 },
];

function Shell({
  provider,
  sidebar,
  submenus = false,
}: {
  provider?: Omit<SidebarProviderProps, "children">;
  sidebar?: Omit<SidebarProps, "children">;
  submenus?: boolean;
}) {
  return (
    <SidebarProvider {...provider}>
      <Sidebar {...sidebar}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip="Acme Inc.">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
                >
                  A
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-semibold">Acme Inc.</span>
                  <span className="text-xs text-muted-foreground">Enterprise</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Main">
            <SidebarGroup>
              <SidebarGroupLabel>Platform</SidebarGroupLabel>
              <SidebarGroupAction aria-label="New report">
                <Plus />
              </SidebarGroupAction>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map(({ label, icon: Icon, active, badge }) => (
                    <SidebarMenuItem key={label}>
                      <SidebarMenuButton
                        render={<a href={`#${label.toLowerCase()}`} />}
                        isActive={active}
                        tooltip={label}
                      >
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                      {badge && <SidebarMenuBadge>{badge}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  ))}
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#products" />} tooltip="Products">
                      <Box />
                      <span>Products</span>
                    </SidebarMenuButton>
                    {submenus && (
                      <SidebarMenuSub>
                        {["All products", "Inventory", "Categories"].map((label, index) => (
                          <SidebarMenuSubItem key={label}>
                            <SidebarMenuSubButton
                              href={`#products-${index}`}
                              isActive={index === 1}
                            >
                              <span>{label}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#settings" />} tooltip="Settings">
                      <Settings />
                      <span>Settings</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction aria-label="More settings">
                      <MoreHorizontal />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </nav>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip="Ada Lovelace">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium"
                >
                  AL
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-medium">Ada Lovelace</span>
                  <span className="text-xs text-muted-foreground">ada@acme.dev</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <Page />
      </SidebarInset>
    </SidebarProvider>
  );
}

function Page(): ReactNode {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ms-1" />
        <h1 className="text-sm font-medium">Dashboard</h1>
        <span className="ms-auto hidden text-xs text-muted-foreground sm:inline">
          Ctrl/⌘+B toggles the sidebar
        </span>
      </header>
      <div className="grid gap-4 p-4 sm:grid-cols-3">
        {["Revenue", "Orders", "Customers"].map((title) => (
          <div key={title} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">1,284</p>
          </div>
        ))}
        <div className="h-64 rounded-xl border border-border bg-card sm:col-span-3" />
      </div>
    </>
  );
}

/**
 * A bordered column that slides off-canvas. The trigger, the rail on its edge and Ctrl/⌘+B toggle
 * it; below `md` it becomes a Drawer.
 */
export const Default: Story = {
  render: () => <Shell />,
};

/** `collapsible="icon"`: collapses to a 3rem column of icons; each item shows its tooltip. */
export const IconCollapse: Story = {
  render: () => <Shell provider={{ defaultOpen: false }} sidebar={{ collapsible: "icon" }} />,
};

/** `variant="floating"`: a card inset from the viewport's edges. */
export const Floating: Story = {
  render: () => <Shell sidebar={{ variant: "floating", collapsible: "icon" }} />,
};

/** `variant="inset"`: the sidebar sits on the shell's backdrop and the page becomes a card. */
export const Inset: Story = {
  render: () => <Shell sidebar={{ variant: "inset", collapsible: "icon" }} />,
};

/** `side="right"`: the column sits after the page and its tooltips open to the left. */
export const RightSide: Story = {
  render: () => <Shell sidebar={{ side: "right", collapsible: "icon" }} />,
};

/** A `SidebarMenuSub` under Products, with an indent guide and an active sub page. */
export const WithSubmenus: Story = {
  render: () => <Shell submenus />,
};
