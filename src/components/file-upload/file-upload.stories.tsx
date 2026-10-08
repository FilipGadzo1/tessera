import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";
import { type FileRejection, getFileKey } from "../../lib/file";
import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Form } from "../form";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadList,
  FileUploadRejections,
} from "./file-upload";

const meta = {
  title: "Components/FileUpload",
  component: FileUpload,
  tags: ["autodocs"],
  args: { disabled: false },
  decorators: [
    (Story) => (
      // The centred canvas sizes to its content, so the width is capped by the viewport itself.
      <div className="w-[min(28rem,calc(100vw-2rem))]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A small coloured square as an SVG `File`, so the stories have images to preview. */
function sampleImage(name: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${color}"/><circle cx="32" cy="32" r="14" fill="white" fill-opacity="0.6"/></svg>`;
  return new File([svg], name, { type: "image/svg+xml", lastModified: 1 });
}

function sampleDocument(name: string, type: string, size: number) {
  return new File([new Uint8Array(size)], name, { type, lastModified: 1 });
}

/**
 * Tab to the field (the dropzone shows the focus ring) and press Enter or Space to open the system
 * picker, click the dropzone, or drop files on it. Each file can be removed; adds and removals are
 * announced.
 */
export const Basic: Story = {
  render: (args) => {
    const [files, setFiles] = useState<File[]>([]);
    return (
      <Field>
        <FieldLabel>Attachments</FieldLabel>
        <FileUpload {...args} value={files} onValueChange={setFiles}>
          <FileUploadDropzone />
          <FileUploadList />
        </FileUpload>
        <FieldDescription>
          {files.length === 0 ? "No files yet." : `${files.length} selected.`}
        </FieldDescription>
      </Field>
    );
  },
};

/** `accept="image/*"`: images show a preview (an object URL, revoked when the item goes). */
export const ImagesWithPreviews: Story = {
  name: "Images with previews",
  render: (args) => (
    <Field>
      <FieldLabel>Photos</FieldLabel>
      <FileUpload
        {...args}
        accept="image/*"
        defaultValue={[
          sampleImage("sunset.svg", "#f97316"),
          sampleImage("forest.svg", "#16a34a"),
          sampleImage("ocean.svg", "#2563eb"),
        ]}
      >
        <FileUploadDropzone />
        <FileUploadRejections />
        <FileUploadList />
      </FileUpload>
    </Field>
  ),
};

/**
 * `maxFiles={1}` (single mode): a new pick replaces the file. A compact dropzone is the dropzone
 * with the consumer's own children and classes: it stays the visible control and the focus ring.
 */
export const SingleFile: Story = {
  name: "Single file (avatar)",
  render: (args) => (
    <Field>
      <FieldLabel>Avatar</FieldLabel>
      <FileUpload {...args} accept="image/*" maxFiles={1}>
        <FileUploadDropzone className="min-h-0 flex-row py-2">
          <span className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground">
            Choose an image
          </span>
          <span className="text-xs">or drop it here</span>
        </FileUploadDropzone>
        <FileUploadRejections />
        <FileUploadList />
      </FileUpload>
    </Field>
  ),
};

/**
 * `accept=".pdf,image/*"`, `maxSize` 1 MB and `maxFiles={3}`: anything else is rejected, listed
 * below the dropzone and announced, and the list is unchanged. Rejections never make the field
 * invalid; the next accepted add or a removal clears them.
 */
export const ConstraintsAndRejections: Story = {
  name: "Constraints and rejections",
  render: (args) => {
    const [last, setLast] = useState<FileRejection[]>([]);
    return (
      <Field>
        <FieldLabel>Documents</FieldLabel>
        <FileUpload
          {...args}
          accept=".pdf,image/*"
          maxSize={1_000_000}
          maxFiles={3}
          onFilesRejected={setLast}
        >
          <FileUploadDropzone>PDF or images, up to 1 MB each, 3 files at most</FileUploadDropzone>
          <FileUploadRejections />
          <FileUploadList />
        </FileUpload>
        <FieldDescription>
          {last.length === 0
            ? "Try a .txt file or a large one."
            : `Last rejected: ${last.map((r) => `${r.file.name} (${r.reason})`).join(", ")}`}
        </FieldDescription>
      </Field>
    );
  },
};

type Upload = { progress: number; failed: boolean };

/**
 * Uploads are the app's: this story fakes one with `setTimeout` (stories may use timers; the
 * component has none) and passes `progress` and `status` to each `FileUploadItem`. A file named
 * with "fail" ends in an error.
 */
export const UploadProgress: Story = {
  name: "Upload progress",
  render: (args) => {
    const [uploads, setUploads] = useState(new Map<File, Upload>());
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
    useEffect(() => {
      const pending = timers.current;
      return () => {
        for (const timer of pending) clearTimeout(timer);
      };
    }, []);
    const start = (file: File) => {
      const tick = (progress: number) => {
        const failed = file.name.includes("fail") && progress >= 60;
        setUploads((current) => new Map(current).set(file, { progress, failed }));
        if (progress >= 100 || failed) return;
        const timer = setTimeout(() => tick(progress + 20), 400);
        timers.current.add(timer);
      };
      tick(0);
    };
    return (
      <Field>
        <FieldLabel>Uploads</FieldLabel>
        <FileUpload
          {...args}
          defaultValue={[]}
          onValueChange={(files) => {
            for (const file of files) if (!uploads.has(file)) start(file);
          }}
        >
          <FileUploadDropzone />
          <FileUploadList>
            {(files) =>
              files.map((file) => {
                const upload = uploads.get(file);
                const status = !upload
                  ? "idle"
                  : upload.failed
                    ? "error"
                    : upload.progress >= 100
                      ? "complete"
                      : "uploading";
                return (
                  <FileUploadItem
                    key={getFileKey(file)}
                    file={file}
                    status={status}
                    progress={status === "uploading" ? upload?.progress : undefined}
                    error="Upload failed. Remove it and try again."
                  />
                );
              })
            }
          </FileUploadList>
        </FileUpload>
        <FieldDescription>Name a file with "fail" to see an error.</FieldDescription>
      </Field>
    );
  },
};

/**
 * In a Form: the file input carries one FormData entry per listed file (dropped ones too) under
 * the Field's name, and `onFormSubmit` reports the `File[]`. `required` needs at least one file.
 */
export const InAForm: Story = {
  name: "In a Form",
  render: (args) => {
    const formRef = useRef<HTMLFormElement>(null);
    const [submitted, setSubmitted] = useState("nothing yet");
    return (
      <Form
        ref={formRef}
        aria-label="Application"
        className="flex flex-col gap-4"
        onFormSubmit={(values) => {
          const all = formRef.current ? new FormData(formRef.current).getAll("attachments") : [];
          const names = all.map((entry) => (entry instanceof File ? entry.name : entry));
          const reported = (values.attachments as File[]).map((file) => file.name);
          setSubmitted(`getAll: ${JSON.stringify(names)}, values: ${JSON.stringify(reported)}`);
        }}
      >
        <Field name="attachments">
          <FieldLabel>Attachments</FieldLabel>
          <FileUpload {...args} required>
            <FileUploadDropzone />
            <FileUploadRejections />
            <FileUploadList />
          </FileUpload>
          <FieldDescription>At least one file.</FieldDescription>
          <FieldError />
        </Field>
        <Button type="submit" className="self-start">
          Submit
        </Button>
        <output className="text-sm text-muted-foreground">Submitted: {submitted}</output>
      </Form>
    );
  },
};

/** Disabled: the input, the dropzone and the remove buttons are disabled and leave the Tab order. */
export const Disabled: Story = {
  render: (args) => (
    <Field disabled>
      <FieldLabel>Attachments</FieldLabel>
      <FileUpload
        {...args}
        defaultValue={[sampleDocument("contract.pdf", "application/pdf", 240_000)]}
      >
        <FileUploadDropzone />
        <FileUploadList />
      </FileUpload>
    </Field>
  ),
};

/** In an RTL page the item rows run right to left; the dropzone stays centred. */
export const RTL: Story = {
  render: (args) => (
    <div dir="rtl" lang="ar">
      <Field>
        <FieldLabel>المرفقات</FieldLabel>
        <FileUpload
          {...args}
          locale="ar"
          removeLabel={(file) => `إزالة ${file.name}`}
          removedLabel={(file) => `أُزيل ${file.name}`}
          addedLabel={(files) => `أُضيف ${files.length}`}
          defaultValue={[
            sampleImage("صورة.svg", "#9333ea"),
            sampleDocument("تقرير.pdf", "application/pdf", 1_536_000),
          ]}
        >
          <FileUploadDropzone>اسحب الملفات إلى هنا أو انقر للاختيار</FileUploadDropzone>
          <FileUploadList aria-label="الملفات المختارة" />
        </FileUpload>
      </Field>
    </div>
  ),
};
