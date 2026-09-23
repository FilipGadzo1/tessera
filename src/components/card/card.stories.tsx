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

export const Outlined: Story = {
  args: { variant: "outlined" },
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
        <CardTitle>Monthly usage</CardTitle>
        <Badge color="success">Healthy</Badge>
      </CardHeader>
      <CardContent>
        <div className="font-semibold text-3xl">72%</div>
        <div className="text-muted-foreground">of 50 GB used</div>
      </CardContent>
    </Card>
  ),
};

export const Grid: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      {["Storage", "Bandwidth", "Requests"].map((label) => (
        <Card key={label} variant="elevated">
          <CardHeader>
            <CardTitle>{label}</CardTitle>
            <CardDescription>This billing period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-semibold text-3xl">72%</div>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};
