import { describe, expect, it } from "vitest";
import { findPackageProblems, MAX_TARBALL_BYTES, pnpmCommand } from "./check-package.ts";

const GOOD = {
  files: [
    "LICENSE",
    "README.md",
    "dist/cli.js",
    "dist/grammars/web-tree-sitter.wasm",
    "package.json",
  ],
  packageJson: {
    name: "megareviewer",
    version: "1.0.0",
    scripts: { build: "node scripts/build.ts" },
  },
  tarballBytes: 12 * 1024 * 1024,
};

describe("findPackageProblems", () => {
  it("accepts built files, package.json, license and readme", () => {
    expect(findPackageProblems(GOOD)).toEqual([]);
  });

  it("rejects files outside dist/", () => {
    expect(
      findPackageProblems({ ...GOOD, files: [...GOOD.files, "src/cli/main.ts", "binding.gyp"] }),
    ).toEqual([
      "Unexpected file in the package: src/cli/main.ts",
      "Unexpected file in the package: binding.gyp",
    ]);
  });

  it("requires dist/cli.js", () => {
    expect(findPackageProblems({ ...GOOD, files: ["package.json"] })).toEqual([
      "The package has no dist/cli.js",
    ]);
  });

  it("rejects dependencies of any kind, but not empty ones", () => {
    const packageJson = {
      ...GOOD.packageJson,
      dependencies: { zod: "4.0.0" },
      optionalDependencies: {},
      peerDependencies: { react: "19" },
    };
    expect(findPackageProblems({ ...GOOD, packageJson })).toEqual([
      "package.json has dependencies: bundle them instead",
      "package.json has peerDependencies: bundle them instead",
    ]);
  });

  it("rejects scripts that run on install", () => {
    const packageJson = { scripts: { postinstall: "node x.js", prepare: "husky" } };
    expect(findPackageProblems({ ...GOOD, packageJson })).toEqual([
      'package.json has a "postinstall" script, which runs on install',
      'package.json has a "prepare" script, which runs on install',
    ]);
  });

  it("rejects a tarball over the size limit", () => {
    expect(findPackageProblems({ ...GOOD, tarballBytes: MAX_TARBALL_BYTES + 1 })).toEqual([
      "The tarball is 50.0 MB, over 50.0 MB",
    ]);
  });
});

describe("pnpmCommand", () => {
  const args = ["pack", "--pack-destination", "C:\\Users\\Jo Smith\\Temp\\pack"];

  it("runs pnpm directly where it's an executable", () => {
    expect(pnpmCommand(args, "linux")).toEqual({ file: "pnpm", args, shell: false });
    expect(pnpmCommand(args, "darwin").shell).toBe(false);
  });

  it("goes through the shell on Windows, where pnpm is a .cmd shim, quoting paths with spaces", () => {
    expect(pnpmCommand(args, "win32")).toEqual({
      file: "pnpm",
      args: ["pack", "--pack-destination", '"C:\\Users\\Jo Smith\\Temp\\pack"'],
      shell: true,
    });
  });
});
