import { AxiosError } from 'axios';

import type { HTTPErrorResponse } from '@cms/contracts';

export type HandledHttpError = {
  message: string;
  /** Maps a form field to its server-side validation messages. */
  fieldErrors: Record<string, string[]>;
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
    };
  }

  if (error instanceof Error) {
    return { message: error.message || fallback, fieldErrors: {} };
  }

  return { message: fallback, fieldErrors: {} };
}
