import i18n from '@/locales/i18n';

i18n.addResourceBundle('en', 'apps', {
  title: 'Applications and modules',
  eyebrow: 'All applications',
  newApp: 'New application',
  newModule: 'New module',

  appsEmptyTitle: 'No applications yet',
  appsEmptyDescription:
    'An application is one product whose copy is managed here — a storefront, a merchant dashboard.',

  modulesOf: 'Modules in {{app}}',
  globalModules: 'Global modules',
  globalModulesDescription:
    'Shared by every application. They resolve under an application’s own modules, so a key defined in both comes from the application.',

  colModule: 'Module',
  colSlug: 'Identifier',
  colScope: 'Scope',
  colEndpoint: 'Endpoint',
  open: 'Open',

  modulesEmptyTitle: 'No modules in this application',
  modulesEmptyDescription:
    'A module is a namespace of copy — checkout, products, authentication.',

  // --- Create application ---
  createAppTitle: 'New application',
  createAppSubtitle:
    'The identifier is baked into the runtime URL your apps ship with, so it cannot be changed later.',
  appName: 'Name',
  appSlug: 'Identifier',
  appSlugHelper: 'Lowercase and hyphenated. Permanent once created.',
  appDescription: 'Description',
  defaultLocale: 'Default language',
  appCreated: 'Application created.',

  // --- Create module ---
  createModuleTitle: 'New module',
  createModuleSubtitle:
    'The identifier appears in the runtime path, so it cannot be changed later.',
  moduleName: 'Name',
  moduleSlug: 'Identifier',
  moduleCreated: 'Module created.',

  nameIsRequired: 'Name is required.',
  slugIsRequired: 'Identifier is required.',
  slugIsInvalid: 'Use lowercase letters, digits and hyphens only.',
  localeIsRequired: 'Pick a default language.',
});
