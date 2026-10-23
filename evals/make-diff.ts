// Writes diff.patch for a synthetic case from its files/base and files/head:
// node evals/make-diff.ts <case>. Imported cases keep the host's diff instead.

import { writeFileSync } from "node:fs";
import { evalCase } from "./cases/index.ts";
import { gitDiff } from "./git-diff.ts";

const name = process.argv[2];
const found = name === undefined ? undefined : evalCase(name);
if (found === undefined) {
  console.error("Usage: node evals/make-diff.ts <case>");
  process.exit(1);
}
if (found.source !== "synthetic") {
  console.error(`${found.name} is ${found.source}: its diff comes from the host or stage 02.`);
  process.exit(1);
}
const out = new URL(`./cases/${found.name}/diff.patch`, import.meta.url);
writeFileSync(out, gitDiff(found.fixture.baseFiles, found.fixture.headFiles));
console.log(`wrote ${out.pathname}`);
