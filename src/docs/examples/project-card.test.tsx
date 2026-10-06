import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { restorePlatform, stubMac, stubWindows } from "../../../test/platform";
import { ProjectCard } from "./project-card";

const menuTrigger = () => page.getByRole("button", { name: "Project actions" });
const title = () => page.getByRole("heading", { level: 2 });

async function tabTo(element: Element) {
  for (let i = 0; i < 12 && document.activeElement !== element; i++) await userEvent.tab();
  expect(document.activeElement).toBe(element);
}

function highlighted() {
  return Array.from(document.querySelectorAll("[data-highlighted]")).map((el) =>
    el.textContent?.trim(),
  );
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
  restorePlatform();
});

describe("ProjectCard shortcut hints", () => {
  const hints = () =>
    Array.from(document.querySelectorAll("[data-slot=menu-shortcut]")).map(
      (hint) => hint.textContent,
    );

  it("Copy link reads Ctrl+L off Apple; F2 stays", async () => {
    stubWindows();
    await render(<ProjectCard />);
    await userEvent.click(menuTrigger());
    await waitForPopupSettled(page.getByRole("menu").element());
    expect(hints()).toEqual(["Ctrl+L", "F2"]);
  });

  it("Copy link reads ⌘L under a macOS stub", async () => {
    stubMac();
    await render(<ProjectCard />);
    await userEvent.click(menuTrigger());
    await waitForPopupSettled(page.getByRole("menu").element());
    expect(hints()).toEqual(["⌘L", "F2"]);
  });
});

describe("ProjectCard example", () => {
  it("renders the project with its status, icon buttons and member count", async () => {
    await render(<ProjectCard />);
    await expect.element(title()).toHaveTextContent("Mosaic");
    await expect.element(page.getByText("Active")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Star project" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Share project" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: /Members/ })).toBeVisible();
  });

  it("renames the project with the keyboard only; focus returns to the menu trigger", async () => {
    await render(<ProjectCard />);
    await tabTo(menuTrigger().element());
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("menu")).toBeVisible();
    await userEvent.keyboard("{ArrowDown}");
    // The F2 shortcut is aria-hidden: the item's accessible name is just "Rename…".
    const rename = page.getByRole("menuitem", { name: "Rename…", exact: true });
    await expect.poll(highlighted).toHaveLength(1);
    await expect.poll(() => document.querySelector("[data-highlighted]")).toBe(rename.element());
    await userEvent.keyboard("{Enter}");

    const dialog = page.getByRole("dialog", { name: "Rename project" });
    await expect.element(dialog).toBeVisible();
    const input = page.getByRole("textbox", { name: "Project name" });
    await expect.poll(() => document.activeElement).toBe(input.element());
    await expect.element(input).toHaveValue("Mosaic");
    await userEvent.keyboard("{Control>}a{/Control}Atlas{Enter}");

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(title()).toHaveTextContent("Atlas");
    await expect.poll(() => document.activeElement).toBe(menuTrigger().element());
  });

  it("keeps the old name when the rename is cancelled with Escape", async () => {
    await render(<ProjectCard />);
    await userEvent.click(menuTrigger());
    await userEvent.click(page.getByRole("menuitem", { name: "Rename…", exact: true }));
    await expect.element(page.getByRole("dialog", { name: "Rename project" })).toBeVisible();
    await userEvent.keyboard("{Control>}a{/Control}Nope{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    await expect.element(title()).toHaveTextContent("Mosaic");
  });

  it("deletes after the alert dialog confirms, shows the empty state, and Undo restores", async () => {
    await render(<ProjectCard />);
    await userEvent.click(menuTrigger());
    await userEvent.click(page.getByRole("menuitem", { name: "Delete" }));

    const alert = page.getByRole("alertdialog", { name: "Delete “Mosaic”?" });
    await expect.element(alert).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Delete project" }));
    await expect.element(alert).not.toBeInTheDocument();

    await expect.element(page.getByText("Project deleted")).toBeVisible();
    await expect.element(title()).not.toBeInTheDocument();
    const undo = page.getByRole("button", { name: "Undo" });
    await expect.poll(() => document.activeElement).toBe(undo.element());
    await userEvent.click(undo);

    await expect.element(title()).toHaveTextContent("Mosaic");
    await expect.element(page.getByText("Project deleted")).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(menuTrigger().element());
  });

  it("keeps the project when the delete is cancelled", async () => {
    await render(<ProjectCard />);
    await userEvent.click(menuTrigger());
    await userEvent.click(page.getByRole("menuitem", { name: "Delete" }));
    await expect.element(page.getByRole("alertdialog")).toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
    await expect.element(title()).toHaveTextContent("Mosaic");
  });

  it("invites a member from the Members popover", async () => {
    await render(<ProjectCard />);
    await userEvent.click(page.getByRole("button", { name: /Members/ }));
    const popover = page.getByRole("dialog", { name: "Members" });
    await expect.element(popover).toBeVisible();
    await waitForPopupSettled(popover.element());
    await expect.poll(() => page.getByRole("listitem").elements().length).toBe(3);
    await userEvent.type(
      page.getByRole("textbox", { name: "Invite by email" }),
      "grace@example.com",
    );
    await userEvent.click(page.getByRole("button", { name: "Invite" }));
    await expect.poll(() => page.getByRole("listitem").elements().length).toBe(4);
    await expect.element(page.getByText("grace@example.com")).toBeVisible();
    await expect.element(page.getByRole("textbox", { name: "Invite by email" })).toHaveValue("");
  });

  it("toggles the star (aria-pressed) and describes icon buttons with tooltips", async () => {
    await render(<ProjectCard tooltipDelay={0} />);
    const star = page.getByRole("button", { name: "Star project" });
    await expect.element(star).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(star);
    await expect.element(star).toHaveAttribute("aria-pressed", "true");
    await userEvent.hover(page.getByRole("button", { name: "Share project" }));
    await expect.element(page.getByRole("tooltip")).toHaveTextContent("Copy a share link");
  });

  it("confirms a Share click in the Share tooltip, which stays open", async () => {
    await render(<ProjectCard tooltipDelay={0} />);
    const share = page.getByRole("button", { name: "Share project" });
    await userEvent.hover(share);
    await expect.element(page.getByRole("tooltip")).toHaveTextContent("Copy a share link");
    await userEvent.click(share);
    await expect.element(page.getByRole("tooltip")).toHaveTextContent("Link copied");
  });

  it("confirms the menu's Copy link inline, without leaving the Share tooltip stale", async () => {
    await render(<ProjectCard tooltipDelay={0} />);
    await userEvent.click(menuTrigger());
    await userEvent.click(page.getByRole("menuitem", { name: "Copy link", exact: true }));
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
    await expect.element(page.getByRole("status")).toHaveTextContent("Link copied");
    await userEvent.hover(page.getByRole("button", { name: "Share project" }));
    await expect.element(page.getByRole("tooltip")).toHaveTextContent("Copy a share link");
  });

  it.each(["light", "dark"] as const)("has no axe violations at rest (%s)", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    try {
      await render(
        <div className="bg-background p-4">
          <ProjectCard />
        </div>,
      );
      await expect.element(title()).toBeVisible();
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });
});
