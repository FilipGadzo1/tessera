import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { CalendarIcon, PlusIcon, SearchIcon } from "../../lib/icons";
import { useModifierKeyLabel } from "../../lib/use-modifier-key-label";
import { Button } from "../button";
import { KbdShortcut } from "../kbd";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
  CommandSeparator,
  CommandShortcut,
} from "./command";

const meta = {
  title: "Components/Command",
  component: Command,
  tags: ["autodocs"],
  args: { loop: false, label: "Command menu" },
  argTypes: {
    loop: { control: "boolean" },
    label: { control: "text" },
  },
  render: (args) => (
    <Command {...args} className="w-96 border border-border shadow-md">
      <CommandInput placeholder="Type a command or search…" />
      <CommandEmpty />
      <CommandList>
        <CommandGroup>
          <CommandGroupLabel>Suggestions</CommandGroupLabel>
          <CommandItem>
            <CalendarIcon />
            Calendar
          </CommandItem>
          <CommandItem keywords={["find", "lookup"]}>
            <SearchIcon />
            Search the docs
          </CommandItem>
          <CommandItem disabled>
            <PlusIcon />
            New project
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup>
          <CommandGroupLabel>Settings</CommandGroupLabel>
          <CommandItem>
            Profile
            <CommandShortcut shortcut="mod+p" />
          </CommandItem>
          <CommandItem keywords={["invoices", "payment"]}>
            Billing
            <CommandShortcut shortcut="mod+b" />
          </CommandItem>
          <CommandItem>
            Toggle sidebar
            <CommandShortcut shortcut="mod+s" />
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Inline: the list is always visible. Typing filters on the item text and `keywords` (try
 * "payment"); groups with no match hide and the separator steps aside. ↑/↓ move the highlight,
 * Home/End jump to the ends, Enter runs the item, Escape clears the query. "New project" is
 * disabled: reachable, but it does not run.
 */
export const Default: Story = {};

function DialogDemo() {
  const [open, setOpen] = useState(false);
  const [ran, setRan] = useState<string | null>(null);
  const run = (name: string) => () => setRan(name);
  const { aria } = useModifierKeyLabel();
  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" aria-keyshortcuts={aria("mod+k")} onClick={() => setOpen(true)}>
        Open command menu
        <KbdShortcut aria-hidden shortcut="mod+k" className="ms-2" />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        description="Type to filter, use the arrow keys to move and Enter to run a command."
      >
        <CommandInput placeholder="Type a command or search…" />
        <CommandEmpty />
        <CommandList>
          <CommandGroup>
            <CommandGroupLabel>Orders</CommandGroupLabel>
            <CommandItem onSelect={run("Create a new order")}>Create a new order</CommandItem>
            <CommandItem keywords={["csv", "download"]} onSelect={run("Export orders")}>
              Export orders
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup>
            <CommandGroupLabel>Account</CommandGroupLabel>
            <CommandItem onSelect={run("Edit profile")}>
              Edit profile
              <CommandShortcut shortcut="mod+p" />
            </CommandItem>
            <CommandItem
              keywords={["invoices"]}
              onSelect={(event) => {
                // Keeps the dialog open, e.g. to show a sub-page of commands.
                event.preventDefault();
                setRan("Billing (dialog kept open)");
              }}
            >
              Billing
              <CommandShortcut shortcut="mod+b" />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {ran ? `Ran: ${ran}` : "No command run yet."}
      </p>
    </div>
  );
}

/**
 * `CommandDialog`: Ctrl+K (⌘K on a Mac) opens it from anywhere except a text field; the input
 * takes focus. Running an item closes it and focus returns; "Billing" calls
 * `event.preventDefault()` in `onSelect`, so the dialog stays open. Escape clears the query
 * first, then closes.
 */
export const Dialog: Story = {
  render: () => <DialogDemo />,
};

const people = [
  "Ada Lovelace",
  "Grace Hopper",
  "Alan Turing",
  "Katherine Johnson",
  "Linus Torvalds",
];

function AsyncDemo() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const needle = query.trim().toLowerCase();
      setResults(people.filter((name) => name.toLowerCase().includes(needle)));
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Command
      value={query}
      onValueChange={setQuery}
      filter={() => true}
      label="Find a person"
      className="w-80 border border-border shadow-md"
    >
      <CommandInput placeholder="Search people…" />
      {loading && <CommandLoading>Searching…</CommandLoading>}
      {/* Kept mounted (a live region); silent while a search is running. */}
      <CommandEmpty>{loading ? null : "No people found."}</CommandEmpty>
      <CommandList>
        {results.map((name) => (
          <CommandItem key={name}>{name}</CommandItem>
        ))}
      </CommandList>
    </Command>
  );
}

/**
 * Async results: the controlled `value` drives the search, `filter={() => true}` keeps every
 * returned item, `CommandLoading` says "Searching…" and `CommandEmpty` (localised) the rest.
 */
export const AsyncResults: Story = {
  render: () => <AsyncDemo />,
};
