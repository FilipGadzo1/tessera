import axe from "axe-core";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Button } from "../button";
import { DatePicker } from "../date-picker";
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

  // Documents the current behaviour (see docs/backlog.md): the pickers join a Field for label,
  // description, invalid and disabled state through Base UI internals, but never register as a
  // Field control, so Field `validate` / `required` don't reach them. Form `errors` do show,
  // because the Field derives its invalid state from them on its own.
  it("DatePicker in a Form: shows server errors, skips Field validation, is absent from the submit object but has a YYYY-MM-DD hidden input", async () => {
    const onFormSubmit = vi.fn();
    const screen = await render(
      <>
        <Form aria-label="Invoice" errors={{ due: "Due date is in the past" }}>
          <Field name="due">
            <FieldLabel>Due date</FieldLabel>
            <DatePicker />
            <FieldError />
          </Field>
        </Form>
        <Form aria-label="Booking" onFormSubmit={onFormSubmit}>
          <Field name="when" validate={() => "custom rejects"}>
            <FieldLabel>When</FieldLabel>
            <DatePicker defaultValue={new Date(2026, 8, 25)} />
            <FieldError />
          </Field>
          <Button type="submit">Send</Button>
        </Form>
      </>,
    );
    await expect.element(screen.getByText("Due date is in the past")).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: /Due date/ }))
      .toHaveAttribute("aria-invalid", "true");

    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    // The Field's custom validate is not consulted for the picker: the submit goes through
    // (validation is async, so wait for it), then no error was ever shown.
    await vi.waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
    // Not registered, so its value is absent from the onFormSubmit object; only the hidden input
    // (native FormData) carries it.
    expect(onFormSubmit.mock.calls[0]?.[0]).toEqual({});
    expect(screen.getByText("custom rejects").elements()).toHaveLength(0);
    expect(document.querySelector<HTMLInputElement>("input[name='when']")?.value).toBe(
      "2026-09-25",
    );
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
