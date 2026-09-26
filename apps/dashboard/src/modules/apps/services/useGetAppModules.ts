import { handleHttpError, showToast } from '@cms/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  HTTPResponseType,
  PaginatedList,
  TranslationModuleResponseData,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { MODULES_QUERY_KEYS } from '@/helpers';

import type { ModulesParams } from '../Apps.types';

export function useGetAppModules({ appId, ...params }: ModulesParams) {
  const { t } = useTranslation('app');

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: [MODULES_QUERY_KEYS.getAllModules, appId, params],
    queryFn: async () => {
      const response = await axiosInstance.get<
        HTTPResponseType<PaginatedList<TranslationModuleResponseData>>,
        ApiResponse<PaginatedList<TranslationModuleResponseData>>
      >(`/apps/${appId}/modules`, { params });

      return response.data;
    },
    enabled: Boolean(appId),
    placeholderData: (previous) => previous,
    throwOnError: false,
  });

  useEffect(() => {
    if (!error) return;
    const { message } = handleHttpError(error, t('someThingWentWrong'));
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [error, t]);

  return { data, isLoading, isFetching };
}
