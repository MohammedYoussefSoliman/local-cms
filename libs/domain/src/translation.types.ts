/**
 * `text` renders as-is, `rich_text` carries sanitized HTML, `icu_message`
 * carries ICU MessageFormat and must be validated before it is published.
 */
export type ContentType = 'text' | 'rich_text' | 'icu_message';

/**
 * Only `published` values are ever returned by the runtime read APIs.
 */
export type TranslationStatus =
  'draft' | 'in_review' | 'published' | 'archived';

/** One localized string: exactly one entry × one locale. */
export type TranslationValue = {
  id: string;
  entryId: string;
  localeCode: string;
  value: string;
  status: TranslationStatus;
  /** Optimistic concurrency token; bumped on every write. */
  version: number;
  publishedAt: string | null;
};

/**
 * The language-independent identity of a piece of copy, e.g. `add_to_cart`.
 * It carries no `appId` — its module already decides whether it is app-scoped
 * or global, and a second foreign key could disagree with the first.
 */
export type TranslationEntry = {
  id: string;
  moduleId: string;
  key: string;
  description?: string;
  contentType: ContentType;
  translations: TranslationValue[];
};

/** An append-only history row backing audit and rollback. */
export type TranslationValueVersion = {
  id: string;
  translationValueId: string;
  version: number;
  value: string;
  status: TranslationStatus;
  changedBy: string;
  changeNote?: string;
  createdAt: string;
};
