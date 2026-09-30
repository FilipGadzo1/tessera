import type { Meta, StoryObj } from "@storybook/react-vite";
import { DashboardPage } from "./dashboard-page";

/**
 * The Phase H app shell composed with earlier components. A `Sidebar` (icon-collapsible, Ctrl/⌘+B
 * or the trigger; below `md` it becomes a Drawer) holds a workspace-switcher `Menu` in its header,
 * a nav (Overview, Orders, Customers, Products with a sub-list; the current page has
 * `aria-current`) and an account `Menu` on an `Avatar` in its footer. The inset's top bar has the
 * `SidebarTrigger`, a `Breadcrumb` and a Search button that opens the command-palette
 * `Autocomplete` in a `Dialog`. The content is a grid of `Card`s with `Progress` and `Meter`, a
 * filter `Form` (an editable `DatePicker` "From" and a `DateRangePicker` "Period"; Apply shows the
 * values `onFormSubmit` reported under the Field names) and a `Table` of recent orders.
 *
 * The shortcut listens on `window`, so a page should keep it on for one provider only.
 */
const meta = {
  title: "Tessera/Examples/Dashboard",
  component: DashboardPage,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 640 } },
  },
} satisfies Meta<typeof DashboardPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = { name: "Dashboard" };
