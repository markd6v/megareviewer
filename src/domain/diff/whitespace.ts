import type { DiffLine, Hunk } from "./types.ts";

const TRAILING_WHITESPACE = /[ \t\r]+$/;

export const stripTrailing = (text: string): string => text.replace(TRAILING_WHITESPACE, "");

export const isBlank = (text: string): boolean => stripTrailing(text) === "";

/**
 * What changed if the hunk changes only whitespace, or null. Each run of changed lines between
 * context lines is compared on its own, so a line moved past a context line isn't "whitespace".
 * Indentation isn't normalized: it can change meaning (Python, YAML, string literals).
 */
export const whitespaceChange = (hunk: Hunk): string | null => {
  const kinds = new Set<string>();
  for (const block of changeBlocks(hunk.lines)) {
    const deleted = block.filter((line) => line.kind === "del" && !isBlank(line.text));
    const added = block.filter((line) => line.kind === "add" && !isBlank(line.text));
    if (deleted.length !== added.length) return null;
    if (block.some((line) => isBlank(line.text))) kinds.add("blank lines");
    for (const [index, before] of deleted.entries()) {
      const after = added[index];
      if (after === undefined || stripTrailing(before.text) !== stripTrailing(after.text)) {
        return null;
      }
      if (before.text === after.text) {
        if (before.noNewlineAtEnd !== after.noNewlineAtEnd) kinds.add("newline at end of file");
      } else if (before.text.replace(/\r$/, "") === after.text.replace(/\r$/, "")) {
        kinds.add("line endings");
      } else {
        kinds.add("trailing whitespace");
      }
    }
  }
  return kinds.size === 0 ? "whitespace only" : `whitespace only: ${[...kinds].join(", ")}`;
};

/** Runs of consecutive added and deleted lines. */
const changeBlocks = (lines: readonly DiffLine[]): DiffLine[][] => {
  const blocks: DiffLine[][] = [];
  let current: DiffLine[] = [];
  for (const line of lines) {
    if (line.kind !== "context") {
      current.push(line);
    } else if (current.length > 0) {
      blocks.push(current);
      current = [];
    }
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
};
