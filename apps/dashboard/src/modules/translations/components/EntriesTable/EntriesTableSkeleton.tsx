import { Skeleton } from '@cms/ui';

const ROWS = 8;

/**
 * Column count follows the locale count, so the skeleton has the same shape as
 * the table it stands in for even when an app serves five languages.
 */
export function EntriesTableSkeleton({ localeCount }: { localeCount: number }) {
  const columns = Math.max(localeCount, 1);

  return (
    <div className="overflow-hidden rounded-12 border border-soft-light bg-white">
      <div className="flex items-center gap-4 bg-weak px-3 py-2.5">
        <Skeleton className="h-3 w-20 rounded-4" />
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-16 rounded-4" />
        ))}
      </div>

      {Array.from({ length: ROWS }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-soft-light p-3 last:border-b-0"
        >
          <Skeleton className="h-3.5 w-44 shrink-0 rounded-4" />
          {Array.from({ length: columns }).map((_, cellIndex) => (
            <Skeleton key={cellIndex} className="h-3.5 flex-1 rounded-4" />
          ))}
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}
