import type { ContentType, ModuleScope, TranslationStatus } from '@cms/domain';

export type CreateAppPayload = {
  name: string;
  slug: string;
  description?: string;
  defaultLocaleCode: string;
};

export type CreateModulePayload = {
  name: string;
  slug: string;
  scope: ModuleScope;
  description?: string;
};

export type CreateEntryPayload = {
  key: string;
  description?: string;
  contentType?: ContentType;
};

export type UpsertTranslationPayload = {
  value: string;
  /**
   * The version the editor was looking at. The API rejects the write with 409
   * when it no longer matches — this is what stops two editors overwriting
   * each other silently.
   */
  expectedVersion?: number;
};

export type ChangeStatusPayload = {
  status: Extract<TranslationStatus, 'in_review' | 'published' | 'archived'>;
  changeNote?: string;
};

export type TranslationRow = {
  entryId: string;
  key: string;
  description: string | null;
  contentType: ContentType;
  /** Keyed by locale code — built from rows, never from columns. */
  values: Record<
    string,
    { value: string; status: TranslationStatus; version: number } | undefined
  >;
};
