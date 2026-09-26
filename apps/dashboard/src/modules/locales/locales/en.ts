import i18n from '@/locales/i18n';

i18n.addResourceBundle('en', 'locales', {
  title: 'Languages',
  eyebrow: 'All applications',
  description:
    'Adding a language adds rows, not columns: every existing key gets an empty value in the new language, with no schema change and no redeploy.',
  addLocale: 'Add language',
  readOnlyNotice:
    'Read-only. Adding and disabling languages needs an admin.',

  colCode: 'Code',
  colName: 'Name',
  colNativeName: 'Native name',
  colDirection: 'Direction',
  colStatus: 'Status',
  colFallback: 'Falls back to',

  directionLtr: 'Left to right',
  directionRtl: 'Right to left',

  enabledInApp: 'Enabled in {{app}}',
  notEnabled: 'Not enabled',
  inactive: 'Inactive',
  isDefault: 'Default',
  defaultLocked: 'Default · cannot be disabled',
  enable: 'Enable',
  disable: 'Disable',
  noFallback: 'No fallback',

  emptyTitle: 'No languages yet',

  createTitle: 'Add a language',
  createSubtitle:
    'The code goes into the runtime URL that client apps fetch, so it cannot be changed later.',
  code: 'BCP 47 code',
  codeHelper: 'For example ar, en, pt-BR.',
  name: 'English name',
  nativeName: 'Native name',
  direction: 'Reading direction',
  localeCreated: 'Language added.',
  localeEnabled: 'Language enabled.',
  localeDisabled: 'Language disabled.',
  fallbackUpdated: 'Fallback updated.',

  codeIsRequired: 'Code is required.',
  codeIsInvalid: 'Use a BCP 47 tag, for example ar or pt-BR.',
  nameIsRequired: 'Name is required.',
  nativeNameIsRequired: 'Native name is required.',
});
