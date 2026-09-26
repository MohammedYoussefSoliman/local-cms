import { useTranslation } from 'react-i18next';
import * as z from 'zod';

/** Mirrors the API's own slug rule, so the first rejection is client-side. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function useAppFormSchema() {
  const { t } = useTranslation('apps');

  return z.object({
    name: z.string().min(1, { message: t('nameIsRequired') }),
    slug: z
      .string()
      .min(1, { message: t('slugIsRequired') })
      .regex(SLUG, { message: t('slugIsInvalid') }),
    description: z.string().optional(),
    defaultLocaleCode: z.string().min(1, { message: t('localeIsRequired') }),
  });
}

export type AppFormValues = z.infer<ReturnType<typeof useAppFormSchema>>;

export function useModuleFormSchema() {
  const { t } = useTranslation('apps');

  return z.object({
    name: z.string().min(1, { message: t('nameIsRequired') }),
    slug: z
      .string()
      .min(1, { message: t('slugIsRequired') })
      .regex(SLUG, { message: t('slugIsInvalid') }),
    description: z.string().optional(),
  });
}

export type ModuleFormValues = z.infer<ReturnType<typeof useModuleFormSchema>>;
