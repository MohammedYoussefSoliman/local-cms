import { cn } from '../../functions';

import type { DividerProps } from './Divider.types';

/** A full-bleed tinted strip, for grouping rows inside a list or a menu. */
function BarDivider({ children, className, contentClassName }: DividerProps) {
  return (
    <div
      data-slot="divider"
      className={cn('w-full bg-weak px-5 py-1.5', className)}
    >
      <div
        data-slot="divider-content"
        className={cn(
          'text-subheading-xs uppercase text-soft-medium',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A rule with an optional label sitting in a gap in the middle of it. */
function SplitDivider({
  children,
  className,
  lineClassName,
  contentClassName,
}: DividerProps) {
  return (
    <div
      data-slot="divider"
      className={cn('flex w-full items-center gap-3', className)}
    >
      <span
        data-slot="divider-line"
        className={cn('h-px flex-1 bg-soft-light', lineClassName)}
      />
      {!!children && (
        <>
          <span
            data-slot="divider-content"
            className={cn(
              'flex shrink-0 items-center text-subheading-2xs uppercase text-sub-dark',
              contentClassName,
            )}
          >
            {children}
          </span>
          <span
            data-slot="divider-line"
            className={cn('h-px flex-1 bg-soft-light', lineClassName)}
          />
        </>
      )}
    </div>
  );
}

export function Divider({ variant = 'split', ...props }: DividerProps) {
  return variant === 'bar' ? <BarDivider {...props} /> : <SplitDivider {...props} />;
}
