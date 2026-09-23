import type { Meta, StoryObj } from "@storybook/react-vite";

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const SURFACE_STEPS = [0, ...STEPS] as const;

const GROUPS = [
  {
    title: "Primary",
    note: "Pick one with data-primary",
    palettes: ["malachite", "lapis", "amethyst", "carnelian"],
    steps: STEPS,
  },
  {
    title: "Status",
    note: "success · warning · danger · info",
    palettes: ["verdant", "amber", "garnet", "azure"],
    steps: STEPS,
  },
  {
    title: "Surface",
    note: "Pick one with data-surface",
    palettes: ["marble", "slate", "sandstone"],
    steps: SURFACE_STEPS,
  },
] as const;

/** Deterministic hand-laid tilt in degrees, so the mosaic reads as set stone, not a grid. */
const tilt = (row: number, column: number) => (((row * 7 + column * 13) % 5) - 2) * 0.5;

function Tile({
  palette,
  step,
  row,
  column,
}: {
  palette: string;
  step: number;
  row: number;
  column: number;
}) {
  const token = `--tsr-${palette}-${step}`;
  const onDark = step >= 500;
  return (
    <div
      title={token}
      className="group relative aspect-square flex-1 rounded-[3px] transition-transform duration-200 ease-out hover:z-10 hover:scale-125 motion-reduce:transition-none"
      style={{ background: `var(${token})`, rotate: `${tilt(row, column)}deg` }}
    >
      <span
        className="absolute bottom-1 left-1.5 font-mono text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: `var(--tsr-${palette}-${onDark ? 50 : 900})` }}
      >
        {step}
      </span>
    </div>
  );
}

function Palettes() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 p-8 text-foreground">
      <header className="flex flex-col gap-2">
        <h1 className="font-semibold text-3xl tracking-tight">Palettes</h1>
        <p className="max-w-prose text-muted-foreground text-sm">
          Each tile is one token, <code className="font-mono">--tsr-‹palette›-‹step›</code>. Every
          colored palette shares one lightness curve, so any of them can take the primary role and
          keep text legible (WCAG AA) on every surface.
        </p>
      </header>
      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-semibold text-lg">{group.title}</h2>
            <p className="text-muted-foreground text-xs">{group.note}</p>
          </div>
          <div className="flex flex-col gap-[3px] rounded-lg bg-border p-[3px]">
            {group.palettes.map((palette, row) => (
              <div key={palette} className="flex items-center gap-[3px]">
                <span className="w-24 shrink-0 px-2 font-medium text-foreground text-xs capitalize">
                  {palette}
                </span>
                {group.steps.map((step, column) => (
                  <Tile key={step} palette={palette} step={step} row={row} column={column} />
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// Tailwind scan hint (tone classes below are built dynamically):
// tone-primary tone-neutral tone-success tone-warning tone-danger tone-info
const ROLES = ["primary", "neutral", "success", "warning", "danger", "info"] as const;

function Roles() {
  return (
    <div className="grid w-full max-w-3xl grid-cols-2 gap-4 p-8 sm:grid-cols-3">
      {ROLES.map((role) => (
        <div
          key={role}
          className={`tone-${role} flex flex-col overflow-hidden rounded-lg border border-border`}
        >
          <div className="flex h-16 items-end bg-tone p-3 font-medium text-sm text-tone-foreground">
            {role}
          </div>
          <div className="flex h-10 items-center bg-tone-soft px-3 text-sm text-tone-soft-foreground">
            soft
          </div>
          <div className="flex h-10 items-center bg-background px-3 text-sm text-tone-ink">
            ink on background
          </div>
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: "Tessera/Palettes",
  component: Palettes,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Palettes>;

export default meta;

export const Mosaic: StoryObj<typeof meta> = {};

export const RoleTokens: StoryObj<typeof meta> = {
  name: "Roles",
  render: () => <Roles />,
  parameters: { layout: "centered" },
};
