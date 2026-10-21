import { err, ok, type Result } from "../shared/index.ts";
import { readCString } from "./c-string.ts";
import { type HunkContent, hunkNamer } from "./hunk-id.ts";
import type { DiffLine, FileChange, FileStatus, Hunk } from "./types.ts";

/** `line` is 1-based, counting lines of the raw diff. */
export interface DiffParseError {
  readonly line: number;
  readonly message: string;
}

type HunkDraft = HunkContent & Pick<Hunk, "sectionHeading">;
type FileDraft = Omit<FileChange, "hunks"> & { readonly hunks: readonly HunkDraft[] };

const DIFF_GIT = "diff --git ";
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: (.*))?$/;

/**
 * Parses a git-style unified diff, as GitHub and Bitbucket produce it. Anything it doesn't
 * understand is an error, never skipped: a dropped line would hide code from the reviewer.
 */
export const parseUnifiedDiff = (diff: string): Result<FileChange[], DiffParseError> => {
  const lines = diff.split("\n");
  if (lines.at(-1) === "") lines.pop();

  const drafts: FileDraft[] = [];
  let index = 0;
  while (index < lines.length) {
    const parsed = parseFile(lines, index);
    if (!parsed.ok) return parsed;
    drafts.push(parsed.value.file);
    index = parsed.value.next;
  }

  const name = hunkNamer();
  return ok(
    drafts.map((file) => ({
      ...file,
      hunks: file.hunks.map(
        (hunk): Hunk => ({ id: name(file.path, hunk), path: file.path, ...hunk }),
      ),
    })),
  );
};

interface FileHeader {
  oldPath: string | null;
  newPath: string | null;
  sawOldPath: boolean;
  sawNewPath: boolean;
  renameFrom: string | null;
  renameTo: string | null;
  copyTo: string | null;
  added: boolean;
  deleted: boolean;
  binary: boolean;
  oldMode: string | null;
  newMode: string | null;
}

const parseFile = (
  lines: readonly string[],
  start: number,
): Result<{ file: FileDraft; next: number }, DiffParseError> => {
  const first = lines[start] ?? "";
  if (!first.startsWith(DIFF_GIT)) {
    return err({
      line: start + 1,
      message: `expected "diff --git", found ${JSON.stringify(first)}`,
    });
  }
  const gitPaths = parseDiffGitPaths(first.slice(DIFF_GIT.length));
  const header: FileHeader = {
    oldPath: gitPaths?.oldPath ?? null,
    newPath: gitPaths?.newPath ?? null,
    sawOldPath: false,
    sawNewPath: false,
    renameFrom: null,
    renameTo: null,
    copyTo: null,
    added: false,
    deleted: false,
    binary: false,
    oldMode: null,
    newMode: null,
  };

  let index = start + 1;
  for (; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (line.startsWith(DIFF_GIT) || line.startsWith("@@")) break;
    if (line === "GIT binary patch") {
      header.binary = true;
      while (index + 1 < lines.length && !lines[index + 1]?.startsWith(DIFF_GIT)) index++;
      continue;
    }
    const problem = readHeaderLine(header, line);
    if (problem !== null) return err({ line: index + 1, message: problem });
  }

  const hunks: HunkDraft[] = [];
  while (lines[index]?.startsWith("@@")) {
    if (!header.sawOldPath || !header.sawNewPath) {
      return err({ line: index + 1, message: 'hunk before the "---" and "+++" lines' });
    }
    const parsed = parseHunk(lines, index);
    if (!parsed.ok) return parsed;
    hunks.push(parsed.value.hunk);
    index = parsed.value.next;
  }

  const file = toFileDraft(header, hunks);
  if (file === null) return err({ line: start + 1, message: "can't tell the file's path" });
  return ok({ file, next: index });
};

