import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "../checkbox";
import { Field, FieldDescription, FieldError, FieldItem, FieldLabel } from "../field";
import { Fieldset, FieldsetLegend } from "../fieldset";
import { Label } from "../label";
import { Radio, RadioGroup } from "./radio-group";

const meta = {
  title: "Components/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
  args: { defaultValue: "pro", name: "plan" },
  argTypes: {
    disabled: { control: "boolean" },
    readOnly: { control: "boolean" },
    required: { control: "boolean" },
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const plans = [
  { value: "free", label: "Free", detail: "1 project, community support" },
  { value: "pro", label: "Pro", detail: "Unlimited projects, email support" },
  { value: "team", label: "Team", detail: "Shared workspaces, priority support" },
] as const;

/**
 * Plan picker. The Fieldset renders the RadioGroup, so the legend names the group; each option
 * sits in a FieldItem so its label and description get their own ids inside the Field.
 */
export const Playground: Story = {
  render: (args) => (
    <Field className="max-w-80">
      <Fieldset render={<RadioGroup {...args} />}>
        <FieldsetLegend>Plan</FieldsetLegend>
        {plans.map((plan) => (
          <FieldItem key={plan.value}>
            <FieldLabel className="flex items-center gap-2">
              <Radio value={plan.value} />
              {plan.label}
            </FieldLabel>
            <FieldDescription className="ps-7">{plan.detail}</FieldDescription>
          </FieldItem>
        ))}
      </Fieldset>
    </Field>
  ),
};

function Options({ disabledValue }: { disabledValue?: string }) {
  return (
    <>
      {plans.map((plan) => (
        <Label key={plan.value} className="flex items-center gap-2">
          <Radio value={plan.value} disabled={plan.value === disabledValue} />
          {plan.label}
        </Label>
      ))}
    </>
  );
}

/** Unchecked, checked, one disabled option, and a whole disabled group. */
export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <Fieldset render={<RadioGroup defaultValue="pro" />}>
        <FieldsetLegend>Default</FieldsetLegend>
        <Options disabledValue="team" />
      </Fieldset>
      <Fieldset render={<RadioGroup defaultValue="pro" disabled />}>
        <FieldsetLegend>Disabled group</FieldsetLegend>
        <Options />
      </Fieldset>
    </div>
  ),
};

/** A horizontal layout comes from the caller's className. */
export const Horizontal: Story = {
  render: () => (
    <Fieldset render={<RadioGroup defaultValue="monthly" className="flex-row gap-6" />}>
      <FieldsetLegend>Billing</FieldsetLegend>
      <Label className="flex items-center gap-2">
        <Radio value="monthly" />
        Monthly
      </Label>
      <Label className="flex items-center gap-2">
        <Radio value="yearly" />
        Yearly
      </Label>
    </Fieldset>
  ),
};

/**
 * A disabled Fieldset disables its RadioGroup. `disabled` on the surrounding Field also dims the
 * option labels, so set it there.
 */
export const Disabled: Story = {
  render: () => (
    <Field disabled>
      <Fieldset disabled render={<RadioGroup defaultValue="pro" />}>
        <FieldsetLegend>Plan</FieldsetLegend>
        {plans.map((plan) => (
          <FieldItem key={plan.value}>
            <FieldLabel className="flex items-center gap-2">
              <Radio value={plan.value} />
              {plan.label}
            </FieldLabel>
          </FieldItem>
        ))}
      </Fieldset>
    </Field>
  ),
};

/** Inside `<Field invalid>`, every radio takes the danger border and FieldError shows. */
export const Invalid: Story = {
  render: () => (
    <Field invalid>
      <Fieldset render={<RadioGroup />}>
        <FieldsetLegend>Payment</FieldsetLegend>
        <FieldItem>
          <FieldLabel className="flex items-center gap-2">
            <Radio value="card" />
            Card
          </FieldLabel>
        </FieldItem>
        <FieldItem>
          <FieldLabel className="flex items-center gap-2">
            <Radio value="bank" />
            Bank transfer
          </FieldLabel>
        </FieldItem>
      </Fieldset>
      <FieldError>Choose a payment method.</FieldError>
    </Field>
  ),
};

/** Fieldset also groups checkboxes: one Field per control, named by the legend. */
export const CheckboxFieldset: Story = {
  render: () => (
    <Fieldset>
      <FieldsetLegend>Notifications</FieldsetLegend>
      {["Email", "SMS", "Push"].map((channel) => (
        <Field key={channel}>
          <FieldLabel className="flex items-center gap-2">
            <Checkbox name={channel.toLowerCase()} defaultChecked={channel === "Email"} />
            {channel}
          </FieldLabel>
        </Field>
      ))}
    </Fieldset>
  ),
};
