# Stage 01: Scaffolding and tooling

**Status:** In progress (branch stage/01-scaffolding)
**Depends on:** —
**Unblocks:** everything
**Owns:** root config files, `.github/`, the folder skeleton, `src/domain/shared/`

## Goal

An empty but fully wired repository: every later stage can add code and immediately get typechecking, lint, dependency-rule enforcement, tests with coverage thresholds, and CI, with no tooling work of its own.

## Read first

- [ENGINEERING.md](../../ENGINEERING.md) §3 (layers and layout), §6 (code rules), §7 (testing), §8 (dependencies)
- [ARCHITECTURE.md](../../ARCHITECTURE.md) "Why TypeScript everywhere" (bundling, no native modules)

## Scope

**In:** package manager, TypeScript configs, Biome, dependency-cruiser, Vitest, CI, folder skeleton, base dependencies, `Result` type.
**Out:** any product code; the production build and bundling (stage 12).

## Tasks

### 1. Package manager and Node

- Use **pnpm 10** (pin the exact current version in `packageManager`) and **Node 24** (`.nvmrc` with `24`, `engines.node: ">=24"`).
- `.npmrc`: `save-exact=true`.
- Dependency install scripts must not run. pnpm 10 blocks them by default; keep the allowlist of packages allowed to build empty. Verify after installing that no package ran a lifecycle script.
- `package.json`: `"name": "megareviewer"`, `"private": true` (stage 17 flips it), `"type": "module"`.
- **Every dependency is a `devDependency`.** The published package bundles everything (stage 12), so `dependencies` stays empty. Add a script `scripts/check-no-runtime-deps.ts` that fails if `dependencies` is non-empty, and run it in `pnpm check`.

### 2. Base dependencies

Install now, so wave-3 stages rarely touch `package.json` at the same time. Pin exact current versions.

| Purpose | Packages |
|---|---|
| Language | `typescript`, `@types/node` |
| Schemas | `zod` (v4) |
| Server | `hono`, `@hono/node-server` |
| Integrations | `@octokit/rest`, `@anthropic-ai/sdk` |
| Code parsing | `web-tree-sitter` (grammars are added by stage 04) |
| UI | `react`, `react-dom`, `@types/react`, `@types/react-dom`, `shiki`, `vite`, `@vitejs/plugin-react` |
| Lint and format | `@biomejs/biome` |
| Dependency rules | `dependency-cruiser` |
| Tests | `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@playwright/test` |
| Bundling | `esbuild` |

### 3. TypeScript

