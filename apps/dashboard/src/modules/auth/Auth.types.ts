import type { LoginPayload } from '@cms/contracts';

export type LoginFormValues = LoginPayload;

export type AcceptInvitationFormValues = {
  password: string;
  confirmPassword: string;
};
