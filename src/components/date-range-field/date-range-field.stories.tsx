import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { DateRange } from "../calendar";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Input } from "../input";
import { DateRangeField } from "./date-range-field";

const meta = {
  title: "Components/DateRangeField",
  component: DateRangeField,
  tags: ["autodocs"],
  args: { locale: "en-US", size: "md", disabled: false, readOnly: false },
  argTypes: {
    locale: { control: "select", options: ["en-US", "en-GB", "de-DE", "fr-FR", "ja-JP", "ar-EG"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
  decorators: [
    (Story) => (
      // Two dates side by side: the lg size needs ~22rem for the field alone.
      <div className="w-[30rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DateRangeField>;

export default meta;
type Story = StoryObj<typeof meta>;

const formatted = (value: Date | null) =>
  value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(value) : "none";

/**
 * Two date fields in one group. Type the start: once it is complete, typing moves on into the end.
 * ←/→ cross between the halves, and pasting "2026-09-01 – 2026-09-12", "2026-09-01/2026-09-12"
 * or "9/1/2026 to 9/12/2026" fills both.
 */
export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState<DateRange>({ start: null, end: null });
    return (
      <Field>
        <FieldLabel>Stay</FieldLabel>
        <DateRangeField {...args} value={value} onValueChange={setValue} />
        <FieldDescription>
          {formatted(value.start)} – {formatted(value.end)}
        </FieldDescription>
      </Field>
    );
  },
};

/**
 * Each half follows the locale's segment order, separators, digits and placeholders. Inside
 * `dir="rtl"` the start sits on the right and ←/→ follow the visual order across both halves.
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
            <DateRangeField
              {...args}
              locale={locale}
              defaultValue={{ start: new Date(2026, 8, 1), end: new Date(2026, 8, 12) }}
            />
          </Field>
        </div>
      ))}
    </div>
  ),
};

/** An end outside `min`/`max` (or on a day `isDateDisabled` rejects) marks the field invalid. */
export const MinMax: Story = {
  name: "Min/Max",
  render: (args) => (
    <Field>
      <FieldLabel>Booking</FieldLabel>
      <DateRangeField
        {...args}
        min={new Date(2026, 8, 1)}
        max={new Date(2026, 11, 31)}
        defaultValue={{ start: new Date(2026, 11, 20), end: new Date(2027, 0, 4) }}
      />
      <FieldDescription>Between Sep 1 and Dec 31, 2026.</FieldDescription>
    </Field>
  ),
};

/**
 * An end before the start is invalid (`data-invalid`, "The end date must be on or after the start
 * date." at validation); it is never swapped, since a typed range is what the user meant.
 */
export const InField: Story = {
  name: "In Field (reversed, invalid)",
  render: (args) => (
    <Field invalid>
      <FieldLabel>Trip</FieldLabel>
      <DateRangeField
        {...args}
        defaultValue={{ start: new Date(2026, 8, 12), end: new Date(2026, 8, 1) }}
      />
      <FieldDescription>Departure and return.</FieldDescription>
      <FieldError>The end date must be on or after the start date.</FieldError>
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
          <div className="grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-2">
            <span className="text-xs text-muted-foreground">Reference</span>
            <Input
              size={size}
              readOnly
              defaultValue="09 / 01 / 2026 – 09 / 12 / 2026"
              aria-label={`Reference input (${size})`}
            />
            <span className="text-xs font-medium text-foreground">DateRangeField</span>
            <DateRangeField
              {...args}
              size={size}
              aria-label={`Range (${size})`}
              defaultValue={{ start: new Date(2026, 8, 1), end: new Date(2026, 8, 12) }}
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
        <DateRangeField
          {...args}
          readOnly
          defaultValue={{ start: new Date(2026, 8, 1), end: new Date(2026, 8, 12) }}
        />
      </Field>
      <Field disabled>
        <FieldLabel>Disabled</FieldLabel>
        <DateRangeField
          {...args}
          defaultValue={{ start: new Date(2026, 8, 1), end: new Date(2026, 8, 12) }}
        />
      </Field>
    </div>
  ),
};
