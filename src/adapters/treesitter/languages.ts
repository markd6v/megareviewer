export interface LanguageSpec {
  /** The tree-sitter name; the grammar is `tree-sitter-<name>.wasm`. */
  readonly name: string;
  readonly extensions: readonly string[];
  /** Files in `queries/`, concatenated into the language's symbols query. */
  readonly queries: readonly string[];
}

export const LANGUAGES: readonly LanguageSpec[] = [
  { name: "typescript", extensions: [".ts", ".mts", ".cts"], queries: ["typescript"] },
  { name: "tsx", extensions: [".tsx"], queries: ["typescript", "jsx"] },
  {
    name: "javascript",
    extensions: [".js", ".mjs", ".cjs", ".jsx"],
    queries: ["javascript", "jsx"],
  },
  { name: "python", extensions: [".py", ".pyi"], queries: ["python"] },
  { name: "go", extensions: [".go"], queries: ["go"] },
  { name: "java", extensions: [".java"], queries: ["java"] },
  { name: "rust", extensions: [".rs"], queries: ["rust"] },
  { name: "c_sharp", extensions: [".cs"], queries: ["c_sharp"] },
];

const byExtension = new Map(
  LANGUAGES.flatMap((spec) =>
    spec.extensions.map((extension): [string, LanguageSpec] => [extension, spec]),
  ),
);
const byName = new Map(LANGUAGES.map((spec) => [spec.name, spec]));

export const languageSpecFor = (path: string): LanguageSpec | null => {
  const basename = path.slice(path.lastIndexOf("/") + 1);
  const dot = basename.lastIndexOf(".");
  if (dot <= 0) return null;
  return byExtension.get(basename.slice(dot).toLowerCase()) ?? null;
};

export const languageSpecNamed = (name: string): LanguageSpec | null => byName.get(name) ?? null;