- `tsconfig.base.json`, shared settings:
  - `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `isolatedModules`, `verbatimModuleSyntax`.
  - `erasableSyntaxOnly` and `allowImportingTsExtensions`, so Node 24 can run `.ts` files directly through type stripping (no enums, namespaces or parameter properties).
  - `noEmit`: tsc only typechecks. esbuild and Vite produce output.
  - `target: "es2024"`.
- `tsconfig.json` (server side): extends base, `module`/`moduleResolution: "nodenext"`, includes `src`, `contracts`, `scripts`, `evals`.
- `web/tsconfig.json`: extends base, `lib: ["dom", "dom.iterable", "es2024"]`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, includes `web/src`, `web/dev`, `contracts`, `src/domain`.
- Relative imports always use the `.ts`/`.tsx` extension.

### 4. Biome

- `biome.json`: recommended rules, plus:
  - `noExplicitAny`: error
  - `noNonNullAssertion`: error
  - `useImportType`: error
  - `noConsole`: error, except in `src/cli/**`, `scripts/**` and `evals/**`
  - `noDangerouslySetInnerHtml`: error (model output must never be rendered as HTML)
- Formatter: 2 spaces, line width 100, double quotes.
- Ignore `dist`, `coverage`, `evals/results`, recorded fixture JSON.

### 5. dependency-cruiser

`.dependency-cruiser.cjs` enforces ENGINEERING.md §3 and §4. Rules (all `error`):

| Rule | From | Must not import |
|---|---|---|
| domain-is-pure | `src/domain` | `src/application`, `src/adapters`, `src/cli`, `contracts`, any `node:` module, any npm package except `zod` |
| application-depends-on-domain | `src/application` | `src/adapters`, `src/cli`, `contracts`, any `node:` module, any npm package except `zod` |
| adapters-are-isolated | `src/adapters/<x>` | `src/adapters/<y>` for any other adapter, `src/cli` |
| only-http-uses-contracts | `src/adapters/<x>` except `http` | `contracts` |
| contracts-are-pure | `contracts` | anything except `src/domain` and `zod` |
| web-uses-contracts | `web/src`, `web/dev` | `src/application`, `src/adapters`, `src/cli` |
| no-deep-imports | anywhere outside a module | files inside `src/domain/<x>/`, `src/application/<x>/`, `src/adapters/<x>/` other than that folder's `index.ts` |
| no-circular | anywhere | circular imports |

`src/application/testing/` may be imported only by test files (`*.test.ts`), `src/cli/dev/` and `evals/`.

Check by hand that each rule fires: add a deliberate violation, run `pnpm deps`, confirm the error, remove it. Don't commit the violations.

### 6. Vitest

- `vitest.config.ts` with two projects:
  - `server`: `src/**/*.test.ts`, `contracts/**/*.test.ts`, `scripts/**/*.test.ts`, Node environment.
  - `web`: `web/src/**/*.test.tsx?`, jsdom environment.
- Coverage with the v8 provider. Thresholds of **90% branches and lines** for `src/domain/**` and `src/application/**` (excluding `src/application/testing/**`). No thresholds elsewhere.
- Tests must not reach the network. Add a setup file that replaces global `fetch` with a function that throws "network access in tests", so an adapter test that forgets to inject `fetch` fails loudly.

### 7. Scripts

| Script | Does |
|---|---|
| `typecheck` | `tsc -p tsconfig.json` and `tsc -p web/tsconfig.json` |
| `lint` | `biome check .` |
| `format` | `biome format --write .` |
| `deps` | dependency-cruiser over `src`, `contracts`, `web/src`, `web/dev` |
| `test` | `vitest run --coverage` |
| `check` | `check-no-runtime-deps`, then typecheck, lint, deps, test |
| `dev:server` | `node --watch src/cli/main.ts` |
| `dev:web` | `vite --config web/vite.config.ts` (stage 13 creates the config) |
| `build` | placeholder that exits 0; stage 12 replaces it |

### 8. Folder skeleton

Create these, each with an `index.ts` containing `export {};` so the layout exists and imports resolve:

```
src/domain/shared/
src/domain/review/
src/domain/diff/
src/application/ports/
src/application/use-cases/
src/application/events/
src/application/testing/
src/adapters/{github,bitbucket,jira,claude,sqlite,treesitter,http}/
src/cli/
contracts/
web/src/
evals/
e2e/
scripts/
```

`src/cli/main.ts` prints the package version and exits. This proves Node runs TypeScript directly (`node src/cli/main.ts`).

### 9. `Result` type

`src/domain/shared/result.ts`, exported from `src/domain/shared/index.ts`:

```ts
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

Add small helpers only if they're needed right away (`map`, `isOk`). Cover them with tests.

### 10. Git hygiene

`.gitignore`: `node_modules/`, `dist/`, `coverage/`, `.idea/`, `.DS_Store`, `*.log`, `.env*`, `evals/results/`, `test-results/`, `playwright-report/`.

### 11. CI

`.github/workflows/ci.yml`, on pushes to `main` and on PRs:

1. Checkout.
2. Set up Node from `.nvmrc`, enable corepack, cache the pnpm store.
3. `pnpm install --frozen-lockfile`
4. `pnpm check`
5. `pnpm build`

Ubuntu only for now. Stage 17 adds a macOS and Windows smoke test.

## Tests

- `result.test.ts` covers `ok`, `err` and any helpers.
- The no-network setup file has a test proving `fetch` throws.
- `check-no-runtime-deps` has a test with a fake `package.json` that has dependencies.

## Definition of done

- [x] `pnpm install && pnpm check && pnpm build` passes on a clean clone.
- [x] `node src/cli/main.ts` prints the version.
- [x] Each dependency rule was seen to fail on a deliberate violation.
- [ ] CI runs on a PR and passes.
- [x] `.idea/` is ignored.

## Open issues

_None yet._

## Notes for later stages

- **TypeScript is 6.0.3, not 7.** TypeScript 7 has no JavaScript API yet, and dependency-cruiser needs one to read `.ts` imports (without it, it silently misses dependencies). Move to 7 once dependency-cruiser supports it.
- **Install scripts:** `.npmrc` sets `strict-dep-builds=true`, so a new dependency with an install script fails `pnpm install` instead of only warning. esbuild is listed in `pnpm.ignoredBuiltDependencies`: its postinstall only checks the platform binary, which pnpm installs as an optional dependency anyway. `onlyBuiltDependencies` stays empty.
- **Imports:** Biome's `useImportExtensions` enforces the `.ts`/`.tsx` extension on relative imports.
- **Test files** (`*.test.ts`) are exempt from the purity rules for `src/domain`, `src/application` and `contracts`, since they import Vitest.
- **No-network setup** is `scripts/vitest/no-network.ts`, used by both Vitest projects.
- **Folder skeleton:** `web/dev/` was added too, because `pnpm deps` and `web/tsconfig.json` include it. `src/cli/` and `scripts/` have no `index.ts`; they hold entry scripts, not modules.
- **`Result`** has only `ok` and `err`. Add helpers when a stage needs them.
- **CI** caches the pnpm store with `actions/cache`, because `setup-node`'s pnpm cache needs pnpm before corepack has enabled it.
