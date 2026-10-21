import { describe, expect, it } from "vitest";
import { parseGitattributes } from "./gitattributes.ts";

describe("parseGitattributes", () => {
  it.each([
    // [rules, path, expected]
    ["*.pb.go linguist-generated", "api/v1/user.pb.go", "linguist-generated"],
    ["*.pb.go linguist-generated", "api/v1/user.go", null],
    ["*.min.js linguist-generated=true", "static/app.min.js", "linguist-generated"],
    ["vendor/** linguist-vendored", "vendor/lib/a.js", "linguist-vendored"],
    ["vendor/** linguist-vendored", "src/vendor/lib/a.js", null],
    ["**/vendor/** linguist-vendored", "src/vendor/lib/a.js", "linguist-vendored"],
    ["**/vendor/** linguist-vendored", "vendor/a.js", "linguist-vendored"],
    ["a/**/b.ts linguist-generated", "a/b.ts", "linguist-generated"],
    ["a/**/b.ts linguist-generated", "a/x/y/b.ts", "linguist-generated"],
    ["a/**b.ts linguist-generated", "a/xb.ts", "linguist-generated"],
    ["a/**b.ts linguist-generated", "a/x/b.ts", null],
    ["** linguist-generated", "any/path.txt", "linguist-generated"],
    ["/root.js linguist-generated", "root.js", "linguist-generated"],
    ["/root.js linguist-generated", "sub/root.js", null],
    ["gen/*.ts linguist-generated", "gen/a.ts", "linguist-generated"],
    ["gen/*.ts linguist-generated", "gen/sub/a.ts", null],
    ["gen/*.ts linguist-generated", "x/gen/a.ts", null],
    ["file?.ts linguist-generated", "file1.ts", "linguist-generated"],
    ["file?.ts linguist-generated", "file10.ts", null],
    ["*.[ch] linguist-generated", "lib/x.h", "linguist-generated"],
    ["*.[ch] linguist-generated", "lib/x.o", null],
    ["*.[!ch] linguist-generated", "lib/x.o", "linguist-generated"],
    ["*.[!ch] linguist-generated", "lib/x.c", null],
    ["a[/]b linguist-generated", "a/b", null],
    ["\\*.js linguist-generated", "*.js", "linguist-generated"],
    ["\\*.js linguist-generated", "a.js", null],
    ["a.b linguist-generated", "axb", null],
    ['"with space.js" linguist-generated', "with space.js", "linguist-generated"],
    // A trailing slash matches only directories, which git doesn't apply to files inside.
    ["gen/ linguist-generated", "gen/a.ts", null],
    ["gen linguist-generated", "gen/a.ts", null],
    // Negated patterns are ignored by git.
    ["!*.ts linguist-generated", "a.ts", null],
    ["*.ts linguist-generated\n!*.ts -linguist-generated", "a.ts", "linguist-generated"],
    // Later lines override earlier ones.
    ["*.ts linguist-generated\nsrc/*.ts -linguist-generated", "src/a.ts", null],
    ["*.ts linguist-generated\nsrc/*.ts linguist-generated=false", "src/a.ts", null],
    ["*.ts linguist-generated\nsrc/*.ts !linguist-generated", "src/a.ts", null],
    ["*.ts linguist-generated=yes", "a.ts", null],
    ["*.ts -linguist-generated\n*.ts linguist-generated", "a.ts", "linguist-generated"],
    // Lines without these attributes don't touch them.
    ["*.ts linguist-generated\n*.ts text eol=lf", "a.ts", "linguist-generated"],
    ["*.ts linguist-generated linguist-vendored", "a.ts", "linguist-generated"],
    ["*.ts linguist-vendored", "a.ts", "linguist-vendored"],
    ["# *.ts linguist-generated\n\n[attr]gen linguist-generated\n*.ts gen", "a.ts", null],
    ["*.ts", "a.ts", null],
    // Patterns it can't read unset their attributes everywhere.
    ["*.ts linguist-generated\n*.[z-a] -linguist-generated", "a.ts", null],
    ["*.ts linguist-generated\n*.[ch -linguist-generated", "a.ts", null],
    ["*.[z-a] linguist-generated", "a.z", null],
  ])("%j for %s is %s", (rules, path, expected) => {
    expect(parseGitattributes(rules)(path)).toBe(expected);
  });
});
