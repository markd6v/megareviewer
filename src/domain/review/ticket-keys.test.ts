import { describe, expect, it } from "vitest";
import { extractTicketKeys } from "./index.ts";

describe("extractTicketKeys", () => {
  it.each([
    [["Implements SHOP-123"], ["SHOP-123"]],
    [["PAY-42-fix-null"], ["PAY-42"]],
    [["feature/AB2-7_retry"], []],
    [["feature/AB2-7-retry"], ["AB2-7"]],
    [["(SHOP-1), [SHOP-2]: SHOP-3."], ["SHOP-1", "SHOP-2", "SHOP-3"]],
    [
      ["SHOP-2 then SHOP-1", "SHOP-1 again, SHOP-3"],
      ["SHOP-2", "SHOP-1", "SHOP-3"],
    ],
    [["shop-123 and Shop-123"], []],
    [["A-1 is too short"], []],
    [["SHOP-123abc"], []],
    [["SHOP-"], []],
    [[""], []],
    [[], []],
  ])("finds keys in %j", (texts, expected) => {
    expect(extractTicketKeys(texts)).toEqual(expected);
  });

  it.each([
    ["UTF-8"],
    ["UTF-16"],
    ["SHA-1"],
    ["SHA-256"],
    ["SHA-512"],
    ["ISO-8601"],
    ["RFC-7231"],
    ["CVE-2024-3094"],
    ["X-SHOP-1"],
    ["x-SHOP-1"],
    ["header X-RATE-10 set"],
  ])("ignores the non-ticket token in %j", (text) => {
    expect(extractTicketKeys([text, "SHOP-9"])).toEqual(["SHOP-9"]);
  });

  it("only treats X- as a header prefix at the start of a token", () => {
    expect(extractTicketKeys(["BOX-SHOP-1", "box-SHOP-2"])).toEqual(["SHOP-1", "SHOP-2"]);
  });
});
