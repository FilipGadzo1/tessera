import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import {
  ColorAlphaSlider,
  ColorArea,
  ColorEyeDropper,
  ColorFormatToggle,
  ColorHueSlider,
  ColorInput,
  ColorPicker,
  ColorSwatches,
} from "./color-picker";

const meta = {
  title: "Components/ColorPicker",
  component: ColorPicker,
  tags: ["autodocs"],
  args: { defaultValue: "#1d4ed8" },
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const palette = [
  { value: "#1d4ed8", label: "Blue" },
  { value: "#16a34a", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#dc2626", label: "Red" },
  { value: "#7c3aed", label: "Violet" },
  { value: "#0f172a", label: "Slate" },
];

export const Inline: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(args.defaultValue ?? "#1d4ed8");
    return (
      <div className="flex flex-col gap-3">
        <ColorPicker {...args} defaultValue={undefined} value={value} onValueChange={setValue} />
        <p className="text-sm text-muted-foreground">
          Value: <code className="font-mono">{value}</code>
        </p>
      </div>
    );
  },
};

export const WithAlpha: Story = {
  args: { alpha: true, defaultValue: "#1d4ed899" },
};

export const WithSwatches: Story = {
  args: { swatches: palette, defaultValue: "#16a34a" },
};

/** The parts composed by hand: a wider picker with the swatches above the area and no eyedropper. */
export const Composed: Story = {
  render: () => (
    <ColorPicker alpha defaultValue="#7c3aed" swatches={palette} className="w-80">
      <ColorSwatches />
      <ColorArea className="h-48" />
      <ColorHueSlider />
      <ColorAlphaSlider />
      <div className="flex items-center gap-2">
        <ColorInput format="rgb" className="flex-1" />
        <ColorEyeDropper />
      </div>
    </ColorPicker>
  ),
};

export const InAForm: Story = {
  render: function Render() {
    const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null);
    return (
      <Form aria-label="Theme" onFormSubmit={setSubmitted} className="flex flex-col gap-4">
        <Field
          name="accent"
          validate={(value) =>
            value === "#ffffff" ? "White has no contrast on a light page." : null
          }
        >
          <FieldLabel>Accent colour</FieldLabel>
          <ColorPicker defaultValue="#1d4ed8" swatches={palette} />
          <FieldDescription>Used for links and buttons.</FieldDescription>
          <FieldError />
        </Field>
        <Button type="submit" className="self-start">
          Save
        </Button>
        {submitted && (
          <p className="text-sm text-muted-foreground">
            Submitted: <code className="font-mono">{JSON.stringify(submitted)}</code>
          </p>
        )}
      </Form>
    );
  },
};

export const Disabled: Story = {
  args: { disabled: true, alpha: true, swatches: palette },
};

/** Localised part names and format labels through composition. */
export const Localised: Story = {
  render: () => (
    <ColorPicker defaultValue="#dc2626" aria-label="Farbwähler">
      <ColorArea
        aria-label="Sättigung und Helligkeit"
        getValueText={(s, v) => `Sättigung ${s} %, Helligkeit ${v} %`}
      />
      <ColorHueSlider aria-label="Farbton" getValueText={(h) => `${h} Grad`} />
      <div className="flex flex-wrap items-center gap-2">
        <ColorInput aria-label="Farbwert" className="min-w-32 flex-1" />
        <ColorFormatToggle aria-label="Farbformat" />
        <ColorEyeDropper aria-label="Farbe vom Bildschirm aufnehmen" />
      </div>
    </ColorPicker>
  ),
};
