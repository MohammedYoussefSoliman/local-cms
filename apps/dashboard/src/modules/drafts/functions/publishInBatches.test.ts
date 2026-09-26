import { describe, expect, it, vi } from 'vitest';

import { publishInBatches } from './publishInBatches';

describe('publishInBatches', () => {
  it('never runs more than `limit` tasks at once', async () => {
    let inFlight = 0;
    let peak = 0;

    const task = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return 'ok';
    });

    await publishInBatches(Array.from({ length: 12 }), 4, task);

    expect(task).toHaveBeenCalledTimes(12);
    expect(peak).toBeLessThanOrEqual(4);
  });

  it('preserves input order even when tasks finish out of order', async () => {
    const items = [30, 5, 20, 1];

    const results = await publishInBatches(items, 4, async (delay) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return delay;
    });

    expect(results.map((r) => (r.ok ? r.value : null))).toEqual(items);
  });

  it('resolves rather than rejecting when every task fails', async () => {
    const results = await publishInBatches([1, 2, 3], 2, async () => {
      throw new Error('nope');
    });

    expect(results).toHaveLength(3);
    expect(results.every((result) => !result.ok)).toBe(true);
  });

  it('keeps successes alongside failures', async () => {
    const results = await publishInBatches([1, 2, 3, 4], 2, async (n) => {
      if (n % 2 === 0) throw new Error('even');
      return n;
    });

    expect(results.map((r) => r.ok)).toEqual([true, false, true, false]);
  });

  it('handles an empty list without spawning a worker', async () => {
    const task = vi.fn();
    const results = await publishInBatches([], 4, task);

    expect(results).toEqual([]);
    expect(task).not.toHaveBeenCalled();
  });
});
