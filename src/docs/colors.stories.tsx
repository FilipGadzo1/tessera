import type { Meta, StoryObj } from "@storybook/react-vite";

// Every color token defined in src/styles/tessera.css.
const swatches = [
  { name: "background", className: "bg-background" },
  { name: "foreground", className: "bg-foreground" },
  { name: "card", className: "bg-card" },
  { name: "card-foreground", className: "bg-card-foreground" },
  { name: "popover", className: "bg-popover" },
  { name: "popover-foreground", className: "bg-popover-foreground" },
  { name: "primary", className: "bg-primary" },
  { name: "primary-foreground", className: "bg-primary-foreground" },
  { name: "secondary", className: "bg-secondary" },
  { name: "secondary-foreground", className: "bg-secondary-foreground" },
  { name: "muted", className: "bg-muted" },
  { name: "muted-foreground", className: "bg-muted-foreground" },
  { name: "accent", className: "bg-accent" },
  { name: "accent-foreground", className: "bg-accent-foreground" },
  { name: "destructive", className: "bg-destructive" },
  { name: "destructive-foreground", className: "bg-destructive-foreground" },
  { name: "border", className: "bg-border" },
  { name: "input", className: "bg-input" },
  { name: "ring", className: "bg-ring" },
] as const;

function ColorPalette() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {swatches.map((swatch) => (
        <figure key={swatch.name} className="m-0 flex flex-col gap-2">
          <div className={`h-16 w-32 rounded-lg border border-border ${swatch.className}`} />
          <figcaption className="font-mono text-foreground text-xs">--{swatch.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

const meta = {
  title: "Tessera/Colors",
  component: ColorPalette,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ColorPalette>;

export default meta;

export const Palette: StoryObj<typeof meta> = {};
