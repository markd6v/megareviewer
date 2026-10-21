import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { CodeParser } from "../../application/ports/index.ts";
import { hunk, refactorMove } from "../../application/testing/index.ts";
import {
  type FileChange,
  findFormattingProofs,
  parseUnifiedDiff,
} from "../../domain/diff/index.ts";
import { createTreeSitterCodeParser } from "./index.ts";

// The real parser feeding the domain's formatting proofs, as the pipeline will use them. A false
// "formatting only" hides code from the reviewer, so most cases here must NOT be proved.

let parser: CodeParser;
beforeAll(async () => {
  parser = await createTreeSitterCodeParser({
    grammarsDir: fileURLToPath(new URL("grammars", import.meta.url)),
  });
});

const changedFile = (path: string): FileChange => ({
  path,
  oldPath: null,
  status: "modified",
  binary: false,
  oldMode: null,
  newMode: null,
  language: null,
  hunks: [hunk(path, "@@ -1 +1 @@", ["-before", "+after"])],
  additions: 1,
  deletions: 1,
});

/** Whether the change from base to head is proved formatting-only. Parser errors prove nothing. */
const proves = async (language: string, base: string, head: string): Promise<boolean> => {
  const [baseNodes, headNodes] = await Promise.all([
    parser.syntaxNodes(base, language),
    parser.syntaxNodes(head, language),
  ]);
  const nodes =
    baseNodes.ok && headNodes.ok
      ? new Map([["file", { base: baseNodes.value, head: headNodes.value }]])
      : new Map();
  return findFormattingProofs([changedFile("file")], nodes).length > 0;
};

describe("formatting proofs: not proved", () => {
  it.each([
    [
      "a Python statement dedented out of an if",
      "python",
      "if ready:\n    start()\n    log()\n",
      "if ready:\n    start()\nlog()\n",
    ],
    [
      "a nested Python block dedented one level",
      "python",
      "for x in xs:\n    if x:\n        a()\n        b()\n",
      "for x in xs:\n    if x:\n        a()\n    b()\n",
    ],
    ["a comment's text changed", "typescript", "// retry once\nf();\n", "// retry twice\nf();\n"],
    [
      "whitespace inside a block comment",
      "go",
      "package p\n/* a b */\n",
      "package p\n/* a  b */\n",
    ],
    ["JavaScript semicolons added", "javascript", "a()\nb()\n", "a();\nb();\n"],
    ["a base with a syntax error", "typescript", "const a = (;\n", "const a = ();\n"],
    ["a head with a syntax error", "typescript", "const a = 1;\n", "const a = (;\n"],
    [
      "a reformat plus a renamed variable",
      "typescript",
      "const total = 1;\nexport { total };\n",
      "const sum = 1;\n\nexport {\n  sum,\n};\n",
    ],
    [
      "Go: a newline that ends a statement",
      "go",
      "package p\nvar a = b\n-c\n",
      "package p\nvar a = b - c\n",
    ],
    ["JSX: whitespace between words", "tsx", "const a = <p>a b</p>;\n", "const a = <p>a  b</p>;\n"],
    ["JSX: whitespace-only text", "javascript", "const a = <p> </p>;\n", "const a = <p>  </p>;\n"],
    [
      "Go: a space character literal became a tab",
      "go",
      "package p\nvar a = ' '\n",
      "package p\nvar a = '\t'\n",
    ],
    [
      "Java: a space character literal became a tab",
      "java",
      "class A { char a = ' '; }",
      "class A { char a = '\t'; }",
    ],
    [
      "Rust: a space character literal became a tab",
      "rust",
      "const A: char = ' ';",
      "const A: char = '\t';",
    ],
    [
      "C#: a space character literal became a tab",
      "c_sharp",
      "class A { char a = ' '; }",
      "class A { char a = '\t'; }",
    ],
    ["a BOM added", "typescript", "f();\n", "\uFEFFf();\n"],
    ["a non-breaking space between tokens", "javascript", "const a = 1;\n", "const\u00A0a = 1;\n"],
  ])("%s", async (_, language, base, head) => {
    expect(await proves(language, base, head)).toBe(false);
  });

  // Whitespace inside every kind of literal that can hold it, at the start, middle and end, since a
  // grammar can leave part of a literal outside any node.
  const literals: [language: string, wrap: (content: string) => string][] = [
    ["typescript", (s) => `const a = "${s}";`],
    ["typescript", (s) => `const a = '${s}';`],
    ["typescript", (s) => `const a = \`${s}\`;`],
    ["typescript", (s) => `const a = \`\${x}${s}\${y}\`;`],
    ["typescript", (s) => `const a = /${s}x/;`],
    ["tsx", (s) => `const a = <p title="${s}" />;`],
    ["javascript", (s) => `const a = "${s}";`],
    ["javascript", (s) => `const a = \`${s}\`;`],
    ["javascript", (s) => `const a = /x${s}/u;`],
    ["javascript", (s) => `const a = <p>x${s}</p>;`],
    ["python", (s) => `a = "${s}"`],
    ["python", (s) => `a = '''${s}'''`],
    ["python", (s) => `a = r"${s}"`],
    ["python", (s) => `a = b"${s}"`],
    ["python", (s) => `a = f"{x}${s}{y}"`],
    ["python", (s) => `a = f"""${s}"""`],
    ["go", (s) => `package p\nvar a = "${s}"`],
    ["go", (s) => `package p\nvar a = \`${s}\``],
    ["java", (s) => `class A { String a = "${s}"; }`],
    ["java", (s) => `class A { String a = """\n${s}x${s}"""; }`],
    ["rust", (s) => `const A: &str = "${s}";`],
    ["rust", (s) => `const A: &str = r"${s}";`],
    ["rust", (s) => `const A: &str = r#"${s}"#;`],
    ["rust", (s) => `const A: &[u8] = b"${s}";`],
    ["c_sharp", (s) => `class A { string a = "${s}"; }`],
    ["c_sharp", (s) => `class A { string a = @"${s}"; }`],
    ["c_sharp", (s) => `class A { string a = $"{x}${s}{y}"; }`],
    ["c_sharp", (s) => `class A { string a = """${s}x${s}"""; }`],
  ];
  const variants = [
    [" ", "  "],
    [" a", "  a"],
    ["a ", "a  "],
    ["a b", "a  b"],
    ["a b", "a\tb"],
  ];
  it.each(
    literals.flatMap(([language, wrap]) =>
      variants.map(([before = "", after = ""]) => [language, wrap(before), wrap(after)]),
    ),
  )("%s: %j to %j", async (language, base, head) => {
    expect(await proves(language, base, head)).toBe(false);
  });
});

