import { Checkbox } from '@cms/ui';
import { useTranslation } from 'react-i18next';


import { DraftRow } from '../DraftRow';

import { DraftsTableSkeleton } from './DraftsTableSkeleton';

import type { DraftsTableProps } from './DraftsTable.types';


/**
 * The queue.
 *
 * Hand-rolled rather than driven by `@cms/ui`'s `Table` because a row here can
 * be followed by a full-width conflict disclosure — a second `<tr>` the column
 * model has no way to express.
 */
export function DraftsTable({
  rows,
  isLoading,
  selected,
  onToggleRow,
  onTogglePage,
  onPublishRow,
  onPublishVersion,
  onOpenInEditor,
  publishingId,
  failures,
}: DraftsTableProps) {
  const { t } = useTranslation('drafts');

  if (isLoading) return <DraftsTableSkeleton />;

  const selectedOnPage = rows.filter((row) => selected.has(row.id)).length;
  // Tri-state over THIS PAGE only, and the label says so — a "select all 412"
  // that silently means "the 20 you can see" is the bug this naming prevents.
  const pageState =
    selectedOnPage === 0
      ? false
      : selectedOnPage === rows.length
        ? true
        : 'indeterminate';

  function handleTogglePage(checked: boolean | 'indeterminate') {
    onTogglePage(checked === true);
  }

  return (
    <div className="overflow-hidden rounded-12 border border-soft-light bg-white">
      <table className="w-full">
        <thead>
          <tr className="bg-weak">
            <th className="w-px p-3">
              <Checkbox
                checked={pageState}
                onCheckedChange={handleTogglePage}
                aria-label={t('selectPage')}
              />
            </th>
            <th className="w-44 p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colKey')}
            </th>
            <th className="w-px p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colLocale')}
            </th>
            <th className="p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colValue')}
            </th>
            <th className="w-36 p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colAuthor')}
            </th>
            <th className="w-px p-3" />
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <DraftRow
              key={row.id}
              row={row}
              isSelected={selected.has(row.id)}
              isPublishing={publishingId === row.id}
              failure={failures.get(row.id)}
              onToggle={onToggleRow}
              onPublish={onPublishRow}
              onPublishVersion={onPublishVersion}
              onOpenInEditor={onOpenInEditor}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
