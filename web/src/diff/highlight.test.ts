import type { ThemedTokenWithVariants, ThemeRegistrationRaw } from "shiki/core";
import darkTheme from "shiki/themes/github-dark-default.mjs";
import lightTheme from "shiki/themes/github-light-default.mjs";
import { describe, expect, it } from "vitest";
import css from "../styles/tokens.css?raw";
import {
  createShikiHighlighter,
  hunkSides,
  languageOf,
  themeTokens,
  tokensForLines,
} from "./highlight.ts";
import { displayLines } from "./lines.ts";
import { firstHunk, modifiedFile } from "./testing.ts";
import type { CodeToken } from "./tokens.ts";

const FOREGROUNDS = { light: "#1f2328", dark: "#e6edf3" };

const shikiToken = (
  content: string,
  light: string,
  dark: string,
  fontStyle = 0,
): ThemedTokenWithVariants => ({
  content,
  offset: 0,
  variants: { light: { color: light, fontStyle }, dark: { color: dark } },
});

const token = (text: string, light: string | null = null): CodeToken => ({
  text,
  light,
  dark: light,
  italic: false,
  bold: false,
});

describe("languageOf", () => {
  it.each([
    [{ path: "src/a.ts", language: "typescript" }, "typescript"],
    [{ path: "src/A.cs", language: "c_sharp" }, "csharp"],
    [{ path: "src/a.ts", language: null }, "typescript"],
    [{ path: "pnpm-lock.yaml", language: null }, "yaml"],
    [{ path: "README.MD", language: null }, "markdown"],
    [{ path: "deploy/Dockerfile", language: null }, "docker"],
    [{ path: "Makefile", language: null }, "make"],
    [{ path: "script.weird", language: "weird" }, null],
    [{ path: "LICENSE", language: null }, null],
    [{ path: ".env", language: null }, null],
  ])("%j is %s", (file, language) => {
    expect(languageOf(file)).toBe(language);
  });
});

// A template string that starts in a context line and spans the changed lines.
const templateHunk = firstHunk(
  modifiedFile("src/query.ts", [
    "@@ -1,4 +1,4 @@",
    " const query = `",
    "-  SELECT id",
    "+  SELECT id, name",
    "   FROM users`;",
    " run(query);",
  ]),
);

describe("hunkSides", () => {
  it("builds the old side from context and deleted lines, the new one from context and added", () => {
    expect(hunkSides(displayLines(templateHunk.lines))).toEqual({
      old: "const query = `\n  SELECT id\n  FROM users`;\nrun(query);",
      new: "const query = `\n  SELECT id, name\n  FROM users`;\nrun(query);",
    });
  });

  it("drops carriage returns", () => {
    const hunk = firstHunk(modifiedFile("a.ini", ["@@ -1 +1 @@", "-a\r", "+b\r"]));
    expect(hunkSides(displayLines(hunk.lines))).toEqual({ old: "a", new: "b" });
  });
});

