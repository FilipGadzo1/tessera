import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../button";
import { createToaster, Toaster, type ToastPosition, type ToastType, useToast } from "./toast";

const meta = {
  title: "Components/Toast",
  component: Toaster,
  tags: ["autodocs"],
  args: { position: "bottom-right", limit: 3, timeout: 5000 },
  argTypes: {
    position: {
      control: "select",
      options: ["bottom-right", "top-right", "bottom-center", "top-center"],
    },
    limit: { control: "number" },
    timeout: { control: "number" },
  },
  render: (args) => (
    <Toaster {...args}>
      <SaveButton />
    </Toaster>
  ),
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

function SaveButton() {
  const toast = useToast();
  return (
    <Button
      onClick={() =>
        toast.add({
          title: "Changes saved",
          description: "Your profile is up to date.",
          type: "success",
        })
      }
    >
      Save changes
    </Button>
  );
}

/**
 * Wrap the app in `Toaster`; anything inside calls `useToast().add({ title, description, type })`.
 * Toasts dismiss after `timeout` (paused while hovered or focused), or with their Close button,
 * Escape (when focused) or a swipe.
 */
export const Default: Story = {};

const typeContent: Record<ToastType, { title: string; description: string }> = {
  default: { title: "Draft saved", description: "You can pick up where you left off." },
  success: { title: "Invoice paid", description: "€1,240.00 from Acme Corp arrived today." },
  warning: { title: "Storage almost full", description: "You have used 92% of your 50 GB." },
  danger: { title: "Payment failed", description: "The card ending in 4242 was declined." },
  info: { title: "New version available", description: "Reload to get the latest features." },
};

function TypeButtons() {
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(typeContent) as ToastType[]).map((type) => (
        <Button
          key={type}
          variant="outline"
          color="neutral"
          onClick={() => toast.add({ ...typeContent[type], type })}
        >
          {type}
        </Button>
      ))}
    </div>
  );
}

/**
 * `type` sets the tone: a leading icon and a left accent (`default` has neither). Base UI's
 * `promise()` also uses `loading` (spinner) and `error` (styled as danger).
 */
export const Types: Story = {
  args: { limit: 5 },
  render: (args) => (
    <Toaster {...args}>
      <TypeButtons />
    </Toaster>
  ),
};

function ArchiveButton() {
  const toast = useToast();
  const [archived, setArchived] = useState(3);
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        onClick={() => {
          setArchived((count) => count + 1);
          const id = toast.add({
            title: "Conversation archived",
            description: "It moved to the Archive folder.",
            // Actionable toasts need time to act on (WCAG 2.2.1): keep them until closed.
            timeout: 0,
            actionProps: {
              children: "Undo",
              onClick: () => {
                setArchived((count) => count - 1);
                toast.close(id);
              },
            },
          });
        }}
      >
        Archive conversation
      </Button>
      <span className="text-sm text-muted-foreground">Archived: {archived}</span>
    </div>
  );
}

/**
 * `actionProps` adds an action Button. The toast stays polite (`priority: "low"`) and uses
 * `timeout: 0`, so there is time to act (WCAG 2.2.1); it closes with Undo, Close or Escape.
 */
export const WithAction: Story = {
  render: (args) => (
    <Toaster {...args}>
      <ArchiveButton />
    </Toaster>
  ),
};

function UploadButton() {
  const toast = useToast();
  return (
    <div className="flex gap-2">
      {(["succeed", "fail"] as const).map((outcome) => (
        <Button
          key={outcome}
          variant="outline"
          color="neutral"
          onClick={() =>
            toast.promise(
              new Promise<string>((resolve, reject) =>
                setTimeout(
                  () =>
                    outcome === "succeed"
                      ? resolve("quarterly-report.pdf")
                      : reject(new Error("The server is not responding.")),
                  2000,
                ),
              ),
              {
                loading: { title: "Uploading…", description: "quarterly-report.pdf" },
                success: (name) => ({ title: "Upload complete", description: name }),
                error: (error: Error) => ({ title: "Upload failed", description: error.message }),
              },
            )
          }
        >
          Upload ({outcome})
        </Button>
      ))}
    </div>
  );
}

/** `promise()` shows a loading toast, then turns it into a success or error toast. */
export const Promise_: Story = {
  name: "Promise",
  render: (args) => (
    <Toaster {...args}>
      <UploadButton />
    </Toaster>
  ),
};

const allPositions: ToastPosition[] = ["top-center", "top-right", "bottom-center", "bottom-right"];

function PositionButtons({ onPosition }: { onPosition: (position: ToastPosition) => void }) {
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      {allPositions.map((position) => (
        <Button
          key={position}
          variant="outline"
          color="neutral"
          onClick={() => {
            onPosition(position);
            toast.add({ title: `Hello from ${position}`, description: "Toasts stack from here." });
          }}
        >
          {position}
        </Button>
      ))}
    </div>
  );
}

/** `position` puts the stack in a corner or centred at the top or bottom edge. */
export const Positions: Story = {
  render: function Positions(args) {
    const [position, setPosition] = useState<ToastPosition>("bottom-right");
    return (
      <Toaster {...args} position={position}>
        <PositionButtons onPosition={setPosition} />
      </Toaster>
    );
  },
};

const events = [
  { title: "Ana commented", description: "“Looks great, ship it!”" },
  { title: "Build #482 passed", description: "All 312 tests green in 2m 14s.", type: "success" },
  {
    title: "Deploy queued",
    description: "Production will update in about a minute.",
    type: "info",
  },
  { title: "Disk usage high", description: "db-primary is at 87% capacity.", type: "warning" },
];

const toaster = createToaster();

/**
 * Collapsed, older toasts peek behind the newest one; hover or focus (F6 jumps to the toasts)
 * spreads the stack out. Past `limit`, the oldest are hidden. This story adds toasts through a
 * `createToaster()` manager — plain function calls, as from outside React.
 */
export const Stacked: Story = {
  render: (args) => (
    <Toaster {...args} timeout={0} toastManager={toaster}>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            for (const event of events) toaster.add(event);
          }}
        >
          Add four toasts
        </Button>
        <Button variant="outline" color="neutral" onClick={() => toaster.close()}>
          Clear all
        </Button>
      </div>
    </Toaster>
  ),
};
