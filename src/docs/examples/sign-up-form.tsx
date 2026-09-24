"use client";

import { Form } from "@base-ui/react/form";
import { useState } from "react";
import { Button } from "../../components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/card";
import { Checkbox } from "../../components/checkbox";
import { Field, FieldDescription, FieldError, FieldItem, FieldLabel } from "../../components/field";
import { Fieldset, FieldsetLegend } from "../../components/fieldset";
import { Input } from "../../components/input";
import { Radio, RadioGroup } from "../../components/radio-group";
import { Switch } from "../../components/switch";
import { Textarea } from "../../components/textarea";

const plans = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "team", label: "Team" },
] as const;

function validateEmail(value: unknown) {
  return typeof value === "string" && value.includes("@") ? null : "Enter a valid email address";
}

/**
 * Example only (not exported from the library): every Phase B form control composed inside Base
 * UI's `Form`. Each Field's `name` becomes a key in the submitted values; errors show on submit.
 */
export function SignUpForm() {
  const [values, setValues] = useState<Record<string, unknown> | null>(null);
  // Remounting the form resets every control, including the non-native Checkbox, Switch and Radio.
  const [formKey, setFormKey] = useState(0);

  function reset() {
    setValues(null);
    setFormKey((key) => key + 1);
  }

  return (
    <div className="flex w-[28rem] max-w-full flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Create your account
          </CardTitle>
          <CardDescription>Start on any plan; you can change it later.</CardDescription>
        </CardHeader>
        <Form key={formKey} className="flex flex-col gap-6" onFormSubmit={setValues}>
          <CardContent className="flex flex-col gap-5">
            <Field name="name">
              <FieldLabel>Name</FieldLabel>
              <Input required autoComplete="name" />
              <FieldError match="valueMissing">Enter your name</FieldError>
            </Field>

            <Field name="email" validate={validateEmail}>
              <FieldLabel>Email</FieldLabel>
              <Input type="text" inputMode="email" autoComplete="email" />
              <FieldError />
            </Field>

            <Field name="plan">
              <Fieldset render={<RadioGroup defaultValue="free" />}>
                <FieldsetLegend>Plan</FieldsetLegend>
                {plans.map((plan) => (
                  <FieldItem key={plan.value}>
                    <FieldLabel className="flex items-center gap-2 font-normal">
                      <Radio value={plan.value} />
                      {plan.label}
                    </FieldLabel>
                  </FieldItem>
                ))}
              </Fieldset>
            </Field>

            <Field name="about">
              <FieldLabel>About you</FieldLabel>
              <Textarea rows={3} />
              <FieldDescription>Optional. Helps us tailor your onboarding.</FieldDescription>
            </Field>

            <Field name="newsletter">
              <FieldLabel className="flex items-center justify-between gap-4">
                Newsletter
                <Switch />
              </FieldLabel>
              <FieldDescription>Product news, once a month.</FieldDescription>
            </Field>

            <Field name="terms">
              <FieldLabel className="flex items-center gap-2 font-normal">
                <Checkbox required />I accept the terms of service
              </FieldLabel>
              <FieldError match="valueMissing">Accept the terms to continue</FieldError>
            </Field>
          </CardContent>
          <CardFooter>
            <Button type="submit">Create account</Button>
            <Button type="button" variant="ghost" color="neutral" onClick={reset}>
              Reset
            </Button>
          </CardFooter>
        </Form>
      </Card>

      {values && (
        <pre
          data-testid="sign-up-result"
          className="overflow-x-auto rounded-md bg-muted p-4 text-muted-foreground text-xs"
        >
          {JSON.stringify(values, null, 2)}
        </pre>
      )}
    </div>
  );
}
