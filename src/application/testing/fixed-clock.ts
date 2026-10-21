import type { Clock } from "../ports/index.ts";

export class FixedClock implements Clock {
  private time: number;

  constructor(iso = "2026-01-01T00:00:00.000Z") {
    this.time = Date.parse(iso);
  }

  now(): string {
    return new Date(this.time).toISOString();
  }

  advance(ms: number): void {
    this.time += ms;
  }
}
