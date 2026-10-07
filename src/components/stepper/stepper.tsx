"use client";

import {
  Children,
  type ComponentProps,
  createContext,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { toggleFocusClasses } from "../../lib/focus-classes";
import { AlertIcon, CheckIcon } from "../../lib/icons";
import { useControllableState } from "../../lib/use-controllable-state";

export type StepperOrientation = "horizontal" | "vertical";
export type StepperState = "complete" | "current" | "upcoming" | "error";

const defaultStateLabel = (state: StepperState) =>
  state === "complete" ? "Completed" : state === "error" ? "Error" : "";

interface StepperContextValue {
  value: number;
  select: (step: number) => void;
  orientation: StepperOrientation;
  linear: boolean;
  /** The step right after the run of complete steps that starts at the current one (spec §4). */
  frontier: number;
  stateLabel: (state: StepperState) => string;
  /** The steps read from the element children (a wrapped item is missing here). */
  steps: ReadonlySet<number>;
}

const StepperContext = createContext<StepperContextValue | null>(null);

function useStepperContext(part: string) {
  const context = use(StepperContext);
  if (!context) throw new Error(`${part} must be rendered inside a Stepper.`);
  return context;
}

interface StepperItemContextValue {
  step: number;
  state: StepperState;
  current: boolean;
  reachable: boolean;
  titleId: string;
  /** The ids of the mounted `StepperDescription`s, in mount order. */
  descriptionIds: readonly string[];
  registerDescription: (id: string) => () => void;
}

const StepperItemContext = createContext<StepperItemContextValue | null>(null);

function useStepperItemContext(part: string) {
  const context = use(StepperItemContext);
  if (!context) throw new Error(`${part} must be rendered inside a StepperItem.`);
  return context;
}

/** The element children, with fragments (and arrays) flattened, as Tree reads its items. */
function elementChildren(children: ReactNode): ReactElement[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    if (child.type === Fragment) {
      return elementChildren((child.props as { children?: ReactNode }).children);
    }
    return [child];
  });
}

/** `complete(k)` of spec §4: an explicit `completed` wins over the position; an error never is. */
const isComplete = (
  step: number,
  value: number,
  { completed, error }: { completed?: boolean; error?: boolean } = {},
) => !error && (completed ?? step < value);

export interface StepperProps extends Omit<ComponentProps<"ol">, "defaultValue" | "onChange"> {
  /** The current step (0-based), controlled. */
  value?: number;
  /** The initial current step when uncontrolled. Default 0. */
  defaultValue?: number;
  /** Called once per real change, with the activated step (not for the current step). */
  onValueChange?: (step: number) => void;
  /** Default `"horizontal"`. */
  orientation?: StepperOrientation;
  /**
   * Default `true`: only the steps up to the current one, the run of complete steps after it and
   * the step right after that run are reachable; the rest are `aria-disabled`. `false`: every step
   * that is not `disabled`.
   */
  linear?: boolean;
  /**
   * The visually hidden state text appended to each trigger's name. Defaults: "Completed" for
   * `complete`, "Error" for `error`, nothing for `current` and `upcoming`.
   */
  stateLabel?: (state: StepperState) => string;
}

/**
 * A progress stepper: an ordered list of steps whose triggers are plain buttons (`aria-current=
 * "step"` on the current one). Every step is a Tab stop; there are no arrow keys. The steps'
 * `completed` and `error` are read from the `StepperItem` element children (fragments and arrays
 * included), so reachability is decided on the server too.
 */
export function Stepper({
  value: valueProp,
  defaultValue = 0,
  onValueChange,
  orientation = "horizontal",
  linear = true,
  stateLabel = defaultStateLabel,
  className,
  children,
  ...props
}: StepperProps) {
  const [value, setValue] = useControllableState(valueProp, defaultValue, onValueChange);

  const items = new Map<number, StepperItemProps>();
  for (const element of elementChildren(children)) {
    if (element.type === StepperItem) {
      const itemProps = element.props as StepperItemProps;
      items.set(itemProps.step, itemProps);
    }
  }
  const last = Math.max(value, ...items.keys());
  let frontier = value;
  while (frontier < last && isComplete(frontier, value, items.get(frontier))) frontier += 1;

  const context: StepperContextValue = {
    value,
    select: (step) => {
      if (step !== value) setValue(step);
    },
    orientation,
    linear,
    frontier,
    stateLabel,
    steps: new Set(items.keys()),
  };

  return (
    <StepperContext value={context}>
      <ol
        {...props}
        // biome-ignore lint/a11y/noRedundantRoles: Safari drops the list role of a list-style: none list.
        role="list"
        aria-label={
          props["aria-label"] ?? (props["aria-labelledby"] === undefined ? "Progress" : undefined)
        }
        data-slot="stepper"
        data-orientation={orientation}
        className={cn(
          "flex w-full list-none gap-2 data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:items-start data-[orientation=vertical]:flex-col",
          className,
        )}
      >
        {children}
      </ol>
    </StepperContext>
  );
}

