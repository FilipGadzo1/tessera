import type { Meta, StoryObj } from "@storybook/react-vite";
import { EventsAdminPage, type UploadFile } from "./events-admin-page";

/**
 * A story-local stand-in for an upload: ten steps of 10% every 150ms. Stories may use timers; the
 * components never do. Name a file "fail…" to see a failed upload keep the drawer open.
 */
const fakeUpload: UploadFile = (file, onProgress) =>
  new Promise((resolve, reject) => {
    let percent = 0;
    const tick = () => {
      percent += 10;
      onProgress(percent);
      if (percent === 50 && file.name.startsWith("fail")) reject(new Error("Upload failed"));
      else if (percent >= 100) resolve();
      else setTimeout(tick, 150);
    };
    setTimeout(tick, 150);
  });

/**
 * The Phase K components in one events admin page. A `DataTable` from `useDataTable` lists twelve
 * events sorted by date, then start (Shift+click or Shift+Enter a header to add a sort key), five
 * per page with a "Rows per page" Select; the header checkbox selects the page, "Delete selected"
 * removes the selected rows, the search filters by title and the Columns menu shows the hidden
 * Files column. "New event" and each row's Edit open a Drawer with a Form: a `DatePicker`
 * (`editable`), a `TimePicker` (8:00 AM to 8:00 PM in 15-minute steps; try "9 3 0 p" and Save),
 * a `TagsInput` (lowercase letters, digits and hyphens, up to 5) and a `FileUpload` (images or
 * PDFs up to 5 MB, 3 files). Save uploads the new attachments through a fake uploader, showing
 * each item's progress, then adds or updates the row and says "Event saved".
 */
const meta = {
  title: "Tessera/Examples/Events admin",
  component: EventsAdminPage,
  args: { uploadFile: fakeUpload },
  parameters: { layout: "padded" },
} satisfies Meta<typeof EventsAdminPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EventsAdmin: Story = { name: "Events admin" };

/** The page in an RTL container: the table, the toolbar and the pager run right to left. */
export const RTL: Story = {
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
};
