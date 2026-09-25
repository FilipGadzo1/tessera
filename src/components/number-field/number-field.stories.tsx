import type { Meta, StoryObj } from "@storybook/react-vite";
import { Field, FieldLabel } from "../field";
import { Input } from "../input";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldScrubArea,
} from "./number-field";

const meta = {
  title: "Components/NumberField",
  component: NumberField,
  tags: ["autodocs"],
  args: { defaultValue: 1, "aria-label": "Quantity" },
} satisfies Meta<typeof NumberField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CurrencyFormat: Story = {
  args: {
    "aria-label": "Price",
    defaultValue: 19.9,
    min: 0,
    step: 0.1,
    format: { style: "currency", currency: "USD" },
  },
};

export const MinMaxStep: Story = {
  args: { "aria-label": "Servings", defaultValue: 2, min: 1, max: 8, step: 1 },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["sm", "md", "lg"] as const).map((size) => (
        <div key={size} className="flex items-center gap-3">
          <Input aria-label={`Input ${size}`} size={size} placeholder={size} className="w-24" />
          <NumberField aria-label={`Quantity ${size}`} defaultValue={1}>
            <NumberFieldGroup size={size} className="w-32">
              <NumberFieldDecrement />
              <NumberFieldInput />
              <NumberFieldIncrement />
            </NumberFieldGroup>
          </NumberField>
        </div>
      ))}
    </div>
  ),
};

export const InFieldInvalid: Story = {
  render: () => (
    <Field invalid className="w-48">
      <FieldLabel>Quantity</FieldLabel>
      <NumberField defaultValue={0} min={1} max={10} />
    </Field>
  ),
};

export const ScrubAreaLabel: Story = {
  render: () => (
    <NumberField aria-label="Volume" defaultValue={50} min={0} max={100}>
      <NumberFieldScrubArea className="text-sm font-medium text-foreground">
        Volume
      </NumberFieldScrubArea>
      <NumberFieldGroup className="mt-1.5 w-40">
        <NumberFieldDecrement />
        <NumberFieldInput />
        <NumberFieldIncrement />
      </NumberFieldGroup>
    </NumberField>
  ),
};

export const DisabledReadOnly: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <NumberField aria-label="Disabled quantity" defaultValue={3} disabled className="w-32" />
      <NumberField aria-label="Read-only quantity" defaultValue={5} readOnly className="w-32" />
    </div>
  ),
};
