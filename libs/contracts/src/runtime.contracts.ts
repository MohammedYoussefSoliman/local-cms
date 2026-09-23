import type { TextDirection } from '@cms/domain';

/**
 * One language an app serves, as a client application sees it.
 *
 * Narrower than `AppLocaleResponseData`: ids are a CMS concern, and a client
 * app addresses everything by code. `direction` is here because the client has
 * to set `dir` on its own document before it has fetched a single string.
 */
export type RuntimeLocaleData = {
  code: string;
  name: string;
  nativeName: string;
  direction: TextDirection;
  isDefault: boolean;
  /** Where a key with no translation in this language resolves next. */
  fallbackLocaleCode: string | null;
};

/**
 * Exists so a client app does not hard-code its own language list — which is
 * the mistake invariant Rule 1 exists to prevent, one layer up.
 */
export type RuntimeLocalesResponseData = {
  appSlug: string;
  defaultLocaleCode: string;
  locales: RuntimeLocaleData[];
};
