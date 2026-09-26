import { useTranslation } from 'react-i18next';
import * as z from 'zod';

export function useInviteUserSchema() {
  const { t } = useTranslation('users');

  return z.object({
    name: z.string().min(1, { message: t('nameIsRequired') }),
    email: z
      .string()
      .min(1, { message: t('emailIsRequired') })
      .email({ message: t('emailIsInvalid') }),
    role: z.enum(['admin', 'editor']),
  });
}

export type InviteUserSchemaValues = z.infer<
  ReturnType<typeof useInviteUserSchema>
>;
