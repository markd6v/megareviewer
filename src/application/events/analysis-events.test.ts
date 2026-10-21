import { describe, expect, it } from "vitest";
import { AnalysisId } from "../../domain/review/index.ts";
import { type AnalysisEvent, createAnalysisEvents } from "./index.ts";

const a = AnalysisId.parse("a_0000000000000001");
const b = AnalysisId.parse("a_0000000000000002");
const updated: AnalysisEvent = { type: "updated", stage: "collect", status: "running" };

describe("createAnalysisEvents", () => {
  it("delivers events to the analysis's subscribers only", () => {
    const events = createAnalysisEvents();
    const seenA: AnalysisEvent[] = [];
    const seenB: AnalysisEvent[] = [];
    events.subscribe(a, (event) => seenA.push(event));
    events.subscribe(b, (event) => seenB.push(event));
    events.emit(a, updated);
    events.emit(a, { type: "done" });
    expect(seenA).toEqual([updated, { type: "done" }]);
    expect(seenB).toEqual([]);
  });

  it("doesn't buffer events for later subscribers", () => {
    const events = createAnalysisEvents();
    events.emit(a, updated);
    const seen: AnalysisEvent[] = [];
    events.subscribe(a, (event) => seen.push(event));
    expect(seen).toEqual([]);
  });

  it("stops delivering after unsubscribe, even mid-emit", () => {
    const events = createAnalysisEvents();
    const seen: string[] = [];
    const listener = () => seen.push("twice");
    const first = events.subscribe(a, listener);
    events.subscribe(a, listener);
    const unsubscribeSelf: () => void = events.subscribe(a, () => {
      seen.push("self");
      unsubscribeSelf();
    });
    events.emit(a, updated);
    first();
    first();
    events.emit(a, updated);
    expect(seen).toEqual(["twice", "twice", "self", "twice"]);
  });

  it("forgets an analysis once its last subscriber leaves", () => {
    const events = createAnalysisEvents();
    const seen: AnalysisEvent[] = [];
    events.subscribe(a, () => {})();
    events.subscribe(a, (event) => seen.push(event));
    events.emit(a, updated);
    expect(seen).toEqual([updated]);
  });
});
