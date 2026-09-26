import i18n from '@/locales/i18n';

i18n.addResourceBundle('ar', 'locales', {
  title: 'اللغات',
  eyebrow: 'كل التطبيقات',
  description:
    'إضافة لغة تُضيف صفوفاً لا أعمدة: كل مفتاح موجود يحصل على قيمة فارغة باللغة الجديدة، دون تعديل على بنية قاعدة البيانات أو إعادة نشر.',
  addLocale: 'إضافة لغة',
  readOnlyNotice: 'للعرض فقط. إضافة اللغات وتعطيلها من صلاحيات المدير.',

  colCode: 'الرمز',
  colName: 'الاسم',
  colNativeName: 'الاسم الأصلي',
  colDirection: 'الاتجاه',
  colStatus: 'الحالة',
  colFallback: 'تتراجع إلى',

  directionLtr: 'من اليسار إلى اليمين',
  directionRtl: 'من اليمين إلى اليسار',

  enabledInApp: 'مُفعّلة في {{app}}',
  notEnabled: 'غير مُفعّلة',
  inactive: 'غير نشطة',
  isDefault: 'افتراضية',
  defaultLocked: 'افتراضية · لا يمكن تعطيلها',
  enable: 'تفعيل',
  disable: 'تعطيل',
  noFallback: 'بدون تراجع',

  emptyTitle: 'لا توجد لغات بعد',

  createTitle: 'إضافة لغة',
  createSubtitle:
    'الرمز يدخل في رابط التشغيل الذي تطلبه التطبيقات، لذا لا يمكن تغييره لاحقاً.',
  code: 'رمز BCP 47',
  codeHelper: 'مثل ar أو en أو pt-BR.',
  name: 'الاسم بالإنجليزية',
  nativeName: 'الاسم الأصلي',
  direction: 'اتجاه القراءة',
  localeCreated: 'تمت إضافة اللغة.',
  localeEnabled: 'تم تفعيل اللغة.',
  localeDisabled: 'تم تعطيل اللغة.',
  fallbackUpdated: 'تم تحديث التراجع.',

  codeIsRequired: 'الرمز مطلوب.',
  codeIsInvalid: 'استخدم رمز BCP 47 مثل ar أو pt-BR.',
  nameIsRequired: 'الاسم مطلوب.',
  nativeNameIsRequired: 'الاسم الأصلي مطلوب.',
});
