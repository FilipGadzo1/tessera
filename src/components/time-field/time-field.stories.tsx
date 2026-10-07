import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { TimeField } from "./time-field";

const meta = {
  title: "Components/TimeField",
  component: TimeField,
  tags: ["autodocs"],
  args: { locale: "en-US", size: "md", disabled: false, readOnly: false },
  argTypes: {
    locale: { control: "select", options: ["en-US", "en-GB", "de-DE", "ko-KR", "ja-JP", "ar-EG"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    hourCycle: { control: "inline-radio", options: [undefined, 12, 24] },
    granularity: { control: "inline-radio", options: ["minute", "second"] },
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimeField>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Type the digits: a segment advances once no further digit fits (hour "2"–"9" on a 12-hour
 * clock, minute "6"–"9", or two digits); typing the hour fills an empty AM/PM with AM. ↑/↓ step
 * with wrap, PageUp/PageDown step further, Home/End jump to the bounds, `a` / `p` set AM/PM,
 * Backspace clears, ←/→ and Tab move, ":" advances, and pasting "9:30 PM" or "21:30" fills every
 * segment. The value is the `<input type="time">` wire format, `"HH:mm"`.
 */
export const Basic: Story = {
  render: (args) => {
    const [value, setValue] = useState<string | null>(null);
    return (
      <Field>
        <FieldLabel>Start time</FieldLabel>
        <TimeField {...args} value={value} onValueChange={setValue} />
        <FieldDescription>Value: {value ?? "none"}</FieldDescription>
      </Field>
    );
  },
};

/** `granularity="second"` adds a second segment and reports `"HH:mm:ss"`. */
export const WithSeconds: Story = {
  name: "With seconds",
  args: { granularity: "second" },
  render: (args) => {
    const [value, setValue] = useState<string | null>("14:05:30");
    return (
      <Field>
        <FieldLabel>Lap time</FieldLabel>
        <TimeField {...args} value={value} onValueChange={setValue} />
        <FieldDescription>Value: {value ?? "none"}</FieldDescription>
      </Field>
    );
  },
};

/** `hourCycle` overrides the locale's clock: the same value on a 24-hour and a 12-hour clock. */
export const HourCycles: Story = {
  name: "24-hour / 12-hour",
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>24-hour (hourCycle 24)</FieldLabel>
        <TimeField {...args} hourCycle={24} defaultValue="21:45" />
      </Field>
      <Field>
        <FieldLabel>12-hour (hourCycle 12)</FieldLabel>
        <TimeField {...args} hourCycle={12} defaultValue="21:45" />
      </Field>
    </div>
  ),
};

/**
 * Business hours, 09:00–17:00 in 15-minute steps: ↑/↓ on the minutes land on 00 / 15 / 30 / 45,
 * and a time outside the range or off the grid is invalid (not clamped), with a message saying
 * why.
 */
export const MinMaxStep: Story = {
  name: "Min, max and step",
  render: (args) => {
    const [value, setValue] = useState<string | null>("08:40");
    return (
      <Field>
        <FieldLabel>Meeting time</FieldLabel>
        <TimeField
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

/** In a Form: `required`, the range and the step validate on submit; the echo shows `onFormSubmit`. */
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
          <TimeField {...args} required min="09:00" max="17:00" step={900} />
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

/** Read-only segments stay focusable (Tab, ←/→) but ignore edits; disabled ones leave the Tab order. */
export const DisabledReadOnly: Story = {
  name: "Disabled and read-only",
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>Read-only</FieldLabel>
        <TimeField {...args} readOnly defaultValue="09:30" />
      </Field>
      <Field disabled>
        <FieldLabel>Disabled</FieldLabel>
        <TimeField {...args} defaultValue="09:30" />
      </Field>
    </div>
  ),
};

/**
 * The order, digits, day-period texts and segment names follow the locale. The segment row takes
 * the locale's script direction and the clock digits always read left to right: in the RTL frame
 * Arabic shows the period at the inline end ("م ٩:٣٠"), and ←/→ move to the visually neighbouring
 * segment.
 */
export const Locales: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {[
        { locale: "en-US", label: "English (US)" },
        { locale: "de-DE", label: "Deutsch" },
        { locale: "ko-KR", label: "한국어" },
        { locale: "ar-EG", label: "العربية", dir: "rtl" as const },
      ].map(({ locale, label, dir }) => (
        <div key={locale} dir={dir} lang={locale}>
          <Field>
            <FieldLabel>{label}</FieldLabel>
            <TimeField {...args} locale={locale} defaultValue="21:30" />
          </Field>
        </div>
      ))}
    </div>
  ),
};
