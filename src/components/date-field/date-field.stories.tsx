import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Input } from "../input";
import { DateField } from "./date-field";

const meta = {
  title: "Components/DateField",
  component: DateField,
  tags: ["autodocs"],
  args: { locale: "en-US", size: "md", disabled: false, readOnly: false },
  argTypes: {
    locale: { control: "select", options: ["en-US", "en-GB", "de-DE", "fr-FR", "ja-JP", "ar-EG"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DateField>;

export default meta;
type Story = StoryObj<typeof meta>;

const formatted = (value: Date | null) =>
  value ? new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(value) : "none";

/**
 * Type the digits: each segment advances once no further digit fits (month "2"–"9", day
 * "4"–"9", four year digits). ↑/↓ step with wrap, PageUp/PageDown step further, Home/End jump to
 * the bounds, Backspace clears, ←/→ and Tab move, "/" advances, and pasting "9/25/2026" or
 * "2026-09-25" fills every segment.
 */
export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState<Date | null>(null);
    return (
      <Field>
        <FieldLabel>Due date</FieldLabel>
        <DateField {...args} value={value} onValueChange={setValue} />
        <FieldDescription>Value: {formatted(value)}</FieldDescription>
      </Field>
    );
  },
};

/**
 * The segment order, separators, digits, placeholders and segment names follow the locale. Arabic
 * shows Arabic-Indic digits (typing accepts them and ASCII digits) and, inside `dir="rtl"`, ←/→
 * follow the visual order.
 */
export const Locales: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {[
        { locale: "en-US", label: "English (US)" },
        { locale: "de-DE", label: "Deutsch" },
        { locale: "ja-JP", label: "日本語" },
        { locale: "ar-EG", label: "العربية", dir: "rtl" as const },
      ].map(({ locale, label, dir }) => (
        <div key={locale} dir={dir} lang={locale}>
          <Field>
            <FieldLabel>{label}</FieldLabel>
            <DateField {...args} locale={locale} defaultValue={new Date(2026, 8, 25)} />
          </Field>
        </div>
      ))}
    </div>
  ),
};

/** A date outside `min`/`max` (or one `isDateDisabled` rejects) marks the field invalid. */
export const MinMax: Story = {
  name: "Min/Max",
  render: (args) => (
    <Field>
      <FieldLabel>Delivery date</FieldLabel>
      <DateField
        {...args}
        min={new Date(2026, 8, 1)}
        max={new Date(2026, 11, 31)}
        isDateDisabled={(date) => date.getDay() === 0 || date.getDay() === 6}
        defaultValue={new Date(2027, 0, 4)}
      />
      <FieldDescription>A weekday between Sep 1 and Dec 31, 2026.</FieldDescription>
    </Field>
  ),
};

/** The FieldLabel names the group, the description describes it and an invalid Field paints it danger. */
export const InField: Story = {
  name: "In Field (invalid)",
  render: (args) => (
    <Field invalid>
      <FieldLabel>Date of birth</FieldLabel>
      <DateField {...args} defaultValue={new Date(2031, 1, 3)} />
      <FieldDescription>As shown on your passport.</FieldDescription>
      <FieldError>Enter a date in the past.</FieldError>
    </Field>
  ),
};

/** The Input heights (sm 32px, md 40px, lg 48px), with the text starting where Input's does. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <div key={size} className="flex flex-col gap-3">
          <Input size={size} defaultValue="09 / 25 / 2026" aria-label={`Input (${size})`} />
          <DateField
            {...args}
            size={size}
            aria-label={`Date (${size})`}
            defaultValue={new Date(2026, 8, 25)}
          />
        </div>
      ))}
    </div>
  ),
};

/** Read-only segments stay focusable (Tab, ←/→) but ignore edits; disabled ones leave the Tab order. */
export const ReadOnlyDisabled: Story = {
  name: "Read-only/Disabled",
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>Read-only</FieldLabel>
        <DateField {...args} readOnly defaultValue={new Date(2026, 8, 25)} />
      </Field>
      <Field disabled>
        <FieldLabel>Disabled</FieldLabel>
        <DateField {...args} defaultValue={new Date(2026, 8, 25)} />
      </Field>
    </div>
  ),
};
