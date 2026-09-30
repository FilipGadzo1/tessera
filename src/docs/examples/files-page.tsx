"use client";

import { FileImage, FileMusic, FileSpreadsheet, FileText } from "lucide-react";
import { type ComponentType, type ReactNode, useId, useRef, useState } from "react";
import { Button } from "../../components/button";
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../../components/carousel";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "../../components/command";
import { DateRangePicker } from "../../components/date-picker";
import { Field, FieldLabel } from "../../components/field";
import { Form } from "../../components/form";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "../../components/sidebar";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/table";
import { Tree, TreeItem, TreeItemContent, TreeItemIcon } from "../../components/tree";
import { FolderIcon, PanelLeftIcon, PlusIcon, SearchIcon } from "../../lib/icons";
import {
  type Art,
  artByName,
  type FileEntry,
  type Folder,
  filesByFolder,
  initialFolders,
  type Kind,
  primaryTone,
} from "./files-data";

const kindIcon: Record<Kind, ComponentType<{ className?: string }>> = {
  Document: FileText,
  Spreadsheet: FileSpreadsheet,
  Image: FileImage,
  Audio: FileMusic,
};

const shapes: Record<Art["shape"], ReactNode> = {
  sun: <circle cx="80" cy="42" r="18" />,
  hills: <path d="M0 70 Q40 38 80 62 T160 52 V90 H0Z" />,
  peak: <path d="M20 80 72 20 96 50 108 38 140 80Z" />,
};

/** What the filter Form reports through `onFormSubmit`: DateRangePicker's `{ start, end }`. */
export type FilesFilter = { modified: { start: string; end: string } };

function ancestorsOf(id: string, folders: Folder[]) {
  const ids: string[] = [];
  let parent = folders.find((folder) => folder.id === id)?.parent ?? null;
  while (parent) {
    ids.push(parent);
    const at: string = parent;
    parent = folders.find((folder) => folder.id === at)?.parent ?? null;
  }
  return ids;
}

function FolderItems({ folders, parent }: { folders: Folder[]; parent: string | null }) {
  return folders
    .filter((folder) => folder.parent === parent)
    .map((folder) => (
      <TreeItem key={folder.id} value={folder.id}>
        <TreeItemContent>
          <TreeItemIcon>
            <FolderIcon />
          </TreeItemIcon>
          {folder.name}
        </TreeItemContent>
        {/* Only folders with subfolders get a group (and so a chevron and aria-expanded). */}
        {folders.some((child) => child.parent === folder.id) && (
          <FolderItems folders={folders} parent={folder.id} />
        )}
      </TreeItem>
    ));
}

