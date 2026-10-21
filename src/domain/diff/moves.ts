import { extension } from "./path.ts";
import type { FileChange, HunkId } from "./types.ts";
import { isBlank, stripTrailing } from "./whitespace.ts";

/** Languages where leading indentation never changes what the code means outside strings. */
const INDENTATION_INSENSITIVE = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".java",
  ".kt",
  ".go",
  ".rs",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cs",
  ".swift",
  ".php",
  ".rb",
  ".scala",
  ".css",
  ".scss",
  ".json",
  ".sql",
]);

/** A moved region needs this many lines with a letter or digit: `}` and `);` don't count. */
const MIN_SUBSTANTIVE_LINES = 3;

interface ChangedLine {
  readonly hunkId: HunkId;
  readonly path: string;
  readonly line: number;
  readonly text: string;
  readonly insensitive: boolean;
  /** Fully trimmed text, to find candidate matches. */
  readonly key: string;
}

/** Consecutive non-blank lines of one kind in one hunk. Blank lines are skipped, not breaks. */
type Run = readonly ChangedLine[];

/**
 * Hunks whose every non-blank added and deleted line belongs to a block that was deleted in one
 * place and added in another, with a detail for each. Regions are matched greedily and each line
 * is used once, so a missed match only means a missing proof, never a wrong one.
 */
export const findMoves = (files: readonly FileChange[]): Map<HunkId, string> => {
  const deletedRuns = files.flatMap((file) => runs(file, "del"));
  const addedRuns = files.flatMap((file) => runs(file, "add"));

  const addedByKey = new Map<string, { run: Run; index: number }[]>();
  for (const run of addedRuns) {
    for (const [index, line] of run.entries()) {
      const list = addedByKey.get(line.key);
      if (list === undefined) addedByKey.set(line.key, [{ run, index }]);
      else list.push({ run, index });
    }
  }

  const used = new Set<ChangedLine>();
  const regions = new Map<HunkId, string[]>();
  const addRegion = (hunkId: HunkId, description: string) =>
    regions.set(hunkId, [...(regions.get(hunkId) ?? []), description]);

  for (const deleted of deletedRuns) {
    let start = 0;
    while (start < deleted.length) {
      const candidates = addedByKey.get(deleted[start]?.key ?? "") ?? [];
      const match = longestMatch(deleted, start, candidates, used);
      if (match === null) {
        start += 1;
        continue;
      }
      const from = deleted.slice(start, start + match.length);
      const to = match.run.slice(match.index, match.index + match.length);
      for (const line of [...from, ...to]) used.add(line);
      const identical = from.every((line, i) => line.text === to[i]?.text);
      const how = identical ? "identical" : "identical apart from indentation";
      addRegion(firstOf(from).hunkId, `moved to ${range(to)}, ${how}`);
      addRegion(firstOf(to).hunkId, `moved from ${range(from)}, ${how}`);
      start += match.length;
    }
  }

  const changedByHunk = Map.groupBy([...deletedRuns, ...addedRuns].flat(), (line) => line.hunkId);
  const moves = new Map<HunkId, string>();
  for (const [hunkId, descriptions] of regions) {
    const changed = changedByHunk.get(hunkId) ?? [];
    if (changed.every((line) => used.has(line))) moves.set(hunkId, descriptions.join("; "));
  }
  return moves;
};

const runs = (file: FileChange, kind: "add" | "del"): Run[] => {
  // Deleted lines are numbered in the old file, which a rename gives another path.
  const path = kind === "del" ? (file.oldPath ?? file.path) : file.path;
  const insensitive = INDENTATION_INSENSITIVE.has(extension(path));
  return file.hunks.flatMap((hunk) => {
    const found: ChangedLine[][] = [];
    let current: ChangedLine[] = [];
    for (const line of hunk.lines) {
      const number = kind === "add" ? line.newLine : line.oldLine;
      if (line.kind === kind && number !== null) {
        if (isBlank(line.text)) continue;
        const text = stripTrailing(line.text);
        current.push({
          hunkId: hunk.id,
          path,
          line: number,
          text,
          insensitive,
          key: text.trim(),
        });
      } else if (current.length > 0) {
        found.push(current);
        current = [];
      }
    }
    if (current.length > 0) found.push(current);
    return found;
  });
};

const longestMatch = (
  deleted: Run,
  start: number,
  candidates: readonly { run: Run; index: number }[],
  used: ReadonlySet<ChangedLine>,
): { run: Run; index: number; length: number } | null => {
  let best: { run: Run; index: number; length: number } | null = null;
  for (const { run, index } of candidates) {
    let length = 0;
    for (;;) {
      const from = deleted[start + length];
      const to = run[index + length];
      if (from === undefined || to === undefined || used.has(from) || used.has(to)) break;
      if (from.hunkId === to.hunkId || !sameLine(from, to)) break;
      length += 1;
    }
    if (length > (best?.length ?? 0)) best = { run, index, length };
  }
  if (best === null) return null;
  const substantive = deleted
    .slice(start, start + best.length)
    .filter((line) => /[\p{L}\p{N}]/u.test(line.text)).length;
  return substantive >= MIN_SUBSTANTIVE_LINES ? best : null;
};

/** Indentation counts unless both files are in indentation-insensitive languages. */
const sameLine = (a: ChangedLine, b: ChangedLine): boolean =>
  a.insensitive && b.insensitive ? a.key === b.key : a.text === b.text;

const firstOf = (lines: readonly ChangedLine[]): ChangedLine => {
  const [first] = lines;
  if (first === undefined) throw new Error("empty moved region");
  return first;
};

const range = (lines: readonly ChangedLine[]): string => {
  const first = firstOf(lines);
  return `${first.path}:${first.line}–${lines.at(-1)?.line ?? first.line}`;
};
