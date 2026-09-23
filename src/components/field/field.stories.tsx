import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "../input";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field";

const meta = {
  title: "Components/Field",
  component: Field,
  tags: ["autodocs"],
  args: { disabled: false, invalid: false },
  argTypes: {
    disabled: { control: "boolean" },
    invalid: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Label and control. Toggle `disabled` and `invalid` in the controls. */
export const Default: Story = {
  render: (args) => (
    <Field {...args}>
      <FieldLabel>Full name</FieldLabel>
      <Input placeholder="Ada Lovelace" />
      <FieldError>Enter your name.</FieldError>
    </Field>
  ),
};

/** The description is announced with the control via `aria-describedby`. */
export const WithDescription: Story = {
  render: (args) => (
    <Field {...args}>
      <FieldLabel>Email</FieldLabel>
      <Input type="email" placeholder="you@example.com" />
      <FieldDescription>We only use it for sign-in links.</FieldDescription>
    </Field>
  ),
};

/** Controlled invalid state, e.g. from a server response or a form library. */
export const Invalid: Story = {
  args: { invalid: true },
  render: (args) => (
    <Field {...args}>
      <FieldLabel>Email</FieldLabel>
      <Input type="email" defaultValue="ada@" />
      <FieldDescription>We only use it for sign-in links.</FieldDescription>
      <FieldError>Enter a complete email address.</FieldError>
    </Field>
  ),
};

/** `validate` runs when the input loses focus; the error clears once the value is valid. */
export const ValidateOnBlur: Story = {
  render: (args) => (
    <Field
      {...args}
      validationMode="onBlur"
      validate={(value) => (String(value).includes("@") ? null : "Enter an email address")}
    >
      <FieldLabel>Email</FieldLabel>
      <Input type="text" placeholder="you@example.com" />
      <FieldDescription>Type something without an @, then press Tab.</FieldDescription>
      <FieldError />
    </Field>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <Field {...args}>
      <FieldLabel>Workspace</FieldLabel>
      <Input defaultValue="tessera" />
      <FieldDescription>Contact an admin to rename the workspace.</FieldDescription>
    </Field>
  ),
};
