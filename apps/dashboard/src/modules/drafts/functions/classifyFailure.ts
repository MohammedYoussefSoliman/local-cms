import { handleHttpError } from '@cms/ui';

import { readTranslationConflict } from './readTranslationConflict';

import type {
  DraftPublishFailure,
  DraftPublishFailureKind,
} from '../Drafts.types';


const KIND_BY_STATUS: Record<number, DraftPublishFailureKind | undefined> = {
  403: 'forbidden',
  404: 'missing',
  409: 'conflict',
  422: 'transition',
};

/**
 * Turns one rejected publish into a row the table can explain. The status code
 * is the classifier because each one means a different thing to the editor:
 * 409 is "it moved", 422 is "it is no longer a draft", 404 is "it is gone".
 */
export function classifyFailure(
  id: string,
  error: unknown,
  fallbackMessage: string,
): DraftPublishFailure {
  const { message, status } = handleHttpError(error, fallbackMessage);

  const kind: DraftPublishFailureKind =
    (status === undefined ? undefined : KIND_BY_STATUS[status]) ?? 'unknown';

  return {
    id,
    kind,
    message,
    conflict: kind === 'conflict' ? readTranslationConflict(error) : null,
  };
}
