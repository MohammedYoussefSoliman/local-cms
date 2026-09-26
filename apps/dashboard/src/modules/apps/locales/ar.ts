import i18n from '@/locales/i18n';

i18n.addResourceBundle('ar', 'apps', {
  title: 'التطبيقات والوحدات',
  eyebrow: 'كل التطبيقات',
  newApp: 'تطبيق جديد',
  newModule: 'وحدة جديدة',

  appsEmptyTitle: 'لا توجد تطبيقات بعد',
  appsEmptyDescription:
    'التطبيق هو منتج واحد تُدار نصوصه هنا — متجر، أو لوحة تاجر.',

  modulesOf: 'وحدات {{app}}',
  globalModules: 'الوحدات العامة',
  globalModulesDescription:
    'مشتركة بين كل التطبيقات. تُحلّ بعد وحدات التطبيق نفسه، فالمفتاح الموجود في الاثنين يأتي من التطبيق.',

  colModule: 'الوحدة',
  colSlug: 'المعرّف',
  colScope: 'النطاق',
  colEndpoint: 'نقطة الوصول',
  open: 'فتح',

  modulesEmptyTitle: 'لا توجد وحدات في هذا التطبيق',
  modulesEmptyDescription:
    'الوحدة هي مساحة أسماء للنصوص — الدفع، المنتجات، تسجيل الدخول.',

  // --- Create application ---
  createAppTitle: 'تطبيق جديد',
  createAppSubtitle:
    'المعرّف يدخل في رابط التشغيل الذي تُبنى به تطبيقاتك، لذا لا يمكن تغييره لاحقاً.',
  appName: 'الاسم',
  appSlug: 'المعرّف',
  appSlugHelper: 'أحرف صغيرة وشرطات. دائم بعد الإنشاء.',
  appDescription: 'الوصف',
  defaultLocale: 'اللغة الافتراضية',
  appCreated: 'تم إنشاء التطبيق.',

  // --- Create module ---
  createModuleTitle: 'وحدة جديدة',
  createModuleSubtitle:
    'المعرّف يظهر في مسار التشغيل، لذا لا يمكن تغييره لاحقاً.',
  moduleName: 'الاسم',
  moduleSlug: 'المعرّف',
  moduleCreated: 'تم إنشاء الوحدة.',

  nameIsRequired: 'الاسم مطلوب.',
  slugIsRequired: 'المعرّف مطلوب.',
  slugIsInvalid: 'استخدم أحرفاً إنجليزية صغيرة وأرقاماً وشرطات فقط.',
  localeIsRequired: 'اختر لغة افتراضية.',
});
