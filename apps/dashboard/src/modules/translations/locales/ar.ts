import i18n from '@/locales/i18n';

i18n.addResourceBundle('ar', 'translations', {
  title: 'الترجمات',
  newKey: 'مفتاح جديد',
  searchPlaceholder: 'ابحث في المفاتيح أو النصوص…',

  layoutTable: 'جدول',
  layoutCards: 'بطاقات',
  layoutFocus: 'تركيز',

  filterAll: 'الكل',
  filterMissing: 'غير مترجم',
  filterDraft: 'مسودات',

  colKey: 'المفتاح',
  colStatus: 'الحالة',

  emptyTitle: 'لا توجد مفاتيح في هذه الوحدة بعد',
  emptyDescription:
    'المفتاح هو الاسم المستقل عن اللغة الذي تستدعيه الشيفرة عبر ‎t()‎.',

  // --- Editing ---
  saveDraft: 'حفظ كمسودة',
  saveAndPublish: 'حفظ ونشر مباشرة',
  saveLabel: 'حفظ',
  publishNow: 'نشر الآن',
  discard: 'تجاهل',
  deleteKey: 'حذف المفتاح',
  notTranslated: '— غير مترجم',

  livePublishedTitle: 'هذه القيمة منشورة.',
  livePublishedBody: 'الحفظ ينشر التعديل مباشرة في التطبيقات.',

  savedAsDraft: 'حُفظت كمسودة.',
  editPublishedLive: 'نُشر التعديل مباشرة.',
  published: 'تم النشر.',
  keyCreated: 'تم إنشاء المفتاح.',
  keyDeleted: 'تم حذف المفتاح.',

  // --- Conflict ---
  conflictTitle: 'تغيّرت هذه القيمة أثناء تعديلك',
  conflictBody: 'حفظ شخص آخر نسخة أحدث. قارن بينهما قبل الاستبدال.',
  conflictYours: 'نصّك',
  conflictTheirs: 'المحفوظ الآن',
  conflictOverwrite: 'استبدل بنصّي',
  conflictKeepTheirs: 'أبقِ نصّهم',

  // --- Panel ---
  whatTheAppReceives: 'ما يستلمه التطبيق',
  history: 'السجل',
  historyEmpty: 'لا يوجد سجل بعد.',
  version: 'نسخة {{version}}',
  lastChanged: 'آخر تعديل بواسطة {{name}}',

  // --- Create key ---
  createKeyTitle: 'مفتاح جديد',
  createKeySubtitle:
    'المفتاح هو ما تمرره الشيفرة إلى ‎t()‎. تغييره لاحقاً يكسر كل تطبيق يستدعيه.',
  key: 'المفتاح',
  keyHelper: 'أحرف وأرقام ونقاط وشرطات سفلية وشرطات.',
  description: 'الوصف',
  descriptionHelper: 'سياق للمترجمين. يظهر بجانب المفتاح.',
  contentType: 'نوع المحتوى',
  contentTypeText: 'نص عادي',
  contentTypeRichText: 'نص منسّق',
  contentTypeIcu: 'رسالة ICU',

  keyIsRequired: 'المفتاح مطلوب.',
  keyIsInvalid:
    'يبدأ بحرف أو رقم، ثم أحرف وأرقام ونقاط وشرطات سفلية وشرطات.',

  deleteKeyTitle: 'حذف {{key}}؟',
  deleteKeyDescription:
    'تُحذف كل ترجمات هذا المفتاح وسجله كاملاً. التطبيقات التي ما زالت تستدعيه ستعرض اسم المفتاح نفسه.',
  deleteKeyCta: 'حذف المفتاح',
});
