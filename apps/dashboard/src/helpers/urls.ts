const URLS = {
  login: '/login',
  home: '/',
  apps: '/apps',
  appDetails: '/apps/:appId',
  modules: '/apps/:appId/modules',
  translations: '/apps/:appId/modules/:moduleId/translations',
  locales: '/locales',
  users: '/users',
} as const;

export default URLS;
