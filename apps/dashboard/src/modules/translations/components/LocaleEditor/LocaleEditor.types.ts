import type { AppLocaleResponseData } from '@cms/contracts';

import type { EditorCell } from '../../Translations.types';

export type LocaleEditorProps = {
  locale: AppLocaleResponseData;
  cell: EditorCell;
  /** The in-flight edit, or `undefined` when the cell is untouched. */
  draft: string | undefined;
  onChange: (entryId: string, localeCode: string, value: string) => void;
  disabled?: boolean;
}
