import type { ContentType, TranslationStatus } from '@cms/domain';

export type CreateEntryPayload = {
  key: string;
  description?: string | null;
  contentType?: ContentType;
};

/**
 * `key` is editable. Unlike an app or module slug it does not appear in a
 * runtime URL, so Rule 8 does not reach it — but it *is* what client code
 * passes to `t()`, so renaming one after it has shipped is a breaking change
 * for every app that references it. The API allows it; the dashboard is where
 * the warning belongs.
 */
export type UpdateEntryPayload = {
  key?: string;
  description?: string | null;
  contentType?: ContentType;
};

/** A single entry, without its values. The list endpoint returns `TranslationRow`. */
export type EntryResponseData = {
  id: string;
  moduleId: string;
  key: string;
  description: string | null;
  contentType: ContentType;
  createdAt: string;
  updatedAt: string;
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

/**
 * The body of `submit-review`, `publish`, `archive` and `rollback`. It carries
 * no `status`: the route names the transition, so a status in the body would be
 * a second source of truth able to disagree with the URL the caller chose.
 *
 * The note is written to the history row, which is the only place it is ever
 * read from.
 */
export type TranslationNotePayload = {
  changeNote?: string;
};

/** One localized string, as the CMS returns it. */
export type TranslationValueResponseData = {
  id: string;
  entryId: string;
  localeId: string;
  /** Denormalized: every caller addresses a language by code, never by id. */
  localeCode: string;
  value: string;
  status: TranslationStatus;
  /** Optimistic-concurrency token. Send it back as `expectedVersion`. */
  version: number;
  publishedAt: string | null;
  updatedAt: string;
};

/**
 * What a stale `expectedVersion` returns in the 409's `details`, so the
 * dashboard can show the editor what landed while they were typing instead of
 * just telling them they lost (invariant Rule 7).
 */
export type TranslationConflictData = {
  currentValue: string;
  currentVersion: number;
  currentStatus: TranslationStatus;
};

/** One append-only history row. Never updated, never deleted (Rule 6). */
export type TranslationHistoryData = {
  id: string;
  translationValueId: string;
  version: number;
  value: string;
  status: TranslationStatus;
  changedBy: string | null;
  changeNote: string | null;
  createdAt: string;
};

export type TranslationRow = {
  entryId: string;
  key: string;
  description: string | null;
  contentType: ContentType;
  /**
   * Keyed by locale code — built from rows at read time, never from columns.
   *
   * `null` rather than `undefined` for a language with no translation yet:
   * `undefined` disappears in `JSON.stringify`, and the missing-value case is
   * exactly what the editor has to render. Every locale the module serves gets
   * a key, present or not.
   */
  values: Record<
    string,
    { value: string; status: TranslationStatus; version: number } | null
  >;
};
