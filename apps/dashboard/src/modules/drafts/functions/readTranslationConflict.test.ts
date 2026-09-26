/*
 * The no-restricted-imports rule exists so runtime code cannot create a second
 * HTTP client that skips the token injection and the refresh queue. A test
 * building an `AxiosError` fixture is the opposite case: `handleHttpError`
 * narrows with `instanceof AxiosError`, so a hand-rolled object would not
 * exercise the branch under test.
 */
// eslint-disable-next-line no-restricted-imports
import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { readTranslationConflict } from './readTranslationConflict';

function httpError(status: number, data: unknown): AxiosError {
  const error = new AxiosError('failed');
  error.response = {
    status,
    data,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

describe('readTranslationConflict', () => {
  it('extracts the conflict payload from a 409', () => {
    const error = httpError(409, {
      statusCode: 409,
      message: 'moved on',
      error: 'Conflict',
      details: {
        currentValue: 'الثانية',
        currentVersion: 4,
        currentStatus: 'draft',
      },
    });

    expect(readTranslationConflict(error)).toEqual({
      currentValue: 'الثانية',
      currentVersion: 4,
      currentStatus: 'draft',
    });
  });

  it('returns null for a 409 with no details — the unique-violation case', () => {
    const error = httpError(409, {
      statusCode: 409,
      message: 'already exists',
      error: 'Conflict',
    });

    expect(readTranslationConflict(error)).toBeNull();
  });

  it('returns null for a non-409, even when it carries details', () => {
    const error = httpError(422, {
      statusCode: 422,
      message: 'invalid ICU',
      error: 'Unprocessable Entity',
      details: {
        currentValue: 'x',
        currentVersion: 1,
        currentStatus: 'draft',
      },
    });

    expect(readTranslationConflict(error)).toBeNull();
  });

  it('returns null when details is present but the wrong shape', () => {
    const error = httpError(409, {
      statusCode: 409,
      message: 'moved on',
      error: 'Conflict',
      details: { currentValue: 'x', currentVersion: '4' },
    });

    expect(readTranslationConflict(error)).toBeNull();
  });

  it('returns null for something that is not an HTTP error at all', () => {
    expect(readTranslationConflict(new Error('offline'))).toBeNull();
  });
});
