import type { AppLocaleResponseData, TranslationRow } from '@cms/contracts';

export type EntriesTableProps = {
  rows: TranslationRow[];
  locales: AppLocaleResponseData[];
  isLoading: boolean;
  selectedEntryId: string | null;
  onSelect: (entryId: string) => void;
}
