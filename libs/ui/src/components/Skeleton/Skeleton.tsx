import { cn } from '../../functions/cn';

import type { SkeletonProps } from './Skeleton.types';

/**
 * The only skeleton primitive. Sizing comes from `className`; the pulse and
 * base colour are fixed so every loading state in the product animates
 * identically.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded bg-neutral-200', className)}
      {...props}
    />
  );
}
