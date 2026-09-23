import { MAX_KEY_LENGTH, flatten } from './load';

import type { FindingKind } from './report';

function collect() {
  const found: Array<{ kind: FindingKind; key?: string }> = [];
  return {
    found,
    report: (kind: FindingKind, _detail: string, key?: string) =>
      found.push({ kind, key }),
  };
}

describe('flatten', () => {
  it('turns nesting into dotted keys', () => {
    const { report, found } = collect();

    const keys = flatten(
      { checkout: { summary: { title: 'Summary' }, cta: 'Pay' } },
      report,
    );

    expect([...keys]).toEqual([
      ['checkout.summary.title', 'Summary'],
      ['checkout.cta', 'Pay'],
    ]);
    expect(found).toEqual([]);
  });

  it('keeps a source key that is already dotted', () => {
    const { report } = collect();

    expect([...flatten({ 'checkout.cta': 'Pay' }, report)]).toEqual([
      ['checkout.cta', 'Pay'],
    ]);
  });

  it('reports a non-string leaf rather than coercing it', () => {
    const { report, found } = collect();

    // A `0` stored as "0" reads as translated copy forever afterwards, and
    // nobody would know to look at it again.
    const keys = flatten({ count: 0, tags: ['a'], nothing: null }, report);

    expect([...keys]).toEqual([]);
    expect(found.map((finding) => finding.kind)).toEqual([
      'non_string_value',
      'non_string_value',
      'non_string_value',
    ]);
  });

  it('reports two shapes that collapse onto one key, and keeps the first', () => {
    const { report, found } = collect();

    const keys = flatten(
      { a: { b: 'from nesting' }, 'a.b': 'from a dotted key' },
      report,
    );

    expect(keys.get('a.b')).toBe('from nesting');
    expect(found).toEqual([{ kind: 'duplicate_key', key: 'a.b' }]);
  });

  it('reports a key the column cannot hold', () => {
    const { report, found } = collect();
    const long = 'k'.repeat(MAX_KEY_LENGTH + 1);

    expect(flatten({ [long]: 'value' }, report).size).toBe(0);
    expect(found).toEqual([{ kind: 'key_too_long', key: long }]);
  });

  it('reports a file that is not an object of strings', () => {
    const { report, found } = collect();

    expect(flatten('just a string', report).size).toBe(0);
    expect(found.map((finding) => finding.kind)).toEqual(['unreadable_file']);
  });
});
