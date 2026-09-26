/** One segment of a value, split for placeholder highlighting. */
export type ValueSegment =
  | { kind: 'text'; text: string }
  | { kind: 'placeholder'; text: string };

/**
 * Matches `{identifier}` and nothing else.
 *
 * ICU `{count, plural, one{#} other{#}}` deliberately does NOT match: its first
 * token looks like a placeholder but the rest is syntax, and chipping only the
 * head reads as corruption. The editor is where ICU gets a real renderer.
 */
const PLACEHOLDER = /\{[A-Za-z_][A-Za-z0-9_]*\}/g;

/**
 * Splits a value into plain text and `{placeholder}` segments so the UI can
 * render the placeholders as chips.
 */
export function splitPlaceholders(value: string): ValueSegment[] {
  const segments: ValueSegment[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(PLACEHOLDER)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ kind: 'text', text: value.slice(lastIndex, start) });
    }
    segments.push({ kind: 'placeholder', text: match[0] });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push({ kind: 'text', text: value.slice(lastIndex) });
  }

  return segments;
}
