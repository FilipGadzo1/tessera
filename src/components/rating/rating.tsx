"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import {
  LabelableProvider,
  useLabelableContext,
} from "@base-ui/react/internals/labelable-provider";
import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import {
  type ComponentProps,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type Ref,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { StarIcon } from "../../lib/icons";
import { mergeClassName } from "../../lib/merge-class-name";
import { useControllableState } from "../../lib/use-controllable-state";
import { useElementDirection } from "../../lib/use-element-direction";
import { useMergedRefs } from "../../lib/use-merged-refs";

export type RatingSize = "sm" | "md" | "lg";

export interface RatingProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "children" | "ref"> {
  /**
   * The controlled value (`null`: no rating). A value that matches no radio (3.7, or 3.5 without
   * `allowHalf`) shows its fractional fill but checks no radio, so Tab lands on the first star and
   * the first key or click replaces it with a step value.
   */
  value?: number | null;
  /** The initial value when uncontrolled. Default `null`. */
  defaultValue?: number | null;
  /** Every change, with the new value (`null` when `clearable` clears it). */
  onValueChange?: (value: number | null) => void;
  /** The number of stars. Default 5. */
  max?: number;
  /** Two radios per star, so the value steps by 0.5. Default `false`. */
  allowHalf?: boolean;
  /** Choosing the checked star again clears the value to `null`. Default `false`. */
  clearable?: boolean;
  /**
   * Display mode: a `role="img"` named by `valueLabel`, with any fractional fill, no radios and no
   * Tab stop. It is not a form control, so `name`, `form` and `required` are ignored.
   */
  readOnly?: boolean;
  disabled?: boolean;
  /** Submits the value through the radios' inputs. */
  name?: string;
  /** The id of a `<form>` elsewhere in the document that the radios belong to. */
  form?: string;
  required?: boolean;
  /** Default `"md"` (20px stars); `"sm"` is 16px, `"lg"` 24px. */
  size?: RatingSize;
  /** Each radio's name. Default "1 star", "2.5 stars". */
  itemLabel?: (value: number, max: number) => string;
  /** The display mode's name. Default "3.5 out of 5 stars", and "No rating" for `null`. */
  valueLabel?: (value: number | null, max: number) => string;
  ref?: Ref<HTMLElement>;
}

/* A fixed locale, so the server and the client agree; localise through the label functions. */
const numberFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

const defaultItemLabel = (value: number) =>
  `${numberFormat.format(value)} ${value === 1 ? "star" : "stars"}`;

const defaultValueLabel = (value: number | null, max: number) =>
  value === null
    ? "No rating"
    : `${numberFormat.format(value)} out of ${numberFormat.format(max)} ${max === 1 ? "star" : "stars"}`;

/*
 * Disabled: Base UI keeps a disabled RadioGroup's roving radio focusable (`aria-disabled`), so the
 * focusable-disabled convention applies: muted stars (GrayText in forced colors) at opacity 1.
 */
const rootClasses = "inline-flex items-center gap-0.5 data-disabled:cursor-not-allowed";

const itemClasses = cn(
  "relative inline-flex shrink-0 rounded-sm forced-color-adjust-none",
  "outline-none outline-offset-2 outline-ring",
  "has-[[role=radio]:focus-visible]:outline-2 has-[[role=radio]:focus-visible]:outline-solid",
  "forced-colors:has-[[role=radio]:focus-visible]:outline-[Highlight]",
);

const itemSizes: Record<RatingSize, string> = { sm: "size-4", md: "size-5", lg: "size-6" };

const radioClasses =
  "absolute inset-y-0 cursor-pointer rounded-sm outline-none data-disabled:cursor-not-allowed";

const emptyStarClasses = cn(
  "absolute inset-0 size-full fill-none stroke-current stroke-[1.5] text-muted-foreground",
  "forced-colors:text-[CanvasText] forced-colors:in-data-disabled:text-[GrayText]",
);

const filledStarClasses = cn(
  "absolute inset-0 size-full fill-current stroke-current stroke-[1.5] text-warning",
  "[clip-path:inset(0_calc(100%-var(--rating-fill))_0_0)] rtl:[clip-path:inset(0_0_0_calc(100%-var(--rating-fill)))]",
  "transition-[clip-path,color] duration-150 ease-out motion-reduce:transition-none",
  "forced-colors:text-[CanvasText] in-data-preview:text-warning-hover forced-colors:in-data-preview:text-[Highlight]",
  "in-data-disabled:text-muted-foreground forced-colors:in-data-disabled:text-[GrayText]",
);

/** One star: the empty outline under the filled star, clipped to `fill` (0–1) from the inline start. */
function RatingItem({
  fill,
  size,
  children,
}: {
  fill: number;
  size: RatingSize;
  children?: ReactNode;
}) {
  const style = { "--rating-fill": `${Math.round(fill * 1000) / 10}%` } as CSSProperties;
  return (
    <span
      data-slot="rating-item"
      data-filled={fill === 1 ? "" : undefined}
      data-half={fill > 0 && fill < 1 ? "" : undefined}
      className={cn(itemClasses, itemSizes[size])}
      style={style}
    >
      <StarIcon data-slot="rating-star-empty" className={emptyStarClasses} />
      <StarIcon data-slot="rating-star-filled" className={filledStarClasses} />
      {children}
    </span>
  );
}

/** How much of star `index` (1-based) a value fills, 0–1. */
const fillOf = (value: number, index: number) => Math.min(1, Math.max(0, value - (index - 1)));

/**
 * A star rating: a Base UI RadioGroup with one radio per star (two with `allowHalf`), so the arrows
 * step through the values and it joins a Field and Form as one control. `readOnly` renders a
 * display instead (an image named by its value).
 */
export function Rating({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  max = 5,
  allowHalf = false,
  clearable = false,
  readOnly = false,
  disabled,
  name,
  form,
  required,
  size = "md",
  itemLabel = defaultItemLabel,
  valueLabel = defaultValueLabel,
  ref,
  className,
  onPointerLeave,
  ...props
}: RatingProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const setRootRef = useMergedRefs(rootRef, ref);
  const direction = useElementDirection(rootRef);
  const { labelId } = useLabelableContext();
  const [value, setValue] = useControllableState(valueProp, defaultValue, onValueChange);
  const [preview, setPreview] = useState<number | null>(null);
  const indices = Array.from({ length: max }, (_, index) => index + 1);

  if (readOnly) {
    const shown = value ?? 0;
    return (
      <span
        {...(props as ComponentProps<"span">)}
        onPointerLeave={onPointerLeave as ComponentProps<"span">["onPointerLeave"]}
        ref={setRootRef}
        role="img"
        aria-label={valueLabel(value, max)}
        aria-labelledby={undefined}
        data-slot="rating"
        data-readonly=""
        data-size={size}
        className={cn(rootClasses, className)}
      >
        {indices.map((index) => (
          <RatingItem key={index} fill={fillOf(shown, index)} size={size} />
        ))}
      </span>
    );
  }

  const shown = preview ?? value ?? 0;
  const ariaLabelledBy = props["aria-labelledby"];
  const ariaLabel = props["aria-label"] ?? (ariaLabelledBy || labelId ? undefined : "Rating");

  const renderRadio = (radioValue: number, position: string) => (
    <BaseRadio.Root
      key={radioValue}
      value={radioValue}
      aria-label={itemLabel(radioValue, max)}
      data-slot="rating-radio"
      className={cn(radioClasses, position)}
      onPointerEnter={(event: PointerEvent<HTMLElement>) => {
        // Touch has no hover: a tap must not leave a preview behind.
        if (event.pointerType === "touch" || event.currentTarget.hasAttribute("data-disabled")) {
          return;
        }
        setPreview(radioValue);
      }}
      onClick={(event) => {
        if (!clearable || radioValue !== value) return;
        if (event.currentTarget.hasAttribute("data-disabled")) return;
        setValue(null);
      }}
    />
  );

  return (
    <DirectionProvider direction={direction}>
      <BaseRadioGroup<number | null>
        {...props}
        ref={setRootRef}
        value={value}
        onValueChange={(next) => {
          // A key (or click) change shows the new value even while the mouse rests on a star.
          setPreview(null);
          setValue(next);
        }}
        disabled={disabled}
        name={name}
        form={form}
        required={required}
        aria-label={ariaLabel}
        data-slot="rating"
        data-size={size}
        data-preview={preview === null ? undefined : ""}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          setPreview(null);
        }}
        className={mergeClassName(rootClasses, className)}
      >
        {/* A labelling scope of their own: in a Field the radios keep their item names instead of
            taking the Field label (which names the group). */}
        <LabelableProvider>
          {indices.map((index) => (
            <RatingItem key={index} fill={fillOf(shown, index)} size={size}>
              {allowHalf ? (
                <>
                  {renderRadio(index - 0.5, "start-0 w-1/2")}
                  {renderRadio(index, "end-0 w-1/2")}
                </>
              ) : (
                renderRadio(index, "inset-x-0")
              )}
            </RatingItem>
          ))}
        </LabelableProvider>
      </BaseRadioGroup>
    </DirectionProvider>
  );
}
