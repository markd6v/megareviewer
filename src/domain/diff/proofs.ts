import { generatedReason } from "./generated.ts";
import { parseGitattributes } from "./gitattributes.ts";
import { findMoves } from "./moves.ts";
import type { FileChange, MechanicalProof } from "./types.ts";
import { whitespaceChange } from "./whitespace.ts";

export interface ProofContext {
  /** The BASE version, so a PR can't hide code by editing .gitattributes. null when absent. */
  readonly gitattributes: string | null;
  /** By path, the old path for renames. null when the file doesn't exist at that commit. */
  readonly baseContents: ReadonlyMap<string, string | null>;
  readonly headContents: ReadonlyMap<string, string | null>;
}

/**
 * Deterministic proofs that hunks are mechanical, at most one per hunk: generated, rename, move,
 * then whitespace. A hunk without a proof is shown to the reviewer, so every check here errs
 * toward not proving.
 */
export const findMechanicalProofs = (
  files: readonly FileChange[],
  context: ProofContext,
): MechanicalProof[] => {
  const attributeFor = parseGitattributes(context.gitattributes ?? "");
  // A mode change (say, made executable) can matter, and it has no hunk to show it on.
  const eligible = files.filter((file) => file.oldMode === null && file.newMode === null);
  const generated = new Map(
    eligible.map((file) => [
      file,
      generatedReason(file, {
        attributeFor,
        baseContent: context.baseContents.get(file.oldPath ?? file.path),
        headContent: context.headContents.get(file.path),
      }),
    ]),
  );
  // Code moved into a generated file would be hidden on both ends.
  const moves = findMoves(eligible.filter((file) => generated.get(file) === null));

  return eligible.flatMap((file): MechanicalProof[] => {
    if (file.status === "renamed" && file.hunks.length === 0 && !file.binary) {
      const detail = `renamed from ${file.oldPath}, content unchanged`;
      return [{ path: file.path, hunkId: null, kind: "rename", detail }];
    }
    const reason = generated.get(file) ?? null;
    return file.hunks.flatMap((hunk): MechanicalProof[] => {
      const proof = (kind: MechanicalProof["kind"], detail: string): MechanicalProof[] => [
        { path: file.path, hunkId: hunk.id, kind, detail },
      ];
      if (reason !== null) return proof("generated", reason);
      const move = moves.get(hunk.id);
      if (move !== undefined) return proof("move", move);
      const whitespace = whitespaceChange(hunk);
      return whitespace === null ? [] : proof("whitespace", whitespace);
    });
  });
};