describe("tokensForLines", () => {
  const lines = displayLines(templateHunk.lines);
  const sideTokens = (side: string) => side.split("\n").map((text) => [token(text, "#123456")]);
  const { old: oldSide, new: newSide } = hunkSides(lines);

  it("takes deleted lines from the old side and the others from the new side", () => {
    const tokens = tokensForLines(lines, sideTokens(oldSide), sideTokens(newSide));
    expect(tokens.map((line) => line.map(({ text }) => text).join(""))).toEqual(
      lines.map(({ text }) => text),
    );
    expect(tokens.every((line) => line.every(({ light }) => light === "#123456"))).toBe(true);
  });

  it("leaves a side without tokens plain", () => {
    const tokens = tokensForLines(lines, null, sideTokens(newSide));
    expect(tokens[1]).toEqual([token("  SELECT id")]);
    expect(tokens[2]?.[0]?.light).toBe("#123456");
  });

  it("leaves a line plain when its tokens don't spell its text", () => {
    const wrong = sideTokens(newSide).map(() => [token("something else", "#123456")]);
    expect(tokensForLines(lines, null, wrong)[0]).toEqual([token("const query = `")]);
  });

  it("colors a changed line inside a multi-line string as part of the string", async () => {
    const highlighter = createShikiHighlighter();
    const tokens = tokensForLines(
      lines,
      await highlighter.highlight(oldSide, "typescript"),
      await highlighter.highlight(newSide, "typescript"),
    );
    const stringColor = tokens[3]?.[0]?.light;
    expect(stringColor).toMatch(/^#[0-9a-f]{6}$/);
    // The deleted and added lines are string content, not keywords and identifiers.
    expect(tokens[1]?.map(({ light }) => light)).toEqual([stringColor]);
    expect(tokens[2]?.map(({ light }) => light)).toEqual([stringColor]);
    // Outside the string, `run` is colored as a function.
    expect(tokens[4]?.[0]).toMatchObject({ text: "run" });
    expect(tokens[4]?.[0]?.light).not.toBe(stringColor);
  });
});

describe("createShikiHighlighter", () => {
  it("returns null for a language without a grammar", async () => {
    expect(await createShikiHighlighter().highlight("a", "weird")).toBeNull();
  });

  it("tokenizes each line and keeps long lines whole", async () => {
    const long = `const a = "${"x".repeat(1200)}";`;
    const tokens = await createShikiHighlighter().highlight(`let b = 1;\n${long}`, "typescript");
    expect(tokens).toHaveLength(2);
    expect(tokens?.[1]?.map(({ text }) => text).join("")).toBe(long);
    expect(tokens?.[1]).toHaveLength(1);
  });
});

describe("themeTokens", () => {
  it("leaves text in the themes' default colors plain and merges neighbors with one style", () => {
    expect(
      themeTokens(
        [
          shikiToken("const", "#CF222E", "#ff7b72"),
          shikiToken(" ", "#1f2328", "#e6edf3"),
          shikiToken("a", "#1F2328", "#E6EDF3"),
          shikiToken(" = ", "#1f2328", "#e6edf3"),
          shikiToken("1", "#0550ae", "#79c0ff"),
          shikiToken("2", "#0550ae", "#79c0ff"),
        ],
        FOREGROUNDS,
      ),
    ).toEqual([
      { ...token("const", "#cf222e"), dark: "#ff7b72" },
      token(" a = "),
      { ...token("12", "#0550ae"), dark: "#79c0ff" },
    ]);
  });

  it("reads italic and bold, and doesn't merge across them", () => {
    const [comment, strong] = themeTokens(
      [shikiToken("// a", "#59636e", "#9198a1", 1), shikiToken("b", "#59636e", "#9198a1", 2)],
      FOREGROUNDS,
    );
    expect(comment).toMatchObject({ text: "// a", italic: true, bold: false });
    expect(strong).toMatchObject({ text: "b", italic: false, bold: true });
  });
});

// WCAG 2 contrast, as in styles/tokens.test.ts.
const luminance = (hex: string): number => {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};
const contrast = (a: string, b: string): number => {
  const [lighter = 0, darker = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

const cssColors = (block: string): Map<string, string> =>
  new Map(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(([, name = "", hex = ""]) => [
      name,
      hex,
    ]),
  );
const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
const lightTokens = cssColors(css.slice(0, darkStart));
const darkTokens = new Map([...lightTokens, ...cssColors(css.slice(darkStart))]);

/** Every foreground a theme gives text, as themeTokens passes it on. */
const themeColors = (theme: ThemeRegistrationRaw, variant: "light" | "dark"): string[] => {
  const colors = new Set(
    (theme.tokenColors ?? []).flatMap(({ settings }) =>
      // Colors with their own background are for invalid code, which Shiki doesn't give a token.
      settings.foreground === undefined || settings.background !== undefined
        ? []
        : [settings.foreground],
    ),
  );
  return [...colors].flatMap((color) => {
    const [converted] = themeTokens([shikiToken("a", color, color)], { light: "", dark: "" });
    const out = converted?.[variant];
    return out === null || out === undefined ? [] : [out];
  });
};

describe.each([
  ["light", lightTheme, lightTokens] as const,
  ["dark", darkTheme, darkTokens] as const,
])("%s syntax colors", (variant, theme, tokens) => {
  const backgrounds = ["color-surface", "diff-added-bg", "diff-deleted-bg"];
  const color = (name: string) => tokens.get(name) ?? "";

  it.each(backgrounds)("meet AA (4.5:1) on %s", (background) => {
    expect(themeColors(theme, variant).length).toBeGreaterThan(5);
    const failing = themeColors(theme, variant).filter(
      (text) => contrast(color(background), text) < 4.5,
    );
    expect(failing).toEqual([]);
  });

  it.each(backgrounds)("line numbers meet AA on %s", (background) => {
    expect(contrast(color(background), color("color-text-muted"))).toBeGreaterThanOrEqual(4.5);
  });
});
