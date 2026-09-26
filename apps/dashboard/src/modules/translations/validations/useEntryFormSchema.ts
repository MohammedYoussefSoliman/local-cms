import { useTranslation } from 'react-i18next';
import * as z from 'zod';

/**
 * The API's own key rule, anchored the same way: a key cannot start with a
 * separator, which is what stops a flattened import producing `.title`.
 */
const ENTRY_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function useEntryFormSchema() {
  const { t } = useTranslation('translations');

  return z.object({
    key: z
      .string()
      .min(1, { message: t('keyIsRequired') })
      .regex(ENTRY_KEY, { message: t('keyIsInvalid') }),
    description: z.string().optional(),
    contentType: z.enum(['text', 'rich_text', 'icu_message']),
  });
}

export type EntryFormValues = z.infer<ReturnType<typeof useEntryFormSchema>>;
