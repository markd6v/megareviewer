import { basename } from "./path.ts";

/**
 * Lockfiles by basename, with the manifests a change to them normally comes with. A manifest
 * starting with "*" matches any file name ending in the rest.
 */
export const LOCKFILE_MANIFESTS: ReadonlyMap<string, readonly string[]> = new Map([
  ["package-lock.json", ["package.json"]],
  ["npm-shrinkwrap.json", ["package.json"]],
  ["pnpm-lock.yaml", ["package.json", "pnpm-workspace.yaml"]],
  ["yarn.lock", ["package.json"]],
  ["bun.lock", ["package.json"]],
  ["Cargo.lock", ["Cargo.toml"]],
  ["go.sum", ["go.mod"]],
  ["poetry.lock", ["pyproject.toml"]],
  ["uv.lock", ["pyproject.toml"]],
  ["Pipfile.lock", ["Pipfile"]],
  ["Gemfile.lock", ["Gemfile"]],
  ["composer.lock", ["composer.json"]],
  ["Podfile.lock", ["Podfile"]],
  ["packages.lock.json", ["*.csproj", "*.fsproj", "*.vbproj"]],
  ["gradle.lockfile", ["build.gradle", "build.gradle.kts"]],
  ["flake.lock", ["flake.nix"]],
  ["mix.lock", ["mix.exs"]],
  ["pubspec.lock", ["pubspec.yaml"]],
]);

export const isLockfile = (path: string): boolean => LOCKFILE_MANIFESTS.has(basename(path));
