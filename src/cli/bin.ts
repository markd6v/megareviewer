import { EXIT } from "./args.ts";
import { nodeVersionProblem } from "./node-version.ts";

// Built into dist/cli.js, which loads on old Node too. On Node before 22.13 the server bundle
// fails while loading, before any of our code runs, with errors like "No such built-in module:
// node:sqlite" that don't say Node is too old. So the version is checked here first.
const problem = nodeVersionProblem(process.versions.node);
if (problem === null) {
  await import(new URL("./server.js", import.meta.url).href);
} else {
  console.error(problem);
  process.exitCode = EXIT.config;
}
