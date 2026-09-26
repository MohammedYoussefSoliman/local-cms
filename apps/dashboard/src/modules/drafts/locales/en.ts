import i18n from '@/locales/i18n';

i18n.addResourceBundle('en', 'drafts', {
  title: 'Drafts',
  description:
    'Values that are saved but not published yet. There is no review step: publishing makes them live in your applications immediately.',

  publishSelected: 'Publish selected · {{count}}',
  publishSelectedRunning: 'Publishing · {{done}}/{{total}}',
  publishAll: 'Publish all',
  publish: 'Publish',
  selectPage: 'Select this page',
  selectRow: 'Select {{key}}',

  emptyTitle: 'No drafts. Everything is published.',

  colKey: 'Key',
  colLocale: 'Language',
  colValue: 'Value',
  colAuthor: 'Changed by',
  colActions: '',

  unknownAuthor: 'Imported',
  draftPublished: 'Published.',
  publishedCount_one: 'Published {{count}} value.',
  publishedCount_other: 'Published {{count}} values.',
  publishFailedCount_one: 'Could not publish {{count}} value.',
  publishFailedCount_other: 'Could not publish {{count}} values.',
  publishedPartial:
    'Published {{succeeded}} of {{total}}. {{failed}} failed.',

  confirmTitle: 'Publish {{count}} values?',
  confirmDescription:
    '{{count}} values go live in “{{app}}” immediately. Each is published on its own, and whatever succeeds stays published.',
  confirmCta: 'Publish now',

  partialTitle: 'Published {{succeeded}} of {{total}}.',
  selectFailedOnly: 'Select the failed ones',
  dismiss: 'Dismiss',

  failureConflict: 'This value changed since the page was opened.',
  failureForbidden: 'You do not have access to publish this.',
  failureTransition: 'This value is no longer a draft.',
  failureMissing: 'This value no longer exists.',
  failureUnknown: 'Could not publish this value.',

  conflictShown: 'What you were shown',
  conflictCurrent: 'What is saved now',
  conflictVersion: 'Version {{version}}',
  publishCurrent: 'Publish what is saved now',
  openInEditor: 'Open in the editor',
});