export interface StepperItemProps extends ComponentProps<"li"> {
  /** The step's 0-based index. */
  step: number;
  /** Overrides the derived completion (`step < value`), in both directions. */
  completed?: boolean;
  /** Marks the step as failed: its state is `error` (never complete). */
  error?: boolean;
  /** Never reachable. */
  disabled?: boolean;
}

/**
 * One step, an `li`. Keep it a direct child of the `Stepper` (fragments and arrays are fine): the
 * Stepper reads the items' `completed` / `error` from its element children, so the server HTML is
 * right; a wrapped item cannot extend the frontier (a dev warning says so). Without a
 * `StepperTrigger` among its own children (direct, or in a fragment; not inside a wrapper element) it
 * is display-only: the `li` carries `aria-current="step"` when it is the current step.
 */
export function StepperItem({
  step,
  completed,
  error = false,
  disabled = false,
  className,
  children,
  ...props
}: StepperItemProps) {
  const stepper = useStepperContext("StepperItem");
  const titleId = useId();
  const [descriptionIds, setDescriptionIds] = useState<readonly string[]>([]);
  const registerDescription = useCallback((id: string) => {
    setDescriptionIds((ids) => [...ids, id]);
    return () => setDescriptionIds((ids) => ids.filter((other) => other !== id));
  }, []);

  const known = stepper.steps.has(step);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && !known) {
      console.warn(
        `StepperItem step ${step} is not a direct child of its Stepper (wrapped in another component?), so it cannot extend the reachable steps. Render StepperItems directly, in fragments or arrays.`,
      );
    }
  }, [known, step]);

  const current = step === stepper.value;
  const state: StepperState = error
    ? "error"
    : isComplete(step, stepper.value, { completed })
      ? "complete"
      : current
        ? "current"
        : "upcoming";
  const reachable = !disabled && (!stepper.linear || step <= stepper.frontier);
  const hasTrigger = elementChildren(children).some((element) => element.type === StepperTrigger);

  return (
    <StepperItemContext
      value={{
        step,
        state,
        current,
        reachable,
        titleId,
        descriptionIds,
        registerDescription,
      }}
    >
      <li
        {...props}
        aria-current={!hasTrigger && current ? "step" : props["aria-current"]}
        data-slot="stepper-item"
        data-state={state}
        data-orientation={stepper.orientation}
        data-disabled={reachable ? undefined : ""}
        className={cn(
          "group/stepper-item relative flex gap-2 data-[orientation=horizontal]:flex-1 data-[orientation=horizontal]:items-start data-[orientation=horizontal]:last:flex-none data-[orientation=vertical]:flex-col",
          className,
        )}
      >
        {children}
      </li>
    </StepperItemContext>
  );
}

export type StepperTriggerProps = ComponentProps<"button">;

/**
 * The step's button: named by its title plus the state text ("Shipping Completed"), described by
 * its description. An unreachable step is `aria-disabled` but stays focusable and ignores
 * activation; activating the current step does nothing.
 */
export function StepperTrigger({ className, children, onClick, ...props }: StepperTriggerProps) {
  const stepper = useStepperContext("StepperTrigger");
  const item = useStepperItemContext("StepperTrigger");

  return (
    <button
      {...props}
      type="button"
      aria-current={item.current ? "step" : undefined}
      aria-disabled={item.reachable ? undefined : true}
      aria-labelledby={item.titleId}
      aria-describedby={item.descriptionIds.length > 0 ? item.descriptionIds.join(" ") : undefined}
      data-slot="stepper-trigger"
      data-state={item.state}
      data-disabled={item.reachable ? undefined : ""}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !item.reachable) return;
        stepper.select(item.step);
      }}
      className={cn(
        `group/stepper-trigger flex min-w-0 cursor-pointer items-center gap-3 rounded-md text-start group-data-[orientation=horizontal]/stepper-item:items-start ${toggleFocusClasses} forced-colors:focus-visible:outline-[Highlight] data-disabled:cursor-not-allowed`,
        className,
      )}
    >
      {children}
    </button>
  );
}

const indicatorStateClasses: Record<StepperState, string> = {
  upcoming:
    "border-border bg-background text-muted-foreground forced-colors:border-[CanvasText] forced-colors:text-[CanvasText]",
  current:
    "border-primary bg-background text-primary forced-colors:border-[Highlight] forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none",
  complete:
    "border-primary bg-primary text-primary-foreground forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]",
  error:
    "border-danger bg-danger text-danger-foreground forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]",
};

