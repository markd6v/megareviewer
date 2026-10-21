import { readCString } from "./c-string.ts";

export type GeneratedAttribute = "linguist-generated" | "linguist-vendored";

const ATTRIBUTES: readonly GeneratedAttribute[] = ["linguist-generated", "linguist-vendored"];

const MATCH_ALL = /(?:)/;
const MATCH_NONE = /(?!)/;

interface Rule {
  readonly pattern: RegExp;
  /** true when the line sets the attribute; false when it unsets it or sets another value. */
  readonly settings: ReadonlyMap<GeneratedAttribute, boolean>;
}

/**
 * The subset of .gitattributes that marks files generated or vendored. Returns the first
 * attribute set for a path, or null. A pattern it can't read unsets its attributes for every
 * path, so it can only prove less than git would, never more.
 */
export const parseGitattributes = (text: string): ((path: string) => GeneratedAttribute | null) => {
  const rules = text.split("\n").flatMap((line): Rule[] => {
    const rule = parseRule(line.trim());
    return rule === null ? [] : [rule];
  });
  return (path) => {
    const set = new Map<GeneratedAttribute, boolean>();
    for (const rule of rules) {
      if (!rule.pattern.test(path)) continue;
      for (const [attribute, value] of rule.settings) set.set(attribute, value);
    }
    return ATTRIBUTES.find((attribute) => set.get(attribute) === true) ?? null;
  };
};

const parseRule = (line: string): Rule | null => {
  if (line === "" || line.startsWith("#") || line.startsWith("[attr]")) return null;
  const quoted = readCString(line);
  const space = line.search(/\s/);
  const [patternText, attributesText] = quoted
    ? [quoted.value, quoted.rest]
    : space === -1
      ? [line, ""]
      : [line.slice(0, space), line.slice(space)];

  const settings = new Map<GeneratedAttribute, boolean>();
  for (const token of attributesText.trim().split(/\s+/)) {
    const [, prefix = "", name = "", value] = /^([-!]?)([^=]+)(?:=(.*))?$/.exec(token) ?? [];
    if (!isGeneratedAttribute(name)) continue;
    settings.set(name, prefix === "" && (value === undefined || value === "true"));
  }
  if (settings.size === 0) return null;

  const pattern = patternToRegExp(patternText);
  if (pattern !== null) return { pattern, settings };
  return { pattern: MATCH_ALL, settings: new Map([...settings.keys()].map((a) => [a, false])) };
};

const isGeneratedAttribute = (name: string): name is GeneratedAttribute =>
  ATTRIBUTES.some((attribute) => attribute === name);

/**
 * Git's wildmatch rules for attribute patterns, or null for one this can't read. A pattern with
 * no slash matches the file name at any depth; one with a slash is relative to the repository
 * root. A trailing slash only matches directories, and git doesn't apply a pattern that matches a
 * directory to the files inside, so it never matches a file. Git ignores negated patterns.
 */
const patternToRegExp = (pattern: string): RegExp | null => {
  if (pattern.startsWith("!") || pattern.endsWith("/")) return MATCH_NONE;
  const anchored = pattern.includes("/");
  const body = pattern.startsWith("/") ? pattern.slice(1) : pattern;

  let regex = "";
  for (let i = 0; i < body.length; i++) {
    const char = body.charAt(i);
    if (char === "*" && body.charAt(i + 1) === "*") {
      const atStart = i === 0 || body.charAt(i - 1) === "/";
      const atEnd = i + 2 === body.length || body.charAt(i + 2) === "/";
      if (atStart && atEnd) {
        // "**/" matches zero or more directories; a final "/**" everything inside.
        regex += i + 2 === body.length ? ".*" : "(?:.*/)?";
        i += 2;
      } else {
        regex += "[^/]*";
        i += 1;
      }
    } else if (char === "*") {
      regex += "[^/]*";
    } else if (char === "?") {
      regex += "[^/]";
    } else if (char === "[") {
      const end = body.indexOf("]", i + 2);
      if (end === -1) return null;
      const inner = body
        .slice(i + 1, end)
        .replace(/^[!^]/, "^")
        .replace(/\\/g, "\\\\");
      regex += `(?!/)[${inner}]`;
      i = end;
    } else if (char === "\\" && i + 1 < body.length) {
      regex += escapeRegExp(body.charAt(i + 1));
      i += 1;
    } else {
      regex += escapeRegExp(char);
    }
  }
  try {
    return new RegExp(anchored ? `^${regex}$` : `^(?:.*/)?${regex}$`, "s");
  } catch {
    // A character class git accepts but RegExp doesn't, such as "[z-a]".
    return null;
  }
};

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");
