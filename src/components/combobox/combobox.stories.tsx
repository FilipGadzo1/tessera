import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { Button } from "../button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Input } from "../input";
import {
  Combobox,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxStatus,
  ComboboxValue,
} from "./combobox";

const frameworks = [
  "Astro",
  "Next.js",
  "Nuxt",
  "Remix",
  "SolidStart",
  "SvelteKit",
  "TanStack Start",
];

interface Customer {
  id: string;
  name: string;
  email: string;
}

const customers: Customer[] = [
  { id: "c-101", name: "Ana Horvat", email: "ana@horvat.hr" },
  { id: "c-102", name: "Ben Carter", email: "ben@carter.io" },
  { id: "c-103", name: "Chloé Martin", email: "chloe@martin.fr" },
  { id: "c-104", name: "Daniel Kim", email: "daniel@kim.dev" },
  { id: "c-105", name: "Eva Novak", email: "eva@novak.si" },
];

const timezones = [
  { value: "Americas", items: ["New York", "Chicago", "Denver", "Los Angeles", "São Paulo"] },
  { value: "Europe", items: ["London", "Paris", "Berlin", "Zagreb", "Helsinki"] },
  { value: "Asia Pacific", items: ["Tokyo", "Singapore", "Sydney", "Auckland"] },
];

const labels = ["Bug", "Feature", "Documentation", "Performance", "Accessibility", "Design"];

