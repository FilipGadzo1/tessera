import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { toneColors } from "../../lib/tone";
import { Meter, MeterLabel, MeterValue } from "./meter";

const sizes = ["sm", "md", "lg"] as const;

const meta = {
  title: "Components/Meter",
  component: Meter,
  tags: ["autodocs"],
  args: { value: 64, color: "primary", size: "md", "aria-label": "Meter" },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100 } },
    color: { control: "select", options: toneColors },
    size: { control: "inline-radio", options: sizes },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Meter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Meter value={62}>
      <MeterLabel>Disk usage</MeterLabel>
      <MeterValue />
    </Meter>
  ),
};

export const Colors: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {toneColors.map((color, i) => (
        <Meter key={color} value={30 + i * 12} color={color}>
          <MeterLabel className="capitalize">{color}</MeterLabel>
          <MeterValue />
        </Meter>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {sizes.map((size) => (
        <Meter key={size} value={48} size={size}>
          <MeterLabel>Size {size}</MeterLabel>
        </Meter>
      ))}
    </div>
  ),
};

export const FormattedValue: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Meter value={1240} max={2000}>
        <MeterLabel>Characters</MeterLabel>
        <MeterValue>{(formatted) => `${formatted} / 2,000`}</MeterValue>
      </Meter>
      <Meter value={72} max={100} format={{ style: "percent" }} color="warning">
        <MeterLabel>Storage</MeterLabel>
        <MeterValue />
      </Meter>
    </div>
  ),
};

function strengthOf(password: string): {
  value: number;
  label: string;
  color: "danger" | "warning" | "success";
} {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const value = (score / 5) * 100;
  if (score <= 1) return { value, label: "Weak", color: "danger" };
  if (score <= 3) return { value, label: "Okay", color: "warning" };
  return { value, label: "Strong", color: "success" };
}

function PasswordStrength() {
  const [password, setPassword] = useState("");
  const strength = strengthOf(password);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground" htmlFor="pw">
        Password
        <input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 rounded-md border border-field-border bg-background px-3 text-sm"
        />
      </label>
      <Meter value={password.length === 0 ? 0 : strength.value} color={strength.color}>
        <MeterLabel>Strength</MeterLabel>
        <MeterValue>{() => strength.label}</MeterValue>
      </Meter>
    </div>
  );
}

export const PasswordStrengthStory: Story = {
  name: "Password strength",
  render: () => <PasswordStrength />,
};
