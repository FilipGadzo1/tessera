/*
 * File helpers (spec Phase K §5.1): the `accept` match of `<input type="file">`, SI file sizes in
 * the locale's words, the FileUpload validation pass and stable React keys for `File`s.
 * Server-safe: pure functions, no `window`.
 */

/** Why a file was not added: the first failing check, in `validateFiles`'s order. */
export type FileRejectionReason =
  | "type"
  | "too-large"
  | "too-small"
  | "too-many"
  | "duplicate"
  | "invalid";

/** A file `validateFiles` turned away. `message` is `validate`'s message for `"invalid"`. */
export interface FileRejection {
  file: File;
  reason: FileRejectionReason;
  message?: string;
}

/** The constraints `validateFiles` checks, as FileUpload's props. */
export interface ValidateFilesOptions {
  /** The `accept` attribute: `.ext`, `type/sub` and `type/*` tokens, comma-separated. */
  accept?: string;
  /** The smallest size in bytes. */
  minSize?: number;
  /** The largest size in bytes. */
  maxSize?: number;
  /** The most files in the list. @default Infinity */
  maxFiles?: number;
  /** `false` (or `maxFiles` 1): the first acceptable file replaces the list. @default true */
  multiple?: boolean;
  /** An error message for a file, or `null` to accept it. */
  validate?: (file: File) => string | null;
}

/** What `validateFiles` decided: the files to add (or, with `replace`, the new list) and why the rest were not. */
export interface ValidateFilesResult {
  accepted: File[];
  rejected: FileRejection[];
  /** Single mode accepted a file: it replaces the current list instead of being appended. */
  replace: boolean;
}

/**
 * Whether a file matches an `accept` attribute: comma-separated, trimmed, case-insensitive tokens;
 * `.ext` matches the name's end, `type/sub` the type exactly and `type/*` the major type. An empty
 * or missing `accept` matches everything; a file with no `type` matches only extension tokens.
 */
export function matchesAccept(file: { name: string; type: string }, accept?: string): boolean {
  const tokens = (accept ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token !== "");
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith(".")) return name.endsWith(token);
    if (type === "") return false;
    if (token === "*/*") return true;
    if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

const sizeUnits = [
  ["gigabyte", 1e9],
  ["megabyte", 1e6],
  ["kilobyte", 1e3],
] as const;

/**
 * A file size in SI units (1 kB = 1000 B) with `Intl`'s unit names, in the largest unit whose value
 * is at least 1, to one decimal: 1536 → "1.5 kB", 999 → "999 byte" (as `Intl` prints it).
 */
export function formatFileSize(bytes: number, locale?: string): string {
  const [unit, divisor] = sizeUnits.find(([, size]) => bytes >= size) ?? ["byte", 1];
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(bytes / divisor);
}

const sameFile = (a: File, b: File) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/**
 * Checks incoming files (a pick or a drop) against the current list, each in order: `type`
 * (`accept`), `too-small`, `too-large`, `duplicate` (same name, size and `lastModified` as a
 * current or an earlier incoming file), `invalid` (`validate`), `too-many` (past `maxFiles` in
 * total). In single mode (`multiple: false` or `maxFiles: 1`) the first acceptable file replaces
 * the list (`replace: true`) and the other acceptable ones are `too-many`.
 */
export function validateFiles(
  incoming: readonly File[],
  current: readonly File[],
  {
    accept,
    minSize,
    maxSize,
    maxFiles = Number.POSITIVE_INFINITY,
    multiple = true,
    validate,
  }: ValidateFilesOptions,
): ValidateFilesResult {
  const single = !multiple || maxFiles === 1;
  const accepted: File[] = [];
  const rejected: FileRejection[] = [];
  for (const [index, file] of incoming.entries()) {
    const earlier = incoming.slice(0, index);
    if (!matchesAccept(file, accept)) {
      rejected.push({ file, reason: "type" });
    } else if (minSize !== undefined && file.size < minSize) {
      rejected.push({ file, reason: "too-small" });
    } else if (maxSize !== undefined && file.size > maxSize) {
      rejected.push({ file, reason: "too-large" });
    } else if ([...current, ...earlier].some((other) => sameFile(other, file))) {
      rejected.push({ file, reason: "duplicate" });
    } else {
      const message = validate?.(file);
      if (message) {
        rejected.push({ file, reason: "invalid", message });
      } else if (single ? accepted.length > 0 : current.length + accepted.length >= maxFiles) {
        rejected.push({ file, reason: "too-many" });
      } else {
        accepted.push(file);
      }
    }
  }
  return { accepted, rejected, replace: single && accepted.length > 0 };
}

const fileKeys = new WeakMap<File, string>();
let nextFileKey = 0;

/** A stable key per `File` object, for React lists: the same object always gets the same key. */
export function getFileKey(file: File): string {
  let key = fileKeys.get(file);
  if (key === undefined) {
    nextFileKey += 1;
    key = `file-${nextFileKey}`;
    fileKeys.set(file, key);
  }
  return key;
}
