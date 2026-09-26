import { cn } from '../../functions';

import type { ProgressBarProps } from './ProgressBar.types';

/**
 * A stacked bar — published / draft / missing, in one track.
 *
 * Width is the one legitimate inline style in the system: the value only
 * exists at runtime and no class can hold it
 * (`.claude/rules/global-react-components.md`, Styling). The unit stays
 * relative and everything static about the element stays in classes.
 *
 * Laid out with flex, so the segments fill from the reading start in both
 * directions without a single `left`/`right`.
 */
export function ProgressBar({ segments, className }: ProgressBarProps) {
  return (
    <div
      className={cn(
        'flex h-1.5 w-full overflow-hidden rounded-full bg-soft-light',
        className,
      )}
    >
      {segments.map((segment, index) => (
        <div
          key={index}
          role="presentation"
          title={segment.label}
          className={cn('h-full', segment.className)}
          style={{ width: `${segment.value}%` }}
        />
      ))}
    </div>
  );
}
