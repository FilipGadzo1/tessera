import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bell, CreditCard, Inbox, Send, Trash2, User } from "lucide-react";
import { Badge } from "../badge";
import { Button } from "../button";
import { Tabs, TabsList, TabsPanel, TabsTab } from "./tabs";

const meta = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  args: { defaultValue: "profile", orientation: "horizontal" },
  argTypes: {
    orientation: { control: "inline-radio", options: ["horizontal", "vertical"] },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

function AccountPanels() {
  return (
    <>
      <TabsPanel value="profile" className="text-sm">
        <h3 className="font-medium">Profile</h3>
        <p className="mt-1 text-muted-foreground">
          Your name and photo appear on shared projects and in comments.
        </p>
        <Button size="sm" className="mt-4">
          Edit profile
        </Button>
      </TabsPanel>
      <TabsPanel value="notifications" className="text-sm">
        <h3 className="font-medium">Notifications</h3>
        <p className="mt-1 text-muted-foreground">
          Choose which updates reach your inbox and which stay in the app.
        </p>
      </TabsPanel>
      <TabsPanel value="billing" className="text-sm">
        <h3 className="font-medium">Billing</h3>
        <p className="mt-1 text-muted-foreground">
          Team plan, renews on 1 October. Invoices go to billing@example.com.
        </p>
        <Button size="sm" variant="outline" color="neutral" className="mt-4">
          Download invoices
        </Button>
      </TabsPanel>
    </>
  );
}

export const Underline: Story = {
  render: (args) => (
    <Tabs {...args} className="w-md max-w-full">
      <TabsList aria-label="Account settings">
        <TabsTab value="profile">Profile</TabsTab>
        <TabsTab value="notifications">Notifications</TabsTab>
        <TabsTab value="billing">Billing</TabsTab>
      </TabsList>
      <AccountPanels />
    </Tabs>
  ),
};

export const Segmented: Story = {
  args: { defaultValue: "week" },
  render: (args) => (
    <Tabs {...args} className="w-80">
      <TabsList variant="segmented" aria-label="Report range" className="w-full">
        <TabsTab value="day">Day</TabsTab>
        <TabsTab value="week">Week</TabsTab>
        <TabsTab value="month">Month</TabsTab>
      </TabsList>
      <TabsPanel value="day" className="text-sm text-muted-foreground">
        42 deploys today, 2 rolled back.
      </TabsPanel>
      <TabsPanel value="week" className="text-sm text-muted-foreground">
        268 deploys this week, 5 rolled back.
      </TabsPanel>
      <TabsPanel value="month" className="text-sm text-muted-foreground">
        1,104 deploys this month, 19 rolled back.
      </TabsPanel>
    </Tabs>
  ),
};

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex w-xl max-w-full flex-col gap-10">
      <Tabs {...args}>
        <TabsList aria-label="Account settings" className="w-40 shrink-0">
          <TabsTab value="profile">Profile</TabsTab>
          <TabsTab value="notifications">Notifications</TabsTab>
          <TabsTab value="billing">Billing</TabsTab>
        </TabsList>
        <AccountPanels />
      </Tabs>
      <Tabs {...args}>
        <TabsList variant="segmented" aria-label="Account settings (segmented)" className="w-40">
          <TabsTab value="profile">Profile</TabsTab>
          <TabsTab value="notifications">Notifications</TabsTab>
          <TabsTab value="billing">Billing</TabsTab>
        </TabsList>
        <AccountPanels />
      </Tabs>
    </div>
  ),
};

export const WithIconsAndCounts: Story = {
  args: { defaultValue: "inbox" },
  render: (args) => (
    <div className="flex w-lg max-w-full flex-col gap-10">
      <Tabs {...args}>
        <TabsList aria-label="Mailboxes">
          <TabsTab value="inbox">
            <Inbox aria-hidden className="size-4" />
            Inbox
            <Badge size="sm" color="primary">
              12
            </Badge>
          </TabsTab>
          <TabsTab value="sent">
            <Send aria-hidden className="size-4" />
            Sent
          </TabsTab>
          <TabsTab value="trash">
            <Trash2 aria-hidden className="size-4" />
            Trash
            <Badge size="sm">3</Badge>
          </TabsTab>
        </TabsList>
        <TabsPanel value="inbox" className="text-sm text-muted-foreground">
          12 unread conversations.
        </TabsPanel>
        <TabsPanel value="sent" className="text-sm text-muted-foreground">
          Nothing sent in the last 30 days.
        </TabsPanel>
        <TabsPanel value="trash" className="text-sm text-muted-foreground">
          3 conversations are deleted for good after 30 days.
        </TabsPanel>
      </Tabs>
      <Tabs defaultValue="profile">
        <TabsList variant="segmented" aria-label="Settings sections">
          <TabsTab value="profile">
            <User aria-hidden className="size-4" />
            Profile
          </TabsTab>
          <TabsTab value="notifications">
            <Bell aria-hidden className="size-4" />
            Alerts
            <Badge size="sm" color="danger">
              2
            </Badge>
          </TabsTab>
          <TabsTab value="billing">
            <CreditCard aria-hidden className="size-4" />
            Billing
          </TabsTab>
        </TabsList>
        <AccountPanels />
      </Tabs>
    </div>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <div className="flex w-md max-w-full flex-col gap-10">
      <Tabs {...args}>
        <TabsList aria-label="Account settings">
          <TabsTab value="profile">Profile</TabsTab>
          <TabsTab value="notifications">Notifications</TabsTab>
          <TabsTab value="billing" disabled>
            Billing
          </TabsTab>
        </TabsList>
        <AccountPanels />
      </Tabs>
      <Tabs {...args}>
        <TabsList variant="segmented" aria-label="Account settings (segmented)">
          <TabsTab value="profile">Profile</TabsTab>
          <TabsTab value="notifications">Notifications</TabsTab>
          <TabsTab value="billing" disabled>
            Billing
          </TabsTab>
        </TabsList>
        <AccountPanels />
      </Tabs>
    </div>
  ),
};
