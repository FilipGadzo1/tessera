import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { addDays, toDay } from "../../lib/date";
import { Button } from "../button";
import type { DateRange } from "../calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Input } from "../input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
import { DatePicker, type DatePickerButtonProps, DateRangePicker } from "./date-picker";

/** The controls' args for an `editable` picker (its native props are the field group's). */
const editableArgs = ({ locale, size, disabled, weekStartsOn }: DatePickerButtonProps) => ({
  locale,
  size,
  disabled,
  weekStartsOn,
});

const meta = {
  title: "Components/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  args: { locale: "en-US", size: "md", placeholder: "Pick a date", disabled: false },
  argTypes: {
    locale: { control: "select", options: ["en-US", "en-GB", "de-DE", "fr-FR", "ar-EG"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    weekStartsOn: { control: { type: "number", min: 0, max: 6 } },
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<DatePickerButtonProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A Select-styled trigger opens a calendar with focus on the picked day (or today). Arrows,
 * PageUp/PageDown and Home/End move; Enter picks and closes; Escape closes unchanged.
 */
export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState<Date | null>(null);
    return (
      <Field>
        <FieldLabel>Due date</FieldLabel>
        <DatePicker {...args} value={value} onValueChange={setValue} name="due" />
        <FieldDescription>The invoice is sent a week before.</FieldDescription>
      </Field>
    );
  },
};

/** The FieldLabel names the trigger (followed by the value); an invalid Field paints it danger. */
export const InField: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6">
      <Field>
        <FieldLabel>Start date</FieldLabel>
        <DatePicker {...args} defaultValue={new Date(2026, 9, 1)} />
      </Field>
      <Field invalid>
        <FieldLabel>Renewal date</FieldLabel>
        <DatePicker {...args} />
        <FieldError>Pick when the contract renews.</FieldError>
      </Field>
      <Field disabled>
        <FieldLabel>Signed on</FieldLabel>
        <DatePicker {...args} defaultValue={new Date(2026, 8, 14)} />
      </Field>
    </div>
  ),
};

/** Same heights as Select and Input at every size. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <DatePicker key={size} {...args} size={size} aria-label={`Date (${size})`} />
      ))}
    </div>
  ),
};

/**
 * `editable`: type the date into segments (digits auto-advance, arrows step) or open the calendar
 * with the icon button. Typing a complete date moves the calendar to its month; picking fills the
 * segments and returns focus to the icon button.
 */
export const Editable: Story = {
  render: (args) => {
    const [value, setValue] = useState<Date | null>(null);
    return (
      <Field>
        <FieldLabel>Due date</FieldLabel>
        <DatePicker
          {...editableArgs(args)}
          editable
          value={value}
          onValueChange={setValue}
          name="due"
        />
        <FieldDescription>Type it or pick it.</FieldDescription>
      </Field>
    );
  },
};

/** An editable picker in an invalid and a disabled Field. */
export const EditableInField: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6">
      <Field invalid>
        <FieldLabel>Renewal date</FieldLabel>
        <DatePicker {...editableArgs(args)} editable />
        <FieldError>Pick when the contract renews.</FieldError>
      </Field>
      <Field disabled>
        <FieldLabel>Signed on</FieldLabel>
        <DatePicker {...editableArgs(args)} editable defaultValue={new Date(2026, 8, 14)} />
      </Field>
    </div>
  ),
};

const sizeRows = [
  { size: "sm", name: "Small", height: "32px" },
  { size: "md", name: "Medium", height: "40px" },
  { size: "lg", name: "Large", height: "48px" },
] as const;

/**
 * Alignment check, not a form: at each size the editable picker sits under an Input and a Select
 * so you can compare heights and where the text starts. The Input and Select are only reference
 * controls and do nothing.
 */
export const EditableSizes: Story = {
  name: "Editable sizes (alignment check)",
  render: (args) => (
    <div className="flex flex-col gap-6">
      {sizeRows.map(({ size, name, height }) => (
        <section key={size} aria-label={`${name} (${size})`} className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {name} · <code className="font-mono">size="{size}"</code> · {height}
          </h3>
          <div className="grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-2">
            <span className="text-xs text-muted-foreground">Reference</span>
            <Input size={size} placeholder="Input" aria-label={`Reference input (${size})`} />
            <span className="text-xs text-muted-foreground">Reference</span>
            <Select items={{ a: "Select" }}>
              <SelectTrigger size={size} aria-label={`Reference select (${size})`}>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Select</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs font-medium text-foreground">DatePicker</span>
            <DatePicker
              {...editableArgs(args)}
              editable
              size={size}
              aria-label={`Date (${size})`}
            />
          </div>
        </section>
      ))}
    </div>
  ),
};

/** Only the next 30 days, weekdays only. Disabled days stay reachable by keyboard but can't be picked. */
export const MinMax: Story = {
  name: "Min / Max",
  render: (args) => {
    const today = toDay(new Date());
    return (
      <Field>
        <FieldLabel>Delivery day</FieldLabel>
        <DatePicker
          {...args}
          min={today}
          max={addDays(today, 30)}
          isDateDisabled={(date) => date.getDay() === 0 || date.getDay() === 6}
        />
        <FieldDescription>Weekdays within the next 30 days.</FieldDescription>
      </Field>
    );
  },
};

/**
 * A date far in the past: `defaultMonth` opens the calendar decades back while nothing is picked,
 * and the caption's year and month buttons jump anywhere in a few clicks (year → month → day).
 */
export const Birthday: Story = {
  render: (args) => {
    const [value, setValue] = useState<Date | null>(null);
    const today = toDay(new Date());
    return (
      <Field>
        <FieldLabel>Date of birth</FieldLabel>
        <DatePicker
          {...args}
          value={value}
          onValueChange={setValue}
          defaultMonth={new Date(today.getFullYear() - 30, 0, 1)}
          min={new Date(today.getFullYear() - 120, 0, 1)}
          max={today}
          format={{ dateStyle: "long" }}
          name="birthday"
        />
        <FieldDescription>
          Click the year in the calendar's caption to jump by decades.
        </FieldDescription>
      </Field>
    );
  },
};

/**
 * DateRangePicker: two months side by side. The first pick sets the start and keeps it open;
 * the second sets the end and closes. Escape with only the start chosen reverts.
 */
export const Range: Story = {
  render: ({ locale, size, disabled }) => {
    const [range, setRange] = useState<DateRange>({ start: null, end: null });
    return (
      <Field>
        <FieldLabel>Stay</FieldLabel>
        <DateRangePicker
          locale={locale}
          size={size}
          disabled={disabled}
          value={range}
          onValueChange={setRange}
          startName="check-in"
          endName="check-out"
          min={toDay(new Date())}
        />
        <FieldDescription>Check-in and check-out.</FieldDescription>
      </Field>
    );
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

/** Inside a modal Dialog: the calendar stacks above it, and Escape closes the calendar first. */
export const InDialog: Story = {
  render: (args) => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Schedule post</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule post</DialogTitle>
          <DialogDescription>It goes live at 9:00 on the chosen day.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Publish on</FieldLabel>
          <DatePicker {...args} min={toDay(new Date())} />
        </Field>
        <Field>
          <FieldLabel>Embargo</FieldLabel>
          <DateRangePicker locale={args.locale} numberOfMonths={1} />
        </Field>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" color="neutral" />}>Cancel</DialogClose>
          <DialogClose render={<Button />}>Schedule</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
