import { cn } from '../../functions';

import type { LtrTextProps } from './LtrText.types';

/**
 * Isolates a technical string — a locale code, an entry key, an email, an
 * endpoint — inside a text flow.
 *
 * `inline-block` is load-bearing. Phone numbers, IDs and keys read
 * left-to-right in every locale; dropped bare into an RTL paragraph they are
 * re-ordered (`+966533447788` renders as `966533447788+`). Isolating INLINE
 * fixes the characters while letting the RTL parent still place the span at the
 * reading start. A block-level `dir="ltr"` would also drag the alignment to the
 * left edge of an otherwise right-aligned panel — see
 * `.claude/rules/global-rtl-direction.md` Rule 4.
 */
export function LtrText({ mono, className, ...props }: LtrTextProps) {
  return (
    <span
      dir="ltr"
      className={cn('inline-block', mono && 'font-mono', className)}
      {...props}
    />
  );
}
