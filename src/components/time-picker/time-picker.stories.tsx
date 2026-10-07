import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { TimePicker } from "./time-picker";

const meta = {
  title: "Components/TimePicker",
  component: TimePicker,
  tags: ["autodocs"],
  args: { locale: "en-US", size: "md", disabled: false, readOnly: false, slotStep: 30 },
  argTypes: {
    locale: { control: "select", options: ["en-US", "en-GB", "de-DE", "ko-KR", "ja-JP", "ar-EG"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    hourCycle: { control: "inline-radio", options: [undefined, 12, 24] },
    granularity: { control: "inline-radio", options: ["minute", "second"] },
    slotStep: { control: { type: "number", min: 1 } },
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Type the time in the segments, or open the list with the clock button: it focuses the selected
 * slot (else the nearest one), ↑/↓ move, Home/End jump, PageUp/PageDown move five, Enter or Space
 * picks and returns focus to the button, and Escape closes it unchanged.
 */
export const Basic: Story = {
  render: (args) => {
    const [value, setValue] = useState<string | null>(null);
    return (
      <Field>
        <FieldLabel>Start time</FieldLabel>
        <TimePicker {...args} value={value} onValueChange={setValue} />
        <FieldDescription>Value: {value ?? "none"}</FieldDescription>
      </Field>
    );
  },
};

/**
 * Business hours: `min` / `max` bound both the field and the list, `step={900}` keeps the field on
 * a 15-minute grid, and `slotStep={15}` lists every quarter hour from 09:00 to 17:00.
 */
export const BusinessHours: Story = {
  name: "Business hours",
  args: { slotStep: 15 },
  render: (args) => {
    const [value, setValue] = useState<string | null>("10:15");
    return (
      <Field>
        <FieldLabel>Meeting time</FieldLabel>
        <TimePicker
          {...args}
          min="09:00"
          max="17:00"
          step={900}
          value={value}
          onValueChange={setValue}
        />
        <FieldDescription>Between 9:00 AM and 5:00 PM, in 15-minute steps.</FieldDescription>
      </Field>
    );
  },
};

/** `granularity="second"`: the field has a second segment, and a picked slot reports `":00"`. */
export const WithSeconds: Story = {
  name: "With seconds",
  args: { granularity: "second" },
  render: (args) => {
    const [value, setValue] = useState<string | null>("14:05:30");
    return (
      <Field>
        <FieldLabel>Lap time</FieldLabel>
        <TimePicker {...args} value={value} onValueChange={setValue} />
        <FieldDescription>Value: {value ?? "none"}</FieldDescription>
      </Field>
    );
  },
};

/** In a Form the TimeField is the one control: `required`, the range and the step validate on submit. */
export const InAForm: Story = {
  name: "In a Form",
  render: (args) => {
    const [submitted, setSubmitted] = useState<string>("nothing yet");
    return (
      <Form
        aria-label="Booking"
        className="flex flex-col gap-4"
        onFormSubmit={(values) => setSubmitted(JSON.stringify(values))}
      >
        <Field name="start">
          <FieldLabel>Start time</FieldLabel>
          <TimePicker {...args} required min="09:00" max="17:00" step={900} />
          <FieldDescription>Between 9:00 AM and 5:00 PM, in 15-minute steps.</FieldDescription>
          <FieldError />
        </Field>
        <Button type="submit" className="self-start">
          Book
        </Button>
        <output className="text-sm text-muted-foreground">Submitted: {submitted}</output>
      </Form>
    );
  },
};

/** Read-only segments stay focusable and the clock button is disabled; disabled leaves the Tab order. */
export const DisabledReadOnly: Story = {
  name: "Disabled and read-only",
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>Read-only</FieldLabel>
        <TimePicker {...args} readOnly defaultValue="09:30" />
      </Field>
      <Field disabled>
        <FieldLabel>Disabled</FieldLabel>
        <TimePicker {...args} defaultValue="09:30" />
      </Field>
    </div>
  ),
};

/**
 * In an RTL page the clock button sits at the inline end (left), the popup aligns to the field's
 * right edge and the check marks sit at the right. An English time keeps its LTR row; Arabic reads
 * "م ٩:٣٠".
 */
export const RTL: Story = {
  render: (args) => (
    <div dir="rtl" className="flex flex-col gap-4">
      <Field>
        <FieldLabel>Start time (en-US)</FieldLabel>
        <TimePicker {...args} defaultValue="09:30" />
      </Field>
      <div lang="ar-EG">
        <Field>
          <FieldLabel>وقت البدء</FieldLabel>
          <TimePicker
            {...args}
            locale="ar-EG"
            defaultValue="21:30"
            labels={{ open: "اختر الوقت", dialog: "اختر وقتًا", list: "الأوقات" }}
          />
        </Field>
      </div>
    </div>
  ),
};
