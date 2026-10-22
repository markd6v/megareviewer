import { describe, expect, it } from "vitest";
import { shortcutFor } from "./shortcuts.ts";

const press = (key: string, target: EventTarget | null = document.body, modifiers = {}) =>
  shortcutFor({ key, target, metaKey: false, ctrlKey: false, altKey: false, ...modifiers });

describe("shortcutFor", () => {
  it("maps each shortcut key to its action", () => {
    expect(["j", "k", "n", "p", "a", "r", "c", "Escape", "?"].map((key) => press(key))).toEqual([
      "next-hunk",
      "previous-hunk",
      "next-step",
      "previous-step",
      "approve",
      "reject",
      "comment",
      "escape",
      "help",
    ]);
    expect(press("x")).toBeNull();
    expect(press("J")).toBeNull();
  });

  it("ignores keys typed into text fields", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(press("a", document.createElement(tag))).toBeNull();
    }
  });

  it("leaves browser shortcuts alone", () => {
    expect(press("r", document.body, { metaKey: true })).toBeNull();
    expect(press("c", document.body, { ctrlKey: true })).toBeNull();
    expect(press("n", document.body, { altKey: true })).toBeNull();
  });
});