export type StepperIndicatorProps = ComponentProps<"span">;

/** The step's circle: its number, a check when complete, "!" in error; `children` override. */
export function StepperIndicator({ className, children, ...props }: StepperIndicatorProps) {
  const item = useStepperItemContext("StepperIndicator");
  const content =
    children ??
    (item.state === "complete" ? (
      <CheckIcon data-slot="stepper-check-icon" />
    ) : item.state === "error" ? (
      <AlertIcon data-slot="stepper-alert-icon" />
    ) : (
      item.step + 1
    ));

  return (
    <span
      {...props}
      aria-hidden="true"
      data-slot="stepper-indicator"
      data-state={item.state}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium tabular-nums transition-[color,background-color,border-color] duration-150 ease-out motion-reduce:transition-none [&_svg]:size-4",
        indicatorStateClasses[item.state],
        className,
      )}
    >
      {content}
    </span>
  );
}

export type StepperTitleProps = ComponentProps<"span">;

/**
 * The step's title. It also holds the visually hidden `stateLabel(state)` text, so a step reads
 * "Shipping Completed" / "Shipping Error" both as a trigger's name and in a display-only list.
 */
export function StepperTitle({ className, children, ...props }: StepperTitleProps) {
  const stepper = useStepperContext("StepperTitle");
  const item = useStepperItemContext("StepperTitle");
  const label = stepper.stateLabel(item.state);
  return (
    <span
      {...props}
      id={item.titleId}
      data-slot="stepper-title"
      className={cn(
        "text-sm font-medium text-foreground group-data-[orientation=horizontal]/stepper-item:pt-1.5 group-data-disabled/stepper-trigger:text-muted-foreground forced-colors:group-data-disabled/stepper-trigger:text-[GrayText] group-data-[state=error]/stepper-item:text-danger",
        className,
      )}
    >
      {children}
      {label && (
        <>
          {" "}
          <span data-slot="stepper-state" className="sr-only">
            {label}
          </span>
        </>
      )}
    </span>
  );
}

export type StepperDescriptionProps = ComponentProps<"span">;

/** The step's description: the trigger's `aria-describedby` while it is rendered. */
export function StepperDescription({ className, ...props }: StepperDescriptionProps) {
  const { registerDescription } = useStepperItemContext("StepperDescription");
  const id = useId();
  useLayoutEffect(() => registerDescription(id), [registerDescription, id]);
  return (
    <span
      {...props}
      id={id}
      data-slot="stepper-description"
      className={cn(
        "text-xs text-muted-foreground forced-colors:group-data-disabled/stepper-trigger:text-[GrayText]",
        className,
      )}
    />
  );
}

export type StepperSeparatorProps = ComponentProps<"div">;

/**
 * The connector after a step (inside its item, after the trigger). In forced colors a complete
 * separator is drawn 4px thick instead of recoloured.
 */
export function StepperSeparator({ className, ...props }: StepperSeparatorProps) {
  const item = useStepperItemContext("StepperSeparator");
  return (
    <div
      {...props}
      aria-hidden="true"
      data-slot="stepper-separator"
      data-state={item.state}
      className={cn(
        "shrink-0 rounded-full bg-border transition-[background-color] duration-150 ease-out motion-reduce:transition-none data-[state=complete]:bg-primary forced-colors:bg-[CanvasText] forced-colors:data-[state=complete]:bg-[CanvasText]",
        "group-data-[orientation=horizontal]/stepper-item:mt-[calc(1rem-1px)] group-data-[orientation=horizontal]/stepper-item:h-0.5 group-data-[orientation=horizontal]/stepper-item:min-w-6 group-data-[orientation=horizontal]/stepper-item:flex-1 group-data-[orientation=horizontal]/stepper-item:self-start",
        "group-data-[orientation=vertical]/stepper-item:ms-[calc(1rem-1px)] group-data-[orientation=vertical]/stepper-item:min-h-6 group-data-[orientation=vertical]/stepper-item:w-0.5",
        "forced-colors:group-data-[orientation=horizontal]/stepper-item:data-[state=complete]:h-1 forced-colors:group-data-[orientation=horizontal]/stepper-item:data-[state=complete]:mt-[calc(1rem-2px)] forced-colors:group-data-[orientation=vertical]/stepper-item:data-[state=complete]:w-1 forced-colors:group-data-[orientation=vertical]/stepper-item:data-[state=complete]:ms-[calc(1rem-2px)]",
        className,
      )}
    />
  );
}
