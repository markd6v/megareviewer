import { describe, expect, it } from "vitest";
import { fixtureAnalysisView } from "../../dev/fixtures/index.ts";
import { type AnalysisStreamEvent, type EventStream, subscribeToAnalysis } from "./events.ts";

const id = fixtureAnalysisView.analysis.id;

class FakeEventStream implements EventStream {
  readyState = 0;
  closed = false;
  private readonly listeners = new Map<string, (() => void)[]>();

  readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  emit(type: string, readyState = this.readyState) {
    this.readyState = readyState;
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

const subscribe = () => {
  const events: AnalysisStreamEvent[] = [];
  let stream: FakeEventStream | undefined;
  const unsubscribe = subscribeToAnalysis(
    id,
    "a b",
    (event) => events.push(event),
    (url) => {
      stream = new FakeEventStream(url);
      return stream;
    },
  );
  if (stream === undefined) throw new Error("no stream opened");
  return { events, stream, unsubscribe };
};

describe("subscribeToAnalysis", () => {
  it("opens the analysis's event stream with the token in the query", () => {
    expect(subscribe().stream.url).toBe(`/api/analyses/${id}/events?token=a+b`);
  });

  it("reports each update as a change", () => {
    const { events, stream } = subscribe();
    stream.emit("open", 1);
    stream.emit("updated");
    stream.emit("updated");
    expect(events).toEqual([{ type: "changed" }, { type: "changed" }]);
  });

  it("closes the stream on done", () => {
    const { events, stream } = subscribe();
    stream.emit("done");
    expect(events).toEqual([{ type: "done" }]);
    expect(stream.closed).toBe(true);
  });

  it("reports a reconnect as a change, since events may have been missed", () => {
    const { events, stream } = subscribe();
    stream.emit("open", 1);
    stream.emit("error", 0);
    expect(events).toEqual([]);
    stream.emit("open", 1);
    expect(events).toEqual([{ type: "changed" }]);
  });

  it("reports a stream the server refused, once", () => {
    const { events, stream } = subscribe();
    stream.emit("error", 2);
    stream.emit("error", 2);
    expect(events).toEqual([{ type: "closed" }]);
  });

  it("closes the stream on unsubscribe", () => {
    const { stream, unsubscribe } = subscribe();
    unsubscribe();
    expect(stream.closed).toBe(true);
  });
});
