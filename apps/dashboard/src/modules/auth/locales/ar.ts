import i18n from '@/locales/i18n';

i18n.addResourceBundle('ar', 'auth', {
  signInTitle: 'تسجيل الدخول',
  signInSubtitle:
    'عدّل نصوص تطبيقاتك وانشرها مباشرة، دون مطوّر ودون إعادة نشر التطبيق.',
  sessionHint: 'تبقى جلستك نشطة؛ يُجدَّد رمز الدخول تلقائياً في الخلفية.',

  emailIsRequired: 'البريد الإلكتروني مطلوب.',
  emailIsInvalid: 'أدخل بريداً إلكترونياً صحيحاً.',
  passwordIsRequired: 'كلمة المرور مطلوبة.',
  passwordTooShort: 'استخدم {{count}} حرفاً على الأقل.',
  confirmIsRequired: 'أكّد كلمة المرور.',
  passwordsDoNotMatch: 'كلمتا المرور غير متطابقتين.',

  // --- Invitation ---
  acceptTitle: 'اختر كلمة المرور',
  acceptSubtitle: 'تمت دعوتك بصفة {{role}}. اختر كلمة مرور للمتابعة.',
  newPassword: 'كلمة المرور الجديدة',
  confirmPassword: 'تأكيد كلمة المرور',
  acceptCta: 'حفظ كلمة المرور والدخول',
  invitationInvalidTitle: 'لم يعد هذا الرابط صالحاً',
  invitationInvalidDescription:
    'الدعوات تُستخدم مرة واحدة وتنتهي صلاحيتها. اطلب من المدير إرسال دعوة جديدة.',
  backToSignIn: 'العودة لتسجيل الدخول',
});
