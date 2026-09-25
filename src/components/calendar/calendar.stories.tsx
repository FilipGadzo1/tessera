import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { addDays, toDay } from "../../lib/date";
import { Calendar, type CalendarProps, type DateRange, RangeCalendar } from "./calendar";

const meta = {
  title: "Components/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  args: { locale: "en-US", showOutsideDays: true },
  argTypes: {
    locale: { control: "select", options: ["en-US", "en-GB", "de-DE", "fr-FR", "ar-EG"] },
    weekStartsOn: { control: { type: "number", min: 0, max: 6 } },
  },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The args a RangeCalendar shares with Calendar (its value types differ). */
const shared = ({ locale, showOutsideDays, weekStartsOn }: CalendarProps) => ({
  locale,
  showOutsideDays,
  weekStartsOn,
});

const formatDay = (date: Date | null) =>
  date ? date.toLocaleDateString("en-US", { dateStyle: "medium" }) : "none";

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState<Date | null>(null);
    return (
      <div className="flex flex-col items-start gap-2">
        <Calendar {...args} value={value} onValueChange={setValue} />
        <p className="text-sm text-muted-foreground">Selected: {formatDay(value)}</p>
      </div>
    );
  },
};

export const Range: Story = {
  render: (args) => {
    const [range, setRange] = useState<DateRange>({ start: null, end: null });
    return (
      <div className="flex flex-col items-start gap-2">
        <RangeCalendar {...shared(args)} value={range} onValueChange={setRange} />
        <p className="text-sm text-muted-foreground">
          Check-in: {formatDay(range.start)} · Check-out: {formatDay(range.end)}
        </p>
      </div>
    );
  },
};

export const TwoMonths: Story = {
  name: "Two months",
  render: (args) => {
    const today = toDay(new Date());
    return (
      <RangeCalendar
        {...shared(args)}
        numberOfMonths={2}
        defaultValue={{ start: addDays(today, 3), end: addDays(today, 10) }}
      />
    );
  },
};

export const MinMax: Story = {
  name: "Min / Max",
  render: (args) => {
    const today = toDay(new Date());
    return (
      <div className="flex flex-col items-start gap-2">
        <Calendar {...args} min={today} max={addDays(today, 45)} />
        <p className="text-sm text-muted-foreground">
          Delivery can be booked from today up to 45 days ahead.
        </p>
      </div>
    );
  },
};

export const DisabledWeekends: Story = {
  name: "Disabled weekends",
  args: { isDateDisabled: (date: Date) => date.getDay() === 0 || date.getDay() === 6 },
};

export const Locales: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <Calendar locale="en-US" />
      <Calendar
        locale="de-DE"
        labels={{ previousMonth: "Vorheriger Monat", nextMonth: "Nächster Monat" }}
      />
      <div dir="rtl" lang="ar-EG">
        <Calendar
          locale="ar-EG"
          labels={{ previousMonth: "الشهر السابق", nextMonth: "الشهر التالي" }}
        />
      </div>
    </div>
  ),
};

export const WeekStartsMonday: Story = {
  name: "Week starts Monday",
  args: { locale: "en-US", weekStartsOn: 1 },
};
