
import {
  LtrText,
  SegmentedControl,
  SegmentedControlGroup,
  TextInput,
} from '@cms/ui';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { EditorToolbarProps } from './EditorToolbar.types';
import type { EntryFilter } from '../../Translations.types';
import type { ChangeEvent } from 'react';

export function EditorToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  endpoint,
}: EditorToolbarProps) {
  const { t } = useTranslation('translations');

  function handleSearch(event: ChangeEvent<HTMLInputElement>) {
    onSearchChange(event.target.value);
  }

  function handleFilter(value: string) {
    onFilterChange(value as EntryFilter);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <TextInput
        size="sm"
        value={search}
        onChange={handleSearch}
        placeholder={t('searchPlaceholder')}
        className="w-full sm:w-72"
        // Symmetric glyph: a magnifier does not mirror (RTL Rule 3).
        prefixComponent={<Search size={16} />}
      />

      <SegmentedControlGroup value={filter} onValueChange={handleFilter}>
        <SegmentedControl value="all">{t('filterAll')}</SegmentedControl>
        <SegmentedControl value="missing">{t('filterMissing')}</SegmentedControl>
        <SegmentedControl value="draft">{t('filterDraft')}</SegmentedControl>
      </SegmentedControlGroup>

      {/* Pushed to the reading end with a logical margin, never `ml-auto`. */}
      <LtrText mono className="ms-auto text-paragraph-xs text-sub-dark">
        {endpoint}
      </LtrText>
    </div>
  );
}
