"use client";

import { Field as BaseField } from "@base-ui/react/field";
import { createContext, useContext } from "react";
import { mergeClassName } from "../../lib/merge-class-name";

export type FieldProps = BaseField.Root.Props;
export type FieldLabelProps = BaseField.Label.Props;
export type FieldDescriptionProps = BaseField.Description.Props;
export type FieldErrorProps = BaseField.Error.Props;
export type FieldItemProps = BaseField.Item.Props;

/**
 * Base UI's Field.Error only follows computed validity (native constraints, `validate`, Form
 * errors), not the Field's `invalid` prop. This carries `invalid` down so FieldError shows it.
 */
const FieldInvalidContext = createContext(false);

/** Groups a label, control, description and error; wires ids, `aria-describedby` and validation. */
export function Field({ className, ...props }: FieldProps) {
  return (
    <FieldInvalidContext.Provider value={props.invalid === true}>
      <BaseField.Root
        {...props}
        data-slot="field"
        className={mergeClassName("flex flex-col gap-1.5", className)}
      />
    </FieldInvalidContext.Provider>
  );
}

/** Labels the Field's control; its text dims (muted color, not opacity) while the Field is disabled. */
export function FieldLabel({ className, ...props }: FieldLabelProps) {
  return (
    <BaseField.Label
      {...props}
      data-slot="field-label"
      className={mergeClassName(
        "text-sm font-medium leading-snug text-foreground data-disabled:text-muted-foreground",
        className,
      )}
    />
  );
}

/**
 * One option of a radio or checkbox group inside a Field. Gives the option its own label and
 * description ids; without it every option shares the Field's ids and takes the first label.
 */
export function FieldItem({ className, ...props }: FieldItemProps) {
  return (
    <BaseField.Item
      {...props}
      data-slot="field-item"
      className={mergeClassName("flex flex-col gap-1", className)}
    />
  );
}

/** Helper text, referenced by the control's `aria-describedby`. */
export function FieldDescription({ className, ...props }: FieldDescriptionProps) {
  return (
    <BaseField.Description
      {...props}
      data-slot="field-description"
      className={mergeClassName("text-sm text-muted-foreground", className)}
    />
  );
}

/**
 * Error message, rendered only while the Field is invalid: from `validate`, native constraints,
 * Form errors, or the Field's `invalid` prop. An explicit `match` takes precedence.
 */
export function FieldError({ className, match, ...props }: FieldErrorProps) {
  const fieldInvalid = useContext(FieldInvalidContext);
  return (
    <BaseField.Error
      {...props}
      match={match ?? (fieldInvalid || undefined)}
      data-slot="field-error"
      className={mergeClassName("text-sm text-danger", className)}
    />
  );
}
