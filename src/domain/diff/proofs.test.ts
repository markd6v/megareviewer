import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { refactorMove, smallFeature } from "../../application/testing/index.ts";
import {
  type FileChange,
  findMechanicalProofs,
  type MechanicalProof,
  type ProofContext,
  parseUnifiedDiff,
} from "./index.ts";

const emptyContext: ProofContext = {
  gitattributes: null,
  baseContents: new Map(),
  headContents: new Map(),
};

const parse = (...diffs: string[]): FileChange[] => {
  const result = parseUnifiedDiff(diffs.join(""));
  if (!result.ok) throw new Error(`line ${result.error.line}: ${result.error.message}`);
  return result.value;
};

/** A modified file with one hunk whose header counts are derived from its lines. */
const modified = (path: string, lines: readonly string[], start = 10): string => {
  const oldCount = lines.filter((line) => !line.startsWith("+")).length;
  const newCount = lines.filter((line) => !line.startsWith("-")).length;
  return [
    `diff --git a/${path} b/${path}`,
    "index 1111111..2222222 100644",
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -${start},${oldCount} +${start},${newCount} @@`,
    ...lines,
    "",
  ].join("\n");
};

const proofsOf = (files: readonly FileChange[], context: Partial<ProofContext> = {}) =>
  findMechanicalProofs(files, { ...emptyContext, ...context });

/** The proof kind and detail per path, for files with one hunk each. */
const proofsByPath = (diff: string, context: Partial<ProofContext> = {}) =>
  Object.fromEntries(
    proofsOf(parse(diff), context).map((proof) => [proof.path, `${proof.kind}: ${proof.detail}`]),
  );

const kindsOf = (proofs: readonly MechanicalProof[]) => proofs.map((proof) => proof.kind);

const fixture = (name: string): string =>
  readFileSync(new URL(`fixtures/${name}.diff`, import.meta.url), "utf8");

const slugify = [
  "export function slugify(input: string): string {",
  "  return input",
  '    .normalize("NFKD")',
  "    .toLowerCase()",
  '    .replace(/[^a-z0-9]+/g, "-");',
  "}",
];
const prefixed = (prefix: string, lines: readonly string[]) => lines.map((line) => prefix + line);

describe("findMechanicalProofs", () => {
  it("finds nothing in a feature PR", () => {
    expect(proofsOf(parse(smallFeature.pullRequest.diff))).toEqual([]);
  });

  it("proves everything in a refactor except the reformatted file, which needs a parser", () => {
    const files = parse(refactorMove.pullRequest.diff);
    const proofs = proofsOf(files);
    expect(proofs.map(({ path, kind, detail }) => ({ path, kind, detail }))).toEqual([
      { path: "pnpm-lock.yaml", kind: "generated", detail: "lockfile (pnpm-lock.yaml)" },
      {
        path: "src/dates.ts",
        kind: "rename",
        detail: "renamed from src/helpers.ts, content unchanged",
      },
      {
        path: "src/text/format.ts",
        kind: "move",
        detail: "moved from src/utils/strings.ts:1–8, identical",
      },
      {
        path: "src/utils/strings.ts",
        kind: "move",
        detail: "moved to src/text/format.ts:1–8, identical",
      },
    ]);
    const hunkIds = files.flatMap((file) => file.hunks.map((hunk) => hunk.id));
    expect(proofs.filter((p) => p.hunkId !== null).map((p) => p.hunkId)).toEqual(
      hunkIds.filter((_, i) => i !== 1),
    );
  });

  describe("generated", () => {
    const lockfileChange = (path: string) => modified(path, ["-  ms: 2.1.2", "+  ms: 2.1.3"]);

    it.each([
      "package-lock.json",
      "npm-shrinkwrap.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "bun.lock",
      "Cargo.lock",
      "go.sum",
      "poetry.lock",
      "uv.lock",
      "Pipfile.lock",
      "Gemfile.lock",
      "composer.lock",
      "Podfile.lock",
      "packages.lock.json",
      "gradle.lockfile",
      "flake.lock",
      "mix.lock",
      "pubspec.lock",
    ])("proves lockfile %s, at any depth", (name) => {
      expect(proofsByPath(lockfileChange(`apps/web/${name}`))).toEqual({
        [`apps/web/${name}`]: `generated: lockfile (${name})`,
      });
    });

    it.each(["package-lock.json.bak", "my-yarn.lock", "Yarn.lock", "yarn.lock/notes.txt"])(
      "doesn't take %s for a lockfile",
      (path) => {
        expect(proofsByPath(lockfileChange(path))).toEqual({});
      },
    );

    it("doesn't prove code renamed to a lockfile name", () => {
      const diff = [
        "diff --git a/src/app.ts b/yarn.lock",
        "similarity index 90%",
        "rename from src/app.ts",
        "rename to yarn.lock",
        "index 1111111..2222222 100644",
        "--- a/src/app.ts",
        "+++ b/yarn.lock",
        "@@ -1 +1 @@",
        "-export const a = 1;",
        "+export const a = 2;",
        "",
      ].join("\n");
      expect(proofsByPath(diff)).toEqual({});
    });

    it("proves a renamed lockfile that is a lockfile under both names", () => {
      const diff = [
        "diff --git a/old/yarn.lock b/new/yarn.lock",
        "similarity index 90%",
        "rename from old/yarn.lock",
        "rename to new/yarn.lock",
        "index 1111111..2222222 100644",
        "--- a/old/yarn.lock",
        "+++ b/new/yarn.lock",
        "@@ -1 +1 @@",
        "-a",
        "+b",
        "",
      ].join("\n");
      expect(proofsByPath(diff)).toEqual({ "new/yarn.lock": "generated: lockfile (yarn.lock)" });
    });

    it("proves files marked in the base .gitattributes", () => {
      const diff = `${modified("gen/api.ts", ["-a()", "+b()"])}${modified("vendor/x.js", ["-a()", "+b()"])}`;
      const gitattributes = "gen/** linguist-generated\nvendor/** linguist-vendored\n";
      expect(proofsByPath(diff, { gitattributes })).toEqual({
        "gen/api.ts": "generated: .gitattributes: linguist-generated",
        "vendor/x.js": "generated: .gitattributes: linguist-vendored",
      });
    });

    it("ignores a .gitattributes edited in this PR, using the base version", () => {
      const diff = `${modified(".gitattributes", ["+src/auth.ts linguist-generated"])}${modified(
        "src/auth.ts",
        ["-  if (!user.isAdmin) throw new Forbidden();"],
      )}`;
      expect(proofsByPath(diff, { gitattributes: null })).toEqual({});
      expect(proofsByPath(diff, { gitattributes: "*.md linguist-documentation\n" })).toEqual({});
    });

    it("requires both names of a renamed file to be marked", () => {
      const diff = [
        "diff --git a/gen/api.ts b/src/api.ts",
        "similarity index 90%",
        "rename from gen/api.ts",
        "rename to src/api.ts",
        "index 1111111..2222222 100644",
        "--- a/gen/api.ts",
        "+++ b/src/api.ts",
        "@@ -1 +1 @@",
        "-a",
        "+b",
        "",
      ].join("\n");
      expect(proofsByPath(diff, { gitattributes: "gen/** linguist-generated" })).toEqual({});
      expect(proofsByPath(diff, { gitattributes: "*.ts linguist-generated" })).toEqual({
        "src/api.ts": "generated: .gitattributes: linguist-generated",
      });
    });

    describe("markers", () => {
      const diff = modified("src/schema.ts", ["-export const a = 1;", "+export const a = 2;"]);
      const contents = (base: string | null, head: string | null) => ({
        baseContents: new Map([["src/schema.ts", base]]),
        headContents: new Map([["src/schema.ts", head]]),
      });

      it.each([
        ["// @generated by schema-gen\n", "@generated"],
        ["// Code generated by protoc-gen-go. DO NOT EDIT.\n", "Code generated … DO NOT EDIT."],
        ["// <auto-generated />\n", "<auto-generated"],
        ["/*\n *\n *\n *\n * @generated\n */\n", "@generated"],
      ])("proves a file with %j in base and head", (header, name) => {
        const code = `${header}export const a = 1;\n`;
        expect(proofsByPath(diff, contents(code, code))).toEqual({
          "src/schema.ts": `generated: marker "${name}" in base and head`,
        });
      });

      it.each([
        ["only in head: added in this PR", "export const a = 1;\n", "// @generated\n"],
        ["only in base: removed in this PR", "// @generated\n", "export const a = 2;\n"],
        ["past line 5", "\n\n\n\n\n// @generated\n", "\n\n\n\n\n// @generated\n"],
        ["different markers", "// @generated\n", "// <auto-generated />\n"],
        ["a lookalike", "// @generatedBy foo\n", "// @generatedBy foo\n"],
        ["a base that doesn't exist", null, "// @generated\n"],
      ])("doesn't prove a marker %s", (_, base, head) => {
        expect(proofsByPath(diff, contents(base, head))).toEqual({});
      });

      it("doesn't prove a marker when contents weren't fetched", () => {
        expect(proofsByPath(diff)).toEqual({});
      });

      it("reads the base by the old path of a renamed file", () => {
        const renamed = [
          "diff --git a/old.ts b/new.ts",
          "similarity index 90%",
          "rename from old.ts",
          "rename to new.ts",
          "index 1111111..2222222 100644",
          "--- a/old.ts",
          "+++ b/new.ts",
          "@@ -1 +1 @@",
          "-a",
          "+b",
          "",
        ].join("\n");
        const marked = "// @generated\n";
        expect(
          proofsByPath(renamed, {
            baseContents: new Map([["old.ts", marked]]),
            headContents: new Map([["new.ts", marked]]),
          }),
        ).toEqual({ "new.ts": 'generated: marker "@generated" in base and head' });
      });
    });

    it("takes priority over a whitespace proof", () => {
      expect(proofsByPath(modified("yarn.lock", ["-a  ", "+a"]))).toEqual({
        "yarn.lock": "generated: lockfile (yarn.lock)",
      });
    });
  });

  describe("rename", () => {
    it("proves a pure rename at file level", () => {
      expect(proofsOf(parse(fixture("renamed")))).toEqual([
        {
          path: "new.txt",
          hunkId: null,
          kind: "rename",
          detail: "renamed from old.txt, content unchanged",
        },
      ]);
    });

    it("doesn't prove a renamed file that also changed", () => {
      expect(proofsOf(parse(fixture("renamed-modified")))).toEqual([]);
    });

    it("doesn't prove a renamed binary file that also changed", () => {
      const diff = [
        "diff --git a/a.png b/b.png",
        "similarity index 80%",
        "rename from a.png",
        "rename to b.png",
        "index 1111111..2222222 100644",
        "Binary files a/a.png and b/b.png differ",
        "",
      ].join("\n");
      expect(proofsOf(parse(diff))).toEqual([]);
    });

    it("doesn't prove a rename that changes the mode", () => {
      const diff = fixture("renamed").replace(
        "similarity index 100%\n",
        "old mode 100644\nnew mode 100755\nsimilarity index 100%\n",
      );
      expect(proofsOf(parse(diff))).toEqual([]);
    });
  });

  describe("whitespace", () => {
    it.each([
      ["trailing whitespace", ["-  return a;  ", "+  return a;"]],
      ["line endings", ["-  return a;\r", "+  return a;"]],
      ["blank lines", ["   return a;", "+", "+  ", " }"]],
      ["blank lines", ["-", "   return a;"]],
      ["blank lines, trailing whitespace", ["-a ", "-", "+a"]],
    ])("proves a hunk that only changes %s", (kind, lines) => {
      expect(proofsByPath(modified("src/a.ts", lines))).toEqual({
        "src/a.ts": `whitespace: whitespace only: ${kind}`,
      });
    });

    it("proves a newline added at the end of the file", () => {
      expect(proofsByPath(fixture("no-newline-old"))).toEqual({
        "tail.txt": "whitespace: whitespace only: newline at end of file",
      });
    });

    it("proves a CRLF line changed to LF", () => {
      expect(proofsByPath(fixture("crlf"))).toEqual({
        "windows.txt": "whitespace: whitespace only: line endings",
      });
    });

    it.each([
      [
        "trailing whitespace plus a changed character in a string",
        ['-  log("ready.")  ', '+  log("ready!")'],
      ],
      ["re-indentation", ["-  return a", "+    return a"]],
      ["a line moved past a context line", ["-x = 1", " y = x", "+x = 1"]],
      ["two lines swapped", ["-a", "-b", "+b", "+a"]],
      ["a deleted line", ["-a", " b"]],
      ["one whitespace block and one real change", ["-a ", "+a", " b", "-c", "+d"]],
      ["inner whitespace", ["-a = 1", "+a  = 1"]],
      ["a non-breaking space", ["-a ", "+a"]],
    ])("doesn't prove %s", (_, lines) => {
      expect(proofsByPath(modified("src/a.py", lines))).toEqual({});
    });

    it("doesn't prove a re-indented Python file (the parser decides)", () => {
      const lines = [
        "-def f(x):",
        "-  if x:",
        "-    return 1",
        "-  return 0",
        "+def f(x):",
        "+    if x:",
        "+        return 1",
        "+    return 0",
      ];
      expect(proofsByPath(modified("app/f.py", lines))).toEqual({});
    });
  });

  describe("move", () => {
    it("proves a function moved between two files", () => {
      const diff = `${modified("src/a.ts", prefixed("-", slugify), 3)}${modified(
        "src/b.ts",
        prefixed("+", slugify),
        40,
      )}`;
      expect(proofsByPath(diff)).toEqual({
        "src/a.ts": "move: moved to src/b.ts:40–45, identical",
        "src/b.ts": "move: moved from src/a.ts:3–8, identical",
      });
    });

    it("proves a move whatever the file order", () => {
      const diff = `${modified("src/a.ts", prefixed("+", slugify))}${modified(
        "src/b.ts",
        prefixed("-", slugify),
      )}`;
      expect(kindsOf(proofsOf(parse(diff)))).toEqual(["move", "move"]);
    });

    it("proves a move between hunks of one file", () => {
      const diff = [
        "diff --git a/src/a.ts b/src/a.ts",
        "index 1111111..2222222 100644",
        "--- a/src/a.ts",
        "+++ b/src/a.ts",
        "@@ -1,6 +0,0 @@",
        ...prefixed("-", slugify),
        "@@ -50,0 +44,6 @@",
        ...prefixed("+", slugify),
        "",
      ].join("\n");
      expect(kindsOf(proofsOf(parse(diff)))).toEqual(["move", "move"]);
    });

    it("names the old path of a renamed file that code moved out of", () => {
      const diff = [
        "diff --git a/src/old.ts b/src/new.ts",
        "similarity index 80%",
        "rename from src/old.ts",
        "rename to src/new.ts",
        "index 1111111..2222222 100644",
        "--- a/src/old.ts",
        "+++ b/src/new.ts",
        "@@ -20,6 +19,0 @@",
        ...prefixed("-", slugify),
        modified("src/b.ts", prefixed("+", slugify)),
      ].join("\n");
      expect(proofsByPath(diff)).toEqual({
        "src/new.ts": "move: moved to src/b.ts:10–15, identical",
        "src/b.ts": "move: moved from src/old.ts:20–25, identical",
      });
    });

    it("proves a block re-indented in an indentation-insensitive language", () => {
      const diff = `${modified("src/a.ts", prefixed("-", slugify))}${modified(
        "src/b.ts",
        prefixed("+  ", slugify),
      )}`;
      expect(proofsByPath(diff)["src/b.ts"]).toBe(
        "move: moved from src/a.ts:10–15, identical apart from indentation",
      );
    });

    it("ignores trailing whitespace and blank lines", () => {
      const from = ["-def f(x):", "-", "-    y = x + 1", "-    return y", "-"];
      const to = ["+def f(x):  ", "+    y = x + 1", "+", "+    return y\r"];
      expect(kindsOf(proofsOf(parse(`${modified("a.py", from)}${modified("b.py", to)}`)))).toEqual([
        "move",
        "move",
      ]);
    });

    it("proves a hunk whose lines moved to several places", () => {
      const first = ["-const a = 1;", "-const b = 2;", "-const c = 3;"];
      const second = ["-const x = 1;", "-const y = 2;", "-const z = 3;"];
      const diff = [
        modified("src/a.ts", [...first, ...second]),
        modified(
          "src/b.ts",
          prefixed(
            "+",
            first.map((l) => l.slice(1)),
          ),
        ),
        modified(
          "src/c.ts",
          prefixed(
            "+",
            second.map((l) => l.slice(1)),
          ),
        ),
      ].join("");
      expect(proofsByPath(diff)["src/a.ts"]).toBe(
        "move: moved to src/b.ts:10–12, identical; moved to src/c.ts:10–12, identical",
      );
    });

    it.each([
      ["one character changed", slugify.map((line) => line.replace("NFKD", "NFKC"))],
      ["one extra line inserted", [...slugify.slice(0, 3), "    .trim()", ...slugify.slice(3)]],
    ])("doesn't prove a moved block with %s", (_, added) => {
      const diff = `${modified("src/a.ts", prefixed("-", slugify))}${modified("src/b.ts", prefixed("+", added))}`;
      expect(proofsByPath(diff)).toEqual({});
    });

    it("proves only the unchanged side when an extra line is inserted in a longer block", () => {
      const block = [
        "const a = 1;",
        "const b = 2;",
        "const c = 3;",
        "const d = 4;",
        "const e = 5;",
      ];
      const added = [...block.slice(0, 3), "sendToAttacker(a);", ...block.slice(3), "const f = 6;"];
      const diff = `${modified("src/a.ts", prefixed("-", [...block, "const f = 6;"]))}${modified(
        "src/b.ts",
        prefixed("+", added),
      )}`;
      expect(proofsByPath(diff)).toEqual({
        "src/a.ts": "move: moved to src/b.ts:10–12, identical; moved to src/b.ts:14–16, identical",
      });
    });

    it.each([
      ["2 lines", ["const a = 1;", "const b = 2;"]],
      ["only closing brackets", ["    }", "  }", "}", "});"]],
      ["2 lines among brackets", ["}", "const a = 1;", "}", "const b = 2;", "}"]],
    ])("doesn't prove a moved block of %s", (_, lines) => {
      const diff = `${modified("src/a.ts", prefixed("-", lines))}${modified("src/b.ts", prefixed("+", lines))}`;
      expect(proofsByPath(diff)).toEqual({});
    });

    it("doesn't prove a re-indented move in a whitespace-sensitive language", () => {
      const lines = ["def f(x):", "    y = x + 1", "    return y"];
      const diff = `${modified("a.py", prefixed("-", lines))}${modified("b.py", prefixed("+    ", lines))}`;
      expect(proofsByPath(diff)).toEqual({});
    });

    it("doesn't prove a re-indented move between languages if either is sensitive", () => {
      const diff = `${modified("a.ts", prefixed("-", slugify))}${modified("b.md", prefixed("+  ", slugify))}`;
      expect(proofsByPath(diff)).toEqual({});
    });

    it("doesn't prove lines reordered within one hunk", () => {
      expect(
        proofsByPath(
          modified("src/a.ts", [...prefixed("-", slugify), " ctx", ...prefixed("+", slugify)]),
        ),
      ).toEqual({});
    });

    it("matches each region once", () => {
      const diff = [
        modified("src/a.ts", prefixed("-", slugify)),
        modified("src/b.ts", prefixed("-", slugify)),
        modified("src/c.ts", prefixed("+", slugify)),
      ].join("");
      expect(Object.keys(proofsByPath(diff))).toEqual(["src/a.ts", "src/c.ts"]);
    });

    it("doesn't prove a hunk with any changed line outside a moved region", () => {
      const diff = `${modified("src/a.ts", [...prefixed("-", slugify), "+slugify.cache = true;"])}${modified(
        "src/b.ts",
        prefixed("+", slugify),
      )}`;
      expect(Object.keys(proofsByPath(diff))).toEqual(["src/b.ts"]);
    });

    it("doesn't move code into or out of a generated file", () => {
      const diff = `${modified("src/a.ts", prefixed("-", slugify))}${modified(
        "gen/b.ts",
        prefixed("+", slugify),
      )}`;
      expect(proofsByPath(diff, { gitattributes: "gen/** linguist-generated" })).toEqual({
        "gen/b.ts": "generated: .gitattributes: linguist-generated",
      });
    });

    it("doesn't prove a hunk of blank lines as a move", () => {
      expect(kindsOf(proofsOf(parse(modified("src/a.ts", ["+", "+"]))))).toEqual(["whitespace"]);
    });
  });

  it("proves nothing in a file whose mode changed", () => {
    const diff = modified("yarn.lock", ["-a", "+b"]).replace(
      "index 1111111..2222222 100644",
      "old mode 100644\nnew mode 100755\nindex 1111111..2222222",
    );
    expect(proofsOf(parse(diff))).toEqual([]);
    expect(proofsOf(parse(fixture("mode-only")))).toEqual([]);
  });

  it("proves nothing in binary, added-empty or copied files", () => {
    const diff = ["binary", "empty-file-added", "copied"].map(fixture).join("");
    expect(proofsOf(parse(diff))).toEqual([]);
  });

  it("handles a 2,000-line hunk", () => {
    expect(proofsOf(parse(fixture("large-hunk")))).toEqual([]);
  });
});
