import { describe, expect, it } from "vitest";
import { ErrorCode } from "../../../contracts/index.ts";
import { errorMessage } from "./messages.ts";

describe("errorMessage", () => {
  it("has a message for every error code", () => {
    for (const code of [...ErrorCode.options, "unreachable" as const]) {
      expect(errorMessage({ code, message: "detail" })).not.toBe("");
    }
  });

  it("explains unsupported URLs without the server's wording", () => {
    expect(errorMessage({ code: "unsupported-url", message: "Not a GitHub URL" })).toBe(
      "Only github.com and bitbucket.org pull request links are supported.",
    );
  });

  it("keeps the server's detail where it says what went wrong", () => {
    expect(errorMessage({ code: "host-error", message: "GitHub returned 502" })).toBe(
      "The git host returned an error: GitHub returned 502.",
    );
    expect(
      errorMessage({ code: "host-not-configured", message: "Bitbucket isn't configured" }),
    ).toBe("Bitbucket isn't configured. Run npx megareviewer doctor to see how to set it up.");
    expect(errorMessage({ code: "not-found", message: "No analysis a_1." })).toBe(
      "No analysis a_1.",
    );
  });

  it("falls back when an internal error has no message", () => {
    expect(errorMessage({ code: "internal", message: " " })).toBe("Something went wrong.");
  });
});
