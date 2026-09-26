import type {
  AppLocaleResponseData,
  PaginationParams,
  TranslationRow,
} from '@cms/contracts';
import type { TranslationStatus } from '@cms/domain';

export type EntriesParams = PaginationParams & {
  moduleId: string;
  /** Only entries with no value at all in this language. */
  missingLocale?: string;
};

/** The filter chips above the table. */
export type EntryFilter = 'all' | 'missing' | 'draft';

/**
 * One editable cell: an entry × a locale.
 *
 * `status` is what the API returned; a cell the user has typed into but not
 * saved is `unsaved`, which is a UI state and has no server equivalent.
 */
export type EditorCell = {
  entryId: string;
  localeCode: string;
  value: string;
  status: TranslationStatus | 'missing';
  /** `undefined` when there is no row yet — nothing to be stale against. */
  version: number | undefined;
};

/** In-flight edits, keyed `entryId:localeCode`. */
export type DraftMap = Record<string, string>;

export type LocaleColumn = AppLocaleResponseData;

export type TranslationTableRow = TranslationRow;
