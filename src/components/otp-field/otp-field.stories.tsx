import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { OTPField } from "./otp-field";

const sizes = ["sm", "md", "lg"] as const;

const meta = {
  title: "Components/OTPField",
  component: OTPField,
  tags: ["autodocs"],
  args: { length: 6 },
  argTypes: {
    size: { control: "select", options: sizes },
    validationType: { control: "select", options: ["numeric", "alphanumeric", "alpha", "none"] },
    mask: { control: "boolean" },
    disabled: { control: "boolean" },
    readOnly: { control: "boolean" },
  },
} satisfies Meta<typeof OTPField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Type, paste or use Backspace and the arrow keys. The first slot takes the Field's label. */
export const Default: Story = {
  render: (args) => (
    <Field>
      <FieldLabel>Verification code</FieldLabel>
      <OTPField {...args} />
      <FieldDescription>Enter the 6-digit code we sent to your phone.</FieldDescription>
    </Field>
  ),
};

/** `groups` splits the slots with a separator: `[3, 3]` reads 123 – 456. */
export const Grouped: Story = {
  args: { groups: [3, 3] },
  render: (args) => (
    <Field>
      <FieldLabel>Verification code</FieldLabel>
      <OTPField {...args} />
    </Field>
  ),
};

/** `validationType="alphanumeric"` for recovery and invite codes. */
export const Alphanumeric: Story = {
  args: { length: 8, groups: [4, 4], validationType: "alphanumeric" },
  render: (args) => (
    <Field>
      <FieldLabel>Recovery code</FieldLabel>
      <OTPField {...args} />
      <FieldDescription>Letters and numbers, for example A7C9-XZ42.</FieldDescription>
    </Field>
  ),
};

/** `mask` hides the entered characters, for PINs. */
export const Masked: Story = {
  args: { length: 4, mask: true, defaultValue: "1234" },
  render: (args) => (
    <Field>
      <FieldLabel>PIN</FieldLabel>
      <OTPField {...args} />
    </Field>
  ),
};

/** Checks the code on completion; only 000000 is accepted, anything else marks the Field invalid. */
export const InFieldInvalid: Story = {
  name: "In Field invalid",
  args: { groups: [3, 3] },
  render: (args) => {
    function Verify() {
      const [code, setCode] = useState("");
      const [invalid, setInvalid] = useState(false);
      return (
        <Form
          aria-label="Verify phone"
          className="flex flex-col gap-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <Field name="code" invalid={invalid}>
            <FieldLabel>Verification code</FieldLabel>
            <OTPField
              {...args}
              value={code}
              onValueChange={(value) => {
                setCode(value);
                setInvalid(false);
              }}
              onValueComplete={(value) => setInvalid(value !== "000000")}
            />
            <FieldError match>That code is wrong or has expired.</FieldError>
          </Field>
          <Button type="button" variant="outline" onClick={() => setCode("123456")}>
            Fill 123456
          </Button>
        </Form>
      );
    }
    return <Verify />;
  },
};

/** Each slot is square at the height of the Input and Button of the same size. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {sizes.map((size) => (
        <div key={size} className="flex items-center gap-4">
          <OTPField {...args} size={size} length={4} aria-label={`Code (${size})`} />
          <Button size={size}>Verify</Button>
        </div>
      ))}
    </div>
  ),
};
