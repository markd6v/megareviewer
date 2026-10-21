import { describe, expect, it } from "vitest";
import { fnv1a64 } from "../shared/index.ts";
import { type DiffLine, hunkId, parseUnifiedDiff } from "./index.ts";

const line = (kind: DiffLine["kind"], text: string): DiffLine => ({
  kind,
  oldLine: kind === "add" ? null : 1,
  newLine: kind === "del" ? null : 1,
  text,
  noNewlineAtEnd: false,
});

const base = {
  oldStart: 1,
  oldLines: 1,
  newStart: 1,
  newLines: 1,
  lines: [line("del", "a"), line("add", "b")],
};

describe("hunkId", () => {
  it("hashes the path, counts and lines", () => {
    expect(hunkId("x.ts", base)).toBe(`h_${fnv1a64("x.ts\n1,1,1,1\n-a\n+b")}`);
    expect(hunkId("x.ts", base)).toBe(hunkId("x.ts", { ...base }));
  });

  it.each([
    ["path", "y.ts", base],
    ["oldStart", "x.ts", { ...base, oldStart: 2 }],
    ["oldLines", "x.ts", { ...base, oldLines: 2 }],
    ["newStart", "x.ts", { ...base, newStart: 2 }],
    ["newLines", "x.ts", { ...base, newLines: 2 }],
    ["line kind", "x.ts", { ...base, lines: [line("context", "a"), line("add", "b")] }],
    ["line text", "x.ts", { ...base, lines: [line("del", "a"), line("add", "c")] }],
    ["carriage return", "x.ts", { ...base, lines: [line("del", "a"), line("add", "b\r")] }],
  ])("differs when the %s differs", (_, path, hunk) => {
    expect(hunkId(path, hunk)).not.toBe(hunkId("x.ts", base));
  });

  it("suffixes colliding hunks in file order", () => {
    const file = (path: string) =>
      [
        `diff --git a/${path} b/${path}`,
        "index 1111111..2222222 100644",
        `--- a/${path}`,
        `+++ b/${path}`,
        "@@ -1 +1 @@",
        "-a",
        "+b",
      ].join("\n");
    // The same file twice is malformed for git, but it's the simplest way to collide.
    const result = parseUnifiedDiff(
      `${file("x.ts")}\n${file("y.ts")}\n${file("x.ts")}\n${file("x.ts")}\n`,
    );
    if (!result.ok) throw new Error(result.error.message);
    const id = hunkId("x.ts", base);
    expect(result.value.map((f) => f.hunks[0]?.id)).toEqual([
      id,
      hunkId("y.ts", base),
      `${id}-2`,
      `${id}-3`,
    ]);
  });
});
