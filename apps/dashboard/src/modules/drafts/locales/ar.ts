import i18n from '@/locales/i18n';

i18n.addResourceBundle('ar', 'drafts', {
  title: 'المسودات',
  description:
    'قيم محفوظة ولم تُنشر بعد. لا توجد خطوة مراجعة: النشر يجعلها مباشرة في التطبيقات فوراً.',

  publishSelected: 'نشر المحدد · {{count}}',
  publishSelectedRunning: 'جارٍ النشر · {{done}}/{{total}}',
  publishAll: 'نشر الكل',
  publish: 'نشر',
  selectPage: 'تحديد هذه الصفحة',
  selectRow: 'تحديد {{key}}',

  emptyTitle: 'لا توجد مسودات. كل شيء منشور.',

  colKey: 'المفتاح',
  colLocale: 'اللغة',
  colValue: 'القيمة',
  colAuthor: 'بواسطة',
  colActions: '',

  unknownAuthor: 'مستورد',
  draftPublished: 'تم النشر.',
  publishedCount_zero: 'لم تُنشر أي قيمة.',
  publishedCount_one: 'نُشرت قيمة واحدة.',
  publishedCount_two: 'نُشرت قيمتان.',
  publishedCount_few: 'نُشرت {{count}} قيم.',
  publishedCount_many: 'نُشرت {{count}} قيمة.',
  publishedCount_other: 'نُشرت {{count}} قيمة.',
  publishFailedCount_zero: 'لم يفشل نشر أي قيمة.',
  publishFailedCount_one: 'تعذّر نشر قيمة واحدة.',
  publishFailedCount_two: 'تعذّر نشر قيمتين.',
  publishFailedCount_few: 'تعذّر نشر {{count}} قيم.',
  publishFailedCount_many: 'تعذّر نشر {{count}} قيمة.',
  publishFailedCount_other: 'تعذّر نشر {{count}} قيمة.',
  publishedPartial: 'نُشرت {{succeeded}} من {{total}}. فشل {{failed}}.',

  confirmTitle: 'نشر {{count}} قيمة؟',
  confirmDescription:
    'سيتم نشر {{count}} قيمة في «{{app}}» مباشرة. يتم نشر كل قيمة على حدة، وما ينجح يبقى منشوراً.',
  confirmCta: 'انشر الآن',

  partialTitle: 'نُشرت {{succeeded}} من {{total}}.',
  selectFailedOnly: 'تحديد الفاشلة فقط',
  dismiss: 'إخفاء',

  failureConflict: 'تغيّرت هذه القيمة منذ فتح الصفحة.',
  failureForbidden: 'لا تملك صلاحية نشر هذه القيمة.',
  failureTransition: 'لم تعد هذه القيمة مسودة.',
  failureMissing: 'لم تعد هذه القيمة موجودة.',
  failureUnknown: 'تعذّر نشر هذه القيمة.',

  conflictShown: 'ما كان معروضاً',
  conflictCurrent: 'ما هو محفوظ الآن',
  conflictVersion: 'النسخة {{version}}',
  publishCurrent: 'نشر ما هو محفوظ الآن',
  openInEditor: 'فتح في المحرر',
});
