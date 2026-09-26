import { LtrText } from '@cms/ui';
import { useTranslation } from 'react-i18next';


import { EntriesTableSkeleton } from './EntriesTableSkeleton';
import { EntryRow } from './EntryRow';

import type { EntriesTableProps } from './EntriesTable.types';

export function EntriesTable({
  rows,
  locales,
  isLoading,
  selectedEntryId,
  onSelect,
}: EntriesTableProps) {
  const { t } = useTranslation('translations');

  if (isLoading) return <EntriesTableSkeleton localeCount={locales.length} />;

  return (
    <div className="overflow-x-auto rounded-12 border border-soft-light bg-white">
      <table className="w-full table-fixed">
        <thead>
          <tr className="bg-weak">
            <th className="w-56 p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colKey')}
            </th>
            {locales.map((locale) => (
              <th
                key={locale.localeId}
                className="p-3 text-start text-label-xs font-normal text-sub-dark"
              >
                <span className="flex items-center gap-1.5">
                  <LtrText mono>{locale.locale.code}</LtrText>
                  <span dir={locale.locale.direction}>
                    {locale.locale.nativeName}
                  </span>
                </span>
              </th>
            ))}
            <th className="w-28 p-3 text-start text-label-xs font-normal text-sub-dark">
              {t('colStatus')}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <EntryRow
              key={row.entryId}
              row={row}
              locales={locales}
              isSelected={row.entryId === selectedEntryId}
              onSelect={onSelect}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
