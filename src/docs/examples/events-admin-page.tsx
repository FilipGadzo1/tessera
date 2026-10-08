"use client";

import { type RefObject, useCallback, useId, useMemo, useRef, useState } from "react";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import {
  DataTable,
  DataTableColumnsMenu,
  type DataTableInstance,
  DataTablePagination,
  useDataTable,
} from "../../components/data-table";
import { DatePicker } from "../../components/date-picker";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../../components/drawer";
import { Field, FieldDescription, FieldError, FieldLabel } from "../../components/field";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadList,
  FileUploadRejections,
} from "../../components/file-upload";
import { Form } from "../../components/form";
import { Input } from "../../components/input";
import { TagsInput } from "../../components/tags-input";
import { TimePicker } from "../../components/time-picker";
import { parseISODate } from "../../lib/date";
import { getLocaleDirection } from "../../lib/direction";
import { getFileKey } from "../../lib/file";
import { PlusIcon } from "../../lib/icons";
import { formatTime } from "../../lib/time";
import {
  type EventItem,
  eventColumns,
  locale,
  initialEvents as sampleEvents,
  startsAt,
} from "./events-admin-data";

/** What a Save reports: the form's values, with the attachments as the `File`s just uploaded. */
export interface SavedEvent {
  title: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`. */
  start: string;
  tags: string[];
  attachments: File[];
}

/** Uploads one file, reporting 0–100 through `onProgress`; rejects when the upload fails. */
export type UploadFile = (file: File, onProgress: (percent: number) => void) => Promise<void>;

export interface EventsAdminPageProps {
  /** @default twelve sample events */
  initialEvents?: EventItem[];
  /** The page has no network code: Save hands each new attachment to this. @default resolves at once */
  uploadFile?: UploadFile;
  /** Called after a Save whose uploads all resolved. */
  onSave?: (event: SavedEvent) => void;
}

const startsAtFormat = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short" });
const tagPattern = /^[a-z0-9-]+$/;
const uploadError = "Upload failed. Save again to retry.";

const instantUpload: UploadFile = async (_file, onProgress) => onProgress(100);

/**
 * A locale-formatted time keeps the locale's direction (the TimePicker rule): in an RTL page an
 * en-US "9:30 AM" starts with a digit, so without it the bidi algorithm shows "AM 9:30".
 */
const startCell = (event: EventItem) => (
  <span dir={getLocaleDirection(locale)}>{formatTime(event.start, locale)}</span>
);

/**
 * Outline badges: a soft badge's fill matches a selected row's. In forced colors a selected row
 * keeps its Highlight pair (`forced-color-adjust: none`), so the badge takes the row's text colour.
 */
const tagBadges = (event: EventItem) => (
  <span className="flex flex-wrap gap-1">
    {event.tags.map((tag) => (
      <Badge
        key={tag}
        variant="outline"
        className="forced-colors:border-current forced-colors:text-inherit"
      >
        {tag}
      </Badge>
    ))}
  </span>
);

interface EventsToolbarProps {
  table: DataTableInstance<EventItem>;
  query: string;
  onQueryChange: (query: string) => void;
  onDelete: () => void;
}

function EventsToolbar({ table, query, onQueryChange, onDelete }: EventsToolbarProps) {
  const count = table.selectedRows.length;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        type="search"
        aria-label="Search events"
        placeholder="Search events…"
        className="sm:max-w-64"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
        <DataTableColumnsMenu table={table} />
        <Button size="sm" color="danger" variant="soft" disabled={count === 0} onClick={onDelete}>
          {count === 0 ? "Delete selected" : `Delete selected (${count})`}
        </Button>
      </div>
    </div>
  );
}

function EventsTable({ table, labelId }: { table: DataTableInstance<EventItem>; labelId: string }) {
  return (
    <div className="flex flex-col gap-4">
      <DataTable table={table} aria-labelledby={labelId} empty="No events match your search." />
      <DataTablePagination table={table} pageSizeOptions={[5, 10, 20]} />
    </div>
  );
}

interface UploadState {
  progress: number;
  status: "uploading" | "complete" | "error";
}

interface EventFormProps {
  /** The event being edited, or `null` for a new one. */
  event: EventItem | null;
  titleRef: RefObject<HTMLInputElement | null>;
  uploadFile: UploadFile;
  onSaved: (event: SavedEvent) => void;
}

/**
 * The drawer's Form. A valid submit uploads the new attachments (each item shows its progress and
 * status) and reports the event once every upload resolved; a failed upload keeps the form open.
 */
function EventForm({ event, titleRef, uploadFile, onSaved }: EventFormProps) {
  const [uploads, setUploads] = useState(() => new Map<File, UploadState>());
  const [saving, setSaving] = useState(false);
  const attached = event?.attachments.map((file) => file.name) ?? [];

  const track = (file: File, state: UploadState) =>
    setUploads((current) => new Map(current).set(file, state));

  async function submit(values: Record<string, unknown>) {
    const saved: SavedEvent = {
      title: String(values.title ?? "").trim(),
      date: String(values.date ?? ""),
      start: String(values.start ?? ""),
      tags: (values.tags as string[] | undefined) ?? [],
      attachments: (values.attachments as File[] | undefined) ?? [],
    };
    setSaving(true);
    const results = await Promise.all(
      saved.attachments.map(async (file) => {
        if (uploads.get(file)?.status === "complete") return true;
        track(file, { progress: 0, status: "uploading" });
        try {
          await uploadFile(file, (progress) => track(file, { progress, status: "uploading" }));
          track(file, { progress: 100, status: "complete" });
          return true;
        } catch {
          track(file, { progress: 0, status: "error" });
          return false;
        }
      }),
    );
    setSaving(false);
    if (results.every(Boolean)) onSaved(saved);
  }

  return (
    <Form className="flex flex-1 flex-col gap-4" onFormSubmit={(values) => void submit(values)}>
      <div className="flex flex-col gap-4 px-4">
        <Field name="title">
          <FieldLabel>Title</FieldLabel>
          <Input ref={titleRef} required defaultValue={event?.title} autoComplete="off" />
          <FieldError />
        </Field>
        <Field name="date">
          <FieldLabel>Date</FieldLabel>
          <DatePicker
            editable
            required
            locale={locale}
            defaultValue={event ? parseISODate(event.date) : null}
          />
          <FieldError />
        </Field>
        <Field name="start">
          <FieldLabel>Start</FieldLabel>
          <TimePicker
            required
            min="08:00"
            max="20:00"
            step={900}
            slotStep={30}
            locale={locale}
            defaultValue={event?.start ?? null}
          />
          <FieldDescription>Between 8:00 AM and 8:00 PM, in 15-minute steps.</FieldDescription>
          <FieldError />
        </Field>
        <Field name="tags">
          <FieldLabel>Tags</FieldLabel>
          <TagsInput
            max={5}
            placeholder="Add a tag"
            defaultValue={event?.tags ?? []}
            validate={(tag) =>
              tagPattern.test(tag) ? null : "Use lowercase letters, digits and hyphens"
            }
          />
          <FieldDescription>Up to 5. Press Enter or type a comma to add one.</FieldDescription>
        </Field>
        <Field name="attachments">
          <FieldLabel>Attachments</FieldLabel>
          <FileUpload accept="image/*,.pdf" maxSize={5_000_000} maxFiles={3} locale={locale}>
            <FileUploadDropzone />
            <FileUploadRejections />
            <FileUploadList>
              {(files) =>
                files.map((file) => {
                  const upload = uploads.get(file);
                  return (
                    <FileUploadItem
                      key={getFileKey(file)}
                      file={file}
                      progress={upload?.status === "uploading" ? upload.progress : undefined}
                      status={upload?.status ?? "idle"}
                      error={uploadError}
                    />
                  );
                })
              }
            </FileUploadList>
          </FileUpload>
          <FieldDescription>
            {attached.length > 0
              ? `${attached.join(", ")} ${attached.length === 1 ? "is" : "are"} already attached.`
              : "Images or PDFs, up to 3 files."}
          </FieldDescription>
        </Field>
      </div>
      <DrawerFooter className="mt-auto">
        <DrawerClose render={<Button variant="outline" color="neutral" />}>Cancel</DrawerClose>
        <Button type="submit" loading={saving}>
          Save
        </Button>
      </DrawerFooter>
    </Form>
  );
}

interface EventDrawerProps extends Omit<EventFormProps, "titleRef"> {
  /** Changes on each open, so the form starts from the event's values again. */
  formKey: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus returns on close (the Orders pattern: the drawer has no DrawerTrigger). */
  finalFocus: () => HTMLElement | boolean;
}

function EventDrawer({
  formKey,
  open,
  onOpenChange,
  finalFocus,
  event,
  ...formProps
}: EventDrawerProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="w-full max-w-none sm:max-w-md"
        initialFocus={titleRef}
        finalFocus={finalFocus}
      >
        <DrawerHeader>
          <DrawerTitle>{event ? "Edit event" : "New event"}</DrawerTitle>
          <DrawerDescription>
            {event ? startsAtFormat.format(startsAt(event)) : "Add an event to the calendar."}
          </DrawerDescription>
        </DrawerHeader>
        <EventForm key={formKey} {...formProps} event={event} titleRef={titleRef} />
      </DrawerContent>
    </Drawer>
  );
}

/**
 * Example only (not exported from the library): an events admin page composing the Phase K
 * components. A DataTable (sorted by date, then start; multi-sort with Shift; page selection;
 * a Columns menu; 5 / 10 / 20 rows per page) lists the events, a search filters them by title, and
 * "Delete selected" removes the selected rows. "New event" and each row's Edit open a Drawer whose
 * Form holds a DatePicker, a TimePicker, a TagsInput and a FileUpload; Save uploads the
 * attachments through `uploadFile`, showing each item's progress.
 */
export function EventsAdminPage({
  initialEvents = sampleEvents,
  uploadFile = instantUpload,
  onSave,
}: EventsAdminPageProps) {
  const headingId = useId();
  const [events, setEvents] = useState(initialEvents);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Kept after closing so the drawer's content stays put during its exit slide.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const nextId = useRef(initialEvents.length + 1);
  const newButton = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());

  const openDrawer = useCallback((id: string | null) => {
    setEditingId(id);
    setFormKey((key) => key + 1);
    setDrawerOpen(true);
  }, []);

  const columns = useMemo(
    () =>
      eventColumns({
        start: startCell,
        tags: tagBadges,
        actionsHeader: <span className="sr-only">Actions</span>,
        edit: (event) => (
          <Button
            ref={(element) => {
              if (element) editButtons.current.set(event.id, element);
              else editButtons.current.delete(event.id);
            }}
            size="sm"
            variant="outline"
            color="neutral"
            aria-label={`Edit ${event.title}`}
            onClick={() => openDrawer(event.id)}
          >
            Edit
          </Button>
        ),
      }),
    [openDrawer],
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return events.filter((event) => event.title.toLocaleLowerCase(locale).includes(needle));
  }, [events, query]);

  const table = useDataTable({
    data: shown,
    columns,
    getRowId: (event) => event.id,
    locale,
    selectionMode: "multiple",
    defaultSorting: [
      { id: "date", desc: false },
      { id: "start", desc: false },
    ],
    defaultPagination: { pageIndex: 0, pageSize: 5 },
    defaultColumnVisibility: { files: false },
  });

  const editing = events.find((event) => event.id === editingId) ?? null;

  function deleteSelected() {
    const ids = new Set(table.selectedRows.map((event) => event.id));
    // The button empties and disables itself: move focus to the line that says what happened.
    statusRef.current?.focus();
    setEvents((current) => current.filter((event) => !ids.has(event.id)));
    table.clearSelection();
    setStatus(ids.size === 1 ? "1 event deleted" : `${ids.size} events deleted`);
  }

  function save(saved: SavedEvent) {
    const { title, date, start, tags } = saved;
    const added = saved.attachments.map(({ name, size }) => ({ name, size }));
    const base = editing ?? { id: `e${nextId.current++}`, attendees: 0, attachments: [] };
    const next = {
      ...base,
      title,
      date,
      start,
      tags,
      attachments: [...base.attachments, ...added],
    };
    setEvents((current) =>
      editing
        ? current.map((event) => (event.id === editing.id ? next : event))
        : [...current, next],
    );
    onSave?.(saved);
    setStatus("Event saved");
    setDrawerOpen(false);
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 id={headingId} className="font-semibold text-2xl tracking-tight">
            Events
          </h1>
          <p className="text-muted-foreground text-sm">
            Plan the season: sort, select and edit events, with times, tags and attachments.
          </p>
        </div>
        <Button ref={newButton} onClick={() => openDrawer(null)}>
          <PlusIcon />
          New event
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <EventsToolbar
          table={table}
          query={query}
          onQueryChange={(next) => {
            setQuery(next);
            table.setPageIndex(0);
          }}
          onDelete={deleteSelected}
        />
        <p ref={statusRef} role="status" tabIndex={-1} className="text-sm outline-none">
          {status}
        </p>
      </div>
      <EventsTable table={table} labelId={headingId} />

      <EventDrawer
        formKey={formKey}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        finalFocus={() =>
          (editingId === null
            ? newButton.current
            : editButtons.current.get(editingId) || statusRef.current) || true
        }
        event={editing}
        uploadFile={uploadFile}
        onSaved={save}
      />
    </div>
  );
}
