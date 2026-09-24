import type { Meta, StoryObj } from "@storybook/react-vite";
import { SignUpForm } from "./sign-up-form";

/**
 * Every form control in one Base UI `Form`: Input, Textarea, RadioGroup (through a Fieldset, one
 * FieldItem per option), Switch, Checkbox and Button, each in a named Field. Submit validates
 * (required name and terms, an email containing "@") and shows the submitted values below.
 * Tessera has no `Form` export yet; import `Form` from `@base-ui/react/form`.
 */
const meta = {
  title: "Tessera/Examples/Sign-up form",
  component: SignUpForm,
} satisfies Meta<typeof SignUpForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignUp: Story = { name: "Sign-up form" };
