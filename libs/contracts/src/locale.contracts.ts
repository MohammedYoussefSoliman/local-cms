import type { Locale, TextDirection } from '@cms/domain';

export type CreateLocalePayload = {
  /** BCP 47. Canonicalized server-side, so `PT-br` and `pt-BR` are one locale. */
  code: string;
  name: string;
  nativeName: string;
  direction?: TextDirection;
  isActive?: boolean;
};

/**
 * `code` is deliberately absent. It appears in runtime bundle URLs
 * (`/v1/apps/:appSlug/locales/:localeCode`), so renaming it would break every
 * client app that already fetches it — the same reasoning that makes app and
 * module slugs immutable.
 */
export type UpdateLocalePayload = {
  name?: string;
  nativeName?: string;
  direction?: TextDirection;
  isActive?: boolean;
};

export type LocaleResponseData = Locale;
