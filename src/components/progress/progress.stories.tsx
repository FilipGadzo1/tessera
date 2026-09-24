import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { toneColors } from "../../lib/tone";
import { Button } from "../button";
import { Progress, ProgressLabel, ProgressValue } from "./progress";

const sizes = ["sm", "md", "lg"] as const;

const meta = {
  title: "Components/Progress",
  component: Progress,
  tags: ["autodocs"],
  args: { value: 64, color: "primary", size: "md", "aria-label": "Progress" },
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
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithLabelAndValue: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Progress value={64}>
        <ProgressLabel>Storage used</ProgressLabel>
        <ProgressValue />
      </Progress>
      <Progress value={3.2} max={5} format={{ style: "unit", unit: "gigabyte" }} color="info">
        <ProgressLabel>Uploads</ProgressLabel>
        <ProgressValue>{(formatted) => `${formatted} of 5 GB`}</ProgressValue>
      </Progress>
    </div>
  ),
};

export const Values: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {[0, 25, 50, 75, 100].map((value) => (
        <Progress key={value} value={value}>
          <ProgressLabel>Step</ProgressLabel>
          <ProgressValue />
        </Progress>
      ))}
    </div>
  ),
};

export const Indeterminate: Story = {
  render: () => (
    <Progress value={null}>
      <ProgressLabel>Preparing export…</ProgressLabel>
    </Progress>
  ),
};

export const Colors: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {toneColors.map((color, i) => (
        <Progress key={color} value={30 + i * 12} color={color}>
          <ProgressLabel className="capitalize">{color}</ProgressLabel>
          <ProgressValue />
        </Progress>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {sizes.map((size) => (
        <Progress key={size} value={48} size={size}>
          <ProgressLabel>Size {size}</ProgressLabel>
        </Progress>
      ))}
    </div>
  ),
};

function SimulatedUpload() {
  const [value, setValue] = useState<number | null>(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setValue((v) => Math.min(100, (v ?? 0) + 7)), 250);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (value === 100) setRunning(false);
  }, [value]);
  return (
    <div className="flex flex-col gap-4">
      <Progress value={value} color={value === 100 ? "success" : "primary"}>
        <ProgressLabel>{value === 100 ? "Upload complete" : "Uploading report.pdf"}</ProgressLabel>
        <ProgressValue />
      </Progress>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            setValue(0);
            setRunning(true);
          }}
          disabled={running}
        >
          Start upload
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setRunning(false);
            setValue(null);
          }}
        >
          Waiting on server
        </Button>
      </div>
    </div>
  );
}

export const Animated: Story = {
  render: () => <SimulatedUpload />,
};
