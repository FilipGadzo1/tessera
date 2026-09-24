import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

const languages = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  ja: "日本語",
};

const timezones = {
  "America/New_York": "Eastern Time (New York)",
  "America/Chicago": "Central Time (Chicago)",
  "America/Los_Angeles": "Pacific Time (Los Angeles)",
  "Europe/London": "Greenwich Mean Time (London)",
  "Europe/Berlin": "Central European Time (Berlin)",
  "Europe/Zagreb": "Central European Time (Zagreb)",
  "Asia/Tokyo": "Japan Standard Time (Tokyo)",
  "Australia/Sydney": "Australian Eastern Time (Sydney)",
};

const meta = {
  title: "Components/Select",
  component: SelectContent,
  tags: ["autodocs"],
  args: { side: "bottom", align: "start", sideOffset: 6, alignItemWithTrigger: false },
  argTypes: {
    side: { control: "select", options: ["top", "bottom"] },
    align: { control: "select", options: ["start", "center", "end"] },
    sideOffset: { control: "number" },
    alignItemWithTrigger: { control: "boolean" },
  },
  render: (args) => (
    <Select items={languages} name="language">
      <SelectTrigger aria-label="Language" className="w-56">
        <SelectValue placeholder="Pick a language" />
      </SelectTrigger>
      <SelectContent {...args}>
        {Object.entries(languages).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
} satisfies Meta<typeof SelectContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Click, Enter, Space or ArrowDown opens it; typing jumps to a matching item, Enter selects and
 * closes, and focus returns to the trigger. Pass `items` so the trigger shows labels.
 */
export const Default: Story = {};

/** Groups with muted labels, separated by a hairline. A disabled item can't be chosen. */
export const WithGroups: Story = {
  render: (args) => (
    <Select items={timezones} defaultValue="Europe/Zagreb">
      <SelectTrigger aria-label="Time zone" className="w-80">
        <SelectValue />
      </SelectTrigger>
      <SelectContent {...args}>
        <SelectGroup>
          <SelectGroupLabel>North America</SelectGroupLabel>
          <SelectItem value="America/New_York">{timezones["America/New_York"]}</SelectItem>
          <SelectItem value="America/Chicago">{timezones["America/Chicago"]}</SelectItem>
          <SelectItem value="America/Los_Angeles">{timezones["America/Los_Angeles"]}</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectGroupLabel>Europe</SelectGroupLabel>
          <SelectItem value="Europe/London">{timezones["Europe/London"]}</SelectItem>
          <SelectItem value="Europe/Berlin">{timezones["Europe/Berlin"]}</SelectItem>
          <SelectItem value="Europe/Zagreb">{timezones["Europe/Zagreb"]}</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectGroupLabel>Asia Pacific</SelectGroupLabel>
          <SelectItem value="Asia/Tokyo">{timezones["Asia/Tokyo"]}</SelectItem>
          <SelectItem value="Australia/Sydney" disabled>
            {timezones["Australia/Sydney"]}
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

const channels = {
  email: "Email",
  push: "Push",
  sms: "SMS",
  slack: "Slack",
};

/** `multiple` keeps the list open while you pick, and the trigger joins the labels with commas. */
export const Multiple: Story = {
  render: (args) => (
    <Select items={channels} multiple defaultValue={["email", "slack"]}>
      <SelectTrigger aria-label="Notify me by" className="w-64">
        <SelectValue placeholder="No channels" />
      </SelectTrigger>
      <SelectContent {...args}>
        {Object.entries(channels).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
};

/** Inside a Field: the label names the trigger, and an invalid Field gives it the danger border. */
export const InField: Story = {
  render: (args) => (
    <div className="flex w-72 flex-col gap-6">
      <Field>
        <FieldLabel>Language</FieldLabel>
        <Select items={languages} defaultValue="en">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent {...args}>
            {Object.entries(languages).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>Used for emails and the interface.</FieldDescription>
      </Field>
      <Field invalid>
        <FieldLabel>Time zone</FieldLabel>
        <Select items={timezones}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a time zone" />
          </SelectTrigger>
          <SelectContent {...args}>
            {Object.entries(timezones).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError>Choose a time zone to schedule reports.</FieldError>
      </Field>
    </div>
  ),
};

/** `size` matches Input (and Button) heights, so a Select lines up in a toolbar row. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <div key={size} className="flex items-center gap-2">
          <Input
            size={size}
            aria-label={`Search (${size})`}
            placeholder="Search…"
            className="w-48"
          />
          <Select items={languages} defaultValue="en">
            <SelectTrigger size={size} aria-label={`Language (${size})`} className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...args}>
              {Object.entries(languages).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size={size}>Apply</Button>
        </div>
      ))}
    </div>
  ),
};

/** Inside a modal Dialog: the list stacks above it, and Escape closes the select first. */
export const InDialog: Story = {
  render: (args) => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Edit preferences</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
          <DialogDescription>Language and time zone apply to your whole account.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Language</FieldLabel>
          <Select items={languages} defaultValue="en">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...args}>
              {Object.entries(languages).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Time zone</FieldLabel>
          <Select items={timezones} defaultValue="Europe/Zagreb">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...args}>
              {Object.entries(timezones).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" color="neutral" />}>Cancel</DialogClose>
          <DialogClose render={<Button />}>Save changes</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
