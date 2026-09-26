import { Skeleton } from '@cms/ui';

export type StatTileProps = {
  label: string;
  value: number | undefined;
  note: string;
  isLoading?: boolean;
};

/**
 * One headline number.
 *
 * `h-8` for the figure matches the `text-title-lg` it replaces, per the
 * skeleton rule's element-to-dimension table — a generic `h-4` here makes the
 * card shrink and jump when the number lands.
 */
export function StatTile({ label, value, note, isLoading }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-12 border border-soft-light bg-white p-4">
      <span className="text-paragraph-xs text-sub-dark">{label}</span>
      {isLoading ? (
        <Skeleton className="h-8 w-16 rounded-4" />
      ) : (
        <span className="text-title-lg text-strong">{value ?? 0}</span>
      )}
      <span className="text-paragraph-xs text-sub-dark">{note}</span>
    </div>
  );
}
