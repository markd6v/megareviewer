import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.ts";

const TIME = new Date("2026-10-22T10:00:00.000Z");

const recordingLogger = (level: "debug" | "info" | "warn" | "error" = "debug") => {
  const lines: string[] = [];
  const logger = createLogger({ level, write: (line) => lines.push(line), now: () => TIME });
  return { lines, logger };
};

describe("createLogger", () => {
  it("writes time, level, message and fields", () => {
    const { lines, logger } = recordingLogger();
    logger.info("Analysis started", { id: "a_1", files: 3, cached: false, user: null });
    expect(lines).toEqual([
      "2026-10-22T10:00:00.000Z INFO Analysis started id=a_1 files=3 cached=false user=null",
    ]);
  });

  it("quotes strings with spaces, quotes or equals signs, and serializes objects", () => {
    const { lines, logger } = recordingLogger();
    logger.warn("x", { a: "two words", b: 'say "hi"', c: "k=v", d: "", e: { n: [1, 2] } });
    expect(lines[0]).toBe(
      String.raw`2026-10-22T10:00:00.000Z WARN x a="two words" b="say \"hi\"" c="k=v" d="" e={"n":[1,2]}`,
    );
  });

  it("keeps every entry on one line", () => {
    const { lines, logger } = recordingLogger();
    const error = new Error("boom");
    logger.error("request\nfailed", { error, stack: "line 1\nline 2" });
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("\n");
    expect(lines[0]).toContain("request\\nfailed");
    expect(lines[0]).toContain(String.raw`stack="line 1\nline 2"`);
  });

  it("survives values JSON can't serialize", () => {
    const { lines, logger } = recordingLogger();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    logger.info("x", { big: 10n, circular });
    expect(lines[0]).toBe('2026-10-22T10:00:00.000Z INFO x big="10" circular="[object Object]"');
  });

  it("redacts fields named like secrets, at any depth and in any case", () => {
    const { lines, logger } = recordingLogger();
    logger.info("x", {
      token: "s1",
      sessionToken: "s2",
      API_SECRET: "s3",
      password: "s4",
      Authorization: "s5",
      headers: { authorization: "s6", accept: "json" },
    });
    expect(lines[0]).not.toMatch(/s[1-6]/);
    expect(lines[0]).toContain("token=[redacted]");
    expect(lines[0]).toContain('headers={"authorization":"[redacted]","accept":"json"}');
  });

  it("drops entries below its level", () => {
    const { lines, logger } = recordingLogger("warn");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(lines.map((line) => line.split(" ")[1])).toEqual(["WARN", "ERROR"]);
  });
});
