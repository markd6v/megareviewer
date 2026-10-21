import type { Ticket, TicketError } from "../../domain/review/index.ts";
import type { Result } from "../../domain/shared/index.ts";

export interface TicketLookup {
  readonly found: Ticket[];
  /** Requested keys the source doesn't know, or the user can't see. */
  readonly missing: string[];
}

export interface TicketSource {
  readonly configured: boolean;
  getTickets(keys: readonly string[]): Promise<Result<TicketLookup, TicketError>>;
}
