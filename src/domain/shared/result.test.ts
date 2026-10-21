import { describe, expect, it } from "vitest";
import { err, ok, type Result } from "./index.ts";

describe("Result", () => {
  it("ok carries a value", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it("err carries an error", () => {
    expect(err("not found")).toEqual({ ok: false, error: "not found" });
  });

  it("narrows on ok", () => {
    const result: Result<number, string> = err("too large");
    const message = result.ok ? `value ${result.value}` : `error ${result.error}`;
    expect(message).toBe("error too large");
  });
});
