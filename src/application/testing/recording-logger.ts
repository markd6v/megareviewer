import type { LogFields, Logger } from "../ports/index.ts";

export interface LogEntry {
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly fields: LogFields | undefined;
}

export class RecordingLogger implements Logger {
  readonly entries: LogEntry[] = [];

  debug(message: string, fields?: LogFields): void {
    this.entries.push({ level: "debug", message, fields });
  }

  info(message: string, fields?: LogFields): void {
    this.entries.push({ level: "info", message, fields });
  }

  warn(message: string, fields?: LogFields): void {
    this.entries.push({ level: "warn", message, fields });
  }

  error(message: string, fields?: LogFields): void {
    this.entries.push({ level: "error", message, fields });
  }
}
