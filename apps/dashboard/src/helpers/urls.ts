/**
 * Every route shape in the dashboard, written down once.
 *
 * Nothing else may spell a path: `routes.tsx` matches on these and navigation
 * interpolates them with `generatePath`, which is what makes renaming a route
 * a one-line change instead of a grep.
 */
const URLS = {
  // --- Unauthenticated ---
  login: '/login',
  acceptInvitation: '/invite',

  // --- App-scoped ---
  home: '/',
  apps: '/apps',
  overview: '/apps/:appId',
  appModules: '/apps/:appId/modules',
  translations: '/apps/:appId/modules/:moduleId/translations',
  drafts: '/apps/:appId/drafts',
  appSettings: '/apps/:appId/settings',

  // --- Global ---
  locales: '/locales',
  users: '/users',
  account: '/account',
} as const;

export default URLS;
