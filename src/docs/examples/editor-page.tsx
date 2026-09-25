"use client";

import { useId, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/avatar";
import type { DateRange } from "../../components/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/card";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "../../components/context-menu";
import { DatePicker, DateRangePicker } from "../../components/date-picker";
import { Field, FieldLabel } from "../../components/field";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "../../components/menu";
import { Meter, MeterLabel, MeterValue } from "../../components/meter";
import { PreviewCard, PreviewCardContent, PreviewCardTrigger } from "../../components/preview-card";
import { ScrollArea } from "../../components/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "../../components/toggle";
import { Toolbar, ToolbarButton, ToolbarSeparator } from "../../components/toolbar";
import { toDay } from "../../lib/date";

const bodyText = `Tessera Phase F rounds out the surface layer: Meter and ScrollArea join Progress
and Table as ways to show quantity and overflow; Toggle, ToggleGroup and Toolbar give formatting
controls a single Tab stop with roving arrows; PreviewCard and ContextMenu add hover and
right-click surfaces on top of the same Menu items used everywhere else; and Calendar,
RangeCalendar, DatePicker and DateRangePicker round out date entry to match Select and Input in
height and keyboard behaviour. Every part still carries a data-slot, merges its className and
reads correctly under axe in light, dark and forced-colors.`;

const characterMax = 2000;

interface EditorToolbarProps {
  formatting: string[];
  onFormattingChange: (value: string[]) => void;
  alignment: string[];
  onAlignmentChange: (value: string[]) => void;
}

/** Bold/Italic/Underline (multiple) and alignment (single) ToggleGroups, plus an Insert Menu. */
function EditorToolbar({
  formatting,
  onFormattingChange,
  alignment,
  onAlignmentChange,
}: EditorToolbarProps) {
  return (
    <Toolbar aria-label="Formatting" className="w-fit">
      <ToggleGroup
        aria-label="Formatting"
        multiple
        value={formatting}
        onValueChange={onFormattingChange}
      >
        <ToggleGroupItem value="bold" aria-label="Bold" size="icon-sm" className="font-bold">
          B
        </ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="Italic" size="icon-sm" className="italic">
          I
        </ToggleGroupItem>
        <ToggleGroupItem
          value="underline"
          aria-label="Underline"
          size="icon-sm"
          className="underline"
        >
          U
        </ToggleGroupItem>
      </ToggleGroup>
      <ToolbarSeparator />
      <ToggleGroup aria-label="Alignment" value={alignment} onValueChange={onAlignmentChange}>
        <ToggleGroupItem value="left" aria-label="Align left" size="icon-sm">
          L
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Align center" size="icon-sm">
          C
        </ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="Align right" size="icon-sm">
          R
        </ToggleGroupItem>
      </ToggleGroup>
      <ToolbarSeparator />
      <Menu>
        <ToolbarButton render={<MenuTrigger />}>Insert</ToolbarButton>
        <MenuContent>
          <MenuItem>Image</MenuItem>
          <MenuItem>Link</MenuItem>
          <MenuItem>Table</MenuItem>
        </MenuContent>
      </Menu>
    </Toolbar>
  );
}

interface EditorBodyProps {
  formatting: string[];
  onToggleFormat: (value: string) => void;
}

/** The post body in a fixed-height ScrollArea with a right-click ContextMenu over the text. */
function EditorBody({ formatting, onToggleFormat }: EditorBodyProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="block rounded-md border border-border">
        <ScrollArea className="h-40">
          <p className="whitespace-pre-line p-4 text-sm text-foreground">{bodyText}</p>
        </ScrollArea>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <MenuItem>Cut</MenuItem>
        <MenuItem>Copy</MenuItem>
        <MenuItem>Paste</MenuItem>
        <MenuSeparator />
        <MenuSub>
          <MenuSubTrigger>Format</MenuSubTrigger>
          <MenuSubContent>
            <MenuCheckboxItem
              checked={formatting.includes("bold")}
              onCheckedChange={() => onToggleFormat("bold")}
            >
              Bold
            </MenuCheckboxItem>
            <MenuCheckboxItem
              checked={formatting.includes("italic")}
              onCheckedChange={() => onToggleFormat("italic")}
            >
              Italic
            </MenuCheckboxItem>
            <MenuCheckboxItem
              checked={formatting.includes("underline")}
              onCheckedChange={() => onToggleFormat("underline")}
            >
              Underline
            </MenuCheckboxItem>
          </MenuSubContent>
        </MenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** The `@name` byline: a PreviewCardTrigger showing an Avatar card on hover or focus. */
function AuthorLine() {
  return (
    <p className="text-muted-foreground text-sm">
      By{" "}
      <PreviewCard>
        <PreviewCardTrigger
          href="#"
          delay={0}
          closeDelay={0}
          className="font-medium text-primary underline underline-offset-2"
        >
          @filip
        </PreviewCardTrigger>
        <PreviewCardContent>
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src="https://i.pravatar.cc/64?u=filip" alt="" />
              <AvatarFallback>F</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">Filip</p>
              <p className="text-muted-foreground">@filip</p>
            </div>
          </div>
          <p className="mt-2 text-muted-foreground">
            Builds Tessera, a personal component library.
          </p>
        </PreviewCardContent>
      </PreviewCard>
    </p>
  );
}

interface ScheduleFieldsProps {
  publishOn: Date | null;
  onPublishOnChange: (value: Date | null) => void;
  embargo: DateRange;
  onEmbargoChange: (value: DateRange) => void;
}

/** A "Publish on" DatePicker and an "Embargo" DateRangePicker, side by side in a Field row. */
function ScheduleFields({
  publishOn,
  onPublishOnChange,
  embargo,
  onEmbargoChange,
}: ScheduleFieldsProps) {
  const today = toDay(new Date());
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <Field className="sm:w-48">
        <FieldLabel>Publish on</FieldLabel>
        <DatePicker value={publishOn} onValueChange={onPublishOnChange} name="publish-on" />
      </Field>
      <Field className="sm:w-72">
        <FieldLabel>Embargo</FieldLabel>
        <DateRangePicker
          value={embargo}
          onValueChange={onEmbargoChange}
          startName="embargo-start"
          endName="embargo-end"
          min={today}
        />
      </Field>
    </div>
  );
}

/**
 * Example only (not exported from the library): a "New post" editor card composing every Phase F
 * component. A Toolbar holds a formatting `ToggleGroup` (Bold/Italic/Underline, multiple), an
 * alignment `ToggleGroup` (single) and an "Insert" `Menu`. The body sits in a fixed-height
 * `ScrollArea` under a `ContextMenu` (Cut/Copy/Paste and a Format submenu that reuses the same
 * `MenuItem`s and toggles the toolbar's own state). The byline's `@name` is a `PreviewCardTrigger`
 * showing an Avatar card. A "Publish on" `DatePicker` and an "Embargo" `DateRangePicker` sit in a
 * Field row, and a `Meter` reports the character count.
 */
export function EditorPage() {
  const titleId = useId();
  const [formatting, setFormatting] = useState<string[]>(["bold"]);
  const [alignment, setAlignment] = useState<string[]>(["left"]);
  const [publishOn, setPublishOn] = useState<Date | null>(null);
  const [embargo, setEmbargo] = useState<DateRange>({ start: null, end: null });
  // A fixed illustrative count, independent of the sample body text above.
  const characterCount = 1240;

  function toggleFormat(value: string) {
    setFormatting((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  }

  return (
    <Card role="group" className="w-full max-w-2xl" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle id={titleId}>New post</CardTitle>
        <AuthorLine />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <EditorToolbar
          formatting={formatting}
          onFormattingChange={setFormatting}
          alignment={alignment}
          onAlignmentChange={setAlignment}
        />
        <EditorBody formatting={formatting} onToggleFormat={toggleFormat} />
        <ScheduleFields
          publishOn={publishOn}
          onPublishOnChange={setPublishOn}
          embargo={embargo}
          onEmbargoChange={setEmbargo}
        />
        <Meter value={characterCount} max={characterMax} format={{}}>
          <MeterLabel>Characters</MeterLabel>
          <MeterValue>
            {(formatted) => `${formatted} / ${characterMax.toLocaleString()}`}
          </MeterValue>
        </Meter>
      </CardContent>
    </Card>
  );
}
