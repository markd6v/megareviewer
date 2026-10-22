import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { LANGUAGES } from "./languages.ts";

const grammars = new URL("grammars/", import.meta.url);
const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const filesIn = (url: URL, extension: string): string[] =>
  readdirSync(url)
    .filter((name) => name.endsWith(extension))
    .sort();

const provenanceTable = readFileSync(new URL("PROVENANCE.md", grammars), "utf8");
/** File name to SHA-256, from the table in PROVENANCE.md. */
const provenance = new Map(
  [...provenanceTable.matchAll(/^\| `([^`]+\.wasm)` \|.*\| `([0-9a-f]{64})` \|$/gm)].map(
    ([, file = "", hash = ""]) => [file, hash],
  ),
);
/** File name to the license text it links, from the same table. */
const licenses = new Map(
  [
    ...provenanceTable.matchAll(
      /^\| `([^`]+\.wasm)` \|.*\| \[[^\]]+\]\((licenses\/[^)]+)\) \| `[0-9a-f]{64}` \|$/gm,
    ),
  ].map(([, file = "", license = ""]) => [file, license]),
);

describe("grammars", () => {
  it("lists every .wasm file in PROVENANCE.md with its SHA-256", () => {
    const actual = filesIn(grammars, ".wasm").map((file) => [
      file,
      sha256(readFileSync(new URL(file, grammars))),
    ]);
    expect(actual).toEqual([...provenance].sort(([a = ""], [b = ""]) => a.localeCompare(b)));
  });

  it("links a license text in licenses/ for every .wasm file, and uses every one", () => {
    expect([...licenses.keys()].sort()).toEqual(filesIn(grammars, ".wasm"));
    expect([...new Set(licenses.values())].sort()).toEqual(
      filesIn(new URL("licenses/", grammars), ".txt").map((file) => `licenses/${file}`),
    );
  });

  it("has the runtime and license text of the installed web-tree-sitter", () => {
    const require = createRequire(import.meta.url);
    const installed = require.resolve("web-tree-sitter/web-tree-sitter.wasm");
    expect(sha256(readFileSync(new URL("web-tree-sitter.wasm", grammars)))).toBe(
      sha256(readFileSync(installed)),
    );
    expect(readFileSync(new URL("licenses/web-tree-sitter.txt", grammars), "utf8")).toBe(
      readFileSync(new URL("LICENSE", pathToFileURL(installed)), "utf8"),
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
