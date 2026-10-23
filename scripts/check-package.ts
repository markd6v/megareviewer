import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { z } from "zod";

// Checks the tarball `pnpm pack` makes from dist/, as users would install it: only built files,
// nothing that runs on install, no dependencies, and a CLI that starts with no node_modules.

export const MAX_TARBALL_BYTES = 50 * 1024 * 1024;

const ALLOWED_FILE = /^(dist\/.+|package\.json|(readme|licen[cs]e|notice)(\.(md|txt|markdown))?)$/i;
const DEPENDENCY_FIELDS = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "bundleDependencies",
  "bundledDependencies",
] as const;
/** Lifecycle scripts a package manager runs when installing the package. */
const INSTALL_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"] as const;

const PackedPackageJson = z.looseObject({
  scripts: z.record(z.string(), z.string()).optional(),
});

/** Paths are relative to the package root, with forward slashes. */
export const findPackageProblems = (pack: {
  readonly files: readonly string[];
  readonly packageJson: unknown;
  readonly tarballBytes: number;
}): string[] => {
  const problems = pack.files
    .filter((file) => !ALLOWED_FILE.test(file))
    .map((file) => `Unexpected file in the package: ${file}`);
  if (!pack.files.includes("dist/cli.js")) problems.push("The package has no dist/cli.js");

  const packageJson = PackedPackageJson.parse(pack.packageJson);
  for (const field of DEPENDENCY_FIELDS) {
    const value = packageJson[field];
    const empty =
      value === undefined ||
      (typeof value === "object" && value !== null && Object.keys(value).length === 0);
    if (!empty) problems.push(`package.json has ${field}: bundle them instead`);
  }
  for (const script of INSTALL_SCRIPTS) {
    if (packageJson.scripts?.[script] !== undefined) {
      problems.push(`package.json has a "${script}" script, which runs on install`);
    }
  }
  if (pack.tarballBytes > MAX_TARBALL_BYTES) {
    problems.push(
      `The tarball is ${megabytes(pack.tarballBytes)}, over ${megabytes(MAX_TARBALL_BYTES)}`,
    );
  }
  return problems;
};

/**
 * pnpm is a .cmd shim on Windows, which Node starts only through a shell; the shell then needs
 * paths with spaces quoted.
 */
export const pnpmCommand = (
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
): { file: string; args: string[]; shell: boolean } =>
  platform === "win32"
    ? { file: "pnpm", args: args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)), shell: true }
    : { file: "pnpm", args: [...args], shell: false };

export const megabytes = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const listFiles = async (root: string): Promise<string[]> =>
  (await readdir(root, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .sort();

const main = async () => {
  const work = await mkdtemp(join(tmpdir(), "megareviewer-pack-"));
  try {
    const pnpm = pnpmCommand(["pack", "--pack-destination", work]);
    execFileSync(pnpm.file, pnpm.args, { stdio: "ignore", shell: pnpm.shell });
    const tarball = (await readdir(work)).find((file) => file.endsWith(".tgz"));
    if (tarball === undefined) throw new Error("pnpm pack made no tarball");
    const tarballPath = join(work, tarball);
    // Relative, because Git Bash's GNU tar reads "C:\…" as a remote host.
    execFileSync("tar", ["-xzf", tarball], { cwd: work });
    const root = join(work, "package");

    const packageJson: unknown = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const { size } = await stat(tarballPath);
    const problems = findPackageProblems({
      files: await listFiles(root),
      packageJson,
      tarballBytes: size,
    });

    // In a temp directory, so no node_modules up the tree can stand in for a missing bundle part.
    const version = z.object({ version: z.string() }).parse(packageJson).version;
    const printed = execFileSync(process.execPath, ["dist/cli.js", "--version"], {
      cwd: root,
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "" },
    }).trim();
    if (printed !== version) {
      problems.push(`node dist/cli.js --version printed "${printed}", expected "${version}"`);
    }

    console.log(`${tarball}: ${megabytes(size)}`);
    if (problems.length > 0) {
      for (const problem of problems) console.error(`✗ ${problem}`);
      process.exitCode = 1;
    } else {
      console.log("✓ The package has only built files, no dependencies, and starts unpacked.");
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
};

if (import.meta.main) await main();
