import i18n from '@/locales/i18n';

i18n.addResourceBundle('en', 'auth', {
  signInTitle: 'Sign in',
  signInSubtitle:
    'Edit your applications’ copy and publish it straight away — no developer, no redeploy.',
  sessionHint:
    'Your session stays active; the access token is renewed in the background.',

  emailIsRequired: 'Email is required.',
  emailIsInvalid: 'Enter a valid email address.',
  passwordIsRequired: 'Password is required.',
  passwordTooShort: 'Use at least {{count}} characters.',
  confirmIsRequired: 'Confirm your password.',
  passwordsDoNotMatch: 'The two passwords do not match.',

  // --- Invitation ---
  acceptTitle: 'Set your password',
  acceptSubtitle: 'You were invited as {{role}}. Pick a password to continue.',
  newPassword: 'New password',
  confirmPassword: 'Confirm password',
  acceptCta: 'Set password and sign in',
  invitationInvalidTitle: 'This link is no longer valid',
  invitationInvalidDescription:
    'Invitations are single-use and expire. Ask an admin to send you a new one.',
  backToSignIn: 'Back to sign in',
});
