import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useState } from "react";
import { Button } from "../button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable";

const meta = {
  title: "Components/Resizable",
  component: ResizablePanelGroup,
  tags: ["autodocs"],
  // A group fills its parent: the centered layout would shrink the frame to its content.
  parameters: { layout: "padded" },
} satisfies Meta<typeof ResizablePanelGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A bordered frame for a group (a group fills its parent). Not `overflow-hidden`: a handle at the
 * edge (a collapsed sidebar) keeps its whole grip visible.
 */
function Frame({ children, className = "h-64" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`w-full max-w-2xl rounded-lg border border-border bg-background text-foreground ${className}`}
    >
      {children}
    </div>
  );
}

function Pane({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center p-4 text-sm">{children}</div>;
}

/** Three panels side by side; each handle moves only its two neighbours. */
export const Horizontal: Story = {
  render: (args) => (
    <Frame>
      <ResizablePanelGroup {...args}>
        <ResizablePanel defaultSize={25} minSize={15}>
          <Pane>Sidebar</Pane>
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize sidebar" />
        <ResizablePanel minSize={30}>
          <Pane>Content</Pane>
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize content" />
        <ResizablePanel defaultSize={25} minSize={15}>
          <Pane>Inspector</Pane>
        </ResizablePanel>
      </ResizablePanelGroup>
    </Frame>
  ),
};

/** Stacked panels: ↑ / ↓ resize. */
export const Vertical: Story = {
  render: () => (
    <Frame className="h-80">
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize={60} minSize={20}>
          <Pane>Editor</Pane>
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize editor" />
        <ResizablePanel minSize={15}>
          <Pane>Terminal</Pane>
        </ResizablePanel>
      </ResizablePanelGroup>
    </Frame>
  ),
};

/** A vertical group inside a horizontal group's panel. */
export const Nested: Story = {
  render: () => (
    <Frame className="h-80">
      <ResizablePanelGroup>
        <ResizablePanel defaultSize={30} minSize={15}>
          <Pane>Files</Pane>
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize files" />
        <ResizablePanel>
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize={65} minSize={20}>
              <Pane>Editor</Pane>
            </ResizablePanel>
            <ResizableHandle withHandle aria-label="Resize editor" />
            <ResizablePanel minSize={15}>
              <Pane>Output</Pane>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </Frame>
  ),
};

const SIDEBAR = 25;

/**
 * A collapsible sidebar with a toggle button: a controlled `layout`. The button collapses the
 * sidebar to 0 and restores the size it had; the handle (Enter, Home, a drag past the gap's
 * midpoint) collapses it too, and the button follows.
 */
export const CollapsibleSidebar: Story = {
  name: "Collapsible sidebar",
  render: function Render() {
    const [layout, setLayout] = useState([SIDEBAR, 100 - SIDEBAR]);
    const [restore, setRestore] = useState(SIDEBAR);
    const collapsed = (layout[0] ?? 0) === 0;
    return (
      <div className="flex w-full max-w-2xl flex-col gap-3">
        <Button
          variant="outline"
          className="self-start"
          aria-controls="story-sidebar"
          aria-expanded={!collapsed}
          onClick={() => {
            if (collapsed) {
              setLayout([restore, 100 - restore]);
            } else {
              setRestore(layout[0] ?? SIDEBAR);
              setLayout([0, 100]);
            }
          }}
        >
          {collapsed ? "Expand sidebar" : "Collapse sidebar"}
        </Button>
        <Frame>
          <ResizablePanelGroup layout={layout} onLayoutChange={setLayout}>
            <ResizablePanel id="story-sidebar" minSize={15} maxSize={40} collapsible>
              <Pane>Sidebar</Pane>
            </ResizablePanel>
            <ResizableHandle withHandle aria-label="Resize sidebar" />
            <ResizablePanel>
              <Pane>Content</Pane>
            </ResizablePanel>
          </ResizablePanelGroup>
        </Frame>
      </div>
    );
  },
};

const STORAGE_KEY = "tessera-resizable-persisted";

/** The stored layout, or `undefined` when there is none or storage is unavailable. */
function readLayout(): number[] | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : undefined;
    return Array.isArray(parsed) && parsed.every((size) => typeof size === "number")
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Persistence is the consumer's: store what `onLayoutCommitted` reports (drag end, each key, a collapse)
 * and pass it back as `defaultLayout`. Resize, then reload the story. Storage can throw (private
 * windows, blocked site data), so both reads and writes are guarded.
 */
export const Persisted: Story = {
  render: function Render() {
    const [defaultLayout] = useState(() => readLayout() ?? [33, 67]);
    return (
      <Frame>
        <ResizablePanelGroup
          defaultLayout={defaultLayout}
          onLayoutCommitted={(layout) => {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
            } catch {
              // Storage unavailable: the layout just is not remembered.
            }
          }}
        >
          <ResizablePanel minSize={20}>
            <Pane>Remembered</Pane>
          </ResizablePanel>
          <ResizableHandle withHandle aria-label="Resize remembered panel" />
          <ResizablePanel minSize={20}>
            <Pane>Content</Pane>
          </ResizablePanel>
        </ResizablePanelGroup>
      </Frame>
    );
  },
};

/** Under `dir="rtl"` the first panel is on the right, and ← grows it. */
export const RTL: Story = {
  render: () => (
    <div dir="rtl" className="w-full max-w-2xl">
      <Frame>
        <ResizablePanelGroup>
          <ResizablePanel defaultSize={30} minSize={15} collapsible>
            <Pane>الشريط الجانبي</Pane>
          </ResizablePanel>
          <ResizableHandle withHandle aria-label="تغيير حجم الشريط الجانبي" />
          <ResizablePanel>
            <Pane>المحتوى</Pane>
          </ResizablePanel>
        </ResizablePanelGroup>
      </Frame>
    </div>
  ),
};
