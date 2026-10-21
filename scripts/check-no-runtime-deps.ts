import { readFileSync } from "node:fs";
import { z } from "zod";

// The published package bundles everything, so any runtime dependency would be
// installed on users' machines unbundled (ENGINEERING.md §8).
const PackageJson = z.object({ dependencies: z.record(z.string(), z.string()).optional() });

export const findRuntimeDependencies = (packageJson: string): readonly string[] =>
  Object.keys(PackageJson.parse(JSON.parse(packageJson)).dependencies ?? {});

if (import.meta.main) {
  const found = findRuntimeDependencies(readFileSync("package.json", "utf8"));
  if (found.length > 0) {
    console.error(
      `package.json has runtime dependencies; make them devDependencies: ${found.join(", ")}`,
    );
    process.exit(1);
  }
}
