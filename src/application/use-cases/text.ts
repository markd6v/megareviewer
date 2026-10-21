/** "1 hunk", "3 hunks". */
export const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** Maps with at most `limit` calls in flight, keeping the input order. */
export const mapLimit = async <T, R>(
  items: readonly T[],
  limit: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  const queue = [...items.entries()];
  const worker = async (): Promise<void> => {
    for (let entry = queue.shift(); entry !== undefined; entry = queue.shift()) {
      const [index, item] = entry;
      results[index] = await map(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};
