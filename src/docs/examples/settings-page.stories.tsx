import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingsPage } from "./settings-page";

/**
 * The Phase D components in one account settings card. Tabs switch between Profile (an Avatar
 * showing its initials fallback, Fields with Inputs and a language Select), Notifications (an
 * Accordion of channels, each holding labelled Switches) and Billing (Progress bars for storage and
 * seats, split by Separators). "Save changes" adds a plain success toast through `useToast()`; the
 * card sits inside a `Toaster`.
 *
 * The panels use `keepMounted`, so the uncontrolled Inputs and the open channels survive a tab
 * change; the language and the switches are controlled so the toast can summarise them.
 */
const meta = {
  title: "Tessera/Examples/Settings",
  component: SettingsPage,
} satisfies Meta<typeof SettingsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Settings: Story = { name: "Settings" };
