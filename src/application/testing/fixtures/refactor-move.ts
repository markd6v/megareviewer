import type { PullRequestFixture } from "./fixture.ts";

const baseFiles: Readonly<Record<string, string>> = {
  "pnpm-lock.yaml": `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      debug:
        specifier: ^4.3.4
        version: 4.3.4

packages:

  debug@4.3.4:
    resolution: {integrity: sha512-PRWFHuSU3eDtQJPvnNY7Jcket1j0t5OuOsFzPPzsekD52Zl8qUfFIPEiswXqIvHWGVHOgX+7G/vCNNhehwxfkQ==}
    engines: {node: '>=6.0'}
    peerDependencies:
      supports-color: '*'
    peerDependenciesMeta:
      supports-color:
        optional: true

  ms@2.1.2:
    resolution: {integrity: sha512-sGkPx+VjMtmA6MX27oA4FBFELFCZZ4S4XqeGOXCv68tT+jb3vk/RyaKWP0PTKyWtmLSM0b+adUTEvbs1PEaH2w==}

snapshots:

  debug@4.3.4:
    dependencies:
      ms: 2.1.2

  ms@2.1.2: {}
`,
  "src/config.ts": `import { readEnv } from "./env.ts";

export const config = { port: Number(readEnv("PORT") ?? 8080), host: readEnv("HOST") ?? "0.0.0.0", logLevel: readEnv("LOG_LEVEL") ?? "info" };

export type Config = typeof config;
`,
  "src/helpers.ts": `const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}
`,
  "src/utils/strings.ts": `export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function capitalize(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : \`\${input.slice(0, max - 1)}…\`;
}
`,
};

const headFiles: Readonly<Record<string, string>> = {
  "pnpm-lock.yaml": `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      debug:
        specifier: ^4.3.4
        version: 4.3.4

packages:

  debug@4.3.4:
    resolution: {integrity: sha512-PRWFHuSU3eDtQJPvnNY7Jcket1j0t5OuOsFzPPzsekD52Zl8qUfFIPEiswXqIvHWGVHOgX+7G/vCNNhehwxfkQ==}
    engines: {node: '>=6.0'}
    peerDependencies:
      supports-color: '*'
    peerDependenciesMeta:
      supports-color:
        optional: true

  ms@2.1.3:
    resolution: {integrity: sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==}

snapshots:

  debug@4.3.4:
    dependencies:
      ms: 2.1.3

  ms@2.1.3: {}
`,
  "src/config.ts": `import { readEnv } from "./env.ts";

export const config = {
  port: Number(readEnv("PORT") ?? 8080),
  host: readEnv("HOST") ?? "0.0.0.0",
  logLevel: readEnv("LOG_LEVEL") ?? "info"
};

export type Config = typeof config;
`,
  "src/dates.ts": `const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}
`,
  "src/text/format.ts": `export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
`,
  "src/utils/strings.ts": `export function capitalize(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : \`\${input.slice(0, max - 1)}…\`;
}
`,
};

const diff = `diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 2548b5a..8cef777 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -23,13 +23,13 @@ packages:
       supports-color:
         optional: true
 
-  ms@2.1.2:
-    resolution: {integrity: sha512-sGkPx+VjMtmA6MX27oA4FBFELFCZZ4S4XqeGOXCv68tT+jb3vk/RyaKWP0PTKyWtmLSM0b+adUTEvbs1PEaH2w==}
+  ms@2.1.3:
+    resolution: {integrity: sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==}
 
 snapshots:
 
   debug@4.3.4:
     dependencies:
-      ms: 2.1.2
+      ms: 2.1.3
 
-  ms@2.1.2: {}
+  ms@2.1.3: {}
diff --git a/src/config.ts b/src/config.ts
index 0ba4373..6e7b863 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,5 +1,9 @@
 import { readEnv } from "./env.ts";
 
-export const config = { port: Number(readEnv("PORT") ?? 8080), host: readEnv("HOST") ?? "0.0.0.0", logLevel: readEnv("LOG_LEVEL") ?? "info" };
+export const config = {
+  port: Number(readEnv("PORT") ?? 8080),
+  host: readEnv("HOST") ?? "0.0.0.0",
+  logLevel: readEnv("LOG_LEVEL") ?? "info"
+};
 
 export type Config = typeof config;
diff --git a/src/helpers.ts b/src/dates.ts
similarity index 100%
rename from src/helpers.ts
rename to src/dates.ts
diff --git a/src/text/format.ts b/src/text/format.ts
new file mode 100644
index 0000000..8156db4
--- /dev/null
+++ b/src/text/format.ts
@@ -0,0 +1,8 @@
+export function slugify(input: string): string {
+  return input
+    .normalize("NFKD")
+    .replace(/[\\u0300-\\u036f]/g, "")
+    .toLowerCase()
+    .replace(/[^a-z0-9]+/g, "-")
+    .replace(/^-+|-+$/g, "");
+}
diff --git a/src/utils/strings.ts b/src/utils/strings.ts
index f6df575..fab48cb 100644
--- a/src/utils/strings.ts
+++ b/src/utils/strings.ts
@@ -1,12 +1,3 @@
-export function slugify(input: string): string {
-  return input
-    .normalize("NFKD")
-    .replace(/[\\u0300-\\u036f]/g, "")
-    .toLowerCase()
-    .replace(/[^a-z0-9]+/g, "-")
-    .replace(/^-+|-+$/g, "");
-}
-
 export function capitalize(input: string): string {
   return input.charAt(0).toUpperCase() + input.slice(1);
 }
`;

export const refactorMove: PullRequestFixture = {
  name: "refactor-move",
  pullRequest: {
    ref: { repo: { host: "github", owner: "acme", repo: "shop" }, number: 102 },
    url: "https://github.com/acme/shop/pull/102",
    title: "Tidy up utilities",
    description:
      "No behavior change.\n\n- Move `slugify` to `src/text/format.ts`\n- Rename `src/helpers.ts` to `src/dates.ts`\n- Reformat `src/config.ts`\n- Refresh the lockfile",
    author: { id: "dana-kim", name: "Dana Kim" },
    sourceBranch: "chore/tidy-utils",
    targetBranch: "main",
    baseSha: "eb4435e5ad4997604e7ae8b7ea7cf1379eb5e0e3",
    headSha: "779f444dbc28d8c2588247d9fae93e1c5974ca58",
    commits: [
      {
        sha: "7f8fd40f9b40cbc1842576c591649e020c23c0fb",
        message: "Move slugify to text/format",
        author: "Dana Kim",
      },
      {
        sha: "83e09b7e34e1295f973a9e250f080a56573a3ae0",
        message: "Rename helpers to dates",
        author: "Dana Kim",
      },
      {
        sha: "c042c82026425b3f0f4b2ec4e717119ec87d32d4",
        message: "Reformat config",
        author: "Dana Kim",
      },
      {
        sha: "779f444dbc28d8c2588247d9fae93e1c5974ca58",
        message: "Refresh lockfile",
        author: "Dana Kim",
      },
    ],
    diff,
    createdAt: "2026-10-18T10:00:00Z",
    updatedAt: "2026-10-18T10:20:00Z",
  },
  baseFiles,
  headFiles,
  tickets: [],
};
