import { cva, type VariantProps } from "class-variance-authority";
import { textFieldSlotBase } from "../input/input-variants";

/** Defaults — shared by cva and the Root's data attribute. */
export const otpFieldDefaults = { size: "md" } as const;

const otpFieldInputCva = cva(
  [...textFieldSlotBase, "text-center text-lg font-medium tabular-nums"],
  {
    variants: {
      // Square slots at the same heights as Input / Button (h-8, h-10, h-12).
      size: { sm: "size-8", md: "size-10", lg: "size-12" },
    },
    defaultVariants: otpFieldDefaults,
  },
);

export type OTPFieldVariantProps = VariantProps<typeof otpFieldInputCva>;

/** Classes for one OTP slot. */
export function otpFieldInputVariants(options: OTPFieldVariantProps = {}): string {
  return otpFieldInputCva(options);
}
