import axe from "axe-core";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { waitForPopupSettled } from "../../../test/overlay";
import { Button } from "../button";
import type { DateRange } from "../calendar";
import { DateField } from "../date-field";
import { DatePicker, DateRangePicker } from "../date-picker";
import { Field, FieldError, FieldLabel } from "../field";
import { Input } from "../input";
import { Form, type FormProps } from "./form";

function EmailForm(props: FormProps) {
  return (
    <Form aria-label="Sign up" {...props}>
      <Field name="email">
        <FieldLabel>Email</FieldLabel>
        <Input required type="email" />
        <FieldError />
      </Field>
      <Field name="nickname">
        <FieldLabel>Nickname</FieldLabel>
        <Input />
        <FieldError />
      </Field>
      <Button type="submit">Send</Button>
    </Form>
  );
}

describe("Form", () => {
  it("renders a form with data-slot and merges className (string and function form)", async () => {
    const screen = await render(
      <>
        <Form aria-label="One" className="flex flex-col gap-4" />
        <Form aria-label="Two" className={() => "grid"} />
      </>,
    );
    const one = screen.getByRole("form", { name: "One" });
    await expect.element(one).toHaveAttribute("data-slot", "form");
    await expect.element(one).toHaveClass("flex", "flex-col", "gap-4");
    await expect.element(screen.getByRole("form", { name: "Two" })).toHaveClass("grid");
  });

  it("submits the values as an object through onFormSubmit", async () => {
    const onFormSubmit = vi.fn();
    const screen = await render(<EmailForm onFormSubmit={onFormSubmit} />);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Nickname"), "ada");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onFormSubmit).toHaveBeenCalledTimes(1);
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({ email: "ada@example.com", nickname: "ada" });
  });

  it("blocks submit and shows the native error on an invalid required field", async () => {
    const onFormSubmit = vi.fn();
    const screen = await render(<EmailForm onFormSubmit={onFormSubmit} />);
    await expect.element(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onFormSubmit).not.toHaveBeenCalled();
    await expect.element(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    await expect.element(screen.getByText(/fill out this field/i)).toBeVisible();
  });

  it("shows server errors by field name in FieldError and clears them on change", async () => {
    const screen = await render(<EmailForm errors={{ email: "Email is already taken" }} />);
    const email = screen.getByLabelText("Email");
    await expect.element(screen.getByText("Email is already taken")).toBeVisible();
    await expect.element(email).toHaveAttribute("aria-invalid", "true");
    await expect.element(screen.getByLabelText("Nickname")).not.toHaveAttribute("aria-invalid");
    await userEvent.type(email, "x");
    await expect.element(screen.getByText("Email is already taken")).not.toBeInTheDocument();
    await expect.element(email).not.toHaveAttribute("aria-invalid");
  });

  it("accepts an array of errors for one field", async () => {
    const screen = await render(<EmailForm errors={{ nickname: ["Too short", "Not allowed"] }} />);
    await expect.element(screen.getByText("Too short")).toBeVisible();
  });

  it("shows fresh server errors set from onFormSubmit", async () => {
    function Server() {
      const [errors, setErrors] = useState<FormProps["errors"]>({});
      return (
        <EmailForm
          errors={errors}
          onFormSubmit={() => setErrors({ email: "Rejected by the server" })}
        />
      );
    }
    const screen = await render(<Server />);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await expect.element(screen.getByText("Rejected by the server")).toBeVisible();
  });

  it("validationMode onSubmit (default): nothing shows on blur, only on submit", async () => {
    const screen = await render(<EmailForm />);
    const email = screen.getByLabelText("Email");
    await userEvent.type(email, "x");
    await userEvent.clear(email);
    await userEvent.tab();
    await expect.element(email).not.toHaveAttribute("aria-invalid");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await expect.element(email).toHaveAttribute("aria-invalid", "true");
  });

  it("validationMode onBlur: validates when the field loses focus", async () => {
    const screen = await render(<EmailForm validationMode="onBlur" />);
    const email = screen.getByLabelText("Email");
    // Base UI reports a missing value only once the field has been changed (dirty).
    await userEvent.type(email, "x");
    await userEvent.clear(email);
    await expect.element(email).not.toHaveAttribute("aria-invalid");
    await userEvent.tab();
    await expect.element(email).toHaveAttribute("aria-invalid", "true");
    await expect.element(screen.getByText(/fill out this field/i)).toBeVisible();
  });

  it("validationMode onChange: validates on every change", async () => {
    const screen = await render(<EmailForm validationMode="onChange" />);
    const email = screen.getByLabelText("Email");
    await userEvent.type(email, "x");
    await expect.element(email).toHaveAttribute("aria-invalid", "true");
    await userEvent.type(email, "@b.co");
    await expect.element(email).not.toHaveAttribute("aria-invalid");
  });

  it("actionsRef.validate() validates every field on demand", async () => {
    const actionsRef: NonNullable<FormProps["actionsRef"]> = { current: null };
    const screen = await render(<EmailForm actionsRef={actionsRef} />);
    const email = screen.getByLabelText("Email");
    await expect.element(email).not.toHaveAttribute("aria-invalid");
    actionsRef.current?.validate();
    await expect.element(email).toHaveAttribute("aria-invalid", "true");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <EmailForm errors={{ email: "Email is already taken" }} className="flex flex-col gap-4" />
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});

/* The date controls join Field validation and Form the way Base UI's Select does (spec Phase H §3). */

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const fullDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(date);
const dayButton = (date: Date) => page.getByRole("button", { name: fullDate(date), exact: true });
const pickerTrigger = () =>
  document.querySelector<HTMLElement>("[data-slot=date-picker-trigger]") as HTMLElement;
const firstSegment = () =>
  document.querySelector<HTMLElement>("[data-slot=date-field-segment]") as HTMLElement;

const pickerPopup = () => document.querySelector("[data-slot=date-picker-content]");

async function openPicker() {
  await userEvent.click(pickerTrigger());
  await expect.poll(pickerPopup).not.toBeNull();
  await waitForPopupSettled(pickerPopup() as Element);
}

interface DateControlOptions {
  required?: boolean;
  filled?: boolean;
  min?: Date;
  /** The native names: DateField / DatePicker `name`, DateRangePicker `startName` / `endName`. */
  native?: boolean;
}

interface DateControlCase {
  control: (options: DateControlOptions) => ReactNode;
  /** What Form focuses on an invalid submit, and what carries `aria-invalid`. */
  visible: () => HTMLElement;
  /** The value Field `validate` receives for the filled control. */
  validated: unknown;
  /** The filled control's `onFormSubmit` value, the empty one's, and its value after `change`. */
  submitted: unknown;
  empty: unknown;
  changed: unknown;
  /** Changes the value through the UI. */
  change: () => Promise<void>;
  /** The native FormData entries of the filled control rendered with `native`. */
  formData: Record<string, string>;
}

const FILLED = d(2026, 9, 5);
const FILLED_RANGE: DateRange = { start: d(2026, 9, 5), end: d(2026, 9, 12) };

const dateCases: Record<string, DateControlCase> = {
  DateField: {
    control: ({ required, filled, min, native }) => (
      <DateField
        locale="en-US"
        required={required}
        min={min}
        name={native ? "due" : undefined}
        defaultValue={filled ? FILLED : null}
      />
    ),
    visible: firstSegment,
    validated: FILLED,
    submitted: "2026-09-05",
    empty: "",
    changed: "2026-10-05",
    change: async () => {
      await userEvent.click(firstSegment());
      await userEvent.keyboard("{ArrowUp}");
    },
    formData: { due: "2026-09-05" },
  },
  DatePicker: {
    control: ({ required, filled, min, native }) => (
      <DatePicker
        locale="en-US"
        required={required}
        min={min}
        name={native ? "due" : undefined}
        defaultValue={filled ? FILLED : null}
      />
    ),
    visible: pickerTrigger,
    validated: FILLED,
    submitted: "2026-09-05",
    empty: "",
    changed: "2026-09-08",
    change: async () => {
      await openPicker();
      await userEvent.click(dayButton(d(2026, 9, 8)));
    },
    formData: { due: "2026-09-05" },
  },
  DateRangePicker: {
    control: ({ required, filled, min, native }) => (
      <DateRangePicker
        locale="en-US"
        required={required}
        min={min}
        startName={native ? "from" : undefined}
        endName={native ? "to" : undefined}
        defaultValue={filled ? FILLED_RANGE : undefined}
      />
    ),
    visible: pickerTrigger,
    validated: FILLED_RANGE,
    submitted: { start: "2026-09-05", end: "2026-09-12" },
    empty: { start: "", end: "" },
    changed: { start: "2026-09-08", end: "2026-09-10" },
    change: async () => {
      await openPicker();
      await userEvent.click(dayButton(d(2026, 9, 8)));
      await userEvent.click(dayButton(d(2026, 9, 10)));
    },
    formData: { from: "2026-09-05", to: "2026-09-12" },
  },
};

function DateForm({
  children,
  validate,
  ...props
}: FormProps & { validate?: (value: unknown) => string | null }) {
  return (
    // A submit that passes must never reach the network (it would reload the test iframe).
    <Form aria-label="Booking" onFormSubmit={props.onSubmit ? undefined : () => {}} {...props}>
      <Field name="when" validate={validate}>
        <FieldLabel>When</FieldLabel>
        {children}
        <FieldError />
      </Field>
      <Button type="submit">Send</Button>
    </Form>
  );
}

const send = () => userEvent.click(page.getByRole("button", { name: "Send", exact: true }));

describe.each(Object.entries(dateCases))("%s in a Form", (_name, c) => {
  it("required: blocks submit, shows the native message, marks and focuses the visible control", async () => {
    const onFormSubmit = vi.fn();
    await render(<DateForm onFormSubmit={onFormSubmit}>{c.control({ required: true })}</DateForm>);
    await expect.element(c.visible()).not.toHaveAttribute("aria-invalid");
    await send();
    await expect.element(page.getByText(/fill out this field/i)).toBeVisible();
    expect(onFormSubmit).not.toHaveBeenCalled();
    await expect.element(c.visible()).toHaveAttribute("aria-invalid", "true");
    await expect.poll(() => document.activeElement).toBe(c.visible());
  });

  it("runs the Field's validate with the value and blocks submit on its error", async () => {
    const onFormSubmit = vi.fn();
    const validate = vi.fn((_value: unknown) => "Not that day");
    await render(
      <DateForm onFormSubmit={onFormSubmit} validate={validate}>
        {c.control({ filled: true })}
      </DateForm>,
    );
    await send();
    await expect.element(page.getByText("Not that day")).toBeVisible();
    expect(onFormSubmit).not.toHaveBeenCalled();
    expect(validate.mock.lastCall?.[0]).toEqual(c.validated);
    await expect.poll(() => document.activeElement).toBe(c.visible());
  });

  it("shows errors[name] and clears it when the value changes", async () => {
    await render(
      <DateForm errors={{ when: "Fully booked" }}>{c.control({ filled: true })}</DateForm>,
    );
    await expect.element(page.getByText("Fully booked")).toBeVisible();
    await expect.element(c.visible()).toHaveAttribute("aria-invalid", "true");
    await c.change();
    await expect.element(page.getByText("Fully booked")).not.toBeInTheDocument();
    await expect.element(c.visible()).not.toHaveAttribute("aria-invalid");
  });

  it("reports the ISO value in onFormSubmit, empty when unset, and the changed value", async () => {
    const filled = vi.fn();
    const screen = await render(
      <DateForm onFormSubmit={filled}>{c.control({ filled: true })}</DateForm>,
    );
    await send();
    await vi.waitFor(() => expect(filled).toHaveBeenCalledTimes(1));
    expect(filled.mock.calls[0]?.[0]).toEqual({ when: c.submitted });

    await c.change();
    await send();
    await vi.waitFor(() => expect(filled).toHaveBeenCalledTimes(2));
    expect(filled.mock.calls[1]?.[0]).toEqual({ when: c.changed });
    await screen.unmount();

    const empty = vi.fn();
    await render(<DateForm onFormSubmit={empty}>{c.control({})}</DateForm>);
    await send();
    await vi.waitFor(() => expect(empty).toHaveBeenCalledTimes(1));
    expect(empty.mock.calls[0]?.[0]).toEqual({ when: c.empty });
  });

  it("keeps the native FormData entries as YYYY-MM-DD", async () => {
    let data: FormData | null = null;
    await render(
      <DateForm
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        {c.control({ filled: true, native: true })}
      </DateForm>,
    );
    await send();
    await expect.poll(() => data).not.toBeNull();
    const entries = Object.fromEntries((data as unknown as FormData).entries());
    expect(entries).toEqual(c.formData);
  });

  it("min: an earlier value blocks submit with a localised message", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <DateForm onFormSubmit={onFormSubmit}>
        {c.control({ filled: true, min: d(2026, 9, 10) })}
      </DateForm>,
    );
    await send();
    await expect.element(page.getByText("Enter a date on or after Sep 10, 2026.")).toBeVisible();
    expect(onFormSubmit).not.toHaveBeenCalled();
    await expect.poll(() => document.activeElement).toBe(c.visible());
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations with an error shown (%s)",
    async (theme) => {
      const screen = await render(
        <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
          <DateForm>{c.control({ required: true })}</DateForm>
        </div>,
      );
      await send();
      await expect.element(page.getByText(/fill out this field/i)).toBeVisible();
      const results = await axe.run(screen.container);
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
    },
  );
});

describe("date controls in a Form: specifics", () => {
  it("DateField: partial input blocks submit with an incomplete-date message", async () => {
    const onFormSubmit = vi.fn();
    await render(
      <DateForm onFormSubmit={onFormSubmit}>
        <DateField locale="en-US" />
      </DateForm>,
    );
    await userEvent.click(firstSegment());
    await userEvent.keyboard("9");
    await send();
    await expect.element(page.getByText("Enter a complete date.")).toBeVisible();
    expect(onFormSubmit).not.toHaveBeenCalled();
    await expect.poll(() => document.activeElement).toBe(firstSegment());
  });

  it("DatePicker: an unavailable day and the messages' labels overrides", async () => {
    await render(
      <>
        <DateForm>
          <DatePicker
            locale="en-US"
            defaultValue={FILLED}
            isDateDisabled={(date) => date.getDate() === 5}
          />
        </DateForm>
        <Form aria-label="Other" onFormSubmit={() => {}}>
          <Field name="other">
            <FieldLabel>Other</FieldLabel>
            <DatePicker
              locale="en-US"
              defaultValue={FILLED}
              max={d(2026, 9, 1)}
              labels={{ rangeOverflow: (max) => `Au plus tard le ${max}` }}
            />
            <FieldError />
          </Field>
          <Button type="submit">Send other</Button>
        </Form>
      </>,
    );
    await send();
    await expect.element(page.getByText("This date is unavailable.")).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Send other" }));
    await expect.element(page.getByText("Au plus tard le Sep 1, 2026")).toBeVisible();
  });

  it("DateRangePicker: only the start set blocks submit with an incomplete-range message", async () => {
    function Partial() {
      const [value, setValue] = useState<DateRange>({ start: FILLED, end: null });
      return (
        <DateForm>
          <DateRangePicker locale="en-US" required value={value} onValueChange={setValue} />
        </DateForm>
      );
    }
    await render(<Partial />);
    await send();
    await expect.element(page.getByText("Choose both a start and an end date.")).toBeVisible();
    await expect.poll(() => document.activeElement).toBe(pickerTrigger());
  });

  it("focus-first-invalid picks the first invalid control in document order", async () => {
    await render(
      <Form aria-label="Trip" onFormSubmit={() => {}}>
        <Field name="note">
          <FieldLabel>Note</FieldLabel>
          <Input />
        </Field>
        <Field name="depart">
          <FieldLabel>Depart</FieldLabel>
          <DateField locale="en-US" required />
        </Field>
        <Field name="back">
          <FieldLabel>Back</FieldLabel>
          <DatePicker locale="en-US" required />
        </Field>
        <Button type="submit">Send</Button>
      </Form>,
    );
    await send();
    await expect.poll(() => document.activeElement).toBe(firstSegment());
  });

  it("validationMode onBlur: validates when focus leaves the whole control, not between its parts", async () => {
    await render(
      <Form aria-label="Trip" validationMode="onBlur">
        <Field name="depart">
          <FieldLabel>Depart</FieldLabel>
          <DateField locale="en-US" defaultValue={FILLED} min={d(2026, 9, 10)} />
          <FieldError />
        </Field>
        <Field name="back">
          <FieldLabel>Back</FieldLabel>
          <DatePicker locale="en-US" defaultValue={FILLED} max={d(2026, 9, 1)} />
          <FieldError />
        </Field>
        <Input aria-label="After" />
      </Form>,
    );
    const underflow = page.getByText("Enter a date on or after Sep 10, 2026.");
    const overflow = page.getByText("Enter a date on or before Sep 1, 2026.");
    await userEvent.click(firstSegment());
    // Moving between segments stays inside the field.
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(underflow).not.toBeInTheDocument();
    await userEvent.tab();
    await userEvent.tab();
    await expect.element(underflow).toBeVisible();
    // Tab now sits on the picker's trigger; opening moves focus into the popup (not a blur).
    await expect.poll(() => document.activeElement).toBe(pickerTrigger());
    await openPicker();
    await expect.element(overflow).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.activeElement).toBe(pickerTrigger());
    await expect.element(overflow).not.toBeInTheDocument();
    await userEvent.tab();
    await expect.element(overflow).toBeVisible();
  });

  it("the hidden control forwards its own focus to the visible control", async () => {
    await render(
      <DateForm>
        <DatePicker locale="en-US" name="due" />
      </DateForm>,
    );
    document.querySelector<HTMLInputElement>("input[name=due]")?.focus();
    await expect.poll(() => document.activeElement).toBe(pickerTrigger());
  });
});
