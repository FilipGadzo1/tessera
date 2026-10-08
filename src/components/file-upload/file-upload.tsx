"use client";

/*
 * FileUpload (spec Phase K §5.2): the native `<input type="file">` is the real control, visually
 * hidden, the one Tab stop of the picker, named by the Field label and opened natively with Enter
 * or Space. `FileUploadDropzone` is its pointer and drop surface and mirrors its focus ring. The
 * list of accepted files is the source of truth and is written back to `input.files` through
 * `DataTransfer`, so a native submit carries exactly the listed files. Field and Form go through
 * the shared hidden-input control (`../field/form-control.tsx`, nameless). No network code: upload
 * progress is the consumer's (`FileUploadItem`'s `progress` and `status`).
 */
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useLabelableContext, useLabelableId } from "@base-ui/react/internals/labelable-provider";
import {
  type ChangeEvent,
  type ComponentProps,
  createContext,
  type DragEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { resolveLocale } from "../../lib/date";
import { type FileRejection, formatFileSize, getFileKey, validateFiles } from "../../lib/file";
import { AlertIcon, CloseIcon, FileIcon, UploadIcon } from "../../lib/icons";
import { mergeClassName } from "../../lib/merge-class-name";
import { useControllableState } from "../../lib/use-controllable-state";
import { useMergedRefs } from "../../lib/use-merged-refs";
import { useStatusMessage } from "../../lib/use-status-message";
import { Button, type ButtonProps } from "../button";
import { useFocusScope, useFormControl, visuallyHiddenInput } from "../field/form-control";
import { Progress } from "../progress";
import {
  fileUploadBase,
  fileUploadDropzone,
  fileUploadInstructions,
  fileUploadItem,
  fileUploadItemPreview,
  fileUploadList,
  fileUploadRejections,
} from "./file-upload-classes";

export interface FileUploadProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "onChange" | "aria-label"> {
  /** The files, controlled. */
  value?: File[];
  /** The initial files. @default [] */
  defaultValue?: File[];
  /** Called with the new list after an add or a removal. */
  onValueChange?: (files: File[]) => void;
  /** Called with a batch's rejected files (each with its `message`). */
  onFilesRejected?: (rejections: FileRejection[]) => void;
  /** The input's `accept`: `.ext`, `type/sub` and `type/*` tokens; also checked on a drop. */
  accept?: string;
  /** The smallest file size in bytes. */
  minSize?: number;
  /** The largest file size in bytes. */
  maxSize?: number;
  /** The most files. @default Infinity */
  maxFiles?: number;
  /** Several files; `false` replaces the file on each pick. @default maxFiles !== 1 */
  multiple?: boolean;
  /** An error message for a file, or `null` to accept it. */
  validate?: (file: File) => string | null;
  /** Disables the input, the dropzone and the remove buttons (a disabled `Field` does too). */
  disabled?: boolean;
  /** Requires at least one file to submit (marks the input `aria-required`). */
  required?: boolean;
  /**
   * The file input's name, else the Field's: one FormData entry per listed file. In a `Form`,
   * `onFormSubmit` reports the `File[]` under the Field's name (else this one).
   */
  name?: string;
  /** The `id` of a `<form>` elsewhere in the document to submit with. */
  form?: string;
  /**
   * The file input's name when there is no Field label. @default "Choose files" ("Choose a file"
   * when not `multiple`)
   */
  "aria-label"?: string;
  /** Announced after an add. @default one: `${name} added`, more: `${n} files added` */
  addedLabel?: (files: File[]) => string;
  /** Announced after a removal. @default (file) => `${file.name} removed` */
  removedLabel?: (file: File) => string;
  /** A remove button's name. @default (file) => `Remove ${file.name}` */
  removeLabel?: (file: File) => string;
  /**
   * Announced after a batch with rejections. @default one: `${name} rejected: ${message}`, more:
   * `${n} files rejected`
   */
  rejectedLabel?: (rejections: FileRejection[]) => string;
  /**
   * A rejection's message (shown, announced and reported). @default type "This file type is not
   * accepted", too-large `Larger than ${maxSize}`, too-small `Smaller than ${minSize}`, too-many
   * `More than ${maxFiles} files`, duplicate "Already added", invalid the `validate` message
   */
  rejectionMessage?: (rejection: FileRejection) => string;
  /** The locale of the file sizes. @default the document's `lang` */
  locale?: string;
}

interface FileUploadContextValue {
  files: File[];
  rejections: FileRejection[];
  disabled: boolean;
  invalid: boolean;
  dragging: boolean;
  focusVisible: boolean;
  maxSize: number | undefined;
  locale: string | undefined;
  instructionsId: string;
  removeLabel: (file: File) => string;
  setDragging: (dragging: boolean) => void;
  addFiles: (files: File[], folders?: ReadonlySet<File>) => void;
  removeFile: (file: File, button: HTMLElement) => void;
  openPicker: () => void;
  registerDropzone: () => () => void;
}

const FileUploadContext = createContext<FileUploadContextValue | null>(null);

function useFileUpload(part: string) {
  const context = useContext(FileUploadContext);
  if (!context) throw new Error(`${part} must be used inside a FileUpload.`);
  return context;
}

const emptyFiles: File[] = [];
const removeSelector = "[data-slot=file-upload-item-remove]";

function sameFiles(a: readonly File[], b: readonly File[]) {
  return a.length === b.length && a.every((file, index) => file === b[index]);
}

/** `DataTransfer` where it can be constructed (not Safari < 14.1, nor a stubbed-out global). */
function createDataTransfer(): DataTransfer | null {
  if (typeof DataTransfer !== "function") return null;
  try {
    return new DataTransfer();
  } catch {
    return null;
  }
}

/**
 * A file picker: a visually hidden native `<input type="file">` (the Field control and the one Tab
 * stop) with a `FileUploadDropzone` as its visible surface, plus the optional
 * `FileUploadRejections` and `FileUploadList`. Picks and drops are checked (`accept`, sizes,
 * `maxFiles`, duplicates, `validate`); accepted files join the list, rejected ones are reported
 * and announced, and the list is written back to the input so a native submit carries it.
 */
export function FileUpload({
  value: valueProp,
  defaultValue = emptyFiles,
  onValueChange,
  onFilesRejected,
  accept,
  minSize,
  maxSize,
  maxFiles = Number.POSITIVE_INFINITY,
  multiple: multipleProp,
  validate,
  disabled: disabledProp,
  required,
  name,
  form,
  "aria-label": ariaLabelProp,
  addedLabel = (added) =>
    added.length === 1 ? `${added[0]?.name} added` : `${added.length} files added`,
  removedLabel = (file) => `${file.name} removed`,
  removeLabel = (file) => `Remove ${file.name}`,
  rejectedLabel,
  rejectionMessage,
  locale: localeProp,
  ref,
  className,
  children,
  ...props
}: FileUploadProps) {
  const field = useFieldRootContext();
  const { labelId: fieldLabelId, getDescriptionProps } = useLabelableContext();
  // The file input is the labelable control: the FieldLabel's `for` points at it.
  const inputId = useLabelableId();
  const instructionsId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRootRef = useMergedRefs(rootRef, ref);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useControllableState(valueProp, defaultValue, onValueChange);
  const [rejections, setRejections] = useState<FileRejection[]>([]);
  const [message, announce] = useStatusMessage();
  const [dragging, setDragging] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  // Bumped after every pick, so the write-back also runs when a controlled parent refuses it.
  const [pickCount, setPickCount] = useState(0);

  const multiple = multipleProp ?? maxFiles !== 1;
  const disabled = !!disabledProp || field.state.disabled;
  const invalid = field.state.valid === false;
  const locale = resolveLocale(localeProp);

  // The dropzone is the only visible control and focus indicator: it registers itself, and a
  // FileUpload without one warns once (spec Phase K §5.2, amended in review).
  const dropzoneCount = useRef(0);
  const [hasDropzone, setHasDropzone] = useState(false);
  const registerDropzone = useCallback(() => {
    dropzoneCount.current += 1;
    setHasDropzone(true);
    return () => {
      dropzoneCount.current -= 1;
      if (dropzoneCount.current === 0) setHasDropzone(false);
    };
  }, []);
  const warned = useRef(false);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && dropzoneCount.current === 0 && !warned.current) {
      warned.current = true;
      console.warn(
        "FileUpload renders no FileUploadDropzone: the file input has no visible control or focus indicator.",
      );
    }
  }, []);

  // A removal moves focus off its button before the button unmounts (Chromium reports a focused
  // element's removal as a `focusout` to nowhere, which the Field would take for a blur). A
  // controlled parent that refuses the removal keeps the item: focus goes back to its button.
  const [removals, setRemovals] = useState(0);
  const pendingRemoval = useRef<{ previous: readonly File[]; button: HTMLElement } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per removal, after its render.
  useLayoutEffect(() => {
    const pending = pendingRemoval.current;
    if (!pending) return;
    pendingRemoval.current = null;
    if (sameFiles(pending.previous, files) && pending.button.isConnected) pending.button.focus();
  }, [removals]);

  // The write-back: the input holds exactly the listed files (a native pick replaced its files).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `pickCount` re-runs it after a refused pick.
  useLayoutEffect(() => {
    const input = inputRef.current;
    const transfer = createDataTransfer();
    if (!input || !transfer) return;
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
  }, [files, pickCount]);

  const defaultRejectionMessage = (rejection: FileRejection) => {
    switch (rejection.reason) {
      case "type":
        return "This file type is not accepted";
      case "too-large":
        return `Larger than ${formatFileSize(maxSize ?? 0, locale)}`;
      case "too-small":
        return `Smaller than ${formatFileSize(minSize ?? 0, locale)}`;
      case "too-many": {
        const limit = multiple ? maxFiles : 1;
        return limit === 1 ? "More than 1 file" : `More than ${limit} files`;
      }
      case "duplicate":
        return "Already added";
      default:
        return rejection.message ?? "";
    }
  };

  const addFiles = (incoming: File[], folders: ReadonlySet<File> = new Set()) => {
    if (disabled) return;
    const result = validateFiles(
      incoming.filter((file) => !folders.has(file)),
      files,
      { accept, minSize, maxSize, maxFiles, multiple, validate },
    );
    const rejected = [
      ...incoming
        .filter((file) => folders.has(file))
        .map((file) => ({ file, reason: "type" as const })),
      ...result.rejected,
    ].map((rejection) => ({
      ...rejection,
      message: rejectionMessage?.(rejection) ?? defaultRejectionMessage(rejection),
    }));
    if (result.accepted.length > 0) {
      setFiles(result.replace ? result.accepted : [...files, ...result.accepted]);
    }
    setRejections(rejected);
    if (rejected.length > 0) onFilesRejected?.(rejected);
    const summary = [
      result.accepted.length > 0 ? addedLabel(result.accepted) : null,
      rejected.length === 0
        ? null
        : (rejectedLabel?.(rejected) ??
          (rejected.length === 1
            ? `${rejected[0]?.file.name} rejected: ${rejected[0]?.message}`
            : `${rejected.length} files rejected`)),
    ].filter((part) => part !== null);
    if (summary.length > 0) announce(summary.join(". "));
  };

  /** Removes a file from its remove button: focus moves to the next, else the previous, else the input. */
  const removeFile = (file: File, button: HTMLElement) => {
    if (!files.includes(file)) return;
    const buttons = [...(rootRef.current?.querySelectorAll<HTMLElement>(removeSelector) ?? [])];
    const index = buttons.indexOf(button);
    const target = buttons[index + 1] ?? buttons[index - 1] ?? inputRef.current;
    target?.focus();
    pendingRemoval.current = { previous: files, button };
    setRemovals((count) => count + 1);
    setFiles(files.filter((other) => other !== file));
    setRejections([]);
    announce(removedLabel(file));
  };

  const openPicker = () => {
    const input = inputRef.current;
    if (!input || disabled) return;
    input.click();
    // A pointer user: focus the input for the Field, without the keyboard ring.
    input.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = [...(event.currentTarget.files ?? [])];
    if (picked.length > 0) addFiles(picked);
    setPickCount((count) => count + 1);
  };

  const formControl = useFormControl({
    slot: "file-upload-form-control",
    value: files,
    inputValue: files.map((file) => file.name).join("\n"),
    formValue: files,
    registrationName: name,
    form,
    required,
    disabled,
    customValidity: "",
    controlRef: inputRef,
  });
  // The input and the remove buttons are one control for the Field's focus / blur.
  useFocusScope(() => [rootRef.current], formControl.onFocus, formControl.onBlur);

  const { "aria-describedby": ariaDescribedBy } = getDescriptionProps({
    "aria-describedby": hasDropzone ? instructionsId : undefined,
  });
  const ariaLabel =
    ariaLabelProp ?? (fieldLabelId ? undefined : multiple ? "Choose files" : "Choose a file");

  const context: FileUploadContextValue = {
    files,
    rejections,
    disabled,
    invalid,
    dragging,
    focusVisible,
    maxSize,
    locale,
    instructionsId,
    removeLabel,
    setDragging,
    addFiles,
    removeFile,
    openPicker,
    registerDropzone,
  };

  return (
    <FileUploadContext.Provider value={context}>
      <div
        {...props}
        ref={setRootRef}
        data-slot="file-upload"
        data-disabled={disabled ? "" : undefined}
        data-dragging={dragging ? "" : undefined}
        data-invalid={invalid ? "" : undefined}
        className={cn(fileUploadBase, className)}
      >
        {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: ARIA in HTML allows aria-required on a file input (the spec's amended-in-review rule). */}
        <input
          ref={inputRef}
          type="file"
          id={inputId}
          name={name ?? field.name}
          form={form}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          // Native `required` sits on the validation input (a dropped file never reaches
          // `input.files` without `DataTransfer`), so the attribute states it here.
          aria-required={required ? true : undefined}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={invalid ? true : undefined}
          data-slot="file-upload-input"
          style={visuallyHiddenInput}
          onChange={onInputChange}
          onFocus={(event) => setFocusVisible(event.currentTarget.matches(":focus-visible"))}
          onBlur={() => setFocusVisible(false)}
        />
        {children}
        <span role="status" data-slot="file-upload-status" className="sr-only">
          {message}
        </span>
        {formControl.input}
      </div>
    </FileUploadContext.Provider>
  );
}

export interface FileUploadDropzoneProps extends ComponentProps<"div"> {}

/**
 * The FileUpload's visible control (required): a click opens the system picker and a drop adds
 * the files. It has no role and is not focusable; it mirrors the hidden input's focus ring. Its
 * children (default: an icon, "Drag files here or click to browse" and the `maxSize` hint)
 * describe the input.
 */
export function FileUploadDropzone({
  className,
  children,
  onClick,
  onMouseDown,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  ...props
}: FileUploadDropzoneProps) {
  const upload = useFileUpload("FileUploadDropzone");
  const { registerDropzone, setDragging, disabled } = upload;
  useLayoutEffect(() => registerDropzone(), [registerDropzone]);
  // Entering a child fires its `dragenter` before the parent's `dragleave`: count the depth.
  const depth = useRef(0);
  useEffect(() => {
    if (disabled) {
      depth.current = 0;
      setDragging(false);
    }
  }, [disabled, setDragging]);

  const carriesFiles = (event: DragEvent) => [...event.dataTransfer.types].includes("Files");

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a pointer and drop surface for the hidden file input, which is the keyboard control.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the file input handles the keys (Enter / Space open the picker natively).
    <div
      {...props}
      data-slot="file-upload-dropzone"
      data-dragging={upload.dragging ? "" : undefined}
      data-focus-visible={upload.focusVisible ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      data-invalid={upload.invalid ? "" : undefined}
      // The disabled look fades the text (an inactive control, exempt from WCAG contrast); the
      // state is stated so assistive technology and audits know it (the TagsInput rule).
      aria-disabled={disabled ? true : undefined}
      className={cn(fileUploadDropzone, className)}
      onMouseDown={(event) => {
        onMouseDown?.(event);
        // Keep focus where it is (the input, if focused): the click moves it there anyway.
        if (!event.defaultPrevented) event.preventDefault();
      }}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) upload.openPicker();
      }}
      onDragEnter={(event) => {
        onDragEnter?.(event);
        if (!carriesFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => {
        onDragOver?.(event);
        if (!carriesFiles(event)) return;
        // Prevented even while disabled, so the browser does not open the file instead.
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }}
      onDragLeave={(event) => {
        onDragLeave?.(event);
        if (!carriesFiles(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        onDrop?.(event);
        if (!carriesFiles(event)) return;
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        if (disabled) return;
        const dropped = [...event.dataTransfer.files];
        // A dropped folder arrives as a `File`; its entry says it is a directory.
        const entries = [...event.dataTransfer.items].filter((item) => item.kind === "file");
        const folders = new Set(
          dropped.filter((_, index) => entries[index]?.webkitGetAsEntry?.()?.isDirectory),
        );
        upload.addFiles(dropped, folders);
      }}
    >
      <div
        id={upload.instructionsId}
        data-slot="file-upload-instructions"
        className={fileUploadInstructions}
      >
        {children ?? (
          <>
            <UploadIcon />
            <span>Drag files here or click to browse</span>
            {upload.maxSize !== undefined && (
              <span className="text-xs">{`Up to ${formatFileSize(upload.maxSize, upload.locale)}`}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export interface FileUploadListProps extends Omit<ComponentProps<"ul">, "children"> {
  /** Renders the items. @default one `FileUploadItem` per file */
  children?: (files: File[]) => ReactNode;
}

/** The selected files, rendered only when there are some. Named "Selected files" by default. */
export function FileUploadList({
  "aria-label": ariaLabel = "Selected files",
  className,
  children,
  ...props
}: FileUploadListProps) {
  const { files } = useFileUpload("FileUploadList");
  if (files.length === 0) return null;
  return (
    <ul
      // biome-ignore lint/a11y/noRedundantRoles: Safari drops the list role of a list without bullets.
      role="list"
      {...props}
      aria-label={ariaLabel}
      data-slot="file-upload-list"
      className={cn(fileUploadList, className)}
    >
      {children
        ? children(files)
        : files.map((file) => <FileUploadItem key={getFileKey(file)} file={file} />)}
    </ul>
  );
}

const FileUploadItemContext = createContext<File | null>(null);

export interface FileUploadItemProps extends Omit<ComponentProps<"li">, "children"> {
  /** The file this item shows. */
  file: File;
  /** Upload progress 0–100; `null` is indeterminate; `undefined` shows no bar. */
  progress?: number | null;
  /** The upload state (`data-status`). @default "idle" */
  status?: "idle" | "uploading" | "complete" | "error";
  /** Shown when `status="error"`. */
  error?: ReactNode;
  /** An image preview. @default true for `image/*` */
  preview?: boolean;
  /** The progress bar's name. @default (file) => `Uploading ${file.name}` */
  progressLabel?: (file: File) => string;
  /** Replaces the inner layout; `FileUploadItemRemove` still works inside. */
  children?: ReactNode;
}

/**
 * One selected file: a preview (an image's object URL, made after mount and revoked on removal) or
 * a file icon, the name and size, an optional progress bar and error, and a remove button.
 */
export function FileUploadItem({
  file,
  progress,
  status = "idle",
  error,
  preview,
  progressLabel = (item) => `Uploading ${item.name}`,
  className,
  children,
  ...props
}: FileUploadItemProps) {
  const { locale } = useFileUpload("FileUploadItem");
  const showPreview = preview ?? file.type.startsWith("image/");
  // Made in an effect, so the server HTML and the first client render show the icon box.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!showPreview) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [file, showPreview]);

  return (
    <FileUploadItemContext.Provider value={file}>
      <li
        {...props}
        data-slot="file-upload-item"
        data-status={status}
        className={cn(fileUploadItem, className)}
      >
        {children ?? (
          <>
            <div data-slot="file-upload-item-preview" className={fileUploadItemPreview}>
              {url ? (
                <img
                  src={url}
                  alt=""
                  className="size-full object-cover"
                  // An image the browser cannot decode (a corrupt file, HEIC) shows the icon.
                  onError={() => setUrl(null)}
                />
              ) : (
                <FileIcon />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span data-slot="file-upload-item-name" className="truncate font-medium">
                {file.name}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatFileSize(file.size, locale)}
              </span>
              {progress !== undefined && (
                <Progress size="sm" value={progress} aria-label={progressLabel(file)} />
              )}
              {status === "error" && error != null && (
                <span
                  data-slot="file-upload-item-error"
                  className="flex items-center gap-1 text-xs text-danger [&_svg]:size-3.5 [&_svg]:shrink-0"
                >
                  <AlertIcon />
                  {error}
                </span>
              )}
            </div>
            <FileUploadItemRemove />
          </>
        )}
      </li>
    </FileUploadItemContext.Provider>
  );
}

export interface FileUploadItemRemoveProps
  extends Omit<ButtonProps, "variant" | "color" | "size" | "children"> {
  /** The button's name. @default the FileUpload's `removeLabel(file)` ("Remove photo.png") */
  "aria-label"?: string;
}

/**
 * Removes its item's file (an icon button): announces it and moves focus to the next item's remove
 * button, else the previous one, else the file input.
 */
export function FileUploadItemRemove({
  "aria-label": ariaLabel,
  onClick,
  disabled,
  className,
  ...props
}: FileUploadItemRemoveProps) {
  const upload = useFileUpload("FileUploadItemRemove");
  const file = useContext(FileUploadItemContext);
  if (!file) throw new Error("FileUploadItemRemove must be used inside a FileUploadItem.");
  return (
    <Button
      {...props}
      // Button sets its own `data-slot`; the render element's props win over it.
      render={<button type="button" data-slot="file-upload-item-remove" />}
      variant="ghost"
      color="neutral"
      size="icon-sm"
      aria-label={ariaLabel ?? upload.removeLabel(file)}
      disabled={upload.disabled || disabled}
      className={mergeClassName("shrink-0", className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) upload.removeFile(file, event.currentTarget);
      }}
    >
      <CloseIcon />
    </Button>
  );
}

export interface FileUploadRejectionsProps extends ComponentProps<"ul"> {}

/**
 * The last batch's rejected files, "name — message" each, until the next accepted add or a
 * removal. Not a live region: the FileUpload's status region announces them.
 */
export function FileUploadRejections({ className, ...props }: FileUploadRejectionsProps) {
  const { rejections } = useFileUpload("FileUploadRejections");
  if (rejections.length === 0) return null;
  return (
    <ul
      // biome-ignore lint/a11y/noRedundantRoles: Safari drops the list role of a list without bullets.
      role="list"
      {...props}
      data-slot="file-upload-rejections"
      className={cn(fileUploadRejections, className)}
    >
      {rejections.map((rejection) => (
        <li
          key={getFileKey(rejection.file)}
          className="flex items-start gap-1.5 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0"
        >
          <AlertIcon />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {`${rejection.file.name} — ${rejection.message}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
