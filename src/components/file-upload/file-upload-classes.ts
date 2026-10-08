/*
 * FileUpload's class strings (spec Phase K §5.2). Server-safe: no hooks, no browser APIs.
 */

/** The root: a column of the dropzone, the rejections and the list. */
export const fileUploadBase = "relative flex w-full flex-col gap-3";

/**
 * The dropzone: a dashed pointer and drop surface that mirrors the hidden input's focus ring
 * (`data-focus-visible`), with the dragging, invalid, disabled and motion looks.
 */
export const fileUploadDropzone: string[] = [
  "relative flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-field-border bg-field px-6 py-8 text-center text-sm text-muted-foreground [&_svg]:size-6",
  "outline-none outline-offset-2 outline-ring data-focus-visible:outline-2 data-focus-visible:outline-solid forced-colors:data-focus-visible:outline-[Highlight]",
  "not-data-disabled:hover:border-field-border-hover not-data-disabled:hover:bg-muted/50",
  "data-dragging:border-primary data-dragging:bg-primary-soft data-dragging:text-primary-soft-foreground forced-colors:data-dragging:border-[Highlight]",
  "data-invalid:border-danger",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50",
  "transition-[color,background-color,border-color,outline-color] duration-150 ease-out motion-reduce:transition-none",
];

/** The element holding the dropzone's text: the input's description. */
export const fileUploadInstructions = "flex flex-col items-center gap-2";

/** The list of selected files. */
export const fileUploadList = "flex flex-col gap-2";

/** One selected file: a row with the preview, the name and size, and the remove button. */
export const fileUploadItem =
  "flex items-center gap-3 rounded-md border border-border bg-card p-2 text-sm data-[status=error]:border-danger";

/** The preview box: the image, or a file icon. */
export const fileUploadItemPreview =
  "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted text-muted-foreground [&_svg]:size-5";

/** The rejections of the last batch. */
export const fileUploadRejections = "flex flex-col gap-1 text-sm text-danger";
