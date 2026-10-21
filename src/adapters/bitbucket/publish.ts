import {
  CommentKey,
  type PublicationComment,
  type PublicationVerdict,
} from "../../domain/review/index.ts";

export const SUMMARY = CommentKey.parse("summary");

/** The body of `POST …/pullrequests/{id}/comments`. */
export interface CommentRequest {
  readonly content: { readonly raw: string };
  readonly inline?:
    | { readonly path: string; readonly to: number }
    | { readonly path: string; readonly from: number };
}

/** `to` anchors on a line of the new file, `from` on one of the old file. */
export const inlineComment = ({ path, line, side, body }: PublicationComment): CommentRequest => ({
  content: { raw: body },
  inline: side === "new" ? { path, to: line } : { path, from: line },
});

export const generalComment = (body: string): CommentRequest => ({ content: { raw: body } });

/** The PR endpoint that records the verdict, or null for a plain comment. */
export const VERDICT_ENDPOINTS = {
  approve: "approve",
  request_changes: "request-changes",
  comment: null,
} as const satisfies Record<PublicationVerdict, string | null>;
