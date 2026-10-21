import { err, ok, type Result } from "../../domain/shared/index.ts";
import type {
  CodeParser,
  CodeParserError,
  SymbolDefinition,
  SymbolReference,
  Token,
} from "../ports/index.ts";

export type CodeParserMethod = "syntaxNodes" | "symbols";

const LANGUAGES: Readonly<Record<string, string>> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  py: "python",
};

const TOKEN = /[A-Za-z_$][\w$]*|\d+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\S/g;
const IDENTIFIER = /[A-Za-z_$][\w$]*/g;
const DEFINITION =
  /^(?:export\s+)?(?:async\s+)?(function|class|interface|type|const|let|def)\s+([A-Za-z_$][\w$]*)/;
const KINDS: Readonly<Record<string, SymbolDefinition["kind"]>> = {
  function: "function",
  def: "function",
  class: "class",
  interface: "type",
  type: "type",
  const: "variable",
  let: "variable",
};

/**
 * A stand-in for tree-sitter that's good enough for pipeline tests. Syntax nodes are the
 * source's tokens, so reformatting keeps them equal and any other change doesn't. A definition
 * starts at an unindented `function`, `class`, `const`… line and runs until the next one;
 * every other identifier is a reference.
 */
export class FakeCodeParser implements CodeParser {
  /** Sources passed to each method, in call order. */
  readonly calls: { readonly method: CodeParserMethod; readonly source: string }[] = [];
  private readonly failing = new Set<CodeParserMethod>();

  /** Every call to `method` fails with a parse error until this is called with false. */
  failAlways(method: CodeParserMethod, failing = true): void {
    if (failing) this.failing.add(method);
    else this.failing.delete(method);
  }

  languageFor(path: string): string | null {
    const extension = path.includes(".") ? path.slice(path.lastIndexOf(".") + 1) : "";
    return LANGUAGES[extension.toLowerCase()] ?? null;
  }

  async syntaxNodes(source: string, language: string): Promise<Result<Token[], CodeParserError>> {
    const failure = this.fail("syntaxNodes", source, language);
    if (failure !== null) return failure;
    return ok([...source.matchAll(TOKEN)].map((match) => ({ type: "token", text: match[0] })));
  }

  async symbols(
    source: string,
    language: string,
  ): Promise<
    Result<{ definitions: SymbolDefinition[]; references: SymbolReference[] }, CodeParserError>
  > {
    const failure = this.fail("symbols", source, language);
    if (failure !== null) return failure;
    const lines = source.split("\n");
    const starts = lines.flatMap((text, index) => {
      const match = DEFINITION.exec(text);
      const [, keyword = "", name = ""] = match ?? [];
      return match === null ? [] : [{ name, kind: KINDS[keyword] ?? "variable", line: index + 1 }];
    });
    const definitions = starts.map(
      ({ name, kind, line }, index): SymbolDefinition => ({
        name,
        kind,
        startLine: line,
        endLine: (starts[index + 1]?.line ?? lines.length + 1) - 1,
      }),
    );
    const defined = new Map(starts.map(({ name, line }) => [line, name]));
    const references = lines.flatMap((text, index): SymbolReference[] =>
      [...text.matchAll(IDENTIFIER)]
        .map((match) => match[0])
        .filter((name) => name !== defined.get(index + 1) && !(name in KINDS))
        .map((name) => ({ name, line: index + 1 })),
    );
    return ok({ definitions, references });
  }

  private fail(
    method: CodeParserMethod,
    source: string,
    language: string,
  ): Result<never, CodeParserError> | null {
    this.calls.push({ method, source });
    if (!Object.values(LANGUAGES).includes(language)) {
      return err({ kind: "unsupported-language", message: `${language} isn't supported` });
    }
    return this.failing.has(method)
      ? err({ kind: "parse-error", message: "scripted parse error" })
      : null;
  }
}
