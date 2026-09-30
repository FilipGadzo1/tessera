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

/**
 * Alignment check, not a form: each size sits under a read-only reference Input, so you can see
 * the matching heights (sm 32px, md 40px, lg 48px) and that the text starts where Input's does.
 */
export const Sizes: Story = {
  name: "Sizes (alignment check)",
  render: (args) => (
    <div className="flex flex-col gap-6">
      {(
        [
          { size: "sm", name: "Small", height: "32px" },
          { size: "md", name: "Medium", height: "40px" },
          { size: "lg", name: "Large", height: "48px" },
        ] as const
      ).map(({ size, name, height }) => (
        <section key={size} aria-label={`${name} (${size})`} className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {name} · <code className="font-mono">size="{size}"</code> · {height}
          </h3>
          <div className="grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-2">
            <span className="text-xs text-muted-foreground">Reference</span>
            <Input
              size={size}
              readOnly
              defaultValue="09 / 25 / 2026"
              aria-label={`Reference input (${size})`}
            />
            <span className="text-xs font-medium text-foreground">DateField</span>
            <DateField
              {...args}
              size={size}
              aria-label={`Date (${size})`}
              defaultValue={new Date(2026, 8, 25)}
            />
          </div>
        </section>
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
