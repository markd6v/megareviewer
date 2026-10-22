import { createContext, useContext, useEffect, useState } from "react";
import type { FileChange, Hunk } from "../../../src/domain/diff/index.ts";
import {
  createShikiHighlighter,
  type Highlighter,
  hunkSides,
  languageOf,
  tokensForLines,
} from "./highlight.ts";
import { displayLines } from "./lines.ts";
import type { CodeToken } from "./tokens.ts";

/** Tests provide a fake; the app uses Shiki. */
export const HighlighterContext = createContext<Highlighter>(createShikiHighlighter());

type LineTokens = readonly (readonly CodeToken[])[];

interface Entry {
  readonly promise: Promise<LineTokens>;
  value: LineTokens | null;
}

// Hunk IDs name their content, so a card expanded again, or a refetched view, highlights from here.
const caches = new WeakMap<Highlighter, Map<string, Entry>>();

const highlightHunk = (highlighter: Highlighter, hunk: Hunk, language: string): Entry => {
  const cache = caches.get(highlighter) ?? new Map<string, Entry>();
  caches.set(highlighter, cache);
  const key = `${language}\0${hunk.id}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const lines = displayLines(hunk.lines);
  const sides = hunkSides(lines);
  const hasOld = lines.some(({ line }) => line.kind !== "add");
  const hasNew = lines.some(({ line }) => line.kind !== "del");
  const side = (code: string, present: boolean) =>
    present ? highlighter.highlight(code, language) : Promise.resolve(null);
  const entry: Entry = {
    promise: Promise.all([side(sides.old, hasOld), side(sides.new, hasNew)]).then(
      ([oldTokens, newTokens]) => {
        const tokens = tokensForLines(lines, oldTokens, newTokens);
        entry.value = tokens;
        return tokens;
      },
    ),
    value: null,
  };
  cache.set(key, entry);
  return entry;
};

/**
 * Highlighted tokens for each of a hunk's lines, or null until they're ready (show plain text
 * until then) and for files in languages that can't be highlighted.
 */
export const useHighlighter = (hunk: Hunk, file: Pick<FileChange, "path" | "language">) => {
  const highlighter = useContext(HighlighterContext);
  const language = languageOf(file);
  const entry = language === null ? null : highlightHunk(highlighter, hunk, language);
  const [ready, setReady] = useState<{ readonly entry: Entry; readonly tokens: LineTokens }>();

  useEffect(() => {
    if (entry === null || entry.value !== null) return;
    let current = true;
    void entry.promise.then((tokens) => {
      if (current) setReady({ entry, tokens });
    });
    return () => {
      current = false;
    };
  }, [entry]);

  return entry?.value ?? (ready?.entry === entry ? ready.tokens : null);
};
