import { useTranslation } from 'react-i18next';
import * as z from 'zod';

/** Matches the API's own minimum, so the first failure is client-side. */
const MIN_PASSWORD_LENGTH = 12;

export function useAcceptInvitationSchema() {
  const { t } = useTranslation('auth');

  return z
    .object({
      password: z
        .string()
        .min(MIN_PASSWORD_LENGTH, {
          message: t('passwordTooShort', { count: MIN_PASSWORD_LENGTH }),
        }),
      confirmPassword: z.string().min(1, { message: t('confirmIsRequired') }),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: t('passwordsDoNotMatch'),
      path: ['confirmPassword'],
    });
}

export type AcceptInvitationSchemaValues = z.infer<
  ReturnType<typeof useAcceptInvitationSchema>
>;
