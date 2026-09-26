import type { ContentType, TextDirection, TranslationStatus } from '@cms/domain';

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
  /**
   * The version the caller believed the value was on. Optional: the importer
   * and the smoke script publish without one, and omitting it keeps
   * last-write-wins. The dashboard always sends it, because a batch publish
   * that skips the check can put text on a live storefront that nobody read.
   */
  expectedVersion?: number;
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

/**
 * One row of the drafts queue — every saved-but-unpublished value in an app.
 *
 * `id` is the `translation_values` id, which is what
 * `POST /translations/:id/publish` takes: the queue is a list of publish
 * targets, so it is addressed the way publishing addresses them.
 */
export type DraftValueRow = {
  id: string;
  entryId: string;
  key: string;
  contentType: ContentType;
  moduleId: string;
  moduleName: string;
  moduleSlug: string;
  localeCode: string;
  /**
   * The locale's OWN reading direction. Denormalized here because the value
   * cell renders in it — never in the UI language's direction, and never in a
   * direction inferred from a hard-coded `ar|he|fa` list, which is invariant
   * Rule 1's language union wearing a different hat.
   */
  localeDirection: TextDirection;
  value: string;
  /** `draft` or `in_review`. Carried so the rare in_review row can be labelled. */
  status: TranslationStatus;
  /** Send this back as `expectedVersion` when publishing. */
  version: number;
  updatedAt: string;
  /** `null` when the author's account was deleted, or for importer writes. */
  updatedByName: string | null;
};
