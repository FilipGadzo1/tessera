import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { Button } from "../button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../command";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Input } from "../input";
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteSeparator,
  AutocompleteStatus,
} from "./autocomplete";

const searches = [
  "accessible forms",
  "dark mode tokens",
  "dialog focus trap",
  "forced colors",
  "form validation",
  "keyboard navigation",
  "popover positioning",
  "tailwind variants",
];

interface Movie {
  id: string;
  title: string;
  year: number;
}

const movies: Movie[] = [
  { id: "m1", title: "Pulp Fiction", year: 1994 },
  { id: "m2", title: "The Shawshank Redemption", year: 1994 },
  { id: "m3", title: "Forrest Gump", year: 1994 },
  { id: "m4", title: "The Godfather", year: 1972 },
  { id: "m5", title: "Heat", year: 1995 },
  { id: "m6", title: "Casablanca", year: 1942 },
];

const cities = [
  { value: "Americas", items: ["New York", "Chicago", "Denver", "Los Angeles", "São Paulo"] },
  { value: "Europe", items: ["London", "Paris", "Berlin", "Zagreb", "Helsinki"] },
  { value: "Asia Pacific", items: ["Tokyo", "Singapore", "Sydney", "Auckland"] },
];

const tags = [
  "feature",
  "fix",
  "bug",
  "docs",
  "internal",
  "mobile",
  "component: accordion",
  "component: autocomplete",
  "component: combobox",
  "component: dialog",
];

const meta = {
  title: "Components/Autocomplete",
  component: AutocompleteContent,
  tags: ["autodocs"],
  args: { side: "bottom", align: "start", sideOffset: 6 },
  argTypes: {
    side: { control: "select", options: ["top", "bottom"] },
    align: { control: "select", options: ["start", "center", "end"] },
    sideOffset: { control: "number" },
  },
  render: (args) => (
    <Autocomplete items={searches} name="query">
      <AutocompleteInput aria-label="Search" placeholder="Search the docs" groupClassName="w-72" />
      <AutocompleteContent {...args}>
        <AutocompleteEmpty>No suggestions.</AutocompleteEmpty>
        <AutocompleteList>
          {(item: string) => (
            <AutocompleteItem key={item} value={item}>
              {item}
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  ),
} satisfies Meta<typeof AutocompleteContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Search suggestions. The input keeps whatever you type: picking a suggestion (ArrowDown +
 * Enter, or a click) only fills the input, and free-form text is fine. Use a Combobox instead
 * when the choice must be one of the items.
 */
export const Default: Story = {};

function searchMovies(query: string, signal: AbortSignal) {
  return new Promise<Movie[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      const needle = query.trim().toLowerCase();
      resolve(
        movies.filter(
          (movie) =>
            movie.title.toLowerCase().includes(needle) || String(movie.year).includes(needle),
        ),
      );
    }, 600);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

function AsyncMovies() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim() === "") {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    searchMovies(query, controller.signal)
      .then((found) => {
        setResults(found);
        setLoading(false);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [query]);

  let status = "";
  if (loading) status = "Searching…";
  else if (query.trim() !== "") {
    status = results.length === 0 ? "No movies found." : `${results.length} results`;
  }

  return (
    <Autocomplete
      items={results}
      filter={null}
      value={query}
      onValueChange={setQuery}
      itemToStringValue={(movie: Movie) => movie.title}
    >
      <AutocompleteInput
        aria-label="Movie"
        placeholder="Search by title or year"
        groupClassName="w-80"
        showClear
      />
      <AutocompleteContent>
        <AutocompleteStatus>{status}</AutocompleteStatus>
        <AutocompleteList>
          {(movie: Movie) => (
            <AutocompleteItem key={movie.id} value={movie}>
              <span className="flex flex-1 items-baseline justify-between gap-4">
                <span>{movie.title}</span>
                <span className="text-xs text-muted-foreground">{movie.year}</span>
              </span>
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  );
}

/**
 * Async results: `filter={null}` (the server filters), the controlled `value` drives the search,
 * and `AutocompleteStatus` announces "Searching…" / the result count politely. Try "199".
 */
export const AsyncWithStatus: Story = {
  render: () => <AsyncMovies />,
};

/** Grouped items: groups with no matches disappear while filtering. */
export const Grouped: Story = {
  render: () => (
    <Autocomplete items={cities}>
      <AutocompleteInput aria-label="City" placeholder="Search cities" groupClassName="w-64" />
      <AutocompleteContent>
        <AutocompleteEmpty>No city found.</AutocompleteEmpty>
        <AutocompleteList>
          {(group: (typeof cities)[number], index: number) => (
            <AutocompleteGroup key={group.value} items={group.items}>
              {index > 0 && <AutocompleteSeparator />}
              <AutocompleteGroupLabel>{group.value}</AutocompleteGroupLabel>
              <AutocompleteCollection>
                {(city: string) => (
                  <AutocompleteItem key={city} value={city}>
                    {city}
                  </AutocompleteItem>
                )}
              </AutocompleteCollection>
            </AutocompleteGroup>
          )}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  ),
};

/**
 * `mode="both"`: the list still filters, and the input temporarily shows the highlighted
 * suggestion while you arrow through it (Escape puts your text back). `mode="inline"` does the
 * same over a static, unfiltered list; `mode="none"` never touches the input.
 */
export const InlineAutocomplete: Story = {
  render: () => (
    <Autocomplete items={tags} mode="both">
      <AutocompleteInput aria-label="Tag" placeholder="e.g. feature" groupClassName="w-72" />
      <AutocompleteContent>
        <AutocompleteList>
          {(tag: string) => (
            <AutocompleteItem key={tag} value={tag}>
              {tag}
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  ),
};

/** Inside a `Field`: the label names the input; an invalid Field gives the danger border. */
export const InField: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-6">
      <Field>
        <FieldLabel>Shipping city</FieldLabel>
        <Autocomplete items={cities.flatMap((group) => group.items)} name="city">
          <AutocompleteInput placeholder="Start typing a city" showClear />
          <AutocompleteContent>
            <AutocompleteEmpty>No city found.</AutocompleteEmpty>
            <AutocompleteList>
              {(city: string) => (
                <AutocompleteItem key={city} value={city}>
                  {city}
                </AutocompleteItem>
              )}
            </AutocompleteList>
          </AutocompleteContent>
        </Autocomplete>
        <FieldDescription>Suggestions only: type any city you like.</FieldDescription>
      </Field>
      <Field invalid>
        <FieldLabel>Billing city</FieldLabel>
        <Autocomplete items={cities.flatMap((group) => group.items)}>
          <AutocompleteInput placeholder="Start typing a city" showTrigger />
          <AutocompleteContent>
            <AutocompleteList>
              {(city: string) => (
                <AutocompleteItem key={city} value={city}>
                  {city}
                </AutocompleteItem>
              )}
            </AutocompleteList>
          </AutocompleteContent>
        </Autocomplete>
        <FieldError>Enter a billing city.</FieldError>
      </Field>
    </div>
  ),
};

/** Sizes match Input (`sm` / `md` / `lg`). */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <div key={size} className="flex items-center gap-3">
          <Input aria-label={`Input ${size}`} size={size} placeholder={`Input ${size}`} />
          <Autocomplete items={tags}>
            <AutocompleteInput
              aria-label={`Tag ${size}`}
              size={size}
              placeholder={`Autocomplete ${size}`}
            />
            <AutocompleteContent>
              <AutocompleteList>
                {(tag: string) => (
                  <AutocompleteItem key={tag} value={tag}>
                    {tag}
                  </AutocompleteItem>
                )}
              </AutocompleteList>
            </AutocompleteContent>
          </Autocomplete>
        </div>
      ))}
    </div>
  ),
};

