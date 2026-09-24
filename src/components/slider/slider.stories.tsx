import type { Meta, StoryObj } from "@storybook/react-vite";
import { toneColors } from "../../lib/tone";
import { Field, FieldLabel } from "../field";
import { Slider, SliderLabel, SliderValue } from "./slider";

const sizes = ["sm", "md"] as const;

const meta = {
  title: "Components/Slider",
  component: Slider,
  tags: ["autodocs"],
  args: { defaultValue: 40, color: "primary", size: "md" },
  argTypes: {
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
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Slider {...args}>
      <SliderLabel>Volume</SliderLabel>
      <SliderValue />
    </Slider>
  ),
};

export const Range: Story = {
  render: () => (
    <Slider defaultValue={[20, 80]} thumbLabels={["Minimum price", "Maximum price"]}>
      <SliderLabel>Price range</SliderLabel>
      <SliderValue>{(formatted) => `$${formatted[0]} – $${formatted[1]}`}</SliderValue>
    </Slider>
  ),
};

export const Colors: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {toneColors.map((color, i) => (
        <Slider key={color} defaultValue={30 + i * 10} color={color}>
          <SliderLabel className="capitalize">{color}</SliderLabel>
          <SliderValue />
        </Slider>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {sizes.map((size) => (
        <Slider key={size} defaultValue={48} size={size}>
          <SliderLabel>Size {size}</SliderLabel>
          <SliderValue />
        </Slider>
      ))}
    </div>
  ),
};

/** `step` snaps the value; the formatted `SliderValue` shows the current step mark. */
export const StepMarks: Story = {
  render: () => (
    <Slider defaultValue={2} min={0} max={4} step={1}>
      <SliderLabel>Compression</SliderLabel>
      <SliderValue>
        {(_formatted, values) => ["None", "Low", "Medium", "High", "Maximum"][values[0] ?? 0]}
      </SliderValue>
    </Slider>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Slider defaultValue={40} disabled>
      <SliderLabel>Volume</SliderLabel>
      <SliderValue />
    </Slider>
  ),
};

export const InField: Story = {
  render: () => (
    <Field>
      <FieldLabel>Brightness</FieldLabel>
      <Slider defaultValue={70}>
        <SliderValue />
      </Slider>
    </Field>
  ),
};

export const Vertical: Story = {
  decorators: [
    (Story) => (
      <div className="h-64 w-auto">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Slider
      defaultValue={60}
      orientation="vertical"
      aria-label="Vertical level"
      className="h-full"
    />
  ),
};
