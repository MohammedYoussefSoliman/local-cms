import i18n from '@/locales/i18n';

i18n.addResourceBundle('en', 'overview', {
  title: 'Overview',
  openTranslations: 'Open translations',

  statModules: 'Modules',
  statModulesNote: 'Namespaces in this application',
  statLocales: 'Languages',
  statLocalesNote: 'Enabled for this application',
  statDrafts: 'Drafts',
  statDraftsNote: 'Saved, not published',
  statApps: 'Applications',
  statAppsNote: 'Managed here',

  languages: 'Languages',
  languagesDescription:
    'What this application serves, and where each one falls back when a key is missing.',
  defaultLocale: 'Default',
  fallsBackTo: 'falls back to {{code}}',
  noFallback: 'no fallback',

  modules: 'Modules',
  modulesDescription: 'Open one to edit its keys.',
  noModules: 'No modules in this application yet.',
  endpoint: 'Endpoint',
});
