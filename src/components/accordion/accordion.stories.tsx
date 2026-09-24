import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../button";
import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "./accordion";

const meta = {
  title: "Components/Accordion",
  component: Accordion,
  tags: ["autodocs"],
  args: { multiple: false, hiddenUntilFound: false, disabled: false },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FAQ: Story = {
  args: { defaultValue: ["shipping"] },
  render: (args) => (
    <Accordion {...args} className="w-md max-w-full">
      <AccordionItem value="shipping">
        <AccordionTrigger>How long does shipping take?</AccordionTrigger>
        <AccordionPanel>
          Orders placed before 2 pm ship the same working day. Delivery takes two to four days
          within the EU and five to eight days elsewhere.
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem value="returns">
        <AccordionTrigger>Can I return an item?</AccordionTrigger>
        <AccordionPanel>
          Yes, within 30 days of delivery, unused and in its original packaging. Start a return from
          your order history and we will email a prepaid label.
          <div className="mt-3">
            <Button size="sm" variant="outline" color="neutral">
              Start a return
            </Button>
          </div>
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem value="warranty">
        <AccordionTrigger>Is there a warranty?</AccordionTrigger>
        <AccordionPanel>
          Every product carries a two-year warranty covering parts and labour. Keep your order
          number; it is your proof of purchase.
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  ),
};

export const Multiple: Story = {
  args: { multiple: true, defaultValue: ["email", "push"] },
  render: (args) => (
    <Accordion {...args} className="w-md max-w-full">
      <AccordionItem value="email">
        <AccordionTrigger>Email</AccordionTrigger>
        <AccordionPanel className="text-muted-foreground">
          A weekly digest every Monday, plus security alerts as they happen.
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem value="push">
        <AccordionTrigger>Push notifications</AccordionTrigger>
        <AccordionPanel className="text-muted-foreground">
          Mentions, replies and review requests on your devices.
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem value="sms">
        <AccordionTrigger>SMS</AccordionTrigger>
        <AccordionPanel className="text-muted-foreground">
          Sign-in codes only. Standard message rates may apply.
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  ),
};

export const DisabledItem: Story = {
  render: (args) => (
    <Accordion {...args} className="w-md max-w-full">
      <AccordionItem value="starter">
        <AccordionTrigger>Starter plan</AccordionTrigger>
        <AccordionPanel>Three projects, 5 GB storage and community support.</AccordionPanel>
      </AccordionItem>
      <AccordionItem value="team">
        <AccordionTrigger>Team plan</AccordionTrigger>
        <AccordionPanel>Unlimited projects, 100 GB storage and email support.</AccordionPanel>
      </AccordionItem>
      <AccordionItem value="enterprise" disabled>
        <AccordionTrigger>Enterprise plan (contact sales)</AccordionTrigger>
        <AccordionPanel>SSO, audit logs and a dedicated account manager.</AccordionPanel>
      </AccordionItem>
    </Accordion>
  ),
};

export const HiddenUntilFound: Story = {
  args: { hiddenUntilFound: true },
  render: (args) => (
    <div className="flex w-md max-w-full flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Closed panels stay in the page. Search it with Ctrl+F / ⌘F for “invoice” and the matching
        section opens.
      </p>
      <Accordion {...args}>
        <AccordionItem value="billing">
          <AccordionTrigger headingLevel={2}>Billing</AccordionTrigger>
          <AccordionPanel>
            Each invoice is emailed to the billing contact on the first of the month and stays
            downloadable from Settings for seven years.
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem value="security">
          <AccordionTrigger headingLevel={2}>Security</AccordionTrigger>
          <AccordionPanel>
            Data is encrypted at rest with AES-256 and in transit with TLS 1.3.
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};
