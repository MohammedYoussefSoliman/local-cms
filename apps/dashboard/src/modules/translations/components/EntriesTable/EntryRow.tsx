import { LtrText, cn } from '@cms/ui';
import { useTranslation } from 'react-i18next';

import type { AppLocaleResponseData, TranslationRow } from '@cms/contracts';

import { TranslationStatusBadge, ValueText } from '@/components';

import { readCell } from '../../functions';

type EntryRowProps = {
  row: TranslationRow;
  locales: AppLocaleResponseData[];
  isSelected: boolean;
  onSelect: (entryId: string) => void;
};

/** The row's overall status: the weakest state any of its languages is in. */
function rowStatus(
  row: TranslationRow,
  locales: AppLocaleResponseData[],
): 'missing' | 'draft' | 'published' {
  const cells = locales.map((locale) => readCell(row, locale.locale.code));

  if (cells.some((cell) => cell.status === 'missing')) return 'missing';
  if (cells.some((cell) => cell.status !== 'published')) return 'draft';
  return 'published';
}

export function EntryRow({
  row,
  locales,
  isSelected,
  onSelect,
}: EntryRowProps) {
  const { t } = useTranslation('translations');

  function handleSelect() {
    onSelect(row.entryId);
  }

  return (
    <tr
      onClick={handleSelect}
      className={cn(
        'cursor-pointer border-b border-soft-light last:border-b-0 hover:bg-weak',
        isSelected && 'bg-primary-lighter',
      )}
    >
      <td className="w-56 p-3 align-top">
        <LtrText mono className="block truncate text-paragraph-sm text-strong">
          {row.key}
        </LtrText>
      </td>

      {/* One column per enabled locale, built from data. Never a hard-coded
          ar/en pair — enabling French must change nothing but this array. */}
      {locales.map((locale) => {
        const cell = readCell(row, locale.locale.code);

        return (
          <td key={locale.localeId} className="p-3 align-top">
            {cell.status === 'missing' ? (
              <span className="text-paragraph-sm text-soft-medium">
                {t('notTranslated')}
              </span>
            ) : (
              <ValueText
                value={cell.value}
                direction={locale.locale.direction}
                truncate
              />
            )}
          </td>
        );
      })}

      <td className="w-px whitespace-nowrap p-3 align-top">
        <TranslationStatusBadge status={rowStatus(row, locales)} />
      </td>
    </tr>
  );
}
