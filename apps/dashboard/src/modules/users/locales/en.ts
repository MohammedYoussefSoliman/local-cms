import i18n from '@/locales/i18n';

i18n.addResourceBundle('en', 'users', {
  title: 'Users',
  eyebrow: 'Access',
  inviteUser: 'Invite a user',

  roleAdminTitle: 'Admin',
  roleAdminDescription:
    'Everything: translations, languages, applications and users.',
  roleEditorTitle: 'Editor',
  roleEditorDescription:
    'Create keys, edit translations and publish them, in every application.',

  colEmail: 'Email',
  colName: 'Name',
  colRole: 'Role',
  colStatus: 'Status',
  colActions: '',

  statusActive: 'Active',
  statusInvited: 'Invited',
  statusDisabled: 'Disabled',

  you: 'You',
  makeAdmin: 'Make admin',
  makeEditor: 'Make editor',
  disable: 'Disable',
  enable: 'Enable',

  emptyTitle: 'No users yet',

  inviteTitle: 'Invite a user',
  inviteSubtitle:
    'The account is created and an invitation link is minted. There is no mail transport — copy the link and send it yourself.',
  inviteName: 'Name',
  inviteEmail: 'Email',
  inviteRole: 'Role',
  inviteCta: 'Create and get link',

  linkTitle: 'Copy this link now',
  linkDescription:
    'It is shown once and cannot be recovered. Re-issuing the invitation is the only way to replace it.',
  copyLink: 'Copy link',
  linkCopied: 'Invitation link copied.',
  done: 'Done',

  userInvited: 'User invited.',
  userUpdated: 'User updated.',
  userEnabled: 'User enabled.',
  userDisabled: 'User disabled.',

  nameIsRequired: 'Name is required.',
  emailIsRequired: 'Email is required.',
  emailIsInvalid: 'Enter a valid email address.',
});
