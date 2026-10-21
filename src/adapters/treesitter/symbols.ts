import type { Node, Query, Tree } from "web-tree-sitter";
import type { SymbolDefinition, SymbolReference } from "../../application/ports/index.ts";

const KINDS: ReadonlySet<string> = new Set(["function", "method", "class", "type", "variable"]);

const isKind = (kind: string): kind is SymbolDefinition["kind"] => KINDS.has(kind);

const startLine = (node: Node): number => node.startPosition.row + 1;

// A node that ends at column 0 ends with a newline, which isn't on the next line.
const endLine = (node: Node): number => {
  const { row, column } = node.endPosition;
  return column === 0 && row > node.startPosition.row ? row : row + 1;
};

/**
 * Definitions and references found by a symbols query. A definition pattern captures the whole
 * definition as `@definition.<kind>` and its name as `@name`; a reference pattern captures the
 * referencing identifier as `@reference`. When patterns overlap, the first in the query wins.
 */
export const findSymbols = (
  tree: Tree,
  query: Query,
): { definitions: SymbolDefinition[]; references: SymbolReference[] } => {
  const definitions = new Map<number, { patternIndex: number; definition: SymbolDefinition }>();
  const references: { position: number; reference: SymbolReference }[] = [];

  for (const match of query.matches(tree.rootNode)) {
    const name = match.captures.find((capture) => capture.name === "name")?.node;
    const whole = match.captures.find((capture) => capture.name.startsWith("definition."));
    const reference = match.captures.find((capture) => capture.name === "reference")?.node;
    if (name !== undefined && whole !== undefined) {
      const kind = whole.name.slice("definition.".length);
      if (!isKind(kind)) throw new Error(`unknown definition kind in query: ${whole.name}`);
      const existing = definitions.get(name.startIndex);
      if (existing !== undefined && existing.patternIndex < match.patternIndex) continue;
      definitions.set(name.startIndex, {
        patternIndex: match.patternIndex,
        definition: {
          name: name.text,
          kind,
          startLine: startLine(whole.node),
          endLine: endLine(whole.node),
        },
      });
    } else if (reference !== undefined) {
      references.push({
        position: reference.startIndex,
        reference: { name: reference.text, line: startLine(reference) },
      });
    } else {
      throw new Error(
        `query pattern ${match.patternIndex} captures neither a definition nor a reference`,
      );
    }
  }

  const unique = new Map<string, SymbolReference>();
  for (const { position, reference } of references) {
    // A type's name is a type identifier too; it doesn't reference itself.
    if (definitions.has(position)) continue;
    unique.set(`${reference.line}:${reference.name}`, reference);
  }
  return {
    definitions: [...definitions.values()]
      .map(({ definition }) => definition)
      .sort((a, b) => a.startLine - b.startLine || compare(a.name, b.name)),
    references: [...unique.values()].sort((a, b) => a.line - b.line || compare(a.name, b.name)),
  };
};

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
