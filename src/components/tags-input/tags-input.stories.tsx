import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import { type TagRejection, TagsInput } from "./tags-input";

const meta = {
  title: "Components/TagsInput",
  component: TagsInput,
  tags: ["autodocs"],
  args: { size: "md", disabled: false, readOnly: false, placeholder: "Add a topic" },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TagsInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Type a topic and press Enter or "," to add it; Backspace in the empty input removes the last
 * one, and × removes any. Pasting "a, b, c" adds three. Each add and removal is announced.
 */
export const Basic: Story = {
  render: (args) => {
    const [tags, setTags] = useState(["react", "typescript"]);
    return (
      <Field>
        <FieldLabel>Topics</FieldLabel>
        <TagsInput {...args} value={tags} onValueChange={setTags} />
        <FieldDescription>Value: {JSON.stringify(tags)}</FieldDescription>
      </Field>
    );
  },
};

/**
 * `max`, duplicates and `validate` reject an entry: the text stays in the input, the field shows
 * as invalid until it changes, and the reason is announced (here also shown below the field).
 */
export const MaxAndValidate: Story = {
  name: "Max and validate",
  render: (args) => {
    const [rejection, setRejection] = useState<TagRejection | null>(null);
    return (
      <Field>
        <FieldLabel>Labels</FieldLabel>
        <TagsInput
          {...args}
          placeholder="Add a label"
          defaultValue={["bug", "docs"]}
          max={5}
          validate={(tag) =>
            tag !== tag.toLowerCase()
              ? "Use lowercase letters"
              : /\s/.test(tag)
                ? "Use no spaces"
                : null
          }
          onTagRejected={setRejection}
        />
        <FieldDescription>
          Lowercase, no spaces, up to 5.
          {rejection && ` Last rejection: ${rejection.reason} (${rejection.message}).`}
        </FieldDescription>
      </Field>
    );
  },
};

/** `delimiters={[",", ";", " "]}`: a comma, a semicolon or a space commits, as Enter does. */
export const CustomDelimiters: Story = {
  name: "Custom delimiters",
  render: (args) => (
    <Field>
      <FieldLabel>Recipients</FieldLabel>
      <TagsInput
        {...args}
        placeholder="name@example.com"
        delimiters={[",", ";", " "]}
        defaultValue={["ada@example.com"]}
        addOnBlur
      />
      <FieldDescription>Separate with a comma, a semicolon or a space.</FieldDescription>
    </Field>
  ),
};

/**
 * In a Form: one FormData entry per tag under the Field's name; `required` needs at least one tag.
 * The echo shows `FormData.getAll("topics")` and `onFormSubmit`'s values.
 */
export const InAForm: Story = {
  name: "In a Form",
  render: (args) => {
    const formRef = useRef<HTMLFormElement>(null);
    const [submitted, setSubmitted] = useState("nothing yet");
    return (
      <Form
        ref={formRef}
        aria-label="Post"
        className="flex flex-col gap-4"
        onFormSubmit={(values) => {
          const all = formRef.current ? new FormData(formRef.current).getAll("topics") : [];
          setSubmitted(`getAll: ${JSON.stringify(all)}, values: ${JSON.stringify(values)}`);
        }}
      >
        <Field name="topics">
          <FieldLabel>Topics</FieldLabel>
          <TagsInput {...args} required defaultValue={["design"]} />
          <FieldDescription>At least one topic.</FieldDescription>
          <FieldError />
        </Field>
        <Button type="submit" className="self-start">
          Publish
        </Button>
        <output className="text-sm text-muted-foreground">Submitted: {submitted}</output>
      </Form>
    );
  },
};

/** Read-only tags have no remove buttons; a disabled field leaves the Tab order. */
export const DisabledReadOnly: Story = {
  name: "Read-only and disabled",
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>Read-only</FieldLabel>
        <TagsInput {...args} readOnly defaultValue={["react", "vue"]} />
      </Field>
      <Field disabled>
        <FieldLabel>Disabled</FieldLabel>
        <TagsInput {...args} defaultValue={["react", "vue"]} />
      </Field>
    </div>
  ),
};

/** The Input heights: 32, 40 and 48px while the tags fit on one line. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Field key={size}>
          <FieldLabel>Size {size}</FieldLabel>
          <TagsInput {...args} size={size} defaultValue={["react", "vue"]} />
        </Field>
      ))}
    </div>
  ),
};

/** In an RTL page the tags run right to left, and → (not ←) at the input's start enters them. */
export const RTL: Story = {
  render: (args) => (
    <div dir="rtl" lang="ar">
      <Field>
        <FieldLabel>الوسوم</FieldLabel>
        <TagsInput
          {...args}
          placeholder="أضف وسمًا"
          listLabel="الوسوم"
          defaultValue={["تصميم", "برمجة", "react"]}
        />
      </Field>
    </div>
  ),
};

/**
 * The keys. In the input: Enter or a delimiter adds the text; Enter in the empty input submits the
 * form; Backspace in the empty input removes the last tag; ← (→ in RTL) at the start of the text
 * moves to the last tag's remove button; Escape clears the text. On a remove button: ← / → move
 * between the tags (past the last: back to the input), Home / End jump to the first / last,
 * Backspace, Delete, Enter or Space remove the tag, and Escape returns to the input. Tab leaves:
 * the input is the field's only Tab stop.
 */
export const Keyboard: Story = {
  render: (args) => (
    <Field>
      <FieldLabel>Skills</FieldLabel>
      <TagsInput {...args} defaultValue={["css", "html", "javascript", "react"]} />
      <FieldDescription>Press ← at the start of the input to reach the tags.</FieldDescription>
    </Field>
  ),
};
