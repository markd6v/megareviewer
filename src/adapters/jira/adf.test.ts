import { describe, expect, it } from "vitest";
import { adfToText, MAX_DESCRIPTION_LENGTH } from "./adf.ts";
import type { AdfNode } from "./schemas.ts";

const doc = (...content: AdfNode[]): AdfNode => ({ type: "doc", content });
const text = (value: string, ...marks: string[]): AdfNode => ({
  type: "text",
  text: value,
  ...(marks.length > 0 ? { marks: marks.map((type) => ({ type })) } : {}),
});
const paragraph = (...content: AdfNode[]): AdfNode => ({ type: "paragraph", content });
const item = (...content: AdfNode[]): AdfNode => ({ type: "listItem", content });
const bullets = (...items: AdfNode[]): AdfNode => ({ type: "bulletList", content: items });
const numbered = (items: AdfNode[], order?: number): AdfNode => ({
  type: "orderedList",
  ...(order === undefined ? {} : { attrs: { order } }),
  content: items,
});
const cell = (type: "tableHeader" | "tableCell", ...content: AdfNode[]): AdfNode => ({
  type,
  attrs: {},
  content,
});

describe("adfToText", () => {
  const cases: [name: string, document: AdfNode, expected: string][] = [
    [
      "paragraphs, separated by a blank line",
      doc(paragraph(text("One.")), paragraph(text("Two."))),
      "One.\n\nTwo.",
    ],
    [
      "text, keeping only the code mark",
      doc(
        paragraph(text("Call "), text("retry()", "code", "strong"), text(" twice", "em", "strong")),
      ),
      "Call `retry()` twice",
    ],
    [
      "hard breaks",
      doc(paragraph(text("line one"), { type: "hardBreak" }, text("line two"))),
      "line one\nline two",
    ],
    [
      "headings by level",
      doc(
        { type: "heading", attrs: { level: 1 }, content: [text("Title")] },
        { type: "heading", attrs: { level: 3 }, content: [text("Part")] },
      ),
      "# Title\n\n### Part",
    ],
    [
      "headings with a missing or out-of-range level",
      doc(
        { type: "heading", content: [text("No level")] },
        { type: "heading", attrs: { level: 9 }, content: [text("Too deep")] },
      ),
      "# No level\n\n###### Too deep",
    ],
    [
      "bullet lists",
      doc(bullets(item(paragraph(text("a"))), item(paragraph(text("b"))))),
      "- a\n- b",
    ],
    [
      "ordered lists, numbered from their order",
      doc(numbered([item(paragraph(text("a"))), item(paragraph(text("b")))], 3)),
      "3. a\n4. b",
    ],
    [
      "nested lists, indented under their item",
      doc(
        bullets(
          item(
            paragraph(text("outer")),
            numbered([
              item(paragraph(text("first")), bullets(item(paragraph(text("deep"))))),
              item(paragraph(text("second"))),
            ]),
          ),
          item(paragraph(text("next"))),
        ),
      ),
      "- outer\n  1. first\n     - deep\n  2. second\n- next",
    ],
    [
      "list items with several paragraphs and a hard break",
      doc(
        numbered([
          item(
            paragraph(text("para one"), { type: "hardBreak" }, text("broken")),
            paragraph(text("para two")),
          ),
        ]),
      ),
      "1. para one\n   broken\n   para two",
    ],
    ["list children that aren't list items", doc(bullets(paragraph(text("stray")))), "- stray"],
    [
      "list items outside a list, without a marker",
      doc(item(paragraph(text("one")), paragraph(text("two")))),
      "one\ntwo",
    ],
    [
      "code blocks, fenced with their language",
      doc({
        type: "codeBlock",
        attrs: { language: "ts" },
        content: [text("const a = 1;\nconst b = 2;")],
      }),
      "```ts\nconst a = 1;\nconst b = 2;\n```",
    ],
    [
      "code blocks without a language, containing a fence",
      doc({ type: "codeBlock", content: [text("```\nnot the end\n```")] }),
      "````\n```\nnot the end\n```\n````",
    ],
    [
      "blockquotes, every line prefixed",
      doc({
        type: "blockquote",
        content: [
          paragraph(text("one"), { type: "hardBreak" }, text("two")),
          paragraph(text("three")),
        ],
      }),
      "> one\n> two\n>\n> three",
    ],
    [
      "mentions, with one @",
      doc(
        paragraph(
          { type: "mention", attrs: { id: "1", text: "@Sam Doe" } },
          text(" and "),
          { type: "mention", attrs: { id: "2", text: "Kim" } },
          text(" and "),
          { type: "mention", attrs: { id: "3" } },
        ),
      ),
      "@Sam Doe and @Kim and @someone",
    ],
    [
      "inline and block cards, as their URL",
      doc(
        paragraph(text("See "), { type: "inlineCard", attrs: { url: "https://example.com/a" } }),
        { type: "blockCard", attrs: { url: "https://example.com/b" } },
        { type: "embedCard", attrs: { url: "https://example.com/c", layout: "wide" } },
      ),
      "See https://example.com/a\n\nhttps://example.com/b\n\nhttps://example.com/c",
    ],
    [
      "emoji, as their short name, else their text",
      doc(
        paragraph(
          { type: "emoji", attrs: { shortName: ":tada:", text: "🎉" } },
          { type: "emoji", attrs: { text: "🙂" } },
        ),
      ),
      ":tada:🙂",
    ],
    [
      "tables, one line per row",
      doc({
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              cell("tableHeader", paragraph(text("Name"))),
              cell("tableHeader", paragraph(text("Note"))),
            ],
          },
          {
            type: "tableRow",
            content: [
              cell("tableCell", paragraph(text("a"))),
              cell("tableCell", paragraph(text("two")), paragraph(text("paragraphs"))),
            ],
          },
        ],
      }),
      "Name | Note\na | two paragraphs",
    ],
    [
      "rules",
      doc(paragraph(text("above")), { type: "rule" }, paragraph(text("below"))),
      "above\n\n---\n\nbelow",
    ],
    [
      "unknown blocks, through their content",
      doc({
        type: "panel",
        attrs: { panelType: "note" },
        content: [paragraph(text("inside")), paragraph(text("panel"))],
      }),
      "inside\n\npanel",
    ],
    [
      "unknown inline nodes, through their content, in one block",
      doc({
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { state: "TODO" },
            content: [text("Buy "), text("milk", "strong")],
          },
          { type: "taskItem", attrs: { state: "DONE" }, content: [text("Ship it")] },
        ],
      }),
      "Buy milk\n\nShip it",
    ],
    [
      "unknown nodes without content, ignored",
      doc(
        paragraph(text("before"), { type: "status", attrs: { text: "DONE" } }),
        { type: "mediaSingle", content: [{ type: "media", attrs: { id: "x" } }] },
        paragraph(text("after")),
      ),
      "before\n\nafter",
    ],
    ["an empty document", doc(), ""],
  ];

  it.each(cases)("renders %s", (_, document, expected) => {
    expect(adfToText(document)).toBe(expected);
  });

  it("renders a missing description as empty", () => {
    expect(adfToText(null)).toBe("");
    expect(adfToText(undefined)).toBe("");
  });

  it("keeps a description at the limit whole", () => {
    const value = "a".repeat(MAX_DESCRIPTION_LENGTH);
    expect(adfToText(doc(paragraph(text(value))))).toBe(value);
  });

  it("cuts a longer description at the limit and says so", () => {
    const result = adfToText(doc(paragraph(text("a".repeat(MAX_DESCRIPTION_LENGTH + 1)))));
    expect(result).toBe(
      `${"a".repeat(MAX_DESCRIPTION_LENGTH)}\n[description truncated at 8,000 characters]`,
    );
  });

  it("doesn't split a surrogate pair at the cut", () => {
    const value = `${"a".repeat(MAX_DESCRIPTION_LENGTH - 1)}😀 and more`;
    const result = adfToText(doc(paragraph(text(value))));
    expect(result).toBe(
      `${"a".repeat(MAX_DESCRIPTION_LENGTH - 1)}\n[description truncated at 8,000 characters]`,
    );
  });
});
