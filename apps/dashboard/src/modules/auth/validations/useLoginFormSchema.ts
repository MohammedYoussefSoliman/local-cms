import { useTranslation } from 'react-i18next';
import * as z from 'zod';

/**
 * A hook rather than a module-level const, so the messages can be translated —
 * a schema defined outside React has no access to `t`.
 */
export function useLoginFormSchema() {
  const { t } = useTranslation('auth');

  return z.object({
    email: z
      .string()
      .min(1, { message: t('emailIsRequired') })
      .email({ message: t('emailIsInvalid') }),
    password: z.string().min(1, { message: t('passwordIsRequired') }),
  });
}

export type LoginFormSchemaValues = z.infer<
  ReturnType<typeof useLoginFormSchema>
>;
