"use client";

import { Ellipsis, Link2, Star, Trash2, UserPlus } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/alert-dialog";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/dialog";
import { Field, FieldDescription, FieldLabel } from "../../components/field";
import { Input } from "../../components/input";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from "../../components/menu";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "../../components/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/tooltip";
import { cn } from "../../lib/cn";

interface Member {
  name: string;
  detail: string;
  tone: string;
}

const initialMembers: Member[] = [
  { name: "Ada Lovelace", detail: "Owner", tone: "tone-primary" },
  { name: "Grace Hopper", detail: "Editor", tone: "tone-info" },
  { name: "Alan Turing", detail: "Viewer", tone: "tone-success" },
];

const inviteTones = ["tone-warning", "tone-neutral", "tone-primary", "tone-info", "tone-success"];

function initials(name: string) {
  const words = name.split(/[\s@.]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

/** Initials in a tinted circle: a stand-in until Tessera has an Avatar (Phase D). */
function Initials({ member, className }: { member: Member; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        member.tone,
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-tone-soft font-medium text-tone-soft-foreground text-xs ring-2 ring-card",
        className,
      )}
    >
      {initials(member.name)}
    </span>
  );
}

export interface ProjectCardProps {
  /** The project's starting name. @default "Mosaic" */
  defaultName?: string;
  /** Open delay of the icon buttons' tooltips, in ms. @default 600 */
  tooltipDelay?: number;
}

/**
 * Example only (not exported from the library): a project card composing every Phase C overlay.
 * Tooltips describe the icon Buttons; a Popover lists members and invites more; a Menu opens a
 * Dialog (rename) and an AlertDialog (delete). Both dialogs are controlled and have no trigger of
 * their own, so each returns focus explicitly (`finalFocus`) to the element that makes sense.
 */
