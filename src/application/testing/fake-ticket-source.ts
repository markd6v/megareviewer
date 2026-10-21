import type { Ticket, TicketError } from "../../domain/review/index.ts";
import { err, ok, type Result } from "../../domain/shared/index.ts";
import type { TicketLookup, TicketSource } from "../ports/index.ts";

export class FakeTicketSource implements TicketSource {
  readonly configured: boolean;
  /** The keys of every getTickets call. */
  readonly calls: (readonly string[])[] = [];
  private readonly tickets: ReadonlyMap<string, Ticket>;
  private readonly failures: TicketError[] = [];

  constructor(options: { tickets?: readonly Ticket[]; configured?: boolean } = {}) {
    this.tickets = new Map((options.tickets ?? []).map((ticket) => [ticket.key, ticket]));
    this.configured = options.configured ?? true;
  }

  /** The next getTickets call fails with this error. Calls queue up. */
  failNext(error: TicketError): void {
    this.failures.push(error);
  }

  async getTickets(keys: readonly string[]): Promise<Result<TicketLookup, TicketError>> {
    this.calls.push([...keys]);
    if (!this.configured) {
      return err({ kind: "not-configured", message: "Jira is not configured" });
    }
    const failure = this.failures.shift();
    if (failure !== undefined) return err(failure);
    const found: Ticket[] = [];
    const missing: string[] = [];
    for (const key of new Set(keys)) {
      const ticket = this.tickets.get(key);
      if (ticket === undefined) missing.push(key);
      else found.push(structuredClone(ticket));
    }
    return ok({ found, missing });
  }
}
