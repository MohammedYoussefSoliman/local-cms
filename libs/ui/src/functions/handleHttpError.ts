import { AxiosError } from 'axios';

import type { HTTPErrorResponse } from '@cms/contracts';

export type HandledHttpError = {
  message: string;
  /** Maps a form field to its server-side validation messages. */
  fieldErrors: Record<string, string[]>;
  /**
   * Machine-readable context the message cannot carry. The case that needs it
   * is the 409 a stale `expectedVersion` produces: invariant Rule 7 requires
   * the *current* value to come back with the rejection so the dashboard can
   * show a diff rather than a dead end.
   *
   * Deliberately left as `Record<string, unknown>` — the envelope is shared by
   * every error, so narrowing belongs in one typed reader per case (see
   * `readTranslationConflict`), not here.
   */
  details?: Record<string, unknown>;
  /** The HTTP status, when the failure reached the server at all. */
  status?: number;
};

/**
 * Single place that knows the API's error envelope. Inline `AxiosError`
 * inspection at call sites drifts the moment the envelope changes, and it
 * routinely drops `fieldErrors` on the floor.
 */
export function handleHttpError(
  error: unknown,
  fallback: string,
): HandledHttpError {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as HTTPErrorResponse | undefined;

    return {
      message: payload?.message || error.message || fallback,
      fieldErrors: payload?.fieldErrors ?? {},
      details: payload?.details,
      status: error.response?.status,
    };
  }

  if (error instanceof Error) {
    return { message: error.message || fallback, fieldErrors: {} };
  }

  return { message: fallback, fieldErrors: {} };
}
