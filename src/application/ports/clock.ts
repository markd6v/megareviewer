export interface Clock {
  /** ISO-8601 in UTC. */
  now(): string;
}
