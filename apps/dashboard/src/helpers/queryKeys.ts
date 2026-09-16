/**
 * Every query key root lives here, grouped per module. A raw string in a hook
 * is a cache-invalidation bug waiting to happen — see
 * `.claude/rules/global-api-service.md`.
 */
export const AUTH_QUERY_KEYS = {
  getCurrentUser: 'getCurrentUser',
} as const;

export const APPS_QUERY_KEYS = {
  getAllApps: 'getAllApps',
  getAppById: 'getAppById',
} as const;

export const LOCALES_QUERY_KEYS = {
  getAllLocales: 'getAllLocales',
  getAppLocales: 'getAppLocales',
} as const;

export const MODULES_QUERY_KEYS = {
  getAllModules: 'getAllModules',
  getModuleById: 'getModuleById',
} as const;

export const TRANSLATIONS_QUERY_KEYS = {
  getEntries: 'getEntries',
  getEntryById: 'getEntryById',
  getValueHistory: 'getValueHistory',
} as const;
