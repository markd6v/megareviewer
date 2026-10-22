import { existsSync } from "node:fs";
import { chmod, cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { build } from "esbuild";
import { z } from "zod";

// Builds the npm package into dist/: the UI, one bundled server file with no runtime
// dependencies, the tree-sitter grammars, and the notices of everything bundled.

const DIST = "dist";
const GRAMMARS = "src/adapters/treesitter/grammars";
/** Kept in the repo for maintainers, not needed at runtime. */
const GRAMMAR_EXTRAS = new Set(["PROVENANCE.md", "refresh.sh"]);

// The bundle is ESM, but CommonJS dependencies inside it call require().
const BANNER = `#!/usr/bin/env node
import { createRequire as __megareviewerCreateRequire } from "node:module";
const require = __megareviewerCreateRequire(import.meta.url);`;

/** The package directory a bundled file comes from, or null for our own sources. */
export const packageRootOf = (file: string): string | null => {
  const match = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(file.replaceAll("\\", "/"));
  return match?.[1] ?? null;
};

export interface GrammarNotice {
  readonly file: string;
  readonly source: string;
  readonly version: string;
  readonly license: string;
}

/** The grammars' table in PROVENANCE.md: file, [repo](url), version, license, hash. */
export const parseProvenance = (markdown: string): GrammarNotice[] =>
  [
    ...markdown.matchAll(
      /^\| `([^`]+\.wasm)` \| \[[^\]]+\]\(([^)]+)\)[^|]* \| ([^|]+) \| ([^|]+) \|/gm,
    ),
  ].map(([, file = "", source = "", version = "", license = ""]) => ({
    file,
    source,
    version: version.trim(),
    license: license.trim(),
  }));

export interface PackageNotice {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly text: string;
}

export const formatNotices = (
  packages: readonly PackageNotice[],
  grammars: readonly GrammarNotice[],
): string => {
  const rule = "-".repeat(78);
  const sections = packages.map(
    (notice) => `${notice.name} ${notice.version} (${notice.license})\n\n${notice.text.trim()}\n`,
  );
  const grammarLines = grammars.map(
    (grammar) => `${grammar.file}: ${grammar.version}, ${grammar.license}, ${grammar.source}`,
  );
  return [
    "megareviewer bundles the following third-party software.\n",
    ...sections,
    `tree-sitter grammars in grammars/\n\n${grammarLines.join("\n")}\n`,
  ].join(`\n${rule}\n\n`);
};

const PackageJson = z.object({
  name: z.string(),
  version: z.string(),
  license: z.string().optional(),
  author: z.union([z.string(), z.object({ name: z.string() })]).optional(),
  repository: z.union([z.string(), z.object({ url: z.string() })]).optional(),
});
const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i;

/**
 * Bundled packages checked by hand that ship no license file. Their notice is what their
 * package.json says. Any other package without one fails the build.
 */
const NO_LICENSE_FILE: ReadonlySet<string> = new Set([
  // Pulled in by @anthropic-ai/sdk. package.json says MIT; the upstream repo's LICENSE is Apache-2.0.
  "standardwebhooks",
]);

const readNotice = async (root: string): Promise<PackageNotice> => {
  const { name, version, license, author, repository } = PackageJson.parse(
    JSON.parse(await readFile(join(root, "package.json"), "utf8")),
  );
  const files = (await readdir(root)).filter((file) => LICENSE_FILE.test(file)).sort();
  if (files.length === 0) {
    // Shipping code without its notice breaks most licenses, so this is a reviewed exception.
    if (!NO_LICENSE_FILE.has(name))
      throw new Error(`${name} ${version} has no license file in ${root}`);
    const lines = [
      `${name} ships no license file. Its package.json declares the license ${license ?? "(none)"}.`,
      ...(author === undefined
        ? []
        : [`Author: ${typeof author === "string" ? author : author.name}`]),
      ...(repository === undefined
        ? []
        : [`Source: ${typeof repository === "string" ? repository : repository.url}`]),
    ];
    return { name, version, license: license ?? "unknown", text: lines.join("\n") };
  }
  const texts = await Promise.all(files.map((file) => readFile(join(root, file), "utf8")));
  return { name, version, license: license ?? "see text", text: texts.join("\n\n") };
};

/** Builds the UI when stage 13's Vite app exists; returns the files it bundled. */
const buildWeb = async (): Promise<string[]> => {
  const configFile = "web/vite.config.ts";
  if (!existsSync("web/index.html") || !existsSync(configFile)) {
    console.warn("No web/index.html or web/vite.config.ts yet: the package has no UI.");
    return [];
  }
  const { build: viteBuild } = await import("vite");
  const result = await viteBuild({
    configFile,
    logLevel: "warn",
    build: { outDir: resolve(DIST, "web"), emptyOutDir: true },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((output) =>
    "output" in output ? output.output : [],
  );
  return outputs.flatMap((chunk) => (chunk.type === "chunk" ? chunk.moduleIds : []));
};

const buildServer = async (): Promise<string[]> => {
  const result = await build({
    entryPoints: ["src/cli/main.ts"],
    outfile: join(DIST, "cli.js"),
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    // Not minified: users can read what they run.
    minify: false,
    banner: { js: BANNER },
    metafile: true,
    logLevel: "warning",
  });
  await chmod(join(DIST, "cli.js"), 0o755);
  return Object.keys(result.metafile.inputs);
};

const main = async () => {
  await rm(DIST, { recursive: true, force: true });
  const bundled = [...(await buildWeb()), ...(await buildServer())];

  await cp(GRAMMARS, join(DIST, "grammars"), {
    recursive: true,
    filter: (source) => !GRAMMAR_EXTRAS.has(basename(source)),
  });

  const roots = [...new Set(bundled.flatMap((file) => packageRootOf(file) ?? []))].sort();
  const notices = await Promise.all(roots.map(readNotice));
  const grammars = parseProvenance(await readFile(join(GRAMMARS, "PROVENANCE.md"), "utf8"));
  if (grammars.length === 0) throw new Error(`No grammars found in ${GRAMMARS}/PROVENANCE.md`);
  await writeFile(join(DIST, "THIRD_PARTY_LICENSES.txt"), formatNotices(notices, grammars));
  console.log(
    `Built ${DIST}/ with ${notices.length} bundled packages and ${grammars.length} grammars.`,
  );
};

if (import.meta.main) await main();
