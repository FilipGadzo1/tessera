import type { Meta, StoryObj } from "@storybook/react-vite";
import { Field, FieldDescription, FieldLabel } from "../field";
import { Label } from "../label";
import { Switch } from "./switch";

const meta = {
  title: "Components/Switch",
  component: Switch,
  tags: ["autodocs"],
  args: { "aria-label": "Notifications" },
  argTypes: {
    checked: { control: "boolean" },
    defaultChecked: { control: "boolean" },
    disabled: { control: "boolean" },
    readOnly: { control: "boolean" },
    required: { control: "boolean" },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Label className="flex items-center gap-2">
        <Switch />
        Off
      </Label>
      <Label className="flex items-center gap-2">
        <Switch defaultChecked />
        On
      </Label>
      <Label className="flex items-center gap-2">
        <Switch disabled />
        Disabled
      </Label>
      <Label className="flex items-center gap-2">
        <Switch disabled defaultChecked />
        Disabled, on
      </Label>
      <Label className="flex items-center gap-2">
        <Switch readOnly defaultChecked />
        Read-only, on
      </Label>
      <Field invalid>
        <FieldLabel className="flex items-center gap-2">
          <Switch />
          Invalid
        </FieldLabel>
      </Field>
    </div>
  ),
};

const settings = [
  { name: "email", label: "Email notifications", on: true },
  { name: "push", label: "Push notifications", on: false },
  { name: "digest", label: "Weekly digest", on: true },
] as const;

/** Settings-list pattern: the label text on the left, the switch on the right. */
export const WithLabel: Story = {
  render: () => (
    <div className="flex max-w-80 flex-col gap-3">
      {settings.map((setting) => (
        <Label key={setting.name} className="flex items-center justify-between gap-4">
          {setting.label}
          <Switch name={setting.name} defaultChecked={setting.on} />
        </Label>
      ))}
    </div>
  ),
};

/** Inside a Field, FieldLabel names the switch and FieldDescription describes it. */
export const InField: Story = {
  render: () => (
    <Field className="max-w-80">
      <FieldLabel className="flex items-center justify-between gap-4">
        Airplane mode
        <Switch name="airplane" />
      </FieldLabel>
      <FieldDescription>Turns off all wireless connections.</FieldDescription>
    </Field>
  ),
};
