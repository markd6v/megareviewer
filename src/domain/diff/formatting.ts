import type { FileChange, MechanicalProof } from "./types.ts";

/** One syntax node, as `CodeParser.syntaxNodes` lists them: text on leaves, "" on inner nodes. */
interface SyntaxNode {
  readonly type: string;
  readonly text: string;
}

const DETAIL = "formatting only: syntax tree unchanged";

/**
 * Proves every hunk of a file formatting-only when its base and head syntax trees are identical.
 * The whole file is the unit: a file with one formatting change and one real change gets nothing.
 * Nodes are keyed by the file's path; for a renamed file, `base` is the old path's contents.
 */
export const findFormattingProofs = (
  files: readonly FileChange[],
  nodesByPath: ReadonlyMap<
    string,
    { readonly base: readonly SyntaxNode[]; readonly head: readonly SyntaxNode[] }
  >,
): MechanicalProof[] =>
  files.flatMap((file): MechanicalProof[] => {
    const nodes = nodesByPath.get(file.path);
    if (!isEligible(file) || nodes === undefined || !sameNodes(nodes.base, nodes.head)) return [];
    return file.hunks.map((hunk) => ({
      path: file.path,
      hunkId: hunk.id,
      kind: "formatting",
      detail: DETAIL,
    }));
  });

// A mode change has no hunk to show it on, so a file with one is never collapsed (as in proofs.ts).
const isEligible = (file: FileChange): boolean =>
  (file.status === "modified" || file.status === "renamed") &&
  file.hunks.length > 0 &&
  !file.binary &&
  file.oldMode === null &&
  file.newMode === null;

// An empty list means nothing was parsed, which proves nothing.
const sameNodes = (base: readonly SyntaxNode[], head: readonly SyntaxNode[]): boolean =>
  base.length > 0 &&
  base.length === head.length &&
  base.every((node, index) => node.type === head[index]?.type && node.text === head[index]?.text);
