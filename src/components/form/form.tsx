"use client";

import { Form as BaseForm } from "@base-ui/react/form";

/**
 * Base UI Form props: `errors` (server-returned errors keyed by Field `name`), `validationMode`
 * (`onSubmit` | `onBlur` | `onChange`), `onFormSubmit(values, details)` (called with the values as
 * an object, after validation passes and with the native submit prevented), `actionsRef`.
 */
export type FormProps<FormValues extends Record<string, unknown> = Record<string, unknown>> =
  BaseForm.Props<FormValues>;

export type FormActions = BaseForm.Actions;
export type FormValidationMode = BaseForm.ValidationMode;

/**
 * A `<form>` that validates its Fields and shows server errors through their `FieldError`. It adds
 * no layout: lay the Fields out with `className` (for example `flex flex-col gap-4`).
 */
export function Form<FormValues extends Record<string, unknown> = Record<string, unknown>>(
  props: FormProps<FormValues>,
) {
  return <BaseForm<FormValues> {...props} data-slot="form" />;
}
