import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../badge/badge";
import { Button } from "../button/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

const variants = ["outlined", "elevated"] as const;

const meta = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: variants },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/** CardTitle is a plain div; give it heading semantics with `role="heading"` + `aria-level`. */
export const Outlined: Story = {
  args: { variant: "outlined" },
  render: (args) => (
    <Card {...args} className="w-96">
      <CardHeader>
        <CardTitle role="heading" aria-level={3}>
          Invite teammates
        </CardTitle>
        <CardDescription>They get access to every project in this workspace.</CardDescription>
      </CardHeader>
      <CardContent>3 seats left on your plan.</CardContent>
      <CardFooter>
        <Button>Send invites</Button>
        <Button variant="ghost" color="neutral">
          Cancel
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const Elevated: Story = {
  args: { variant: "elevated" },
  render: (args) => (
    <Card {...args} className="w-96">
      <CardHeader>
        <CardTitle>Invite teammates</CardTitle>
        <CardDescription>They get access to every project in this workspace.</CardDescription>
      </CardHeader>
      <CardContent>3 seats left on your plan.</CardContent>
      <CardFooter>
        <Button>Send invites</Button>
        <Button variant="ghost" color="neutral">
          Cancel
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const WithBadge: Story = {
  args: { variant: "elevated" },
  render: (args) => (
    <Card {...args} className="w-96">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle role="heading" aria-level={3}>
          Monthly usage
        </CardTitle>
        <Badge color="success">Healthy</Badge>
      </CardHeader>
      <CardContent>
        <div className="font-semibold text-3xl">72%</div>
        <div className="text-muted-foreground">36 of 50 GB used</div>
      </CardContent>
    </Card>
  ),
};

export const Grid: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: "Storage", value: "72%", caption: "36 of 50 GB used" },
        { label: "Bandwidth", value: "41%", caption: "410 of 1,000 GB transferred" },
        { label: "Requests", value: "88%", caption: "8.8M of 10M requests" },
      ].map(({ label, value, caption }) => (
        <Card key={label} variant="elevated">
          <CardHeader>
            <CardTitle role="heading" aria-level={3}>
              {label}
            </CardTitle>
            <CardDescription>This billing period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-semibold text-3xl">{value}</div>
            <div className="text-muted-foreground">{caption}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};
