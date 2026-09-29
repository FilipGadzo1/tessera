import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, forwardRef, useState } from "react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "./navigation-menu";

const meta = {
  title: "Components/NavigationMenu",
  component: NavigationMenu,
  tags: ["autodocs"],
  args: { "aria-label": "Main" },
  parameters: { layout: "padded" },
} satisfies Meta<typeof NavigationMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

const products = [
  { href: "#analytics", title: "Analytics", description: "Dashboards, funnels and retention." },
  { href: "#billing", title: "Billing", description: "Invoices, plans and usage-based pricing." },
  { href: "#automations", title: "Automations", description: "Workflows triggered by events." },
  { href: "#integrations", title: "Integrations", description: "Connect Slack, GitHub and more." },
];

const resources = [
  { href: "#docs", title: "Documentation", description: "Guides and API reference." },
  { href: "#changelog", title: "Changelog", description: "What shipped this month." },
  { href: "#status", title: "System status", description: "Uptime and incidents." },
];

function LinkCard({ href, title, description }: (typeof products)[number]) {
  return (
    <NavigationMenuLink href={href}>
      <span className="block font-medium">{title}</span>
      <span className="mt-1 block text-muted-foreground">{description}</span>
    </NavigationMenuLink>
  );
}

/**
 * A site header: two panels and a plain link. Hover or click a trigger; with a panel open, moving
 * to the other trigger switches panels, and the popup animates to the new panel's size while the
 * content slides in from that side. Tab reaches each trigger and link; Enter, Space or ArrowDown
 * opens a panel and Tab moves into it; Escape closes it and returns focus.
 */
export const SiteHeader: Story = {
  render: (args) => (
    <NavigationMenu {...args}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Products</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-1 sm:grid-cols-2">
              {products.map((item) => (
                <li key={item.href}>
                  <LinkCard {...item} />
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
          <NavigationMenuContent className="sm:w-80">
            <ul className="flex flex-col gap-1">
              {resources.map((item) => (
                <li key={item.href}>
                  <LinkCard {...item} />
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#pricing">Pricing</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};

/**
 * Links only, no panels: a flat navigation bar. Links directly in the list are sized like triggers;
 * `active` marks the current page (`aria-current="page"`) with an underline.
 */
export const LinkList: Story = {
  render: (args) => {
    const [current, setCurrent] = useState("#overview");
    const pages = [
      ["#overview", "Overview"],
      ["#activity", "Activity"],
      ["#settings", "Settings"],
    ] as const;
    return (
      <NavigationMenu {...args}>
        <NavigationMenuList>
          {pages.map(([href, label]) => (
            <NavigationMenuItem key={href}>
              <NavigationMenuLink
                href={href}
                active={current === href}
                onClick={() => setCurrent(href)}
              >
                {label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    );
  },
};

const audiences = [
  {
    value: "teams",
    label: "Teams",
    links: [
      { href: "#planning", title: "Planning", description: "Roadmaps and sprints in one place." },
      { href: "#docs-hub", title: "Docs hub", description: "Specs next to the work." },
    ],
  },
  {
    value: "enterprise",
    label: "Enterprise",
    links: [
      { href: "#security", title: "Security", description: "SSO, SCIM and audit logs." },
      { href: "#compliance", title: "Compliance", description: "SOC 2, ISO 27001 and GDPR." },
      { href: "#support", title: "Premium support", description: "A named engineer, 24/7." },
    ],
  },
  {
    value: "startups",
    label: "Startups",
    links: [{ href: "#program", title: "Startup program", description: "A year free, on us." }],
  },
];

/**
 * A `NavigationMenu` inside a panel is an inline submenu: a vertical list of sub-triggers on the
 * left and their content beside it, in the same popup. `defaultValue` shows a sub-panel at once.
 */
export const NestedInlineSubmenu: Story = {
  render: (args) => (
    <NavigationMenu {...args}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Solutions</NavigationMenuTrigger>
          <NavigationMenuContent className="p-2">
            <NavigationMenu orientation="vertical" defaultValue="teams">
              <NavigationMenuList className="border-r border-border pr-2">
                {audiences.map((audience) => (
                  <NavigationMenuItem key={audience.value} value={audience.value}>
                    <NavigationMenuTrigger>{audience.label}</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="flex flex-col gap-1">
                        {audience.links.map((item) => (
                          <li key={item.href}>
                            <LinkCard {...item} />
                          </li>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#customers">Customers</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};

/** Stands in for a router's link component (Next.js `Link`, React Router `Link`, …). */
const RouterLink = forwardRef<HTMLAnchorElement, ComponentProps<"a"> & { to: string }>(
  function RouterLink({ to, onClick, ...props }, ref) {
    return (
      <a
        ref={ref}
        href={to}
        {...props}
        onClick={(event) => {
          onClick?.(event);
          // A router would push the route here instead of reloading the page.
          event.preventDefault();
        }}
      />
    );
  },
);

/**
 * `render` swaps the `<a>` for a router's link, keeping the styles, `aria-current` and keyboard
 * behaviour. Here the fake router records the route instead of navigating.
 */
export const WithRouterStyleLinks: Story = {
  render: (args) => {
    const [route, setRoute] = useState("/orders");
    const to = (path: string) => ({
      render: <RouterLink to={path} />,
      active: route === path,
      onClick: () => setRoute(path),
    });
    return (
      <div className="flex flex-col gap-4">
        <NavigationMenu {...args}>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Shop</NavigationMenuTrigger>
              <NavigationMenuContent className="sm:w-80">
                <NavigationMenuLink {...to("/shop/new")} closeOnClick>
                  New arrivals
                </NavigationMenuLink>
                <NavigationMenuLink {...to("/shop/sale")} closeOnClick>
                  Sale
                </NavigationMenuLink>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink {...to("/orders")}>Orders</NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        <p className="text-sm text-muted-foreground">
          Current route: <code>{route}</code>
        </p>
      </div>
    );
  },
};
