import { describe, expect, it } from 'vitest';

import { splitPlaceholders } from './splitPlaceholders';

describe('splitPlaceholders', () => {
  it('splits text around a placeholder', () => {
    expect(splitPlaceholders('Hi {name}!')).toEqual([
      { kind: 'text', text: 'Hi ' },
      { kind: 'placeholder', text: '{name}' },
      { kind: 'text', text: '!' },
    ]);
  });

  it('returns a single text segment when there is nothing to pick out', () => {
    expect(splitPlaceholders('Add to cart')).toEqual([
      { kind: 'text', text: 'Add to cart' },
    ]);
  });

  it('does not match an ICU plural — its head only looks like a placeholder', () => {
    const segments = splitPlaceholders('{count, plural, one{#} other{#}}');

    expect(segments.every((segment) => segment.kind === 'text')).toBe(true);
  });

  it('does not match a bare brace', () => {
    expect(splitPlaceholders('a { b')).toEqual([
      { kind: 'text', text: 'a { b' },
    ]);
  });

  it('handles a value that is only a placeholder', () => {
    expect(splitPlaceholders('{name}')).toEqual([
      { kind: 'placeholder', text: '{name}' },
    ]);
  });

  it('returns nothing for an empty value', () => {
    expect(splitPlaceholders('')).toEqual([]);
  });
});
