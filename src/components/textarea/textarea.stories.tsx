import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Field, FieldDescription, FieldLabel } from "../field";
import { Label } from "../label";
import { Textarea } from "./textarea";

const meta = {
  title: "Components/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: { placeholder: "Tell us about yourself", "aria-label": "Bio" },
  argTypes: {
    rows: { control: { type: "number", min: 1 } },
    disabled: { control: "boolean" },
    readOnly: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Type several lines: the textarea grows with its content. */
export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="state-default">Default</Label>
        <Textarea id="state-default" defaultValue={"First line\nSecond line"} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="state-placeholder">Placeholder</Label>
        <Textarea id="state-placeholder" placeholder="Tell us about yourself" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="state-rows">Rows = 6 (minimum height)</Label>
        <Textarea id="state-rows" rows={6} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="state-disabled">Disabled</Label>
        <Textarea id="state-disabled" disabled defaultValue="Locked" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="state-readonly">Read-only</Label>
        <Textarea id="state-readonly" readOnly defaultValue="Submitted on 12 March." />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="state-invalid">Invalid</Label>
        <Textarea id="state-invalid" aria-invalid="true" defaultValue="Too short" />
      </div>
    </div>
  ),
};

const MAX_LENGTH = 200;

function BioField() {
  const [value, setValue] = useState("");
  return (
    <Field>
      <FieldLabel>Bio</FieldLabel>
      <Textarea
        value={value}
        onValueChange={setValue}
        maxLength={MAX_LENGTH}
        placeholder="A few sentences about you"
      />
      <FieldDescription>
        Shown on your public profile. {value.length}/{MAX_LENGTH} characters.
      </FieldDescription>
    </Field>
  );
}

/** Inside a Field, the label and description are wired up; the count updates via `onValueChange`. */
export const InField: Story = {
  render: () => <BioField />,
};
