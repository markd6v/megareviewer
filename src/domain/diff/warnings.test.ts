import { describe, expect, it } from "vitest";
import { type FileChange, lockfileWarnings } from "./index.ts";

const file = (path: string, oldPath: string | null = null): FileChange => ({
  path,
  oldPath,
  status: oldPath === null ? "modified" : "renamed",
  binary: false,
  oldMode: null,
  newMode: null,
  language: null,
  hunks: [],
  additions: 0,
  deletions: 0,
});

describe("lockfileWarnings", () => {
  it.each([
    [["yarn.lock"], ["yarn.lock changed without a change to package.json"]],
    [
      ["pnpm-lock.yaml", "src/a.ts"],
      ["pnpm-lock.yaml changed without a change to package.json or pnpm-workspace.yaml"],
    ],
    [
      ["services/api/Cargo.lock", "Cargo.toml"],
      ["services/api/Cargo.lock changed without a change to services/api/Cargo.toml"],
    ],
    [
      ["gradle.lockfile"],
      ["gradle.lockfile changed without a change to build.gradle or build.gradle.kts"],
    ],
    [
      ["app/packages.lock.json"],
      [
        "app/packages.lock.json changed without a change to app/*.csproj, app/*.fsproj or app/*.vbproj",
      ],
    ],
    [["go.sum", "go.mod"], []],
    [["pnpm-lock.yaml", "pnpm-workspace.yaml"], []],
    // Workspaces keep one lockfile at the root for manifests below it.
    [["pnpm-lock.yaml", "packages/web/package.json"], []],
    [["app/packages.lock.json", "app/App.csproj"], []],
    [["src/app.ts", "package-lock.json.bak"], []],
  ])("for %j warns %j", (paths, expected) => {
    expect(lockfileWarnings(paths.map((path) => file(path)))).toEqual(expected);
  });

  it("counts a renamed manifest", () => {
    expect(lockfileWarnings([file("Gemfile.lock"), file("Gemfile", "Gemfile.old")])).toEqual([]);
    expect(lockfileWarnings([file("Gemfile.lock"), file("Gemfile.old", "Gemfile")])).toEqual([]);
  });
});
