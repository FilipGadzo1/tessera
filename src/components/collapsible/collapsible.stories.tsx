import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronDownIcon } from "../../lib/icons";
import { Button } from "../button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "./collapsible";

const meta = {
  title: "Components/Collapsible",
  component: Collapsible,
  tags: ["autodocs"],
  args: { disabled: false },
  argTypes: { defaultOpen: { control: "boolean" }, disabled: { control: "boolean" } },
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

const keys = ["alien-bean-pasta", "wild-irish-burrito", "horse-battery-staple"];

/** The trigger is a plain button; compose it with a Tessera Button through `render`. */
export const Basic: Story = {
  render: (args) => (
    <Collapsible {...args} className="flex w-64 flex-col gap-2">
      <CollapsibleTrigger render={<Button variant="outline" color="neutral" />}>
        Recovery keys
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <ul className="flex flex-col gap-1 py-1 font-mono text-muted-foreground">
          {keys.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      </CollapsiblePanel>
    </Collapsible>
  ),
};

/** A chevron that turns while the panel is open, driven by `group-data-panel-open`. */
export const WithChevron: Story = {
  render: (args) => (
    <Collapsible {...args} className="flex w-72 flex-col gap-2">
      <CollapsibleTrigger
        render={<Button variant="ghost" color="neutral" className="group justify-between" />}
      >
        Order details
        <ChevronDownIcon className="size-4 transition-transform duration-200 group-data-panel-open:rotate-180 motion-reduce:transition-none" />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <dl className="grid grid-cols-2 gap-1 px-3 py-1 text-muted-foreground">
          <dt>Order</dt>
          <dd className="text-right text-foreground">#4821</dd>
          <dt>Shipping</dt>
          <dd className="text-right text-foreground">Standard</dd>
          <dt>Total</dt>
          <dd className="text-right text-foreground">€64.00</dd>
        </dl>
      </CollapsiblePanel>
    </Collapsible>
  ),
};

/** Closed content stays in the page: find "shipping" with Ctrl+F / ⌘F and the panel opens. */
export const HiddenUntilFound: Story = {
  render: (args) => (
    <Collapsible {...args} className="flex w-80 max-w-full flex-col gap-2">
      <CollapsibleTrigger render={<Button variant="outline" color="neutral" />}>
        Shipping details
      </CollapsibleTrigger>
      <CollapsiblePanel hiddenUntilFound>
        <p className="py-1 text-muted-foreground">Standard shipping takes 3-5 business days.</p>
      </CollapsiblePanel>
    </Collapsible>
  ),
};
