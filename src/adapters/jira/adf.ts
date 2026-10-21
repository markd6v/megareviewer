import type { AdfNode } from "./schemas.ts";

export const MAX_DESCRIPTION_LENGTH = 8_000;
const TRUNCATION_MARKER = "\n[description truncated at 8,000 characters]";

/** Nodes that sit inside a paragraph. A run of them renders as one block of text. */
const INLINE = new Set([
  "text",
  "hardBreak",
  "mention",
  "emoji",
  "inlineCard",
  "date",
  "status",
  "placeholder",
  "inlineExtension",
  "mediaInline",
]);

const stringAttr = (node: AdfNode, name: string): string | null => {
  const value = node.attrs?.[name];
  return typeof value === "string" ? value : null;
};

const numberAttr = (node: AdfNode, name: string): number | null => {
  const value = node.attrs?.[name];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
};

const inline = (node: AdfNode): string => {
  switch (node.type) {
    case "text": {
      const text = node.text ?? "";
      return node.marks?.some((mark) => mark.type === "code") ? `\`${text}\`` : text;
    }
    case "hardBreak":
      return "\n";
    case "mention":
      // Jira's display text usually starts with "@" already.
      return `@${(stringAttr(node, "text") ?? "").replace(/^@/, "") || "someone"}`;
    case "emoji":
      return stringAttr(node, "shortName") ?? stringAttr(node, "text") ?? "";
    case "inlineCard":
      return stringAttr(node, "url") ?? "";
    default:
      return renderInline(node.content ?? []);
  }
};

const renderInline = (nodes: readonly AdfNode[]): string => nodes.map(inline).join("");

/** Renders block nodes, joining them with `separator`. Inline runs between blocks become blocks. */
const renderBlocks = (nodes: readonly AdfNode[], separator: string): string => {
  const parts: string[] = [];
  let run: AdfNode[] = [];
  const flush = (): void => {
    if (run.length > 0) parts.push(renderInline(run));
    run = [];
  };
  for (const node of nodes) {
    if (INLINE.has(node.type)) {
      run.push(node);
    } else {
      flush();
      parts.push(block(node));
    }
  }
  flush();
  return parts.filter((part) => part.trim() !== "").join(separator);
};

/** Prefixes the first line with `marker` and indents the rest to line up under it. */
const hang = (marker: string, text: string): string =>
  text
    .split("\n")
    .map((line, index) =>
      index === 0 ? marker + line : line === "" ? "" : " ".repeat(marker.length) + line,
    )
    .join("\n");

const list = (node: AdfNode, marker: (index: number) => string): string =>
  (node.content ?? [])
    .map((item, index) =>
      hang(
        marker(index),
        renderBlocks(item.type === "listItem" ? (item.content ?? []) : [item], "\n"),
      ),
    )
    .join("\n");

const codeBlock = (node: AdfNode): string => {
  const code = (node.content ?? []).map((child) => child.text ?? "").join("");
  // A fence longer than any backtick run in the code, so the code can't close it.
  const longestRun = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}${stringAttr(node, "language") ?? ""}\n${code}\n${fence}`;
};

const tableRow = (row: AdfNode): string =>
  (row.content ?? [])
    .map((cell) =>
      renderBlocks(cell.content ?? [], " ")
        .replace(/\s*\n\s*/g, " ")
        .trim(),
    )
    .join(" | ");

const block = (node: AdfNode): string => {
  switch (node.type) {
    case "paragraph":
      return renderInline(node.content ?? []);
    case "heading": {
      const level = Math.min(6, Math.max(1, numberAttr(node, "level") ?? 1));
      return `${"#".repeat(level)} ${renderInline(node.content ?? [])}`;
    }
    case "bulletList":
      return list(node, () => "- ");
    case "orderedList": {
      const start = numberAttr(node, "order") ?? 1;
      return list(node, (index) => `${start + index}. `);
    }
    case "listItem":
      return renderBlocks(node.content ?? [], "\n");
    case "codeBlock":
      return codeBlock(node);
    case "blockquote":
      return renderBlocks(node.content ?? [], "\n\n")
        .split("\n")
        .map((line) => (line === "" ? ">" : `> ${line}`))
        .join("\n");
    case "blockCard":
    case "embedCard":
      return stringAttr(node, "url") ?? "";
    case "table":
      return (node.content ?? []).map(tableRow).join("\n");
    case "rule":
      return "---";
    default:
      return renderBlocks(node.content ?? [], "\n\n");
  }
};

/** Cuts at the limit without splitting a surrogate pair, and says so. */
const truncate = (text: string): string => {
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
  const lastCode = text.charCodeAt(MAX_DESCRIPTION_LENGTH - 1);
  const end =
    lastCode >= 0xd800 && lastCode <= 0xdbff ? MAX_DESCRIPTION_LENGTH - 1 : MAX_DESCRIPTION_LENGTH;
  return text.slice(0, end) + TRUNCATION_MARKER;
};

/** A Jira description as plain text with light Markdown, at most MAX_DESCRIPTION_LENGTH long. */
export const adfToText = (document: AdfNode | null | undefined): string =>
  document == null ? "" : truncate(block(document).trim());
