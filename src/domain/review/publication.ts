import { z } from "zod";
import { HttpUrl, Timestamp } from "./primitives.ts";

export const PublicationVerdict = z.enum(["approve", "request_changes", "comment"]);
export type PublicationVerdict = z.infer<typeof PublicationVerdict>;

/** "summary", or "decision:<DecisionId>" for a decision's inline comment. */
export const CommentKey = z
  .string()
  .regex(/^(summary|decision:d[1-9][0-9]*)$/)
  .brand<"CommentKey">();
export type CommentKey = z.infer<typeof CommentKey>;

export const PublicationComment = z
  .object({
    key: CommentKey,
    path: z.string().min(1),
    line: z.number().int().positive(),
    /** new: `line` is a head-side line number; old: a base-side one. */
    side: z.enum(["new", "old"]),
    body: z.string().min(1),
  })
  .readonly();
export type PublicationComment = z.infer<typeof PublicationComment>;

export const Publication = z
  .object({
    verdict: PublicationVerdict,
    summary: z.string(),
    comments: z.array(PublicationComment).readonly(),
  })
  .readonly();
export type Publication = z.infer<typeof Publication>;

export const PublicationReceipt = z
  .object({
    /** Link to the review on the host, when the host has one. */
    url: HttpUrl.nullable(),
    publishedAt: Timestamp,
    /** Host IDs of the comments the publishing call posted, by key. */
    postedCommentIds: z.record(CommentKey, z.string().min(1)).readonly(),
  })
  .readonly();
export type PublicationReceipt = z.infer<typeof PublicationReceipt>;
