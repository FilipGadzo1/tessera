import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckoutPage } from "./checkout-page";

/**
 * Every Phase G component in one checkout. The header is a `NavigationMenu` (Shop and Help panels,
 * a plain Orders link marked current). The left column is a `Form`: contact Fields, a phone
 * check that reveals an `OTPField` after "Send code" (type or paste any 6 digits), an
 * `Autocomplete` for the city, a `CheckboxGroup` of delivery options with a "Select all" parent
 * checkbox, and a `Collapsible` promo code. A fake server rejects the code `EXPIRED` and the
 * message comes back through the Form's `errors`, under the promo Field; editing the field clears
 * it. The order summary Card holds a `Collapsible` list of items.
 */
const meta = {
  title: "Tessera/Examples/Checkout",
  component: CheckoutPage,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CheckoutPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Checkout: Story = { name: "Checkout" };
