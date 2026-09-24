import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { Button } from "../button";
import { dialogVariants } from "../dialog/dialog-variants";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  type AlertDialogContentProps,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";

function DeleteProject({
  onConfirm,
  ...props
}: AlertDialogContentProps & { onConfirm?: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" color="danger" />}>
        Delete project
      </AlertDialogTrigger>
      <AlertDialogContent {...props}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>This permanently deletes the project.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" color="neutral" />}>
            Cancel
          </AlertDialogClose>
          <Button color="danger" onClick={onConfirm}>
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const alertDialog = () => page.getByRole("alertdialog");
const trigger = () => page.getByRole("button", { name: "Delete project" });
const backdrop = () => document.querySelector<HTMLElement>("[data-slot=alert-dialog-backdrop]");

async function openByClick() {
  await userEvent.click(trigger());
  await expect.element(alertDialog()).toBeVisible();
  return alertDialog().element() as HTMLElement;
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("AlertDialog", () => {
  it("opens as a modal role=alertdialog, named and described", async () => {
    await render(<DeleteProject />);
    await expect.element(alertDialog()).not.toBeInTheDocument();
    const popup = await openByClick();
    await expect.element(alertDialog()).toHaveAccessibleName("Delete project?");
    await expect
      .element(alertDialog())
      .toHaveAccessibleDescription("This permanently deletes the project.");
    expect(popup.getAttribute("aria-modal")).toBe("true");
  });

  it("moves focus inside on open and traps Tab", async () => {
    await render(<DeleteProject />);
    const popup = await openByClick();
    const cancel = page.getByRole("button", { name: "Cancel" }).element();
    const confirm = page.getByRole("button", { name: "Delete", exact: true }).element();
    await expect.poll(() => document.activeElement).toBe(cancel);
    await userEvent.tab();
    expect(document.activeElement).toBe(confirm);
    await userEvent.tab();
    expect(document.activeElement).toBe(cancel);
    expect(popup.contains(document.activeElement)).toBe(true);
  });

  it("does not close on a backdrop click", async () => {
    await render(<DeleteProject />);
    await openByClick();
    await userEvent.click(backdrop() as HTMLElement, { position: { x: 5, y: 5 } });
    // Give a dismissal a chance to start: the popup must stay open and not begin closing.
    await new Promise((resolve) => setTimeout(resolve, 200));
    await expect.element(alertDialog()).toBeVisible();
    expect(alertDialog().element().hasAttribute("data-ending-style")).toBe(false);
  });

  // Base UI's AlertDialog forces `modal` and `disablePointerDismissal`, but keeps Escape
  // (useDialogRoot: `escapeKey: isTopmost`), so Escape closes it like a Dialog.
  it("closes on Escape and returns focus to the trigger", async () => {
    await render(<DeleteProject />);
    await openByClick();
    await userEvent.keyboard("{Escape}");
    await expect.element(alertDialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(trigger().element());
  });

  it("closes from the cancel action (AlertDialogClose composed with Button)", async () => {
    await render(<DeleteProject />);
    await openByClick();
    const cancel = page.getByRole("button", { name: "Cancel" });
    await expect.element(cancel).toHaveAttribute("data-slot", "button");
    await expect.element(cancel).toHaveAttribute("data-variant", "outline");
    await expect.element(cancel).toHaveAttribute("data-color", "neutral");
    await userEvent.click(cancel);
    await expect.element(alertDialog()).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(trigger().element());
  });

  it("runs the confirm action's handler", async () => {
    function Confirming() {
      const [open, setOpen] = useState(false);
      const [deleted, setDeleted] = useState(false);
      return (
        <div>
          <span data-testid="deleted">{deleted ? "yes" : "no"}</span>
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger>Delete project</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Delete project?</AlertDialogTitle>
              <AlertDialogFooter>
                <Button
                  color="danger"
                  onClick={() => {
                    setDeleted(true);
                    setOpen(false);
                  }}
                >
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    }
    const screen = await render(<Confirming />);
    await openByClick();
    await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));
    await expect.element(screen.getByTestId("deleted")).toHaveTextContent("yes");
    await expect.element(alertDialog()).not.toBeInTheDocument();
  });

  it("has no close button and no showCloseButton prop", async () => {
    await render(<DeleteProject />);
    const popup = await openByClick();
    expect(popup.querySelector("[data-slot$=close-button]")).toBeNull();
    await expect.element(page.getByRole("button", { name: "Close" })).not.toBeInTheDocument();
    // @ts-expect-error AlertDialogContent has no showCloseButton prop.
    const _check: AlertDialogContentProps = { showCloseButton: false };
    void _check;
  });

  it("shares the Dialog styling and sets the alert-dialog data-slots", async () => {
    await render(<DeleteProject className="gap-6" />);
    const popup = await openByClick();
    expect(popup.getAttribute("data-slot")).toBe("alert-dialog-content");
    expect(popup.getAttribute("data-size")).toBe("md");
    const expected = dialogVariants({ className: "gap-6" }).split(" ");
    expect([...popup.classList].sort()).toEqual([...expected].sort());
    const part = (slot: string) => popup.querySelector(`[data-slot=${slot}]`) as HTMLElement;
    expect(part("alert-dialog-header").className).toBe("flex flex-col gap-1.5");
    expect(part("alert-dialog-footer").className).toBe(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
    );
    expect(part("alert-dialog-title").className).toBe("text-lg font-semibold leading-snug");
    expect(part("alert-dialog-description").className).toBe("text-sm text-muted-foreground");
    expect(backdrop()?.className).toContain("fixed inset-0 z-(--z-overlay) bg-black/50");
  });

  it("supports size", async () => {
    await render(<DeleteProject size="sm" />);
    const popup = await openByClick();
    expect(popup.classList.contains("max-w-sm")).toBe(true);
    expect(popup.classList.contains("max-w-lg")).toBe(false);
  });

  it("locks background scroll, uses the overlay z-index and follows .dark", async () => {
    const screen = await render(
      <div>
        <DeleteProject />
        <div data-testid="ref" className="bg-popover" />
      </div>,
    );
    const reference = screen.getByTestId("ref").element();
    const lightBg = getComputedStyle(reference).backgroundColor;
    document.documentElement.classList.add("dark");
    try {
      const popup = await openByClick();
      await expect.poll(() => getComputedStyle(document.body).overflowY).toBe("hidden");
      expect(getComputedStyle(popup).zIndex).toBe("50");
      expect(getComputedStyle(backdrop() as HTMLElement).zIndex).toBe("50");
      const darkBg = getComputedStyle(reference).backgroundColor;
      expect(darkBg).not.toBe(lightBg);
      expect(getComputedStyle(popup).backgroundColor).toBe(darkBg);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });

  it.each(["light", "dark"] as const)("has no axe violations while open (%s)", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    try {
      await render(
        <div className="bg-background">
          <DeleteProject />
        </div>,
      );
      const popup = await openByClick();
      await waitForPopupSettled(popup);
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });
});
