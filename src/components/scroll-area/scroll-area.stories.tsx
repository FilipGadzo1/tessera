import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea } from "./scroll-area";

const meta = {
  title: "Components/ScrollArea",
  component: ScrollArea,
  tags: ["autodocs"],
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const tags = [
  "Design",
  "Engineering",
  "Product",
  "Marketing",
  "Sales",
  "Support",
  "Legal",
  "Finance",
  "Operations",
  "People",
  "Security",
  "Data",
  "Research",
  "Growth",
  "Platform",
];

export const VerticalList: Story = {
  render: () => (
    <ScrollArea className="h-72 w-64 rounded-md border border-border">
      <div className="p-4">
        <h4 className="mb-4 text-sm font-medium text-foreground">Tags</h4>
        {tags.map((tag) => (
          <div
            key={tag}
            className="border-b border-border py-2 text-sm text-foreground last:border-0"
          >
            {tag}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

const colors = [
  "bg-primary",
  "bg-success",
  "bg-warning",
  "bg-danger",
  "bg-info",
  "bg-neutral",
  "bg-primary",
  "bg-success",
];

export const HorizontalGallery: Story = {
  render: () => (
    <ScrollArea orientation="horizontal" className="w-96 rounded-md border border-border">
      <div className="flex gap-4 p-4">
        {colors.map((color, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixture slides repeat colors, so the index disambiguates them.
            key={`${color}-${i}`}
            className={`flex h-32 w-40 shrink-0 items-center justify-center rounded-md text-sm font-medium text-white ${color}`}
          >
            Slide {i + 1}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const Both: Story = {
  render: () => (
    <ScrollArea orientation="both" className="h-72 w-96 rounded-md border border-border">
      <table className="border-collapse text-sm">
        <tbody>
          {Array.from({ length: 20 }, (_, row) => (
            <tr
              // biome-ignore lint/suspicious/noArrayIndexKey: fixture grid rows have no identity beyond position.
              key={row}
            >
              {Array.from({ length: 10 }, (_, col) => (
                <td
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixture grid cells have no identity beyond position.
                  key={col}
                  className="w-24 border-b border-border px-3 py-2 whitespace-nowrap text-foreground"
                >
                  R{row + 1} · C{col + 1}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  ),
};

export const InCard: Story = {
  render: () => (
    <div className="w-80 rounded-lg border border-border bg-background p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-foreground">Release notes</h3>
      <ScrollArea className="h-40">
        <p className="pr-3 text-sm text-muted-foreground">
          Tessera Phase F adds ScrollArea and Meter on Base UI primitives, mirroring the existing
          Progress component for the meter, and a custom-scrollbar pattern that keeps native wheel,
          touch and keyboard scrolling intact. The visual scrollbars are pointer-draggable and only
          ever supplement — never replace — the viewport&apos;s own scrolling behaviour. They fade
          in on hover or while scrolling and fade back out at rest, and their thumb size tracks the
          visible fraction of the content so it always gives an honest read of how much more there
          is to see.
        </p>
      </ScrollArea>
    </div>
  ),
};
