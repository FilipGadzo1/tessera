import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { formatTime } from "../../lib/time";
import { EventsAdminPage, type SavedEvent } from "./events-admin-page";

const el = (locator: { element(): Element }) => locator.element() as HTMLElement;

async function tabTo(element: Element, key: "{Tab}" | "{Shift>}{Tab}{/Shift}" = "{Tab}") {
  for (let i = 0; i < 60 && document.activeElement !== element; i++) await userEvent.keyboard(key);
  expect(document.activeElement).toBe(element);
}

/** Types one key at a time, since focus moves between segments as they fill. */
async function press(...keys: string[]) {
  for (const key of keys) await userEvent.keyboard(key);
}

const range = () => document.querySelector("[data-slot=data-table-range]")?.textContent;
const titles = () =>
  [...document.querySelectorAll("[data-slot=data-table-row] th")].map((cell) => cell.textContent);
const drawer = () => document.querySelector<HTMLElement>("[data-slot=drawer-content]");
const newEvent = () => page.getByRole("button", { name: "New event" });
const sortButton = (name: string) => page.getByRole("button", { name: new RegExp(`^${name}`) });
const head = (name: string) => el(sortButton(name)).closest("th") as HTMLElement;
const headerCheckbox = () => page.getByRole("checkbox", { name: "Select all rows on this page" });
const saveButton = () => page.getByRole("button", { name: "Save", exact: true });
const group = (name: string) => el(page.getByRole("group", { name }));
const segment = (name: string, type: string) =>
  group(name).querySelector<HTMLElement>(`[role=spinbutton][data-type=${type}]`) as HTMLElement;
const clockButton = () => page.getByRole("button", { name: "Choose time" });
const tagsInput = () => page.getByRole("textbox", { name: "Tags" });
const fileInput = () =>
  document.querySelector<HTMLInputElement>("[data-slot=file-upload-input]") as HTMLInputElement;
const tagTexts = () =>
  [...document.querySelectorAll("[data-slot=tags-input-tag-text]")].map((tag) => tag.textContent);

/** An uploader the test drives by hand: each call waits until the test resolves or rejects it. */
function manualUploader() {
  const calls: {
    file: File;
    onProgress: (percent: number) => void;
    resolve: () => void;
    reject: (error: Error) => void;
  }[] = [];
  const uploadFile = vi.fn(
    (file: File, onProgress: (percent: number) => void) =>
      new Promise<void>((resolve, reject) => calls.push({ file, onProgress, resolve, reject })),
  );
  return { calls, uploadFile };
}

const pdf = () => new File(["x".repeat(1000)], "agenda.pdf", { type: "application/pdf" });
const movie = () => new File([new Uint8Array(6_000_000)], "video.mov", { type: "video/quicktime" });

