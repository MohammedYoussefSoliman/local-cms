/** A module is app-scoped, or global and shared by every app. */
export type ModuleScope = 'app' | 'global';

export type LocalizationApp = {
  id: string;
  name: string;
  /** Stable identifier used in runtime URLs. Unique. */
  slug: string;
  description?: string;
  defaultLocaleId: string;
};

/**
 * A translation namespace aligned with a business module (`products`,
 * `checkout`, `authentication`). The slug becomes part of the runtime
 * translation path, so it must stay stable once published.
 *
 * Invariant: `scope === 'app'` ⇒ `appId !== null`;
 *            `scope === 'global'` ⇒ `appId === null`.
 */
export type LocalizationModule = {
  id: string;
  appId: string | null;
  name: string;
  slug: string;
  scope: ModuleScope;
  description?: string;
};

/** Which languages an app has switched on, and how they fall back. */
export type AppLocale = {
  appId: string;
  localeId: string;
  isDefault: boolean;
  fallbackLocaleId: string | null;
  isEnabled: boolean;
};
