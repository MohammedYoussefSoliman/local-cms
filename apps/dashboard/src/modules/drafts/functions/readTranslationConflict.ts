import { handleHttpError } from '@cms/ui';

import type { TranslationConflictData } from '@cms/contracts';

/**
 * Narrows a 409's `details` to `TranslationConflictData`, or `null`.
 *
 * `handleHttpError` returns `details` as `Record<string, unknown>` because the
 * envelope is shared by every error, so this is the one typed reader and the
 * three-field shape is asserted in exactly one place.
 *
 * A 409 from a unique-constraint violation elsewhere in the API carries no
 * `details` at all, and must come back as `null` rather than a half-built
 * object.
 */
export function readTranslationConflict(
  error: unknown,
): TranslationConflictData | null {
  const { status, details } = handleHttpError(error, '');
  if (status !== 409 || !details) return null;

  const { currentValue, currentVersion, currentStatus } = details;

  if (
    typeof currentValue !== 'string' ||
    typeof currentVersion !== 'number' ||
    typeof currentStatus !== 'string'
  ) {
    return null;
  }

  return {
    currentValue,
    currentVersion,
    currentStatus: currentStatus as TranslationConflictData['currentStatus'],
  };
}