// The admin page's intended width; the 390px case below checks the narrow layout.
beforeEach(async () => {
  await page.viewport(1280, 900);
});

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("EventsAdminPage example", () => {
  it("renders the events sorted by date, then start, five per page", async () => {
    await render(<EventsAdminPage />);
    await expect.element(page.getByRole("heading", { level: 1, name: "Events" })).toBeVisible();
    await expect.element(page.getByRole("table", { name: "Events" })).toBeVisible();
    expect(range()).toBe("Showing 1–5 of 12");
    expect(titles()).toEqual([
      "Kickoff",
      "Board meeting",
      "Code review",
      "Investor call",
      "Launch party",
    ]);
    expect(head("Date").getAttribute("aria-sort")).toBe("ascending");
    expect(head("Start").hasAttribute("aria-sort")).toBe(false);
    expect(el(sortButton("Start")).textContent).toContain("sorted ascending, 2 of 2");
    // Start shows formatTime's text; Files is hidden by default.
    const launch = el(page.getByRole("row", { name: /Launch party/ }));
    expect(launch.textContent).toContain(formatTime("18:00", "en-US"));
    expect(launch.textContent).toContain("Oct 12, 2026");
    expect(page.getByRole("columnheader", { name: "Files" }).elements()).toHaveLength(0);
    await expect.element(page.getByRole("button", { name: "Delete selected" })).toBeDisabled();
  });

  it("searches, sorts, selects, deletes and shows a column with the keyboard", async () => {
    await render(<EventsAdminPage />);

    // The Tab order from the page start.
    const order = [
      el(newEvent()),
      el(page.getByRole("searchbox", { name: "Search events" })),
      el(page.getByRole("button", { name: "Columns" })),
      el(headerCheckbox()),
      el(sortButton("Title")),
      el(sortButton("Date")),
      el(sortButton("Start")),
      el(sortButton("Attendees")),
      el(page.getByRole("checkbox", { name: "Select Kickoff" })),
      el(page.getByRole("button", { name: "Edit Kickoff" })),
    ];
    for (const element of order) {
      await userEvent.keyboard("{Tab}");
      expect(document.activeElement).toBe(element);
    }

    // Search filters by title, case-insensitively; clearing it restores every event.
    await tabTo(
      el(page.getByRole("searchbox", { name: "Search events" })),
      "{Shift>}{Tab}{/Shift}",
    );
    await userEvent.keyboard("launch");
    await expect.poll(range).toBe("Showing 1–1 of 1");
    expect(titles()).toEqual(["Launch party"]);
    await userEvent.keyboard("{Control>}a{/Control}{Backspace}");
    await expect.poll(range).toBe("Showing 1–5 of 12");

    // Enter sorts by Title; Shift+Enter adds Start as the second key.
    await tabTo(el(sortButton("Title")));
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => head("Title").getAttribute("aria-sort")).toBe("ascending");
    expect(titles()).toEqual([
      "Board meeting",
      "Code review",
      "Design sprint",
      "Expo",
      "Fundraiser",
    ]);
    await tabTo(el(sortButton("Start")));
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await expect
      .poll(() => el(sortButton("Start")).textContent)
      .toContain("sorted ascending, 2 of 2");
    expect(head("Title").getAttribute("aria-sort")).toBe("ascending");
    expect(head("Start").hasAttribute("aria-sort")).toBe(false);

    // Space on the header checkbox selects the page; Space on a row clears one: indeterminate.
    await tabTo(el(headerCheckbox()), "{Shift>}{Tab}{/Shift}");
    await userEvent.keyboard(" ");
    await expect.element(headerCheckbox()).toHaveAttribute("aria-checked", "true");
    expect(
      document.querySelectorAll("[data-slot=data-table-row][data-state=selected]"),
    ).toHaveLength(5);
    await tabTo(el(page.getByRole("checkbox", { name: "Select Expo" })));
    await userEvent.keyboard(" ");
    await expect.element(headerCheckbox()).toHaveAttribute("aria-checked", "mixed");

    // Delete selected (4): the four rows go and the status line says so.
    const remove = page.getByRole("button", { name: "Delete selected (4)" });
    await tabTo(el(remove), "{Shift>}{Tab}{/Shift}");
    await userEvent.keyboard("{Enter}");
    await expect.poll(range).toBe("Showing 1–5 of 8");
    await expect.element(page.getByText("4 events deleted")).toBeVisible();
    expect(titles()).toEqual(["Expo", "Gala dinner", "Hackathon", "Investor call", "Jam session"]);
    // The emptied button is disabled; focus moved to the status line, not to the page.
    await expect.element(page.getByRole("button", { name: "Delete selected" })).toBeDisabled();
    expect(document.activeElement).toBe(el(page.getByText("4 events deleted")));

    // The Columns menu: End reaches Files, Enter shows the column, Escape closes.
    const columns = page.getByRole("button", { name: "Columns" });
    await tabTo(el(columns), "{Shift>}{Tab}{/Shift}");
    await userEvent.keyboard("{Enter}");
    const files = page.getByRole("menuitemcheckbox", { name: "Files" });
    await expect.element(files).toBeVisible();
    await userEvent.keyboard("{End}");
    await expect.poll(() => document.activeElement).toBe(el(files));
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("columnheader", { name: /^Files/ })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(el(columns));
  });

  it("adds an event through the drawer form: validation, TimePicker, TagsInput, FileUpload and the upload", async () => {
    const { calls, uploadFile } = manualUploader();
    const onSave = vi.fn<(event: SavedEvent) => void>();
    await render(<EventsAdminPage uploadFile={uploadFile} onSave={onSave} />);

    // New event opens the drawer with focus in Title.
    await tabTo(el(newEvent()));
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("dialog", { name: "New event" })).toBeVisible();
    await waitForPopupSettled(drawer() as HTMLElement);
    await expect
      .poll(() => document.activeElement)
      .toBe(el(page.getByRole("textbox", { name: "Title" })));
    await userEvent.keyboard("Autumn retreat");

    // The date, typed into the DatePicker's segments.
    await tabTo(segment("Date", "month"));
    await press("1", "0", "2", "0", "2", "0", "2", "6");
    expect(segment("Date", "year").getAttribute("aria-valuenow")).toBe("2026");

    // Start: "9 3 0 p" is 9:30 PM, after the 8:00 PM maximum.
    await tabTo(segment("Start", "hour"));
    await press("9", "3", "0", "p");
    expect(segment("Start", "dayPeriod").getAttribute("aria-valuetext")).toBe("PM");
    await tabTo(el(saveButton()));
    await userEvent.keyboard("{Enter}");
    const tooLate = `Enter a time at or before ${formatTime("20:00", "en-US")}.`;
    await expect.element(page.getByText(tooLate)).toBeVisible();
    await expect.poll(() => document.activeElement).toBe(segment("Start", "hour"));
    expect(uploadFile).not.toHaveBeenCalled();

    // The TimePicker list: no slot is at or after 21:30, so the last one (20:00) is focused.
    await tabTo(el(clockButton()));
    await userEvent.keyboard("{Enter}");
    const list = page.getByRole("listbox", { name: "Times" });
    await expect.element(list).toBeVisible();
    await waitForPopupSettled(
      document.querySelector("[data-slot=time-picker-content]") as HTMLElement,
    );
    await expect.poll(() => (document.activeElement as HTMLElement).dataset.value).toBe("20:00");
    expect(document.activeElement?.textContent).toBe(formatTime("20:00", "en-US"));
    await press("{Home}", "{ArrowDown}", "{ArrowDown}");
    expect(document.activeElement?.textContent).toBe(formatTime("09:00", "en-US"));
    await userEvent.keyboard("{Enter}");
    await expect.element(list).not.toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(el(clockButton()));
    expect(segment("Start", "hour").getAttribute("aria-valuenow")).toBe("9");
    expect(segment("Start", "minute").getAttribute("aria-valuenow")).toBe("0");
    expect(segment("Start", "dayPeriod").getAttribute("aria-valuetext")).toBe("AM");

    // Tags: an accepted tag, a rejected one (announced, aria-invalid), the fix, Backspace, again.
    await tabTo(el(tagsInput()));
    await userEvent.keyboard("launch{Enter}");
    await userEvent.keyboard("Team Day{Enter}");
    const tagStatus = () =>
      document.querySelector("[data-slot=tags-input-status]")?.textContent?.trim();
    await expect.poll(tagStatus).toBe("Use lowercase letters, digits and hyphens");
    await expect.element(tagsInput()).toHaveAttribute("aria-invalid", "true");
    await userEvent.keyboard("{Control>}a{/Control}team-day{Enter}");
    await expect.poll(tagTexts).toEqual(["launch", "team-day"]);
    expect(el(tagsInput()).hasAttribute("aria-invalid")).toBe(false);
    await userEvent.keyboard("{Backspace}");
    await expect.poll(tagTexts).toEqual(["launch"]);
    await userEvent.keyboard("team-day{Enter}");
    await expect.poll(tagTexts).toEqual(["launch", "team-day"]);

    // Attachments: the PDF is accepted, the movie rejected by type (checked before its size).
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(fileInput());
    await userEvent.upload(fileInput(), [pdf(), movie()]);
    await expect
      .element(page.getByRole("list", { name: "Selected files" }).getByText("agenda.pdf"))
      .toBeVisible();
    await expect
      .element(page.getByText("video.mov — This file type is not accepted"))
      .toBeVisible();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(
      el(page.getByRole("button", { name: "Remove agenda.pdf" })),
    );

    // Save: the native FormData carries every field; the uploader gets agenda.pdf.
    let formData: FormData | null = null;
    const capture = (event: Event) => {
      formData = new FormData(event.target as HTMLFormElement);
    };
    document.addEventListener("submit", capture, true);
    try {
      await tabTo(el(saveButton()));
      await userEvent.keyboard("{Enter}");
      await expect.poll(() => calls.length).toBe(1);
    } finally {
      document.removeEventListener("submit", capture, true);
    }
    const sent = formData as FormData | null;
    expect(sent?.get("title")).toBe("Autumn retreat");
    expect(sent?.get("date")).toBe("2026-10-20");
    expect(sent?.get("start")).toBe("09:00");
    expect(sent?.getAll("tags")).toEqual(["launch", "team-day"]);
    expect(sent?.getAll("attachments").map((file) => (file as File).name)).toEqual(["agenda.pdf"]);
    expect(page.getByText(tooLate).elements()).toHaveLength(0);
    expect(calls[0]?.file.name).toBe("agenda.pdf");

    // Progress at 50 while Save is loading; resolving closes the drawer.
    calls[0]?.onProgress(50);
    await expect
      .element(page.getByRole("progressbar", { name: "Uploading agenda.pdf" }))
      .toHaveAttribute("aria-valuenow", "50");
    await expect.element(saveButton()).toHaveAttribute("data-loading");
    expect(onSave).not.toHaveBeenCalled();
    calls[0]?.resolve();
    await expect.poll(drawer).toBeNull();
    await expect.poll(() => document.activeElement).toBe(el(newEvent()));
    await expect.poll(range).toBe("Showing 1–5 of 13");
    await expect.element(page.getByText("Event saved")).toBeVisible();
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0]?.[0] as SavedEvent;
    expect({ ...saved, attachments: saved.attachments.map((file) => file.name) }).toEqual({
      title: "Autumn retreat",
      date: "2026-10-20",
      start: "09:00",
      tags: ["launch", "team-day"],
      attachments: ["agenda.pdf"],
    });
    // The new row, sorted into its date (Oct 20, before Design sprint at 10:00 AM).
    await tabTo(el(page.getByRole("button", { name: "Page 2" })));
    await userEvent.keyboard("{Enter}");
    await expect.poll(titles).toContain("Autumn retreat");
    const row = el(page.getByRole("row", { name: /Autumn retreat/ }));
    expect(row.textContent).toContain(formatTime("09:00", "en-US"));
    expect(row.textContent).toContain("launch");
  });

  it("a rejected upload marks its item as failed and keeps the drawer open", async () => {
    const { calls, uploadFile } = manualUploader();
    const onSave = vi.fn();
    await render(<EventsAdminPage uploadFile={uploadFile} onSave={onSave} />);
    await userEvent.click(page.getByRole("button", { name: "Edit Launch party" }));
    await expect.element(page.getByRole("dialog", { name: "Edit event" })).toBeVisible();
    await userEvent.upload(fileInput(), [pdf()]);
    await userEvent.click(saveButton());
    await expect.poll(() => calls.length).toBe(1);
    calls[0]?.reject(new Error("Network error"));
    await expect.element(page.getByText("Upload failed. Save again to retry.")).toBeVisible();
    expect(
      document.querySelector("[data-slot=file-upload-item]")?.getAttribute("data-status"),
    ).toBe("error");
    expect(drawer()).not.toBeNull();
    await expect.element(saveButton()).not.toHaveAttribute("data-loading");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Edit opens the drawer prefilled; Escape returns focus to that row's Edit button", async () => {
    await render(<EventsAdminPage />);
    const edit = page.getByRole("button", { name: "Edit Launch party" });
    await tabTo(el(edit));
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("dialog", { name: "Edit event" })).toBeVisible();
    await waitForPopupSettled(drawer() as HTMLElement);
    await expect.element(page.getByRole("textbox", { name: "Title" })).toHaveValue("Launch party");
    expect(segment("Date", "month").getAttribute("aria-valuenow")).toBe("10");
    expect(segment("Date", "day").getAttribute("aria-valuenow")).toBe("12");
    expect(segment("Date", "year").getAttribute("aria-valuenow")).toBe("2026");
    expect(segment("Start", "hour").getAttribute("aria-valuenow")).toBe("6");
    expect(segment("Start", "dayPeriod").getAttribute("aria-valuetext")).toBe("PM");
    expect(tagTexts()).toEqual(["launch", "social"]);
    await expect.element(page.getByText("invite.pdf is already attached.")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.poll(drawer).toBeNull();
    await expect.poll(() => document.activeElement).toBe(el(edit));
  });

  it("saves an edit back to its row", async () => {
    const onSave = vi.fn<(event: SavedEvent) => void>();
    await render(<EventsAdminPage onSave={onSave} />);
    await userEvent.click(page.getByRole("button", { name: "Edit Launch party" }));
    const title = page.getByRole("textbox", { name: "Title" });
    await userEvent.fill(title, "Launch night");
    await userEvent.click(saveButton());
    await expect.poll(drawer).toBeNull();
    await expect.element(page.getByText("Event saved")).toBeVisible();
    expect(titles()).toContain("Launch night");
    expect(range()).toBe("Showing 1–5 of 12");
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      title: "Launch night",
      date: "2026-10-12",
      start: "18:00",
      tags: ["launch", "social"],
      attachments: [],
    });
    await expect
      .poll(() => document.activeElement)
      .toBe(el(page.getByRole("button", { name: "Edit Launch night" })));
  });

  it("in an RTL page the table runs right to left and the en-US start times still read 6:00 PM", async () => {
    // Padded as in the story: flush with the viewport's right edge, the DataTable's 1px `sr-only`
    // status spans (margin −1px) overflow it by 1px in RTL, a known limit logged for the backlog.
    await render(
      <div dir="rtl" className="p-4">
        <EventsAdminPage />
      </div>,
    );
    const row = el(page.getByRole("row", { name: /Launch party/ }));
    const [title, , start] = [...row.querySelectorAll<HTMLElement>("[data-slot=data-table-cell]")];
    // The row starts at the right: Title right of Start.
    expect((title as HTMLElement).getBoundingClientRect().left).toBeGreaterThan(
      (start as HTMLElement).getBoundingClientRect().left,
    );
    const text = (start as HTMLElement).querySelector("span") as HTMLElement;
    const node = text.firstChild as Text;
    expect(node.data).toBe(formatTime("18:00", "en-US"));
    const at = (from: number, to: number) => {
      const range = document.createRange();
      range.setStart(node, from);
      range.setEnd(node, to);
      return range.getBoundingClientRect();
    };
    // The digits sit left of "PM", as in an LTR page (no "PM 6:00").
    expect(at(0, 1).left).toBeLessThan(at(node.data.length - 2, node.data.length).left);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(1280);
  });

  it("at 390px the page does not scroll sideways, the table scrolls and the drawer fills the width", async () => {
    await page.viewport(390, 800);
    await render(<EventsAdminPage />);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
    const container = document.querySelector<HTMLElement>("[data-slot=table-container]");
    expect(container && container.scrollWidth > container.clientWidth).toBe(true);
    await userEvent.click(newEvent());
    await expect.element(page.getByRole("dialog", { name: "New event" })).toBeVisible();
    await waitForPopupSettled(drawer() as HTMLElement);
    expect(Math.round((drawer() as HTMLElement).getBoundingClientRect().width)).toBe(390);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
    await expect.poll(() => document.getAnimations().length).toBe(0);
    const { violations, incomplete } = await auditOpenOverlay();
    expect(violations).toEqual([]);
    expect(incomplete).toEqual([]);
  });

  describe.each(["light", "dark"] as const)("axe (%s)", (theme) => {
    const setup = async () => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="bg-background p-4 text-foreground">
          <EventsAdminPage />
        </div>,
      );
    };
    const audit = async () => {
      await expect.poll(() => document.getAnimations().length).toBe(0);
      const { violations, incomplete } = await auditOpenOverlay();
      expect(violations).toEqual([]);
      expect(incomplete).toEqual([]);
    };

    it("has no violations on the page, and with rows selected", async () => {
      await setup();
      await audit();
      await userEvent.click(headerCheckbox());
      await expect.element(headerCheckbox()).toHaveAttribute("aria-checked", "true");
      await audit();
    });

    it("has no violations with the drawer open", async () => {
      await setup();
      await userEvent.click(page.getByRole("button", { name: "Edit Launch party" }));
      await waitForPopupSettled(drawer() as HTMLElement);
      await audit();
    });

    it("has no violations with the TimePicker list open, every option audited in view", async () => {
      await setup();
      await userEvent.click(newEvent());
      await waitForPopupSettled(drawer() as HTMLElement);
      await userEvent.click(clockButton());
      const popup = () => document.querySelector<HTMLElement>("[data-slot=time-picker-content]");
      await expect.poll(popup).not.toBeNull();
      await waitForPopupSettled(popup() as HTMLElement);
      // The list covers the drawer's later fields, and axe cannot decide the contrast of text it
      // partly hides (`bgOverlap`). The drawer is audited open above; here the Fields after Start
      // and Start's description (the list opens over it) are hidden, as in the Checkout test. The
      // drawer panel itself stays, so the Start field keeps its own background.
      const start = group("Start").closest<HTMLElement>("[data-slot=field]") as HTMLElement;
      const fields = [
        ...(drawer() as HTMLElement).querySelectorAll<HTMLElement>("[data-slot=field]"),
      ];
      const covered = [
        ...fields.slice(fields.indexOf(start) + 1),
        ...start.querySelectorAll<HTMLElement>("[data-slot=field-description]"),
      ];
      for (const element of covered) element.style.visibility = "hidden";
      // The 25 slots scroll inside a 16rem list, and axe leaves the options clipped by it as
      // `elmPartiallyObscured`. So the list is audited at several scroll positions, scrolled the way
      // a keyboard user does it (↓ focuses the next option and scrolls it into view): each pass
      // hides the options the list clips (they cannot be seen there; the focused one never is),
      // until every option has been audited fully visible.
      const list = document.querySelector<HTMLElement>(
        "[data-slot=time-picker-list]",
      ) as HTMLElement;
      const options = [...list.querySelectorAll<HTMLElement>("[role=option]")];
      expect(options).toHaveLength(25);
      expect(document.activeElement).toBe(options[0]);
      const audited = new Set<HTMLElement>();
      for (let pass = 0; audited.size < options.length && pass < options.length; pass++) {
        const next = options.find((option) => !audited.has(option)) as HTMLElement;
        while (document.activeElement !== next) await userEvent.keyboard("{ArrowDown}");
        const box = list.getBoundingClientRect();
        const clipped = options.filter((option) => {
          const rect = option.getBoundingClientRect();
          return rect.top < box.top - 0.5 || rect.bottom > box.bottom + 0.5;
        });
        for (const option of clipped) option.style.visibility = "hidden";
        try {
          await audit();
        } finally {
          for (const option of clipped) option.style.visibility = "";
        }
        for (const option of options) if (!clipped.includes(option)) audited.add(option);
      }
      expect(audited.size).toBe(options.length);
    });
  });
});