describe("formatting proofs: proved", () => {
  it.each([
    [
      "re-indented TypeScript",
      "typescript",
      "export function f(a: number) {\n    if (a > 1) {\n        return a;\n    }\n    return 0;\n}\n",
      "export function f(a: number) {\n  if (a > 1) {\n    return a;\n  }\n  return 0;\n}\n",
    ],
    [
      "reflowed Go",
      "go",
      "package p\n\nfunc f(a int, b int) int { return a +\n\tb }\n",
      "package p\n\nfunc f(a int, b int) int {\n\treturn a +\n\t\tb\n}\n",
    ],
    [
      "re-wrapped Java arguments",
      "java",
      'class A { void f() { log.info("a", first, second, third); } }\n',
      'class A {\n  void f() {\n    log.info(\n        "a",\n        first,\n        second,\n        third);\n  }\n}\n',
    ],
    [
      "Python with only trailing whitespace and blank-line changes",
      "python",
      "def f():   \n    return 1\n\n\n\nx = f()\n",
      "def f():\n    return 1\n\n\nx = f()   \n",
    ],
    ["Rust with spacing changes", "rust", "fn f()->u8{1}\n", "fn f() -> u8 {\n    1\n}\n"],
    [
      "C# with brace placement changed",
      "c_sharp",
      "class A { void F() { G(); } }\n",
      "class A\n{\n    void F()\n    {\n        G();\n    }\n}\n",
    ],
    [
      "JSX attributes wrapped",
      "tsx",
      'const a = <p a="1" b="2" />;\n',
      'const a = <p\n  a="1"\n  b="2"\n/>;\n',
    ],
    ["CRLF line endings", "javascript", "a();\nb();\n", "a();\r\nb();\r\n"],
  ])("%s", async (_, language, base, head) => {
    expect(await proves(language, base, head)).toBe(true);
  });

  it("proves the reformatted file in the refactor-move fixture", async () => {
    const parsed = parseUnifiedDiff(refactorMove.pullRequest.diff);
    if (!parsed.ok) throw new Error(parsed.error.message);
    const path = "src/config.ts";
    const [base, head] = await Promise.all(
      [refactorMove.baseFiles[path], refactorMove.headFiles[path]].map((source = "") =>
        parser.syntaxNodes(source, "typescript"),
      ),
    );
    if (!base?.ok || !head?.ok) throw new Error("config.ts should parse");
    const proofs = findFormattingProofs(
      parsed.value,
      new Map([[path, { base: base.value, head: head.value }]]),
    );
    const config = parsed.value.find((file) => file.path === path);
    expect(proofs.map((proof) => proof.hunkId)).toEqual(config?.hunks.map((h) => h.id));
  });
});
