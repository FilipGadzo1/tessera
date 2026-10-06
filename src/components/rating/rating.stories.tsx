import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { Rating } from "./rating";

const meta = {
  title: "Components/Rating",
  component: Rating,
  tags: ["autodocs"],
  args: { "aria-label": "Rating", defaultValue: 3 },
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: function Render(args) {
    const [value, setValue] = useState<number | null>(args.defaultValue ?? null);
    return (
      <div className="flex flex-col gap-3">
        <Rating {...args} defaultValue={undefined} value={value} onValueChange={setValue} />
        <p className="text-sm text-muted-foreground">Value: {String(value)}</p>
      </div>
    );
  },
};

/** Two radios per star: the arrows step by 0.5, and each star's halves can be clicked. */
export const HalfSteps: Story = {
  name: "Half steps",
  args: { allowHalf: true, defaultValue: 3.5 },
};

/** Choosing the checked star again (click or Space) clears the rating. */
export const Clearable: Story = {
  args: { clearable: true, defaultValue: 2 },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col items-start gap-3">
      <Rating {...args} aria-label="Small" size="sm" />
      <Rating {...args} aria-label="Medium" size="md" />
      <Rating {...args} aria-label="Large" size="lg" />
    </div>
  ),
};

/**
 * `readOnly` shows an average: an image named by its value ("4.3 out of 5 stars") with any
 * fractional fill. It has no Tab stop and is not a form control.
 */
export const Display: Story = {
  render: () => (
    <div className="flex items-center gap-2 text-sm">
      <Rating readOnly value={4.3} />
      <span className="text-muted-foreground">4.3 (128 reviews)</span>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 2 },
};

/** In a Field and Form: the rating is the Field's one control and submits under its name. */
export const InAForm: Story = {
  name: "In a Form",
  render: function Render() {
    const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null);
    return (
      <Form aria-label="Review" onFormSubmit={setSubmitted} className="flex flex-col gap-4">
        <Field name="rating">
          <FieldLabel>Your rating</FieldLabel>
          <Rating required clearable allowHalf />
          <FieldDescription>Choose the same star again to clear it.</FieldDescription>
          <FieldError />
        </Field>
        <Button type="submit" className="self-start">
          Send review
        </Button>
        {submitted && (
          <p className="text-sm text-muted-foreground">Submitted: {JSON.stringify(submitted)}</p>
        )}
      </Form>
    );
  },
};

/** Under `dir="rtl"` star 1 sits on the right, ← checks the next value and fills grow from the right. */
export const RTL: Story = {
  render: (args) => (
    <div dir="rtl" className="flex flex-col items-start gap-3">
      <Rating {...args} allowHalf defaultValue={3.5} aria-label="تقييم" />
      <Rating readOnly value={4.3} />
    </div>
  ),
};