export function ProjectCard({ defaultName = "Mosaic", tooltipDelay }: ProjectCardProps) {
  const [name, setName] = useState(defaultName);
  const [draft, setDraft] = useState(defaultName);
  const [starred, setStarred] = useState(false);
  // Two separate confirmations: the Share button's tooltip, and an inline notice for the menu's
  // "Copy link" (the menu closes on click, so it cannot confirm in place).
  const [copied, setCopied] = useState(false);
  const [menuCopied, setMenuCopied] = useState(false);
  const [members, setMembers] = useState(initialMembers);
  const [invite, setInvite] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const restoredRef = useRef(false);

  // After Undo the card (and its menu trigger) mounts again; put focus back where it was.
  useEffect(() => {
    if (!deleted && restoredRef.current) {
      restoredRef.current = false;
      menuTriggerRef.current?.focus();
    }
  }, [deleted]);

  // The inline notice clears itself after a moment.
  useEffect(() => {
    if (!menuCopied) return;
    const timer = setTimeout(() => setMenuCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [menuCopied]);

  function openRename() {
    setDraft(name);
    setRenameOpen(true);
  }

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = draft.trim();
    if (next) setName(next);
    setRenameOpen(false);
  }

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = invite.trim();
    if (!email) return;
    const tone = inviteTones[members.length % inviteTones.length] ?? "tone-neutral";
    setMembers((current) => [...current, { name: email, detail: "Invited", tone }]);
    setInvite("");
  }

  function writeLink() {
    // The Storybook iframe may deny clipboard access; the example only needs the feedback.
    navigator.clipboard?.writeText(`https://example.com/projects/${name}`).catch(() => {});
  }

  function copyFromShare() {
    writeLink();
    setCopied(true);
  }

  function copyFromMenu() {
    writeLink();
    setMenuCopied(true);
  }

  function undo() {
    restoredRef.current = true;
    setDeleted(false);
  }

  const dialogs = (
    <>
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent size="sm" finalFocus={menuTriggerRef}>
          <form className="grid gap-6" onSubmit={submitRename}>
            <DialogHeader>
              <DialogTitle>Rename project</DialogTitle>
              <DialogDescription>The new name shows everywhere the project does.</DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel>Project name</FieldLabel>
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                required
              />
              <FieldDescription>Press Enter to save.</FieldDescription>
            </Field>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" color="neutral" />}>
                Cancel
              </DialogClose>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm" finalFocus={() => undoRef.current ?? menuTriggerRef.current}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The project, its layers and its export history are removed for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" color="neutral" />}>
              Cancel
            </AlertDialogClose>
            <Button
              color="danger"
              onClick={() => {
                setDeleted(true);
                setDeleteOpen(false);
              }}
            >
              Delete project
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  const emptyState = (
    <Card className="w-[26rem] max-w-full">
      <CardContent className="flex items-center gap-3">
        <Trash2 aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <div role="status" className="flex-1">
          <p className="font-medium">Project deleted</p>
          <p className="text-muted-foreground">“{name}” was moved to the bin.</p>
        </div>
        <Button ref={undoRef} variant="outline" color="neutral" size="sm" onClick={undo}>
          Undo
        </Button>
      </CardContent>
    </Card>
  );

  // The dialogs stay mounted at the same place whichever card shows, so a closing dialog can
  // finish its exit and move focus (to Undo after a delete).
  return (
    <TooltipProvider delay={tooltipDelay}>
      {deleted ? (
        emptyState
      ) : (
        <Card className="w-[26rem] max-w-full">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <CardTitle role="heading" aria-level={2} className="truncate">
                    {name}
                  </CardTitle>
                  <Badge color="success">Active</Badge>
                  {/* Always mounted, so screen readers announce the notice when it appears. */}
                  <span role="status" className="inline-flex">
                    {menuCopied && <Badge color="info">Link copied</Badge>}
                  </span>
                </div>
                <CardDescription>Marketing site design system · edited 2h ago</CardDescription>
              </div>
              <Menu>
                <MenuTrigger
                  ref={menuTriggerRef}
                  render={
                    <Button
                      variant="ghost"
                      color="neutral"
                      size="icon-sm"
                      aria-label="Project actions"
                      className="-mr-2 -mt-1"
                    />
                  }
                >
                  <Ellipsis aria-hidden="true" />
                </MenuTrigger>
                <MenuContent align="end">
                  <MenuItem onClick={copyFromMenu}>
                    Copy link
                    <MenuShortcut>⌘L</MenuShortcut>
                  </MenuItem>
                  <MenuItem onClick={openRename}>
                    Rename…
                    <MenuShortcut>F2</MenuShortcut>
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem variant="danger" onClick={() => setDeleteOpen(true)}>
                    Delete
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          </CardHeader>

          <CardContent>
            <dl className="grid grid-cols-3 gap-3">
              {[
                ["Components", "24"],
                ["Themes", "3"],
                ["Exports", "118"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted px-3 py-2">
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="font-semibold text-base">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>

          <CardFooter>
            <Popover>
              <PopoverTrigger
                render={<Button variant="outline" color="neutral" size="sm" className="pl-1" />}
              >
                <span className="-space-x-0.5 flex">
                  {members.slice(0, 3).map((member) => (
                    <Initials
                      key={member.name}
                      member={member}
                      className="size-6 text-[0.625rem] ring-background"
                    />
                  ))}
                </span>
                Members
                <span className="text-muted-foreground">{members.length}</span>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80">
                <PopoverTitle>Members</PopoverTitle>
                <PopoverDescription>People who can open and edit “{name}”.</PopoverDescription>
                <ul className="-mx-1 flex max-h-56 flex-col gap-1 overflow-y-auto py-1">
                  {members.map((member) => (
                    <li key={member.name} className="flex items-center gap-3 rounded-md px-1 py-1">
                      <Initials member={member} />
                      <span className="min-w-0 flex-1 truncate text-sm">{member.name}</span>
                      <span className="text-muted-foreground text-xs">{member.detail}</span>
                    </li>
                  ))}
                </ul>
                <form
                  className="flex items-end gap-2 border-border border-t pt-3"
                  onSubmit={submitInvite}
                >
                  <Field className="flex-1">
                    <FieldLabel>Invite by email</FieldLabel>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={invite}
                      onChange={(event) => setInvite(event.target.value)}
                    />
                  </Field>
                  <Button type="submit" variant="outline">
                    <UserPlus aria-hidden="true" />
                    Invite
                  </Button>
                </form>
              </PopoverContent>
            </Popover>

            <div className="ml-auto flex gap-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      color="neutral"
                      size="icon-sm"
                      aria-label="Star project"
                      aria-pressed={starred}
                      onClick={() => setStarred((value) => !value)}
                    />
                  }
                >
                  <Star
                    aria-hidden="true"
                    className={starred ? "fill-warning text-warning" : undefined}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {starred ? "Remove from favourites" : "Add to favourites"}
                </TooltipContent>
              </Tooltip>
              <Tooltip onOpenChange={(open) => !open && setCopied(false)}>
                {/* Stays open on click so the tooltip can confirm "Link copied". */}
                <TooltipTrigger
                  closeOnClick={false}
                  render={
                    <Button
                      variant="ghost"
                      color="neutral"
                      size="icon-sm"
                      aria-label="Share project"
                      onClick={copyFromShare}
                    />
                  }
                >
                  <Link2 aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>{copied ? "Link copied" : "Copy a share link"}</TooltipContent>
              </Tooltip>
            </div>
          </CardFooter>
        </Card>
      )}
      {dialogs}
    </TooltipProvider>
  );
}
