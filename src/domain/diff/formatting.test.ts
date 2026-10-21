import { describe, expect, it } from "vitest";
import { hunk } from "../../application/testing/index.ts";
import { type FileChange, findFormattingProofs } from "./index.ts";

const nodes = (...leaves: string[]) => [
  { type: "program", text: "" },
  ...leaves.map((text) => ({ type: "identifier", text })),
];

const file = (overrides: Partial<FileChange> = {}): FileChange => ({
  path: "src/a.ts",
  oldPath: null,
  status: "modified",
  binary: false,
  oldMode: null,
  newMode: null,
  language: "typescript",
  hunks: [
    hunk("src/a.ts", "@@ -1 +1 @@", ["-a  b", "+a b"]),
    hunk("src/a.ts", "@@ -9 +9 @@", ["-  c", "+c"]),
  ],
  additions: 2,
  deletions: 2,
  ...overrides,
});

const same = new Map([["src/a.ts", { base: nodes("a", "b", "c"), head: nodes("a", "b", "c") }]]);

describe("findFormattingProofs", () => {
  it("proves every hunk of a file whose syntax tree is unchanged", () => {
    const changed = file();
    expect(findFormattingProofs([changed], same)).toEqual(
      changed.hunks.map((h) => ({
        path: "src/a.ts",
        hunkId: h.id,
        kind: "formatting",
        detail: "formatting only: syntax tree unchanged",
      })),
    );
  });

  it("proves a renamed file with hunks, keyed by its new path", () => {
    const renamed = file({ status: "renamed", oldPath: "src/old.ts" });
    expect(findFormattingProofs([renamed], same)).toHaveLength(2);
  });

  it.each([
    ["a leaf's text differs", nodes("a", "b", "c"), nodes("a", "b", "d")],
    [
      "a node's type differs",
      nodes("a"),
      [
        { type: "program", text: "" },
        { type: "x", text: "a" },
      ],
    ],
    ["the head has an extra node", nodes("a", "b"), nodes("a", "b", "c")],
    ["the base has an extra node", nodes("a", "b", "c"), nodes("a", "b")],
    ["nothing was parsed", [], []],
  ])("proves nothing when %s", (_, base, head) => {
    expect(findFormattingProofs([file()], new Map([["src/a.ts", { base, head }]]))).toEqual([]);
  });

  it.each([
    ["added", file({ status: "added" })],
    ["deleted", file({ status: "deleted" })],
    ["binary", file({ binary: true })],
    ["with a mode change", file({ oldMode: "100644", newMode: "100755" })],
    ["renamed without hunks", file({ status: "renamed", oldPath: "src/old.ts", hunks: [] })],
  ])("proves nothing for a file %s", (_, changed) => {
    expect(findFormattingProofs([changed], same)).toEqual([]);
  });

  it("proves nothing for a file without nodes", () => {
    expect(findFormattingProofs([file({ path: "src/b.ts" })], same)).toEqual([]);
  });
});