function FolderSidebar({
  folders,
  current,
  expanded,
  onExpandedChange,
  onOpen,
}: {
  folders: Folder[];
  current: string;
  expanded: string[];
  onExpandedChange: (values: string[]) => void;
  onOpen: (id: string) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const labelId = useId();
  // Enter both selects (single mode) and runs onAction, and a double-click's first click selects:
  // the second call of a pair finds the folder already open, so each opening runs once.
  const openRef = useRef(current);
  openRef.current = current;
  const open = (id: string) => {
    if (id === openRef.current) return;
    openRef.current = id;
    onOpen(id);
    if (isMobile) setOpenMobile(false);
  };
  return (
    <Sidebar>
      <SidebarHeader>
        <p className="flex h-10 items-center gap-2 px-2 font-semibold">
          <FolderIcon aria-hidden="true" className="size-4" />
          Files
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel id={labelId}>Folders</SidebarGroupLabel>
          <SidebarGroupContent>
            {/* A click, Space, Enter or a double-click opens a folder; the selection never empties. */}
            <Tree
              aria-labelledby={labelId}
              selectionMode="single"
              selectedValues={[current]}
              onSelectedValuesChange={(values) => values[0] && open(values[0])}
              expandedValues={expanded}
              onExpandedValuesChange={onExpandedChange}
              onAction={open}
            >
              <FolderItems folders={folders} parent={null} />
            </Tree>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

function FilesCommand({
  open,
  onOpenChange,
  folders,
  onGo,
  onNewFolder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
  onGo: (id: string) => void;
  onNewFolder: () => void;
}) {
  const { toggleSidebar } = useSidebar();
  const [view, setView] = useState<"commands" | "folders">("commands");
  const [query, setQuery] = useState("");
  const change = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setView("commands");
      setQuery("");
    }
  };
  return (
    <CommandDialog
      open={open}
      onOpenChange={change}
      value={query}
      onValueChange={setQuery}
      description="Type to filter, use the arrow keys to move and Enter to run a command."
    >
      <CommandInput placeholder={view === "folders" ? "Type a folder name…" : "Type a command…"} />
      <CommandEmpty />
      <CommandList>
        {view === "commands" ? (
          <>
            <CommandGroup>
              <CommandGroupLabel>Folders</CommandGroupLabel>
              <CommandItem
                onSelect={(event) => {
                  // A sub-page of folders: keep the dialog open and start a new query.
                  event.preventDefault();
                  setView("folders");
                  setQuery("");
                }}
              >
                <FolderIcon />
                Go to folder…
              </CommandItem>
              <CommandItem onSelect={onNewFolder}>
                <PlusIcon />
                New folder
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandGroupLabel>View</CommandGroupLabel>
              <CommandItem onSelect={toggleSidebar}>
                <PanelLeftIcon />
                Toggle sidebar
                <CommandShortcut>⌘B</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </>
        ) : (
          <CommandGroup>
            <CommandGroupLabel>Go to folder</CommandGroupLabel>
            {folders.map((folder) => (
              <CommandItem key={folder.id} value={folder.name} onSelect={() => onGo(folder.id)}>
                <FolderIcon />
                {folder.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function FilterForm({ onApply }: { onApply: (values: FilesFilter) => void }) {
  return (
    <Form<FilesFilter>
      aria-label="Filter files"
      className="flex flex-wrap items-end gap-3"
      onFormSubmit={onApply}
    >
      <Field name="modified">
        <FieldLabel>Modified</FieldLabel>
        <DateRangePicker editable locale="en-US" />
      </Field>
      <Button type="submit">Apply</Button>
    </Form>
  );
}

function FileTable({ name, files, empty }: { name: string; files: FileEntry[]; empty: string }) {
  return (
    <Table>
      <TableCaption className="sr-only">Files in {name}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="max-sm:hidden">Kind</TableHead>
          <TableHead className="text-end">Size</TableHead>
          <TableHead>Modified</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
              {empty}
            </TableCell>
          </TableRow>
        )}
        {files.map((file) => {
          const Icon = kindIcon[file.kind];
          return (
            <TableRow key={file.name}>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  {file.name}
                </span>
              </TableCell>
              <TableCell className="max-sm:hidden">{file.kind}</TableCell>
              <TableCell className="text-end whitespace-nowrap tabular-nums">{file.size}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{file.modified}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ImagePreview({ images }: { images: FileEntry[] }) {
  return (
    <Carousel
      aria-label="Image preview"
      slideLabel={(position, count) => `${images[position - 1]?.name}, ${position} of ${count}`}
      className="w-full max-w-md"
    >
      <CarouselContent>
        {images.map(({ name }) => {
          const art = artByName[name] ?? { alt: name, tone: primaryTone, shape: "sun" };
          return (
            <CarouselItem key={name} className="px-1">
              <figure className="flex flex-col gap-2">
                {/* Forced colors drop the tint, so the placeholder draws its own bounds there. */}
                <svg
                  role="img"
                  aria-label={art.alt}
                  viewBox="0 0 160 90"
                  fill="currentColor"
                  className={`aspect-video w-full rounded-lg forced-colors:border forced-colors:border-[CanvasText] ${art.tone}`}
                >
                  <g opacity="0.7">{shapes[art.shape]}</g>
                </svg>
                <figcaption className="text-sm text-muted-foreground">{name}</figcaption>
              </figure>
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <div className="flex items-center justify-between gap-2">
        <CarouselPrevious aria-label="Previous image" />
        <CarouselDots aria-label="Choose image" dotLabel={(position) => `Show image ${position}`} />
        <CarouselNext aria-label="Next image" />
      </div>
    </Carousel>
  );
}

export interface FilesPageProps {
  /** Called with the filter Form's values (keyed by Field name) when it is submitted. */
  onFilter?: (values: FilesFilter) => void;
  /** Called with a folder's id each time a folder is opened. */
  onOpenFolder?: (id: string) => void;
}

/**
 * A file manager: a Sidebar whose content is a folder Tree, and an inset with the open folder's
 * files in a Table, a Modified filter, an image preview Carousel and a ⌘K CommandDialog.
 */
export function FilesPage({ onFilter, onOpenFolder }: FilesPageProps) {
  const [folders, setFolders] = useState(initialFolders);
  const [current, setCurrent] = useState("documents");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilesFilter["modified"] | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  const openFolder = (id: string, list = folders) => {
    setCurrent(id);
    onOpenFolder?.(id);
    // Reveal the folder in the Tree: expand every ancestor.
    const reveal = ancestorsOf(id, list).filter((parent) => !expanded.includes(parent));
    if (reveal.length) setExpanded([...expanded, ...reveal]);
  };

  const newFolder = () => {
    const taken = folders.filter((folder) => folder.name.startsWith("New folder")).length;
    const folder = {
      id: `folder-${folders.length + 1}`,
      name: taken ? `New folder ${taken + 1}` : "New folder",
      parent: current,
    };
    const next = [...folders, folder];
    setFolders(next);
    openFolder(folder.id, next);
  };

  const name = folders.find((folder) => folder.id === current)?.name ?? "";
  const all = filesByFolder[current] ?? [];
  const active = filter?.start && filter.end ? filter : null;
  const files = active
    ? all.filter((file) => file.modified >= active.start && file.modified <= active.end)
    : all;
  const images = files.filter((file) => file.kind === "Image");
  const count = `${all.length} ${all.length === 1 ? "file" : "files"}`;

  return (
    <SidebarProvider>
      <FolderSidebar
        folders={folders}
        current={current}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onOpen={(id) => openFolder(id)}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
          <Button
            variant="outline"
            color="neutral"
            size="sm"
            className="ms-auto"
            aria-keyshortcuts="Control+K Meta+K"
            onClick={() => setCommandOpen(true)}
          >
            <SearchIcon aria-hidden="true" />
            Commands
            <span aria-hidden="true" className="text-xs text-muted-foreground">
              ⌘K
            </span>
          </Button>
        </header>
        <div className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
          <h1 className="text-2xl font-semibold">{name}</h1>
          <FilterForm
            onApply={(values) => {
              setFilter(values.modified);
              onFilter?.(values);
            }}
          />
          <p role="status" className="text-sm text-muted-foreground">
            {active
              ? `${files.length} of ${count} modified ${active.start} – ${active.end}`
              : count}
          </p>
          <FileTable
            name={name}
            files={files}
            empty={all.length ? "No files match the filter." : "This folder is empty."}
          />
          {images.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Preview</h2>
              {/* Remount per folder and filter, so the preview starts at the first image. */}
              <ImagePreview key={`${current}:${active?.start}:${active?.end}`} images={images} />
            </section>
          )}
        </div>
      </SidebarInset>
      <FilesCommand
        open={commandOpen}
        onOpenChange={setCommandOpen}
        folders={folders}
        onGo={(id) => openFolder(id)}
        onNewFolder={newFolder}
      />
    </SidebarProvider>
  );
}
