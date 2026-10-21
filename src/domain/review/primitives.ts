import { z } from "zod";

/**
 * ISO-8601 in UTC ("2026-10-21T09:30:00Z"), so timestamps sort as strings.
 * Adapters convert host timestamps with offsets before they reach the domain.
 */
export const Timestamp = z.iso.datetime();
export type Timestamp = z.infer<typeof Timestamp>;

/** A full 40-char commit SHA. */
export const Sha = z.string().regex(/^[0-9a-f]{40}$/);
export type Sha = z.infer<typeof Sha>;

/** Only http(s), because the UI renders these as links. */
export const HttpUrl = z.url({ protocol: /^https?$/ });
export type HttpUrl = z.infer<typeof HttpUrl>;