const commands = [
  {
    group: "Suggestions",
    items: [
      { label: "Create a new order", hint: "Orders" },
      { label: "Invite a teammate", hint: "Team" },
      { label: "Export orders as CSV", hint: "Orders" },
    ],
  },
  {
    group: "Settings",
    items: [
      { label: "Switch theme", hint: "Appearance" },
      { label: "Edit profile", hint: "Account" },
      { label: "Open billing", hint: "Account" },
    ],
  },
];

function PaletteDemo() {
  const [open, setOpen] = useState(false);
  const [ran, setRan] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open command palette
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search for a command…" />
        <CommandEmpty />
        <CommandList>
          {commands.map(({ group, items }, index) => (
            <CommandGroup key={group}>
              {index > 0 && <CommandSeparator />}
              <CommandGroupLabel>{group}</CommandGroupLabel>
              {items.map(({ label, hint }) => (
                <CommandItem key={label} value={label} onSelect={() => setRan(label)}>
                  <span className="flex-1">{label}</span>
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {ran ? `Ran: ${ran}` : "No command run yet."}
      </p>
    </div>
  );
}

/**
 * A command palette is now its own component: use `Command` / `CommandDialog`
 * (Components/Command), built on this Autocomplete in inline mode. This story renders a
 * `CommandDialog`: the items filter as you type, Enter runs the highlighted one and closes the
 * dialog, and Escape clears the query before it closes.
 */
export const CommandPalette: Story = {
  render: () => <PaletteDemo />,
};
