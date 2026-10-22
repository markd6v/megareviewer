import { describe, expect, it } from "vitest";
import { browserCommand } from "./open-browser.ts";

const URL = "http://127.0.0.1:4823/?token=abc";

describe("browserCommand", () => {
  it.each([
    ["darwin", ["open", [URL]]],
    ["win32", ["cmd", ["/c", "start", '""', URL]]],
    ["linux", ["xdg-open", [URL]]],
    ["freebsd", ["xdg-open", [URL]]],
  ] as const)("on %s", (platform, command) => {
    expect(browserCommand(URL, platform)).toEqual(command);
  });
});
