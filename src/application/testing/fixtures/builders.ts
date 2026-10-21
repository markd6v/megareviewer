import { type DiffLine, type FileChange, type Hunk, HunkId } from "../../../domain/diff/index.ts";
import { fnv1a64 } from "../../../domain/shared/index.ts";

const HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;
const KINDS = { " ": "context", "+": "add", "-": "del" } as const;

/**
 * Builds a hunk from its header and its lines exactly as they appear in the diff, so fixture
 * hunks read like the diff they came from. IDs follow the diff parser's scheme.
 */
export const hunk = (path: string, header: string, diffLines: readonly string[]): Hunk => {
  const match = HEADER.exec(header);
  if (match === null) throw new Error(`not a hunk header: ${header}`);
  const [, oldStart = "", oldLines = "1", newStart = "", newLines = "1", heading = ""] = match;
  let oldLine = Number(oldStart);
  let newLine = Number(newStart);
  const lines = diffLines.map((diffLine): DiffLine => {
    const prefix = diffLine.charAt(0);
    if (prefix !== " " && prefix !== "+" && prefix !== "-") {
      throw new Error(`not a diff line: ${diffLine}`);
    }
    const kind = KINDS[prefix];
    const line: DiffLine = {
      kind,
      oldLine: kind === "add" ? null : oldLine,
      newLine: kind === "del" ? null : newLine,
      text: diffLine.slice(1),
      noNewlineAtEnd: false,
    };
    if (kind !== "add") oldLine += 1;
    if (kind !== "del") newLine += 1;
    return line;
  });
  const counts = `${oldStart},${oldLines},${newStart},${newLines}`;
  return {
    id: HunkId.parse(`h_${fnv1a64(`${path}\n${counts}\n${diffLines.join("\n")}`)}`),
    path,
    oldStart: Number(oldStart),
    oldLines: Number(oldLines),
    newStart: Number(newStart),
    newLines: Number(newLines),
    sectionHeading: heading === "" ? null : heading,
    lines,
  };
};

export const fileChange = (
  file: Pick<FileChange, "path" | "status" | "language"> & Partial<FileChange>,
  hunks: readonly Hunk[],
): FileChange => {
  const count = (kind: DiffLine["kind"]) =>
    hunks.reduce((sum, h) => sum + h.lines.filter((line) => line.kind === kind).length, 0);
  return {
    oldPath: null,
    binary: false,
    oldMode: null,
    newMode: null,
    ...file,
    hunks,
    additions: count("add"),
    deletions: count("del"),
  };
};
