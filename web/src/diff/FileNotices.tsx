import "./diff.css";
import { useId } from "react";
import type { FileChange } from "../../../src/domain/diff/index.ts";
import { FilePath, FileStatusBadge } from "./HunkCard.tsx";

export interface FileNotice {
  readonly key: string;
  readonly file: FileChange;
  readonly text: string;
}

const WHAT_HAPPENED: Readonly<Record<FileChange["status"], string>> = {
  added: "added",
  deleted: "deleted",
  modified: "changed",
  renamed: "changed",
};

/**
 * File changes that have no lines to show: binary files, mode changes, and empty files added or
 * deleted. None of these is mechanical: a newly executable file can matter.
 */
export const fileNotices = (files: readonly FileChange[]): FileNotice[] =>
  files.flatMap((file) => {
    const modeChanged = file.oldMode !== null || file.newMode !== null;
    // A rename without hunks has a mechanical proof instead.
    const nothingElse =
      !file.binary && !modeChanged && file.hunks.length === 0 && file.status !== "renamed";
    return [
      ...(file.binary
        ? [{ key: `${file.path}\0binary`, file, text: `binary file ${WHAT_HAPPENED[file.status]}` }]
        : []),
      ...(modeChanged
        ? [
            {
              key: `${file.path}\0mode`,
              file,
              text: `mode ${file.oldMode ?? "unknown"} → ${file.newMode ?? "unknown"}`,
            },
          ]
        : []),
      ...(nothingElse
        ? [
            {
              key: `${file.path}\0empty`,
              file,
              text:
                file.status === "modified"
                  ? "changed, no lines to show"
                  : `empty file ${file.status}`,
            },
          ]
        : []),
    ];
  });

/** File notices, styled as logic rather than muted. Renders nothing when there are none. */
export const FileNotices = ({ files }: { readonly files: readonly FileChange[] }) => {
  const titleId = useId();
  const notices = fileNotices(files);
  if (notices.length === 0) return null;
  return (
    <section className="file-notices" aria-labelledby={titleId}>
      <h2 id={titleId}>Changes without lines to show</h2>
      <ul>
        {notices.map(({ key, file, text }) => (
          <li key={key} className="file-notice">
            <FilePath file={file} />
            <FileStatusBadge status={file.status} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
