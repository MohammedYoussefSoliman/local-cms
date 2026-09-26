import { cn } from '@cms/ui';

import { splitPlaceholders } from './functions';

import type { ValueTextProps } from './ValueText.types';


/**
 * Renders one translated value in its own language's reading direction, with
 * `{placeholders}` picked out as chips.
 *
 * `dir` is on the BLOCK, not inline: the value is a paragraph in its own
 * language and its *alignment* follows that language, which is what block `dir`
 * moves and inline `dir` does not
 * (`.claude/rules/global-rtl-direction.md` Rule 4).
 *
 * The placeholders go the other way — `dir="ltr"` + `inline-block`, so their
 * braces are not re-ordered inside an RTL sentence while the chip still sits
 * where the reading order puts it.
 */
export function ValueText({
  value,
  direction,
  truncate,
  className,
}: ValueTextProps) {
  return (
    <div
      dir={direction}
      title={truncate ? value : undefined}
      className={cn(
        'text-paragraph-sm text-strong',
        truncate && 'line-clamp-2',
        className,
      )}
    >
      {splitPlaceholders(value).map((segment, index) =>
        segment.kind === 'placeholder' ? (
          <span
            key={index}
            dir="ltr"
            className="inline-block rounded-4 bg-primary-lighter px-1 font-mono text-label-xs text-primary-base"
          >
            {segment.text}
          </span>
        ) : (
          segment.text
        ),
      )}
    </div>
  );
}
