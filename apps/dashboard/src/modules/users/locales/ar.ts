import i18n from '@/locales/i18n';

i18n.addResourceBundle('ar', 'users', {
  title: 'المستخدمون',
  eyebrow: 'الصلاحيات',
  inviteUser: 'دعوة مستخدم',

  roleAdminTitle: 'مدير',
  roleAdminDescription:
    'كل شيء: الترجمات، اللغات، التطبيقات، والمستخدمون.',
  roleEditorTitle: 'محرر',
  roleEditorDescription:
    'إنشاء المفاتيح وتعديل الترجمات ونشرها في كل التطبيقات.',

  colEmail: 'البريد',
  colName: 'الاسم',
  colRole: 'الدور',
  colStatus: 'الحالة',
  colActions: '',

  statusActive: 'نشط',
  statusInvited: 'مدعو',
  statusDisabled: 'معطّل',

  you: 'أنت',
  makeAdmin: 'تغيير إلى مدير',
  makeEditor: 'تغيير إلى محرر',
  disable: 'تعطيل',
  enable: 'تفعيل',

  emptyTitle: 'لا يوجد مستخدمون بعد',

  inviteTitle: 'دعوة مستخدم',
  inviteSubtitle:
    'يُنشأ الحساب ويُصدر رابط دعوة. لا يوجد إرسال بريد — انسخ الرابط وأرسله بنفسك.',
  inviteName: 'الاسم',
  inviteEmail: 'البريد الإلكتروني',
  inviteRole: 'الدور',
  inviteCta: 'إنشاء واستخراج الرابط',

  linkTitle: 'انسخ هذا الرابط الآن',
  linkDescription:
    'يظهر مرة واحدة ولا يمكن استرجاعه. إعادة إصدار الدعوة هي الطريقة الوحيدة لاستبداله.',
  copyLink: 'نسخ الرابط',
  linkCopied: 'تم نسخ رابط الدعوة.',
  done: 'تم',

  userInvited: 'تمت دعوة المستخدم.',
  userUpdated: 'تم تحديث المستخدم.',
  userEnabled: 'تم تفعيل المستخدم.',
  userDisabled: 'تم تعطيل المستخدم.',

  nameIsRequired: 'الاسم مطلوب.',
  emailIsRequired: 'البريد الإلكتروني مطلوب.',
  emailIsInvalid: 'أدخل بريداً إلكترونياً صحيحاً.',
});
