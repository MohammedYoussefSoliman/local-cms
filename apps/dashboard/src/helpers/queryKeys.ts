/**
 * Every query key root lives here, grouped per module. A raw string in a hook
 * is a cache-invalidation bug waiting to happen — see
 * `.claude/rules/global-api-service.md`.
 */
export const AUTH_QUERY_KEYS = {
  getCurrentUser: 'getCurrentUser',
  getInvitationPreview: 'getInvitationPreview',
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
  getGlobalModules: 'getGlobalModules',
  getModuleById: 'getModuleById',
} as const;

export const TRANSLATIONS_QUERY_KEYS = {
  getEntries: 'getEntries',
  getEntryById: 'getEntryById',
  getValueHistory: 'getValueHistory',
} as const;

/**
 * One root, deliberately. The sidebar badge hangs off `getAppDrafts` with
 * different params, so a single root invalidation refreshes the queue *and* the
 * badge and the two cannot drift apart.
 */
export const DRAFTS_QUERY_KEYS = {
  getAppDrafts: 'getAppDrafts',
} as const;

export const USERS_QUERY_KEYS = {
  getAllUsers: 'getAllUsers',
  getUserById: 'getUserById',
  getUserInvitation: 'getUserInvitation',
} as const;

export const API_KEYS_QUERY_KEYS = {
  getAppApiKeys: 'getAppApiKeys',
} as const;
