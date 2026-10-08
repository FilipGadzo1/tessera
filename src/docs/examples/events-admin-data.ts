/** The Events admin example's sample data (twelve events) and its table columns. */

import type { ReactNode } from "react";
import type { DataTableColumn } from "../../lib/data-table";

export const locale = "en-US";
const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

export interface Attachment {
  name: string;
  /** Bytes. */
  size: number;
}

export interface EventItem {
  id: string;
  title: string;
  /** `YYYY-MM-DD`, the DatePicker's form value. */
  date: string;
  /** `HH:mm`, the TimePicker's value. */
  start: string;
  tags: string[];
  attendees: number;
  attachments: Attachment[];
}

/**
 * A time of day is wall-clock data with no date (TimePicker's `"HH:mm"`), so the page combines an
 * event's day and start into a local `Date` itself, for display only.
 */
export function startsAt({ date, start }: EventItem): Date {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const [hour = 0, minute = 0] = start.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

interface ColumnRenderers {
  /** The Start cell: `formatTime`'s text in the locale's direction. */
  start: (event: EventItem) => ReactNode;
  /** The Tags cell (Badges). */
  tags: (event: EventItem) => ReactNode;
  /** The visually hidden header of the Edit buttons' column. */
  actionsHeader: ReactNode;
  /** A row's Edit button. */
  edit: (event: EventItem) => ReactNode;
}

/**
 * Title (the row header), Date (`dateStyle: "medium"`, sorted by the ISO string), Start
 * (`formatTime`, sorted by the value), Tags (not sortable), Attendees and Files (end-aligned;
 * the page hides Files by default) and the Edit buttons (neither sortable nor hideable).
 */
export function eventColumns({ start, tags, actionsHeader, edit }: ColumnRenderers) {
  const columns: DataTableColumn<EventItem>[] = [
    {
      id: "title",
      header: "Title",
      accessor: (event) => event.title,
      rowHeader: true,
      cellClassName: "whitespace-nowrap",
    },
    {
      id: "date",
      header: "Date",
      accessor: (event) => event.date,
      cell: (event) => dateFormat.format(new Date(event.date)),
      cellClassName: "whitespace-nowrap",
    },
    {
      id: "start",
      header: "Start",
      accessor: (event) => event.start,
      cell: start,
      cellClassName: "whitespace-nowrap tabular-nums",
    },
    { id: "tags", header: "Tags", cell: tags },
    {
      id: "attendees",
      header: "Attendees",
      accessor: (event) => event.attendees,
      align: "end",
      cellClassName: "tabular-nums",
    },
    {
      id: "files",
      header: "Files",
      accessor: (event) => event.attachments.length,
      align: "end",
      cellClassName: "tabular-nums",
    },
    {
      id: "actions",
      header: actionsHeader,
      label: "Actions",
      hideable: false,
      align: "end",
      cell: edit,
    },
  ];
  return columns;
}

export const initialEvents: EventItem[] = [
  {
    id: "e1",
    title: "Launch party",
    date: "2026-10-12",
    start: "18:00",
    tags: ["launch", "social"],
    attendees: 120,
    attachments: [{ name: "invite.pdf", size: 240_000 }],
  },
  {
    id: "e2",
    title: "Board meeting",
    date: "2026-10-05",
    start: "09:00",
    tags: ["internal"],
    attendees: 8,
    attachments: [
      { name: "agenda.pdf", size: 52_000 },
      { name: "q3-figures.pdf", size: 1_200_000 },
    ],
  },
  {
    id: "e3",
    title: "Code review",
    date: "2026-10-05",
    start: "14:30",
    tags: ["engineering"],
    attendees: 6,
    attachments: [],
  },
  {
    id: "e4",
    title: "Design sprint",
    date: "2026-10-20",
    start: "10:00",
    tags: ["design", "workshop"],
    attendees: 14,
    attachments: [{ name: "brief.pdf", size: 310_000 }],
  },
  {
    id: "e5",
    title: "Expo",
    date: "2026-11-02",
    start: "09:30",
    tags: ["conference"],
    attendees: 950,
    attachments: [{ name: "floor-plan.png", size: 2_400_000 }],
  },
  {
    id: "e6",
    title: "Fundraiser",
    date: "2026-10-12",
    start: "19:30",
    tags: ["charity", "social"],
    attendees: 300,
    attachments: [],
  },
  {
    id: "e7",
    title: "Gala dinner",
    date: "2026-12-01",
    start: "19:00",
    tags: ["social"],
    attendees: 200,
    attachments: [{ name: "menu.pdf", size: 95_000 }],
  },
  {
    id: "e8",
    title: "Hackathon",
    date: "2026-11-15",
    start: "09:00",
    tags: ["engineering", "social"],
    attendees: 80,
    attachments: [],
  },
  {
    id: "e9",
    title: "Investor call",
    date: "2026-10-05",
    start: "16:00",
    tags: ["finance"],
    attendees: 4,
    attachments: [{ name: "deck.pdf", size: 3_800_000 }],
  },
  {
    id: "e10",
    title: "Jam session",
    date: "2026-10-28",
    start: "17:00",
    tags: ["music"],
    attendees: 25,
    attachments: [],
  },
  {
    id: "e11",
    title: "Kickoff",
    date: "2026-10-01",
    start: "10:00",
    tags: ["internal"],
    attendees: 40,
    attachments: [{ name: "roadmap.png", size: 860_000 }],
  },
  {
    id: "e12",
    title: "Lunch & learn",
    date: "2026-10-20",
    start: "12:30",
    tags: ["learning"],
    attendees: 30,
    attachments: [],
  },
];