/** Applies one extended header line; returns a problem if the line isn't one. */
const readHeaderLine = (header: FileHeader, line: string): string | null => {
  const [keyword, value] = splitHeaderLine(line);
  switch (keyword) {
    case "old mode":
      header.oldMode = value;
      return null;
    case "new mode":
      header.newMode = value;
      return null;
    case "new file mode":
      header.added = true;
      return null;
    case "deleted file mode":
      header.deleted = true;
      return null;
    case "index":
    case "similarity index":
    case "dissimilarity index":
    case "copy from":
      return null;
    case "rename from":
      header.renameFrom = readPath(value);
      return header.renameFrom === null ? `bad path in ${JSON.stringify(line)}` : null;
    case "rename to":
      header.renameTo = readPath(value);
      return header.renameTo === null ? `bad path in ${JSON.stringify(line)}` : null;
    case "copy to":
      header.copyTo = readPath(value);
      return header.copyTo === null ? `bad path in ${JSON.stringify(line)}` : null;
    case "---": {
      const path = readSidePath(value, "a/");
      if (!path.ok) return path.error;
      header.sawOldPath = true;
      header.oldPath = path.value;
      return null;
    }
    case "+++": {
      const path = readSidePath(value, "b/");
      if (!path.ok) return path.error;
      header.sawNewPath = true;
      header.newPath = path.value;
      return null;
    }
  }
  if (/^Binary files .* differ$/.test(line)) {
    header.binary = true;
    return null;
  }
  return `unexpected line in a file header: ${JSON.stringify(line)}`;
};

const HEADER_KEYWORDS = [
  "old mode",
  "new mode",
  "new file mode",
  "deleted file mode",
  "index",
  "similarity index",
  "dissimilarity index",
  "rename from",
  "rename to",
  "copy from",
  "copy to",
  "---",
  "+++",
] as const;

const splitHeaderLine = (line: string): [string | null, string] => {
  const keyword = HEADER_KEYWORDS.find((k) => line.startsWith(`${k} `));
  return keyword === undefined ? [null, ""] : [keyword, line.slice(keyword.length + 1)];
};

/** The path after "---" or "+++": null for /dev/null. */
const readSidePath = (value: string, prefix: "a/" | "b/"): Result<string | null, string> => {
  if (value === "/dev/null") return ok(null);
  const path = readPath(value);
  if (path === null || !path.startsWith(prefix)) return err(`bad path ${JSON.stringify(value)}`);
  return ok(path.slice(prefix.length));
};

/**
 * A path as git writes it after a header keyword: quoted when it has special characters, and
 * followed by a tab when it contains a space. Git quotes any path that itself contains a tab.
 */
const readPath = (value: string): string | null => {
  if (value.startsWith('"')) return readCString(value)?.value ?? null;
  const path = value.split("\t", 1)[0] ?? "";
  return path === "" ? null : path;
};

/**
 * Paths from `a/old b/new`. Unquoted paths with spaces are ambiguous when they differ; then
 * this returns null and the paths come from the "rename" or "---"/"+++" lines.
 */
const parseDiffGitPaths = (rest: string): { oldPath: string; newPath: string } | null => {
  const candidates: { oldPath: string; newPath: string }[] = [];
  const quotedOld = readCString(rest);
  if (quotedOld !== null) {
    const newPath = quotedOld.rest.startsWith(" ") ? readPath(quotedOld.rest.slice(1)) : null;
    if (newPath !== null) candidates.push({ oldPath: quotedOld.value, newPath });
  } else {
    for (let i = rest.indexOf(" "); i !== -1; i = rest.indexOf(" ", i + 1)) {
      const newPath = readPath(rest.slice(i + 1));
      if (newPath !== null) candidates.push({ oldPath: rest.slice(0, i), newPath });
    }
  }
  const prefixed = candidates
    .filter((c) => c.oldPath.startsWith("a/") && c.newPath.startsWith("b/"))
    .map((c) => ({ oldPath: c.oldPath.slice(2), newPath: c.newPath.slice(2) }));
  const same = prefixed.filter((c) => c.oldPath === c.newPath);
  if (same.length === 1) return same[0] ?? null;
  return prefixed.length === 1 ? (prefixed[0] ?? null) : null;
};

