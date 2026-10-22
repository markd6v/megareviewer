import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type {
  AnalysisId,
  DecisionId,
  DecisionVerdict,
  Verdict,
} from "../../../../src/domain/review/index.ts";
import { errorMessage, useApi } from "../../api/index.ts";

export interface Draft {
  readonly verdict: Verdict;
  readonly comment: string;
}

export type SaveStatus = "waiting" | "saving" | "saved" | "failed";

export interface SaveFailure {
  readonly decisionId: DecisionId;
  readonly what: "verdict" | "comment";
  readonly message: string;
}

/** Comments save once typing pauses for this long. */
export const COMMENT_SAVE_DELAY_MS = 500;

const PENDING: Draft = { verdict: "pending", comment: "" };

/**
 * The reviewer's verdicts and comments. Verdicts save at once and show optimistically, rolling back
 * if the save fails; comments save after a pause in typing. Every save sends both, so the last one
 * to land holds the whole state.
 */
export const useVerdicts = (analysisId: AnalysisId, saved: readonly DecisionVerdict[]) => {
  const { client } = useApi();
  // What the reviewer changed on this page; anything else is as the server last sent it.
  const changed = useRef(new Map<DecisionId, Draft>());
  const confirmed = useRef(new Map<DecisionId, Draft>());
  const sequence = useRef(new Map<DecisionId, number>());
  const timers = useRef(new Map<DecisionId, ReturnType<typeof setTimeout>>());
  const inFlight = useRef(new Set<Promise<void>>());
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const [status, setStatus] = useState<ReadonlyMap<DecisionId, SaveStatus>>(new Map());
  const [failure, setFailure] = useState<SaveFailure | null>(null);

  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  const serverDraft = useCallback((id: DecisionId, verdicts: readonly DecisionVerdict[]): Draft => {
    const found = confirmed.current.get(id) ?? verdicts.find((v) => v.decisionId === id);
    return found === undefined ? PENDING : { verdict: found.verdict, comment: found.comment };
  }, []);
  const latestDraft = useCallback(
    (id: DecisionId): Draft => changed.current.get(id) ?? serverDraft(id, savedRef.current),
    [serverDraft],
  );

  const draftOf = (id: DecisionId): Draft => changed.current.get(id) ?? serverDraft(id, saved);

  const setStatusOf = useCallback((id: DecisionId, next: SaveStatus) => {
    setStatus((previous) => new Map(previous).set(id, next));
  }, []);

  const send = useCallback(
    async (id: DecisionId, what: SaveFailure["what"]) => {
      const draft = latestDraft(id);
      const count = (sequence.current.get(id) ?? 0) + 1;
      sequence.current.set(id, count);
      setStatusOf(id, "saving");
      const result = await client.putVerdict(analysisId, id, draft);
      // A newer save of this decision carries everything this one did.
      if (sequence.current.get(id) !== count) return;
      if (result.ok) {
        confirmed.current.set(id, { verdict: result.value.verdict, comment: result.value.comment });
        setStatusOf(id, "saved");
        setFailure((previous) => (previous?.decisionId === id ? null : previous));
        return;
      }
      setStatusOf(id, "failed");
      setFailure({ decisionId: id, what, message: errorMessage(result.error) });
      if (what === "verdict") {
        // Roll the verdict back; keep what was typed, so no comment is lost.
        const current = changed.current.get(id) ?? draft;
        changed.current.set(id, {
          ...current,
          verdict: serverDraft(id, savedRef.current).verdict,
        });
        rerender();
      }
    },
    [analysisId, client, latestDraft, serverDraft, setStatusOf],
  );

  const save = useCallback(
    (id: DecisionId, what: SaveFailure["what"]) => {
      const saving = send(id, what);
      inFlight.current.add(saving);
      void saving.finally(() => inFlight.current.delete(saving));
      return saving;
    },
    [send],
  );

  /** Saves comments still waiting for their pause, and waits for every save to land. */
  const flush = useCallback(async () => {
    for (const [id, timer] of timers.current) {
      clearTimeout(timer);
      void save(id, "comment");
    }
    timers.current.clear();
    await Promise.all(inFlight.current);
  }, [save]);

  const setVerdict = useCallback(
    (id: DecisionId, verdict: Verdict) => {
      changed.current.set(id, { ...latestDraft(id), verdict });
      // The verdict's save takes the comment along.
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      rerender();
      void save(id, "verdict");
    },
    [latestDraft, save],
  );

  const setComment = useCallback(
    (id: DecisionId, comment: string) => {
      changed.current.set(id, { ...latestDraft(id), comment });
      clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          void save(id, "comment");
        }, COMMENT_SAVE_DELAY_MS),
      );
      setStatusOf(id, "waiting");
      rerender();
    },
    [latestDraft, save, setStatusOf],
  );

  // Leaving the page saves comments still waiting for their pause.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const [id, timer] of pending) {
        clearTimeout(timer);
        void save(id, "comment");
      }
      pending.clear();
    };
  }, [save]);

  return {
    draftOf,
    setVerdict,
    setComment,
    statusOf: (id: DecisionId): SaveStatus | null => status.get(id) ?? null,
    flush,
    failure,
    dismissFailure: () => setFailure(null),
  };
};
