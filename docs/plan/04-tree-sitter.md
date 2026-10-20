# Stage 04: tree-sitter: formatting proofs and call-graph hints

**Status:** Not started
**Depends on:** 02
**Unblocks:** 12 (and gives stage 10 a real `CodeParser`; stage 10 can use the fake until then)
**Owns:** `src/adapters/treesitter/`, `src/domain/diff/formatting.ts`, `src/domain/diff/call-graph.ts`

## Goal

A `CodeParser` built on tree-sitter's WASM build, plus two pure domain functions that use its output:

- **Formatting proofs:** a file whose syntax tree is unchanged is formatting-only.
- **Call-graph hints:** which changed hunks reference symbols defined in other changed hunks, so the tour can follow the code.

## Read first

- [ARCHITECTURE.md](../../ARCHITECTURE.md) "2. Deterministic prep"
- [ENGINEERING.md](../../ENGINEERING.md) §6 "Fail safe toward the reviewer", §8 (dependencies)
- Stage 02's `CodeParser` port and `MechanicalProof`, `CallGraphHint` types
- Stage 03 doc, for how proofs combine

## Scope

**In:** grammar sourcing, the `CodeParser` adapter, language mapping, formatting proofs, call-graph hints.
**Out:** calling these from the pipeline (stage 10); bundling grammar files into `dist` (stage 12 copies the folder this stage defines).

## Languages for the first slice

| Language | Extensions |
|---|---|
| TypeScript | `.ts`, `.mts`, `.cts` |
| TSX | `.tsx` |
| JavaScript | `.js`, `.mjs`, `.cjs`, `.jsx` |
| Python | `.py`, `.pyi` |
| Go | `.go` |
| Java | `.java` |
| Rust | `.rs` |
| C# | `.cs` |

Anything else: `languageFor` returns `null`, and the file simply gets no formatting proof or hints.

## Tasks

### 1. Grammar sourcing

Grammar `.wasm` files must be ABI-compatible with the pinned `web-tree-sitter` version, MIT/Apache licensed, and must not bring install scripts (ENGINEERING.md §8). Choose one:

- **A.** An npm package that ships prebuilt `.wasm` grammars, if one exists that is maintained and matches the ABI.
- **B.** Build the `.wasm` files once with the tree-sitter CLI from pinned grammar releases, and commit them to `src/adapters/treesitter/grammars/`.

Either way, write `src/adapters/treesitter/grammars/PROVENANCE.md` listing each grammar's source repo, version, license and the SHA-256 of its `.wasm`, plus the command that rebuilds or refreshes them. Record the choice in **Notes for later stages**.

### 2. `CodeParser` adapter: `tree-sitter-code-parser.ts`

```ts
createTreeSitterCodeParser(options: { grammarsDir: string; maxFileBytes?: number /* default 1_000_000 */ }): Promise<CodeParser>
```

- Initializes `web-tree-sitter` once, pointing it at the runtime `.wasm` in `grammarsDir`.
- Loads each language's grammar lazily on first use and caches it.
- `languageFor(path)`: the extension table above.
- `syntaxNodes(source, language)`: see task 3.
- `symbols(source, language)`: see task 4.
- Files larger than `maxFileBytes` return an `unsupported-language`-style error with message `file too large to parse`. The caller treats any error as "no proof, no hints".
- Free tree-sitter trees after use (WASM memory isn't garbage-collected).

### 3. Syntax nodes and formatting proofs

Comparing only leaf tokens is **not safe**: in Python, dedenting a statement out of an `if` keeps every leaf the same but changes meaning, because tree-sitter-python encodes indentation in tree structure. So compare the whole tree.

That's why stage 02's port has `syntaxNodes(source, language)`: a pre-order list of every node, named and anonymous, with source text on leaves only and no positions.

- If the tree contains any `ERROR` or `MISSING` node, return `parse-error`. We can't prove anything about a file that doesn't parse.
- Comments are leaves with their text, so changing a comment is not formatting-only.

Pure domain function, `src/domain/diff/formatting.ts`:

```ts
findFormattingProofs(
  files: FileChange[],
  nodesByPath: ReadonlyMap<string, { base: Token[]; head: Token[] }>,
): MechanicalProof[]
```

- Only files with status `modified`, or `renamed` with hunks.
- If base and head node sequences are identical (same length, same `type` and `text` at every position), every hunk in the file gets a proof: kind `formatting`, detail `formatting only: syntax tree unchanged`.
- Files missing from the map get nothing.
- Granularity is the whole file in this slice. A file with one formatting change and one real change gets no formatting proof. Note it as a later improvement.

### 4. Symbols and call-graph hints

`symbols(source, language)` uses one tree-sitter query file per language (`queries/<language>.scm`) to find:

- **Definitions:** functions, methods, classes, interfaces/types, exported variables, with 1-based start and end lines.
- **References:** identifiers in call expressions, `new` expressions, type references, and member accesses (the member name), with their line.

Pure domain function, `src/domain/diff/call-graph.ts`:

```ts
buildCallGraphHints(
  files: FileChange[],
  symbolsByPath: ReadonlyMap<string, { definitions: SymbolDefinition[]; references: SymbolReference[] }>, // head side
): CallGraphHint[]
```

1. A hunk **changes** a symbol if the hunk's added lines overlap the symbol's definition line range.
2. A hunk **references** a symbol if a reference with that name falls within the hunk's added or context lines.
3. Emit `{ fromHunkId: referencingHunk, toHunkId: changingHunk, symbol }` for each pair where the hunks differ.
4. Match by name only. Collisions are acceptable: these are ordering hints, not facts.
5. Deduplicate, and keep at most 10 hints per `fromHunkId`, preferring hints within the same file, then by symbol name.

Append both functions' exports to `src/domain/diff/index.ts`.

## Tests

**Adapter** (real grammars, no network):

- Each language parses a small fixture and returns definitions and references with correct lines.
- A file with a syntax error returns `parse-error`.
- A too-large file returns an error.
- Unknown extension: `languageFor` returns `null`.

**Formatting proofs, adversarial cases that must NOT be proved:**

| Case | Expected |
|---|---|
| Python statement dedented out of an `if` | No proof |
| Whitespace changed inside a string literal | No proof |
| Comment text changed | No proof |
| JavaScript semicolons added (changes leaves) | No proof (accepted false negative) |
| Base file has a syntax error | No proof |
| File with a formatting change and one renamed variable | No proof |

Positive: re-indented TypeScript, reflowed Go, re-wrapped Java arguments, Python with only trailing whitespace and blank-line changes.

**Call-graph hints:** a new function in one file called from another file's hunk produces a hint; references to unchanged symbols produce none; the cap of 10 holds; name collisions across files produce hints in both directions (documented behavior).

## Definition of done

- [ ] Grammars for all languages in the table load, with `PROVENANCE.md` filled in.
- [ ] `CodeParser` passes its tests.
- [ ] Every adversarial formatting case has a test and is not proved.
- [ ] Coverage thresholds pass for the two domain files.

## Open issues

_None yet._

## Notes for later stages

_None yet._