const toFileDraft = (header: FileHeader, hunks: readonly HunkDraft[]): FileDraft | null => {
  const renamed = header.renameFrom !== null || header.renameTo !== null;
  const oldPath = header.renameFrom ?? header.oldPath;
  const newPath = header.renameTo ?? header.copyTo ?? header.newPath;
  const added =
    header.added || header.copyTo !== null || (header.sawOldPath && header.oldPath === null);
  const deleted = header.deleted || (header.sawNewPath && header.newPath === null);

  let status: FileStatus = "modified";
  if (renamed) status = "renamed";
  else if (added) status = "added";
  else if (deleted) status = "deleted";

  const path = status === "deleted" ? oldPath : newPath;
  if (path === null || (renamed && oldPath === null)) return null;

  const lines = hunks.flatMap((hunk) => hunk.lines);
  return {
    path,
    oldPath: renamed ? oldPath : null,
    status,
    binary: header.binary,
    oldMode: header.oldMode,
    newMode: header.newMode,
    language: null,
    hunks,
    additions: lines.filter((line) => line.kind === "add").length,
    deletions: lines.filter((line) => line.kind === "del").length,
  };
};

const parseHunk = (
  lines: readonly string[],
  start: number,
): Result<{ hunk: HunkDraft; next: number }, DiffParseError> => {
  const header = lines[start] ?? "";
  const match = HUNK_HEADER.exec(header);
  if (match === null) {
    return err({ line: start + 1, message: `bad hunk header ${JSON.stringify(header)}` });
  }
  const [, oldStartText = "", oldLinesText = "1", newStartText = "", newLinesText = "1", heading] =
    match;
  const counts = {
    oldStart: Number(oldStartText),
    oldLines: Number(oldLinesText),
    newStart: Number(newStartText),
    newLines: Number(newLinesText),
  };
  if (
    (counts.oldLines > 0 && counts.oldStart < 1) ||
    (counts.newLines > 0 && counts.newStart < 1)
  ) {
    return err({ line: start + 1, message: `hunk header starts at line 0: ${header}` });
  }

  const read: DiffLine[] = [];
  let oldLeft = counts.oldLines;
  let newLeft = counts.newLines;
  let index = start + 1;
  const shortBy = () =>
    `hunk has fewer lines than its header says: ${oldLeft} old and ${newLeft} new missing`;

  for (; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const prefix = line.charAt(0);
    if (prefix === "\\") {
      const previous = read.pop();
      if (previous === undefined) {
        return err({ line: index + 1, message: `${JSON.stringify(line)} before any line` });
      }
      read.push({ ...previous, noNewlineAtEnd: true });
      continue;
    }
    if (oldLeft === 0 && newLeft === 0) break;

    const kind =
      prefix === " " ? "context" : prefix === "-" ? "del" : prefix === "+" ? "add" : null;
    if (kind === null) return err({ line: index + 1, message: shortBy() });
    if ((kind !== "add" && oldLeft === 0) || (kind !== "del" && newLeft === 0)) {
      return err({ line: index + 1, message: "hunk has more lines than its header says" });
    }
    read.push({
      kind,
      oldLine: kind === "add" ? null : counts.oldStart + counts.oldLines - oldLeft,
      newLine: kind === "del" ? null : counts.newStart + counts.newLines - newLeft,
      text: line.slice(1),
      noNewlineAtEnd: false,
    });
    if (kind !== "add") oldLeft--;
    if (kind !== "del") newLeft--;
  }
  if (oldLeft > 0 || newLeft > 0) return err({ line: index + 1, message: shortBy() });

  const after = lines[index];
  if (after !== undefined && /^[ +-]/.test(after)) {
    return err({ line: index + 1, message: "hunk has more lines than its header says" });
  }
  return ok({
    hunk: { ...counts, sectionHeading: heading ? heading : null, lines: read },
    next: index,
  });
};
