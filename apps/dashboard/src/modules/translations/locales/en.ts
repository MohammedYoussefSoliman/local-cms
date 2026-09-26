import i18n from '@/locales/i18n';

i18n.addResourceBundle('en', 'translations', {
  title: 'Translations',
  newKey: 'New key',
  searchPlaceholder: 'Search keys or text…',

  layoutTable: 'Table',
  layoutCards: 'Cards',
  layoutFocus: 'Focus',

  filterAll: 'All',
  filterMissing: 'Untranslated',
  filterDraft: 'Drafts',

  colKey: 'Key',
  colStatus: 'Status',

  emptyTitle: 'No keys in this module yet',
  emptyDescription:
    'A key is the language-independent name your code calls t() with.',

  // --- Editing ---
  saveDraft: 'Save as draft',
  saveAndPublish: 'Save and publish now',
  saveLabel: 'Save',
  publishNow: 'Publish now',
  discard: 'Discard',
  deleteKey: 'Delete key',
  notTranslated: '— not translated',

  livePublishedTitle: 'This value is published.',
  livePublishedBody:
    'Saving publishes the change to your applications immediately.',

  savedAsDraft: 'Saved as a draft.',
  editPublishedLive: 'The change is live.',
  published: 'Published.',
  keyCreated: 'Key created.',
  keyDeleted: 'Key deleted.',

  // --- Conflict ---
  conflictTitle: 'This value changed while you were editing',
  conflictBody:
    'Someone saved a newer version. Compare the two before you overwrite it.',
  conflictYours: 'Yours',
  conflictTheirs: 'Saved now',
  conflictOverwrite: 'Overwrite with mine',
  conflictKeepTheirs: 'Keep theirs',

  // --- Panel ---
  whatTheAppReceives: 'What the application receives',
  history: 'History',
  historyEmpty: 'No history yet.',
  version: 'v{{version}}',
  lastChanged: 'Last changed by {{name}}',

  // --- Create key ---
  createKeyTitle: 'New key',
  createKeySubtitle:
    'The key is what your code passes to t(). Renaming it later breaks every app already calling it.',
  key: 'Key',
  keyHelper: 'Letters, digits, dots, underscores and hyphens.',
  description: 'Description',
  descriptionHelper: 'Context for translators. Shown beside the key.',
  contentType: 'Content type',
  contentTypeText: 'Plain text',
  contentTypeRichText: 'Rich text',
  contentTypeIcu: 'ICU message',

  keyIsRequired: 'Key is required.',
  keyIsInvalid:
    'Start with a letter or digit; then letters, digits, dots, underscores and hyphens.',

  deleteKeyTitle: 'Delete {{key}}?',
  deleteKeyDescription:
    'Every translation of this key and its full history are removed. Applications still calling it will render the key itself.',
  deleteKeyCta: 'Delete key',
});
