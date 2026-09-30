/** The Files example's sample data: a folder hierarchy and each folder's files. */

export interface Folder {
  id: string;
  name: string;
  parent: string | null;
}

export const initialFolders: Folder[] = [
  { id: "documents", name: "Documents", parent: null },
  { id: "invoices", name: "Invoices", parent: "documents" },
  { id: "reports", name: "Reports", parent: "documents" },
  { id: "pictures", name: "Pictures", parent: null },
  { id: "holiday", name: "Holiday", parent: "pictures" },
  { id: "music", name: "Music", parent: null },
];

export type Kind = "Document" | "Spreadsheet" | "Image" | "Audio";

export interface FileEntry {
  name: string;
  kind: Kind;
  size: string;
  /** `YYYY-MM-DD`, the same format the Modified filter submits. */
  modified: string;
}

export const filesByFolder: Record<string, FileEntry[]> = {
  documents: [
    { name: "Budget 2026.xlsx", kind: "Spreadsheet", size: "48 KB", modified: "2026-09-12" },
    { name: "Contract.pdf", kind: "Document", size: "1.2 MB", modified: "2026-08-14" },
    { name: "Notes.txt", kind: "Document", size: "3 KB", modified: "2026-09-18" },
    { name: "Onboarding.docx", kind: "Document", size: "220 KB", modified: "2026-07-30" },
  ],
  invoices: [
    { name: "INV-1041.pdf", kind: "Document", size: "88 KB", modified: "2026-09-03" },
    { name: "INV-1042.pdf", kind: "Document", size: "91 KB", modified: "2026-09-27" },
  ],
  reports: [
    { name: "Q3 review.pdf", kind: "Document", size: "2.4 MB", modified: "2026-09-29" },
    { name: "Roadmap.pdf", kind: "Document", size: "640 KB", modified: "2026-08-21" },
  ],
  pictures: [
    { name: "Aurora.png", kind: "Image", size: "3.1 MB", modified: "2026-09-05" },
    { name: "Dunes.png", kind: "Image", size: "2.8 MB", modified: "2026-09-10" },
    { name: "Glacier.png", kind: "Image", size: "4.0 MB", modified: "2026-09-22" },
  ],
  holiday: [
    { name: "Beach.png", kind: "Image", size: "2.2 MB", modified: "2026-08-02" },
    { name: "Harbour.png", kind: "Image", size: "2.6 MB", modified: "2026-08-03" },
    { name: "Itinerary.pdf", kind: "Document", size: "120 KB", modified: "2026-07-20" },
  ],
  music: [{ name: "Demo.mp3", kind: "Audio", size: "5.6 MB", modified: "2026-06-11" }],
};

/** An image placeholder drawn inline (no network images): a tinted scene with a shape. */
export interface Art {
  alt: string;
  tone: string;
  shape: "sun" | "hills" | "peak";
}

export const primaryTone = "bg-primary-soft text-primary-soft-foreground";
const info = "bg-info-soft text-info-soft-foreground";
const success = "bg-success-soft text-success-soft-foreground";
const warning = "bg-warning-soft text-warning-soft-foreground";

/** The image files' placeholders, by file name. */
export const artByName: Record<string, Art> = {
  "Aurora.png": { alt: "A sun over a night sky", tone: info, shape: "sun" },
  "Dunes.png": { alt: "Rolling dunes", tone: warning, shape: "hills" },
  "Glacier.png": { alt: "A mountain peak", tone: primaryTone, shape: "peak" },
  "Beach.png": { alt: "Sun over the sea", tone: info, shape: "sun" },
  "Harbour.png": { alt: "Green hills by a harbour", tone: success, shape: "hills" },
};
