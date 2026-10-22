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
  it("reads every grammar row of the table", () => {
    const markdown = `| File | Source | Version | License | SHA-256 |
|---|---|---|---|---|
| \`tree-sitter-go.wasm\` | [tree-sitter/tree-sitter-go](https://github.com/tree-sitter/tree-sitter-go/releases/tag/v0.25.0) | 0.25.0 | MIT | \`9504\` |
| \`web-tree-sitter.wasm\` | [web-tree-sitter](https://www.npmjs.com/package/web-tree-sitter/v/0.27.1) (the runtime) | 0.27.1 | MIT | \`beca\` |
`;
    expect(parseProvenance(markdown)).toEqual([
      {
        file: "tree-sitter-go.wasm",
        source: "https://github.com/tree-sitter/tree-sitter-go/releases/tag/v0.25.0",
        version: "0.25.0",
        license: "MIT",
      },
      {
        file: "web-tree-sitter.wasm",
        source: "https://www.npmjs.com/package/web-tree-sitter/v/0.27.1",
        version: "0.27.1",
        license: "MIT",
      },
    ]);
  });
});

describe("formatNotices", () => {
  it("has a section per package, then the grammars", () => {
    const text = formatNotices(
      [{ name: "zod", version: "4.6.7", license: "MIT", text: "MIT License\n\nCopyright Colin\n" }],
      [
        {
          file: "tree-sitter-go.wasm",
          source: "https://example.com/go",
          version: "0.25.0",
          license: "MIT",
        },
      ],
    );
    expect(text).toContain("zod 4.6.7 (MIT)\n\nMIT License\n\nCopyright Colin\n");
    expect(text).toContain("tree-sitter-go.wasm: 0.25.0, MIT, https://example.com/go");
    expect(text.indexOf("zod")).toBeLessThan(text.indexOf("tree-sitter-go"));
  });
});
