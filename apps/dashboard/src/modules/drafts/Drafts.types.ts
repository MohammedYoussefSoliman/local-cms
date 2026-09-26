import type {
  PaginationParams,
  TranslationConflictData,
} from '@cms/contracts';

export type DraftsParams = PaginationParams & { appId: string };

/** Why one row of a batch failed, in the terms the table renders. */
export type DraftPublishFailureKind =
  | 'conflict'
  | 'forbidden'
  | 'transition'
  | 'missing'
  | 'unknown';

export type DraftPublishFailure = {
  id: string;
  kind: DraftPublishFailureKind;
  message: string;
  /** Present only when `kind === 'conflict'`. */
  conflict: TranslationConflictData | null;
};

/** A batch result. `usePublishDrafts` resolves with this; it never rejects. */
export type DraftsPublishResult = {
  succeeded: string[];
  failed: DraftPublishFailure[];
};

export type PublishDraftPayload = {
  id: string;
  expectedVersion: number;
};

export type DraftsPublishPayload = {
  rows: PublishDraftPayload[];
};
