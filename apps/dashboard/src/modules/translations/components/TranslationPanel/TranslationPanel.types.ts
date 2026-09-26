import type { AppLocaleResponseData, TranslationRow } from '@cms/contracts';

import type { DraftMap } from '../../Translations.types';

export type TranslationPanelProps = {
  row: TranslationRow | undefined;
  locales: AppLocaleResponseData[];
  moduleSlug: string | undefined;
  appSlug: string | undefined;
  drafts: DraftMap;
  isSaving: boolean;
  canDelete: boolean;
  onChange: (entryId: string, localeCode: string, value: string) => void;
  onSave: (entryId: string) => void;
  onDiscard: (entryId: string) => void;
  onDelete: (row: TranslationRow) => void;
  onClose: () => void;
}
