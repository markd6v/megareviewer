import { describe, expect, it } from "vitest";
import { formatNotices, packageRootOf, parseProvenance } from "./build.ts";

describe("packageRootOf", () => {
  it.each([
    [
      "node_modules/.pnpm/hono@4.13.13/node_modules/hono/dist/index.js",
      "node_modules/.pnpm/hono@4.13.13/node_modules/hono",
    ],
    [
      "node_modules/.pnpm/@octokit+core@7.0.8/node_modules/@octokit/core/dist-src/index.js",
      "node_modules/.pnpm/@octokit+core@7.0.8/node_modules/@octokit/core",
    ],
    ["/repo/node_modules/zod/v4/index.js", "/repo/node_modules/zod"],
    ["C:\\repo\\node_modules\\zod\\index.js", "C:/repo/node_modules/zod"],
    ["src/cli/main.ts", null],
    ["\0vite/preload-helper.js", null],
  ])("%s", (file, root) => {
    expect(packageRootOf(file)).toBe(root);
  });
});

describe("parseProvenance", () => {
  it("reads every grammar row of the table that links its license text", () => {
    const markdown = `| File | Source | Version | License | SHA-256 |
|---|---|---|---|---|
| \`tree-sitter-go.wasm\` | [tree-sitter/tree-sitter-go](https://github.com/tree-sitter/tree-sitter-go/releases/tag/v0.25.0) | 0.25.0 | [MIT](licenses/tree-sitter-go.txt) | \`9504\` |
| \`web-tree-sitter.wasm\` | [web-tree-sitter](https://www.npmjs.com/package/web-tree-sitter/v/0.27.1) (the runtime) | 0.27.1 | [MIT](licenses/web-tree-sitter.txt) | \`beca\` |
| \`tree-sitter-rust.wasm\` | [tree-sitter/tree-sitter-rust](https://github.com/tree-sitter/tree-sitter-rust/releases/tag/v0.24.2) | 0.24.2 | MIT | \`24c8\` |
`;
    expect(parseProvenance(markdown)).toEqual([
      {
        file: "tree-sitter-go.wasm",
        source: "https://github.com/tree-sitter/tree-sitter-go/releases/tag/v0.25.0",
        version: "0.25.0",
        license: "MIT",
        licenseFile: "licenses/tree-sitter-go.txt",
      },
      {
        file: "web-tree-sitter.wasm",
        source: "https://www.npmjs.com/package/web-tree-sitter/v/0.27.1",
        version: "0.27.1",
        license: "MIT",
        licenseFile: "licenses/web-tree-sitter.txt",
      },
    ]);
  });
});

describe("formatNotices", () => {
  const grammar = (file: string, licenseFile: string, text: string) => ({
    file,
    source: `https://example.com/${file}`,
    version: "0.23.2",
    license: "MIT",
    licenseFile,
    text,
  });

  it("has a section per package, then the grammars with their license texts", () => {
    const text = formatNotices(
      [{ name: "zod", version: "4.6.7", license: "MIT", text: "MIT License\n\nCopyright Colin\n" }],
      [grammar("tree-sitter-go.wasm", "licenses/go.txt", "MIT License\n\nCopyright Max\n")],
    );
    expect(text).toContain("zod 4.6.7 (MIT)\n\nMIT License\n\nCopyright Colin\n");
    expect(text).toContain(
      "tree-sitter-go.wasm: 0.23.2, MIT, https://example.com/tree-sitter-go.wasm",
    );
    expect(text).toContain("tree-sitter-go.wasm (MIT)\n\nMIT License\n\nCopyright Max\n");
    expect(text.indexOf("zod")).toBeLessThan(text.indexOf("tree-sitter-go"));
  });

  it("prints a license text shared by several grammars once", () => {
    const text = formatNotices(
      [],
      [
        grammar("tree-sitter-typescript.wasm", "licenses/ts.txt", "Copyright TS"),
        grammar("tree-sitter-tsx.wasm", "licenses/ts.txt", "Copyright TS"),
      ],
    );
    expect(text).toContain(
      "tree-sitter-typescript.wasm, tree-sitter-tsx.wasm (MIT)\n\nCopyright TS\n",
    );
    expect(text.split("Copyright TS")).toHaveLength(2);
  });
});
