import { Skeleton } from '@cms/ui';

const ROWS = 6;

/** Mirrors `LocalesTable`: same wrapper, same seven columns, same widths. */
export function LocalesTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-12 border border-soft-light bg-white">
      <div className="flex items-center gap-4 bg-weak px-3 py-2.5">
        <Skeleton className="h-3 w-10 rounded-4" />
        <Skeleton className="h-3 w-20 rounded-4" />
        <Skeleton className="h-3 w-24 rounded-4" />
      </div>
      {Array.from({ length: ROWS }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-soft-light p-3 last:border-b-0"
        >
          <Skeleton className="h-3.5 w-10 shrink-0 rounded-4" />
          <Skeleton className="h-3.5 w-24 shrink-0 rounded-4" />
          <Skeleton className="h-3.5 w-28 shrink-0 rounded-4" />
          <Skeleton className="h-3.5 w-32 shrink-0 rounded-4" />
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 w-20 shrink-0 rounded-4" />
          <Skeleton className="ms-auto h-8 w-20 shrink-0 rounded-8" />
        </div>
      ))}
    </div>
  );
}
