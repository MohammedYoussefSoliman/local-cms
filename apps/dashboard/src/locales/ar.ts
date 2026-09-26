import i18n from './i18n';

i18n.addResourceBundle('ar', 'app', {
  appName: 'نظام إدارة الترجمات',
  appNameShort: 'الترجمة',

  // --- Generic ---
  someThingWentWrong: 'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
  savedSuccessfully: 'تم الحفظ بنجاح.',
  save: 'حفظ',
  cancel: 'إلغاء',
  create: 'إنشاء',
  edit: 'تعديل',
  delete: 'حذف',
  close: 'إغلاق',
  confirm: 'تأكيد',
  search: 'بحث',
  loading: 'جارٍ التحميل…',
  optional: '(اختياري)',
  copy: 'نسخ',
  copied: 'تم النسخ.',
  retry: 'إعادة المحاولة',
  all: 'الكل',
  none: 'لا شيء',
  page: 'الصفحة {{current}} من {{last}}',
  noResults: 'لا توجد نتائج مطابقة.',
  noResultsHint: 'جرّب بحثاً أقصر، أو امسح عوامل التصفية.',

  // --- Auth / session ---
  signIn: 'تسجيل الدخول',
  signOut: 'تسجيل الخروج',
  email: 'البريد الإلكتروني',
  password: 'كلمة المرور',
  account: 'الحساب',

  // --- Navigation ---
  navOverview: 'نظرة عامة',
  navApps: 'التطبيقات والوحدات',
  navTranslations: 'الترجمات',
  navDrafts: 'المسودات',
  navLocales: 'اللغات',
  navUsers: 'المستخدمون',
  selectApplication: 'التطبيق',
  adminOnly: 'هذه الصفحة للمدراء فقط',
  adminOnlyDescription:
    'يستطيع المحرر تعديل الترجمات ونشرها، أما إدارة المستخدمين واللغات فتحتاج صلاحية مدير.',

  // --- Roles ---
  roleAdmin: 'مدير',
  roleEditor: 'محرر',

  // --- Translation status ---
  statusPublished: 'منشور',
  statusDraft: 'مسودة',
  statusInReview: 'قيد المراجعة',
  statusArchived: 'مؤرشفة',
  statusMissing: 'غير مترجم',
  statusUnsaved: 'غير محفوظ',
});
