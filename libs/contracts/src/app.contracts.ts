import type { LocaleResponseData } from './locale.contracts';

export type CreateAppPayload = {
  name: string;
  /**
   * Lowercase, hyphenated, and immutable once created — it is baked into
   * `/v1/apps/:appSlug/...`, which client apps ship compiled into their
   * bundles (invariant Rule 8).
   */
  slug: string;
  description?: string | null;
  /**
   * BCP 47 code of the language this app is authored in. Creating the app
   * also enables it, as the app's single default `app_locales` row.
   */
  defaultLocaleCode: string;
};

/**
 * `slug` is deliberately absent, and so is `defaultLocaleCode`. The first is
 * immutable (Rule 8). The second is not a field but a two-row move — the old
 * default has to be demoted in the same transaction the new one is promoted in,
 * past `uq_app_locales_one_default` — so it needs its own endpoint rather than
 * a place in a general-purpose PATCH.
 */
export type UpdateAppPayload = {
  name?: string;
  description?: string | null;
};

export type AppResponseData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  defaultLocaleId: string;
  /** Denormalized for the client: every app view labels its default language. */
  defaultLocaleCode: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * One enabled (or previously enabled) language of an app. The nested `locale`
 * carries `direction`, which the dashboard needs to render the editor column
 * for this language in the right reading order.
 */
export type AppLocaleResponseData = {
  appId: string;
  localeId: string;
  locale: LocaleResponseData;
  isDefault: boolean;
  isEnabled: boolean;
  fallbackLocaleId: string | null;
  fallbackLocaleCode: string | null;
};

/** `null` clears the fallback, leaving resolution to end at the key itself. */
export type SetAppLocaleFallbackPayload = {
  fallbackLocaleCode: string | null;
};
