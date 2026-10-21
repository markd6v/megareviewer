export { hunkId } from "./hunk-id.ts";
export { type DiffParseError, parseUnifiedDiff } from "./parse-diff.ts";
export { findMechanicalProofs, type ProofContext } from "./proofs.ts";
export {
  CallGraphHint,
  DiffLine,
  FileChange,
  FileStatus,
  Hunk,
  HunkId,
  MechanicalProof,
  MechanicalProofKind,
} from "./types.ts";
export { lockfileWarnings } from "./warnings.ts";
