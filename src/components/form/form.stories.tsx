import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Input } from "../input";
import { Form, type FormProps } from "./form";

// Annotated (not `satisfies`): the inferred type would name a Base UI internal in the declaration build.
const meta: Meta<typeof Form> = {
  title: "Components/Form",
  component: Form,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Form>;

/** A fake server: rejects one username. Errors are keyed by the Field's `name` and clear when the field changes. */
export const ServerErrors: Story = {
  name: "Server errors",
  render: () => {
    function Example() {
      const [errors, setErrors] = useState<FormProps["errors"]>({});
      const [saved, setSaved] = useState<string | null>(null);
      return (
        <Form
          className="flex flex-col gap-4"
          errors={errors}
          onFormSubmit={async (values) => {
            setSaved(null);
            await new Promise((resolve) => setTimeout(resolve, 300));
            if (values.username === "admin") {
              setErrors({ username: "That username is taken." });
              return;
            }
            setErrors({});
            setSaved(String(values.username));
          }}
        >
          <Field name="username">
            <FieldLabel>Username</FieldLabel>
            <Input required defaultValue="admin" />
            <FieldDescription>Try "admin" to get a server error.</FieldDescription>
            <FieldError />
          </Field>
          <Button type="submit">Create account</Button>
          {saved && <p className="text-sm text-muted-foreground">Created {saved}.</p>}
        </Form>
      );
    }
    return <Example />;
  },
};

/** `onSubmit` (default) validates on submit, `onBlur` when a field loses focus, `onChange` on every change. */
export const ValidationModes: Story = {
  name: "Validation modes",
  args: { validationMode: "onBlur" },
  argTypes: {
    validationMode: { control: "inline-radio", options: ["onSubmit", "onBlur", "onChange"] },
  },
  render: (args) => (
    <Form {...args} className="flex flex-col gap-4" key={args.validationMode}>
      <Field name="email">
        <FieldLabel>Email</FieldLabel>
        <Input required type="email" />
        <FieldError />
      </Field>
      <Button type="submit">Subscribe</Button>
    </Form>
  ),
};

/** `onFormSubmit` receives the field values as an object keyed by `name`, with the native submit prevented. */
export const SubmitAsObject: Story = {
  name: "Submit as object",
  render: () => {
    function Example() {
      const [values, setValues] = useState<unknown>(null);
      return (
        <Form className="flex flex-col gap-4" onFormSubmit={setValues}>
          <Field name="name">
            <FieldLabel>Name</FieldLabel>
            <Input defaultValue="Ada" />
          </Field>
          <Field name="email">
            <FieldLabel>Email</FieldLabel>
            <Input type="email" defaultValue="ada@example.com" />
          </Field>
          <Button type="submit">Submit</Button>
          {values !== null && (
            <pre className="rounded-md bg-muted p-3 text-xs">{JSON.stringify(values, null, 2)}</pre>
          )}
        </Form>
      );
    }
    return <Example />;
  },
};
