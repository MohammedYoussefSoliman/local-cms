import { handleHttpError, showToast } from '@cms/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  HTTPResponseType,
  TranslationModuleResponseData,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { MODULES_QUERY_KEYS } from '@/helpers';

/**
 * The module the editor is scoped to.
 *
 * Needed for two things the route cannot supply: the breadcrumb's module name,
 * and the **slug**, which is the first key of the runtime bundle
 * (`{ "<moduleSlug>": { "<entryKey>": "…" } }`). Guessing it would make the
 * preview panel show a shape no client application ever receives.
 */
export function useGetModuleById(moduleId: string | undefined) {
  const { t } = useTranslation('app');

  const { data, error, isLoading } = useQuery({
    queryKey: [MODULES_QUERY_KEYS.getModuleById, moduleId],
    queryFn: async () => {
      const response = await axiosInstance.get<
        HTTPResponseType<TranslationModuleResponseData>,
        ApiResponse<TranslationModuleResponseData>
      >(`/modules/${moduleId}`);

      return response.data;
    },
    enabled: Boolean(moduleId),
    throwOnError: false,
  });

  useEffect(() => {
    if (!error) return;
    const { message } = handleHttpError(error, t('someThingWentWrong'));
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [error, t]);

  return { data, isLoading };
}
