import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, useSyncExternalStore } from "react";
import { Button } from "../button";
import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  type StepperProps,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "./stepper";

const meta = {
  title: "Components/Stepper",
  component: Stepper,
  tags: ["autodocs"],
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

const CHECKOUT = [
  { title: "Account", description: "Sign in or sign up" },
  { title: "Shipping", description: "Where it goes" },
  { title: "Payment", description: "How you pay" },
  { title: "Review", description: "Check and confirm" },
];

/** True below Tailwind's `sm` breakpoint (640px). */
function useNarrow() {
  const query = "(max-width: 639.98px)";
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

type StepItem = { title: string; description?: string; completed?: boolean; error?: boolean };

/** The usual composition: each step a trigger (indicator, title, description) and a separator. */
function Steps({ steps, ...props }: Omit<StepperProps, "children"> & { steps: StepItem[] }) {
  return (
    <Stepper {...props}>
      {steps.map((step, index) => (
        <StepperItem key={step.title} step={index} completed={step.completed} error={step.error}>
          <StepperTrigger>
            <StepperIndicator />
            <span className="flex flex-col">
              <StepperTitle>{step.title}</StepperTitle>
              {step.description && <StepperDescription>{step.description}</StepperDescription>}
            </span>
          </StepperTrigger>
          {index < steps.length - 1 && <StepperSeparator />}
        </StepperItem>
      ))}
    </Stepper>
  );
}

/**
 * A checkout wizard: Back and Next drive `value`, and the story keeps the completed steps in a set
 * it passes as `completed`, so after going Back the steps already done stay reachable. Below 640px
 * the four titled steps do not fit in a row, so the story switches to `orientation="vertical"`.
 */
export const HorizontalWizard: Story = {
  name: "Horizontal wizard",
  render: function Render() {
    const [value, setValue] = useState(0);
    const [completed, setCompleted] = useState<ReadonlySet<number>>(new Set());
    const narrow = useNarrow();
    const last = CHECKOUT.length - 1;
    const done = completed.size === CHECKOUT.length;
    const step = CHECKOUT[value] as StepItem;
    return (
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <Steps
          aria-label="Checkout"
          orientation={narrow ? "vertical" : "horizontal"}
          value={value}
          onValueChange={setValue}
          steps={CHECKOUT.map((item, index) => ({ ...item, completed: completed.has(index) }))}
        />
        <div className="rounded-lg border border-border p-4 text-sm text-foreground">
          <p className="font-medium">
            Step {value + 1} of {CHECKOUT.length}: {step.title}
          </p>
          <p className="text-muted-foreground">
            {done ? "Order placed." : `The ${step.title.toLowerCase()} form goes here.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={value === 0} onClick={() => setValue(value - 1)}>
            Back
          </Button>
          <Button
            disabled={done}
            onClick={() => {
              setCompleted(new Set(completed).add(value));
              if (value < last) setValue(value + 1);
            }}
          >
            {value === last ? "Place order" : "Next"}
          </Button>
        </div>
      </div>
    );
  },
};

export const Vertical: Story = {
  render: () => (
    <Steps aria-label="Setup" orientation="vertical" defaultValue={1} steps={CHECKOUT} />
  ),
};

/** `linear={false}`: every step that is not `disabled` can be chosen at any time. */
export const NonLinear: Story = {
  name: "Non-linear",
  render: () => (
    <Steps
      aria-label="Profile"
      linear={false}
      steps={[
        { title: "Details" },
        { title: "Photo" },
        { title: "Interests" },
        { title: "Privacy" },
      ]}
    />
  ),
};

/**
 * An `error` step shows "!" (not colour alone) and is named "Shipping Error". It stays reachable
 * and does not block the current step.
 */
export const WithError: Story = {
  name: "With error",
  render: () => (
    <Steps
      aria-label="Checkout"
      defaultValue={2}
      steps={CHECKOUT.map((item, index) =>
        index === 1 ? { ...item, description: "Address not found", error: true } : item,
      )}
    />
  ),
};

/**
 * Display only: items with no `StepperTrigger` are a plain progress list, and the current `li`
 * carries `aria-current="step"`.
 */
export const DisplayOnly: Story = {
  name: "Display only",
  render: () => (
    <Stepper aria-label="Order status" value={2}>
      {["Ordered", "Packed", "Shipped", "Delivered"].map((title, index, all) => (
        <StepperItem key={title} step={index}>
          <StepperIndicator />
          <StepperTitle>{title}</StepperTitle>
          {index < all.length - 1 && <StepperSeparator />}
        </StepperItem>
      ))}
    </Stepper>
  ),
};

/** Under `dir="rtl"` the row runs right to left and the vertical indent is logical. */
export const RTL: Story = {
  render: () => {
    const steps = [
      { title: "الحساب", completed: true },
      { title: "الشحن" },
      { title: "الدفع" },
      { title: "المراجعة" },
    ];
    const stateLabel = (state: string) =>
      state === "complete" ? "مكتمل" : state === "error" ? "خطأ" : "";
    return (
      <div dir="rtl" className="flex flex-col gap-8">
        <Steps aria-label="الدفع" defaultValue={1} steps={steps} stateLabel={stateLabel} />
        <Steps
          aria-label="الدفع عموديًا"
          orientation="vertical"
          defaultValue={1}
          steps={steps}
          stateLabel={stateLabel}
        />
      </div>
    );
  },
};
