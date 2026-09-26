import { handleHttpError, showToast } from '@cms/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  HTTPResponseType,
  PaginatedList,
  PaginationParams,
  TranslationModuleResponseData,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { MODULES_QUERY_KEYS } from '@/helpers';

/**
 * Namespaces shared by every app. They resolve UNDER an app's own modules in
 * the runtime chain, so they are listed separately rather than merged into the
 * app's list — merging them would hide which of two same-named keys wins.
 */
export function useGetGlobalModules(params: PaginationParams = {}) {
  const { t } = useTranslation('app');

  const { data, error, isLoading } = useQuery({
    queryKey: [MODULES_QUERY_KEYS.getGlobalModules, params],
    queryFn: async () => {
      const response = await axiosInstance.get<
        HTTPResponseType<PaginatedList<TranslationModuleResponseData>>,
        ApiResponse<PaginatedList<TranslationModuleResponseData>>
      >('/modules/global', { params });

      return response.data;
    },
    placeholderData: (previous) => previous,
    throwOnError: false,
  });

  useEffect(() => {
    if (!error) return;
    const { message } = handleHttpError(error, t('someThingWentWrong'));
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [error, t]);

  return { data, isLoading };
}