const meta = {
  title: "Components/Combobox",
  component: ComboboxContent,
  tags: ["autodocs"],
  args: { side: "bottom", align: "start", sideOffset: 6 },
  argTypes: {
    side: { control: "select", options: ["top", "bottom"] },
    align: { control: "select", options: ["start", "center", "end"] },
    sideOffset: { control: "number" },
  },
  render: (args) => (
    <Combobox items={frameworks} name="framework">
      <ComboboxInput aria-label="Framework" placeholder="Search frameworks" groupClassName="w-64" />
      <ComboboxContent {...args}>
        <ComboboxEmpty>No framework found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
} satisfies Meta<typeof ComboboxContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Plain strings: type to filter, ArrowDown / Enter to pick. */
export const Default: Story = {};

/** Object items: `itemToStringLabel` fills the input, `itemToStringValue` is what the form submits. */
export const ObjectsWithLabels: Story = {
  render: () => (
    <Combobox
      items={customers}
      name="customer"
      itemToStringLabel={(customer: Customer) => customer.name}
      itemToStringValue={(customer: Customer) => customer.id}
    >
      <ComboboxInput
        aria-label="Customer"
        placeholder="Search customers"
        groupClassName="w-72"
        showClear
      />
      <ComboboxContent>
        <ComboboxEmpty>No customer found.</ComboboxEmpty>
        <ComboboxList>
          {(customer: Customer) => (
            <ComboboxItem key={customer.id} value={customer}>
              <span className="flex flex-col">
                <span>{customer.name}</span>
                <span className="text-xs text-muted-foreground">{customer.email}</span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

/** Grouped items: groups with no matches disappear while filtering. */
export const Groups: Story = {
  render: () => (
    <Combobox items={timezones}>
      <ComboboxInput aria-label="City" placeholder="Search cities" groupClassName="w-64" />
      <ComboboxContent>
        <ComboboxEmpty>No city found.</ComboboxEmpty>
        <ComboboxList>
          {(group: (typeof timezones)[number], index: number) => (
            <ComboboxGroup key={group.value} items={group.items}>
              {index > 0 && <ComboboxSeparator />}
              <ComboboxGroupLabel>{group.value}</ComboboxGroupLabel>
              <ComboboxCollection>
                {(city: string) => (
                  <ComboboxItem key={city} value={city}>
                    {city}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

/**
 * `multiple` with chips: Backspace in the empty input removes the last chip, ArrowLeft walks into
 * the chips, and each chip's × removes it.
 */
export const MultipleWithChips: Story = {
  render: () => (
    <Combobox items={labels} multiple defaultValue={["Bug", "Accessibility"]} name="labels">
      <ComboboxChips className="w-80">
        <ComboboxValue>
          {(values: string[]) =>
            values.map((value) => (
              <ComboboxChip key={value}>
                {value}
                <ComboboxChipRemove />
              </ComboboxChip>
            ))
          }
        </ComboboxValue>
        <ComboboxInput aria-label="Labels" placeholder="Add a label" />
      </ComboboxChips>
      <ComboboxContent>
        <ComboboxEmpty>No label found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
};

function searchCustomers(query: string, signal: AbortSignal) {
  return new Promise<Customer[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      const needle = query.trim().toLowerCase();
      resolve(customers.filter((customer) => customer.name.toLowerCase().includes(needle)));
    }, 600);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

function AsyncCustomers() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim() === "") {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    searchCustomers(query, controller.signal)
      .then((found) => {
        setResults(found);
        setLoading(false);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [query]);

  let status = "";
  if (loading) status = "Searching…";
  else if (query.trim() !== "" && results.length > 0) {
    status = `${results.length} result${results.length === 1 ? "" : "s"}`;
  }

  return (
    <Combobox
      items={results}
      filter={null}
      itemToStringLabel={(customer: Customer) => customer.name}
      onInputValueChange={setQuery}
    >
      <ComboboxInput
        aria-label="Customer"
        placeholder="Type a customer name"
        groupClassName="w-72"
        showTrigger={false}
      />
      <ComboboxContent>
        <ComboboxStatus>{status}</ComboboxStatus>
        {!loading && query.trim() !== "" && <ComboboxEmpty>No customer found.</ComboboxEmpty>}
        <ComboboxList>
          {(customer: Customer) => (
            <ComboboxItem key={customer.id} value={customer}>
              {customer.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/**
 * Async results: `filter={null}` (the server filters), `onInputValueChange` drives the search, and
 * `ComboboxStatus` announces "Searching…" / the result count politely.
 */
export const AsyncWithStatus: Story = {
  render: () => <AsyncCustomers />,
};

/** Inside a `Field`: the label names the input; an invalid Field gives the danger border. */
export const InField: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-6">
      <Field>
        <FieldLabel>Framework</FieldLabel>
        <Combobox items={frameworks}>
          <ComboboxInput placeholder="Search frameworks" showClear />
          <ComboboxContent>
            <ComboboxEmpty>No framework found.</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <FieldDescription>Used to scaffold the project.</FieldDescription>
      </Field>
      <Field invalid>
        <FieldLabel>Labels</FieldLabel>
        <Combobox items={labels} multiple defaultValue={[]}>
          <ComboboxChips>
            <ComboboxValue>
              {(values: string[]) =>
                values.map((value) => (
                  <ComboboxChip key={value}>
                    {value}
                    <ComboboxChipRemove />
                  </ComboboxChip>
                ))
              }
            </ComboboxValue>
            <ComboboxInput placeholder="Add a label" />
          </ComboboxChips>
          <ComboboxContent>
            <ComboboxEmpty>No label found.</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <FieldError>Pick at least one label.</FieldError>
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
          <Combobox items={frameworks}>
            <ComboboxInput
              aria-label={`Framework ${size}`}
              size={size}
              placeholder={`Combobox ${size}`}
            />
            <ComboboxContent>
              <ComboboxList>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      ))}
    </div>
  ),
};

/** Inside a modal Dialog: the list stacks above it, and Escape closes the combobox first. */
export const InDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>Assign customer</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign customer</DialogTitle>
          <DialogDescription>The order is billed to the customer you pick.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Customer</FieldLabel>
          <Combobox items={customers} itemToStringLabel={(customer: Customer) => customer.name}>
            <ComboboxInput placeholder="Search customers" showClear />
            <ComboboxContent>
              <ComboboxEmpty>No customer found.</ComboboxEmpty>
              <ComboboxList>
                {(customer: Customer) => (
                  <ComboboxItem key={customer.id} value={customer}>
                    {customer.name}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" color="neutral" />}>Cancel</DialogClose>
          <DialogClose render={<Button />}>Assign</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
