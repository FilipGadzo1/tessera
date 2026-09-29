import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Checkbox } from "../checkbox";
import { Field, FieldItem, FieldLabel } from "../field";
import { Fieldset, FieldsetLegend } from "../fieldset";
import { Label } from "../label";
import { CheckboxGroup } from "./checkbox-group";

const meta = {
  title: "Components/CheckboxGroup",
  component: CheckboxGroup,
  tags: ["autodocs"],
  args: { disabled: false },
  argTypes: { disabled: { control: "boolean" } },
} satisfies Meta<typeof CheckboxGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function Option({ value, children }: { value: string; children: string }) {
  return (
    <Label className="flex items-center gap-2">
      <Checkbox value={value} />
      {children}
    </Label>
  );
}

/** Named with `aria-labelledby`; each Checkbox sits in a wrapping Label. */
export const Basic: Story = {
  args: { defaultValue: ["gala"] },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <div id="apples-label" className="text-sm font-medium">
        Apples
      </div>
      <CheckboxGroup {...args} aria-labelledby="apples-label">
        <Option value="fuji">Fuji</Option>
        <Option value="gala">Gala</Option>
        <Option value="granny">Granny Smith</Option>
      </CheckboxGroup>
    </div>
  ),
};

const fruits = ["fuji", "gala", "granny"];

/** `allValues` on a controlled group plus `parent` on one Checkbox: it is indeterminate when partly checked. */
export const ParentCheckbox: Story = {
  render: (args) => {
    const [value, setValue] = useState<string[]>(["gala"]);
    return (
      <CheckboxGroup
        {...args}
        aria-label="Apples"
        value={value}
        onValueChange={setValue}
        allValues={fruits}
      >
        <Label className="flex items-center gap-2 font-medium">
          <Checkbox parent />
          All apples
        </Label>
        <div className="flex flex-col gap-3 pl-7">
          <Option value="fuji">Fuji</Option>
          <Option value="gala">Gala</Option>
          <Option value="granny">Granny Smith</Option>
        </div>
      </CheckboxGroup>
    );
  },
};

/** The Fieldset renders the group, so the legend names it; each option is a Field item. */
export const InFieldset: Story = {
  args: { defaultValue: ["email"] },
  render: (args) => (
    <form className="flex flex-col gap-4">
      <Field name="notify">
        <Fieldset render={<CheckboxGroup {...args} />}>
          <FieldsetLegend>Notify me by</FieldsetLegend>
          <FieldItem>
            <FieldLabel className="flex items-center gap-2">
              <Checkbox value="email" />
              Email
            </FieldLabel>
          </FieldItem>
          <FieldItem>
            <FieldLabel className="flex items-center gap-2">
              <Checkbox value="sms" />
              SMS
            </FieldLabel>
          </FieldItem>
          <FieldItem>
            <FieldLabel className="flex items-center gap-2">
              <Checkbox value="push" />
              Push notification
            </FieldLabel>
          </FieldItem>
        </Fieldset>
      </Field>
    </form>
  ),
};

/** `className="flex-row"` lays the options out in a row. */
export const Horizontal: Story = {
  args: { defaultValue: ["mon", "wed"] },
  render: (args) => (
    <Fieldset render={<CheckboxGroup {...args} className="flex-row flex-wrap gap-4" />}>
      <FieldsetLegend className="basis-full">Days</FieldsetLegend>
      <Option value="mon">Mon</Option>
      <Option value="tue">Tue</Option>
      <Option value="wed">Wed</Option>
      <Option value="thu">Thu</Option>
      <Option value="fri">Fri</Option>
    </Fieldset>
  ),
};
