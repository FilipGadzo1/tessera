import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Field, FieldDescription, FieldLabel } from "../field";
import { Label } from "../label";
import { Checkbox } from "./checkbox";

const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: { "aria-label": "Accept terms" },
  argTypes: {
    checked: { control: "boolean" },
    defaultChecked: { control: "boolean" },
    indeterminate: { control: "boolean" },
    disabled: { control: "boolean" },
    readOnly: { control: "boolean" },
    required: { control: "boolean" },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Label className="flex items-center gap-2">
        <Checkbox />
        Unchecked
      </Label>
      <Label className="flex items-center gap-2">
        <Checkbox defaultChecked />
        Checked
      </Label>
      <Label className="flex items-center gap-2">
        <Checkbox indeterminate />
        Indeterminate
      </Label>
      <Label className="flex items-center gap-2">
        <Checkbox disabled />
        Disabled
      </Label>
      <Label className="flex items-center gap-2">
        <Checkbox disabled defaultChecked />
        Disabled, checked
      </Label>
      <Field invalid>
        <FieldLabel className="flex items-center gap-2">
          <Checkbox />
          Invalid
        </FieldLabel>
      </Field>
    </div>
  ),
};

/** Wrap the checkbox in a Label: clicking the text toggles it, and the text names it. */
export const WithLabel: Story = {
  render: () => (
    <Label className="flex items-center gap-2">
      <Checkbox name="terms" />
      Accept terms and conditions
    </Label>
  ),
};

/** Inside a Field, FieldLabel names the checkbox and FieldDescription describes it. */
export const InField: Story = {
  render: () => (
    <Field className="max-w-80">
      <FieldLabel className="flex items-center gap-2">
        <Checkbox name="newsletter" />
        Subscribe to the newsletter
      </FieldLabel>
      <FieldDescription>One email a month. Unsubscribe at any time.</FieldDescription>
    </Field>
  ),
};

const toppings = ["Cheese", "Mushrooms", "Olives"] as const;

function SelectAll() {
  const [selected, setSelected] = useState<string[]>(["Cheese"]);
  const all = selected.length === toppings.length;
  const some = selected.length > 0 && !all;
  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-2">
        <Checkbox
          checked={all}
          indeterminate={some}
          onCheckedChange={(checked) => setSelected(checked ? [...toppings] : [])}
        />
        All toppings
      </Label>
      <div className="flex flex-col gap-2 pl-7">
        {toppings.map((topping) => (
          <Label key={topping} className="flex items-center gap-2">
            <Checkbox
              checked={selected.includes(topping)}
              onCheckedChange={(checked) =>
                setSelected((prev) =>
                  checked ? [...prev, topping] : prev.filter((t) => t !== topping),
                )
              }
            />
            {topping}
          </Label>
        ))}
      </div>
    </div>
  );
}

/** A select-all parent is `indeterminate` while some, but not all, children are checked. */
export const ParentChild: Story = {
  render: () => <SelectAll />,
};
