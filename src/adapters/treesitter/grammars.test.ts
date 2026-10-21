import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { LANGUAGES } from "./languages.ts";

const grammars = new URL("grammars/", import.meta.url);
const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const filesIn = (url: URL, extension: string): string[] =>
  readdirSync(url)
    .filter((name) => name.endsWith(extension))
    .sort();

/** File name to SHA-256, from the table in PROVENANCE.md. */
const provenance = new Map(
  [
    ...readFileSync(new URL("PROVENANCE.md", grammars), "utf8").matchAll(
      /^\| `([^`]+\.wasm)` \|.*\| `([0-9a-f]{64})` \|$/gm,
    ),
  ].map(([, file = "", hash = ""]) => [file, hash]),
);

describe("grammars", () => {
  it("lists every .wasm file in PROVENANCE.md with its SHA-256", () => {
    const actual = filesIn(grammars, ".wasm").map((file) => [
      file,
      sha256(readFileSync(new URL(file, grammars))),
    ]);
    expect(actual).toEqual([...provenance].sort(([a = ""], [b = ""]) => a.localeCompare(b)));
  });

  it("has the runtime of the installed web-tree-sitter", () => {
    const installed = createRequire(import.meta.url).resolve(
      "web-tree-sitter/web-tree-sitter.wasm",
    );
    expect(sha256(readFileSync(new URL("web-tree-sitter.wasm", grammars)))).toBe(
      sha256(readFileSync(installed)),
    );
  });

  it("has a grammar for every language and only those", () => {
    expect(filesIn(grammars, ".wasm")).toEqual(
      [...LANGUAGES.map((spec) => `tree-sitter-${spec.name}.wasm`), "web-tree-sitter.wasm"].sort(),
    );
  });

  it("uses every query file", () => {
    expect(filesIn(new URL("queries/", grammars), ".scm")).toEqual(
      [...new Set(LANGUAGES.flatMap((spec) => spec.queries))].map((name) => `${name}.scm`).sort(),
    );
  });
});
