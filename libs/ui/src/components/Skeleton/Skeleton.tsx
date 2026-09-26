import { cn } from '../../functions';

import type { SkeletonProps } from './Skeleton.types';

/**
 * The only pulse primitive in the dashboard. Size it with `className` to match
 * the element it stands in for — never wrap a page in one generic grey box.
 * The mapping from element to skeleton dimensions is in
 * `.claude/rules/global-skeleton-loading.md` Rule 2.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      data-testid="skeleton"
      className={cn('h-4 w-full animate-pulse rounded-4 bg-sub-light', className)}
      {...props}
    />
  );
}
