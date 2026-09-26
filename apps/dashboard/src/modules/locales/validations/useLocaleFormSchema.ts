import { useTranslation } from 'react-i18next';
import * as z from 'zod';

/** BCP 47: a language subtag, then optional script/region/variant subtags. */
const BCP_47 = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export function useLocaleFormSchema() {
  const { t } = useTranslation('locales');

  return z.object({
    code: z
      .string()
      .min(1, { message: t('codeIsRequired') })
      .regex(BCP_47, { message: t('codeIsInvalid') }),
    name: z.string().min(1, { message: t('nameIsRequired') }),
    nativeName: z.string().min(1, { message: t('nativeNameIsRequired') }),
    direction: z.enum(['ltr', 'rtl']),
  });
}

export type LocaleFormValues = z.infer<ReturnType<typeof useLocaleFormSchema>>;
