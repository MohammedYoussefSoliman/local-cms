import type { AppLocaleResponseData, LocaleResponseData } from '@cms/contracts';

/** One row: a language, plus how the selected app uses it (if it does). */
export type LocaleRow = {
  locale: LocaleResponseData;
  appLocale: AppLocaleResponseData | undefined;
};

export type LocalesTableProps = {
  rows: LocaleRow[];
  isLoading: boolean;
  appName: string | undefined;
  canManage: boolean;
  togglingCode: string | null;
  onToggle: (row: LocaleRow) => void;
}
