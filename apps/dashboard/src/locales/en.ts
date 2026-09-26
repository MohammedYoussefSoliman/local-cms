import i18n from './i18n';

/**
 * App chrome only. Anything that belongs to one feature lives in that module's
 * `locales/en.ts`, and `ar.ts` is updated in the same commit — a key in one
 * file and not the other renders blank, silently, with no error anywhere.
 */
i18n.addResourceBundle('en', 'app', {
  appName: 'Localization CMS',
  appNameShort: 'Localization',

  // --- Generic ---
  someThingWentWrong: 'Something went wrong. Please try again.',
  savedSuccessfully: 'Saved successfully.',
  save: 'Save',
  cancel: 'Cancel',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  close: 'Close',
  confirm: 'Confirm',
  search: 'Search',
  loading: 'Loading…',
  optional: '(optional)',
  copy: 'Copy',
  copied: 'Copied to clipboard.',
  retry: 'Retry',
  all: 'All',
  none: 'None',
  page: 'Page {{current}} of {{last}}',
  noResults: 'Nothing matches that search.',
  noResultsHint: 'Try a shorter search, or clear the filters.',

  // --- Auth / session ---
  signIn: 'Sign in',
  signOut: 'Sign out',
  email: 'Email',
  password: 'Password',
  account: 'Account',

  // --- Navigation ---
  navOverview: 'Overview',
  navApps: 'Applications and modules',
  navTranslations: 'Translations',
  navDrafts: 'Drafts',
  navLocales: 'Languages',
  navUsers: 'Users',
  selectApplication: 'Application',
  adminOnly: 'Admins only',
  adminOnlyDescription:
    'Editors can write and publish translations. Managing users and languages needs an admin.',

  // --- Roles ---
  roleAdmin: 'Admin',
  roleEditor: 'Editor',

  // --- Translation status ---
  statusPublished: 'Published',
  statusDraft: 'Draft',
  statusInReview: 'In review',
  statusArchived: 'Archived',
  statusMissing: 'Not translated',
  statusUnsaved: 'Unsaved',
});
