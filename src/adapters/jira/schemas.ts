import { z } from "zod";

// Only the fields the adapter reads. Zod drops the rest.

/**
 * An Atlassian Document Format node. Parsed loosely: ADF gains node types over time, and an
 * unknown one is rendered through its children rather than failing the ticket.
 */
export interface AdfNode {
  readonly type: string;
  readonly text?: string | undefined;
  readonly attrs?: Readonly<Record<string, unknown>> | undefined;
  readonly marks?: readonly { readonly type: string }[] | undefined;
  readonly content?: readonly AdfNode[] | undefined;
}

export const AdfNode: z.ZodType<AdfNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    text: z.string().optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    marks: z.array(z.object({ type: z.string() })).optional(),
    content: z.array(AdfNode).optional(),
  }),
);

export const JiraIssue = z.object({
  key: z.string().min(1),
  fields: z.object({
    summary: z.string(),
    /** null when the issue has none; missing when the field is hidden from the user. */
    description: AdfNode.nullish(),
    issuetype: z.object({ name: z.string() }),
    status: z.object({ name: z.string() }),
  }),
});
export type JiraIssue = z.infer<typeof JiraIssue>;

export const JiraErrorBody = z.object({
  errorMessages: z.array(z.string()).optional(),
  errors: z.record(z.string(), z.string()).optional(),
});
