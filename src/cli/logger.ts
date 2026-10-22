import type { LogFields, Logger } from "../application/ports/index.ts";
import type { LogLevel } from "./config.ts";

const RANK: Readonly<Record<LogLevel, number>> = { debug: 0, info: 1, warn: 2, error: 3 };
const SENSITIVE = /token|secret|password|authorization/i;
const REDACTED = "[redacted]";

/** Redacts sensitive keys at any depth, so a nested `headers.authorization` doesn't leak. */
const redact = (key: string, value: unknown): unknown =>
  key !== "" && SENSITIVE.test(key) ? REDACTED : value;

const formatValue = (value: unknown): string => {
  if (typeof value === "string") return /^[^\s"=]+$/.test(value) ? value : JSON.stringify(value);
  if (value instanceof Error) return JSON.stringify(value.stack ?? value.message);
  try {
    return JSON.stringify(value, redact) ?? String(value);
  } catch {
    // A bigint or a circular object.
    return JSON.stringify(String(value));
  }
};

const formatFields = (fields: LogFields): string =>
  Object.entries(fields)
    .map(([key, value]) => ` ${key}=${SENSITIVE.test(key) ? REDACTED : formatValue(value)}`)
    .join("");

/** One line per entry: time, level, message, then fields as key=value. */
export const formatLogLine = (
  time: Date,
  level: LogLevel,
  message: string,
  fields: LogFields = {},
): string =>
  `${time.toISOString()} ${level.toUpperCase()} ${message.replace(/\r?\n/g, "\\n")}${formatFields(fields)}`;

export const createLogger = (options: {
  readonly level: LogLevel;
  readonly write?: (line: string) => void;
  readonly now?: () => Date;
}): Logger => {
  const write = options.write ?? ((line) => process.stderr.write(`${line}\n`));
  const now = options.now ?? (() => new Date());
  const at =
    (level: LogLevel) =>
    (message: string, fields?: LogFields): void => {
      if (RANK[level] >= RANK[options.level]) write(formatLogLine(now(), level, message, fields));
    };
  return { debug: at("debug"), info: at("info"), warn: at("warn"), error: at("error") };
};
