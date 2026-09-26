import type { TranslationRow } from '@cms/contracts';

import type { EditorCell } from '../Translations.types';

/**
 * Reads one entry × locale out of a `TranslationRow`.
 *
 * `values[code]` is `null` for a language with no translation yet — the normal
 * state of a translation table, not an error — so this is the only place that
 * guard lives. Reading `values[code].value` without it is the crash the `|
 * null` in the contract exists to prevent.
 */
export function readCell(
  row: TranslationRow,
  localeCode: string,
): EditorCell {
  const value = row.values[localeCode];

  if (!value) {
    return {
      entryId: row.entryId,
      localeCode,
      value: '',
      status: 'missing',
      version: undefined,
    };
  }

  return {
    entryId: row.entryId,
    localeCode,
    value: value.value,
    status: value.status,
    version: value.version,
  };
}
