export type Settled<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

/**
 * Runs `task` over `items` with at most `limit` in flight, preserving input
 * order in the result and never rejecting — each item settles into
 * `{ ok: true, value } | { ok: false, error }`.
 *
 * Bounded on purpose. Every publish is a transaction holding a row lock, and
 * the API throttles at 120/min per IP: an unbounded `Promise.all` over a
 * 400-row queue would 429 halfway through and report a rate limit as a content
 * error.
 */
export async function publishInBatches<TItem, TResult>(
  items: TItem[],
  limit: number,
  task: (item: TItem) => Promise<TResult>,
): Promise<Settled<TResult>[]> {
  const results: Settled<TResult>[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      // Read and advance in one step — two workers must never take the same
      // index, and there is no await between these two lines.
      const index = cursor;
      cursor += 1;

      try {
        results[index] = { ok: true, value: await task(items[index]) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    worker,
  );
  await Promise.all(workers);

  return results;
}
