import { Skeleton } from '@cms/ui';

/** The fold, not the page size — a 20-row skeleton animates work nobody sees. */
const ROWS = 8;

/**
 * Mirrors `DraftsTable` column for column: same card wrapper, same header
 * strip, same six columns at the same widths, so the swap to real content does
 * not move anything (`.claude/rules/global-skeleton-loading.md` Rules 1 and 5).
 */
export function DraftsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-12 border border-soft-light bg-white">
      <div className="flex items-center gap-3 bg-weak px-3 py-2.5">
        <Skeleton className="size-4 rounded-4" />
        <Skeleton className="h-3 w-16 rounded-4" />
        <Skeleton className="h-3 w-12 rounded-4" />
        <Skeleton className="h-3 w-20 rounded-4" />
      </div>

      <div className="flex flex-col">
        {Array.from({ length: ROWS }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-b border-soft-light p-3 last:border-b-0"
          >
            <Skeleton className="size-4 shrink-0 rounded-4" />
            <div className="flex w-44 shrink-0 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-40 rounded-4" />
              <Skeleton className="h-3 w-24 rounded-4" />
            </div>
            <Skeleton className="h-5 w-10 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 flex-1 rounded-4" />
            <Skeleton className="h-3 w-28 shrink-0 rounded-4" />
            <Skeleton className="h-8 w-16 shrink-0 rounded-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
