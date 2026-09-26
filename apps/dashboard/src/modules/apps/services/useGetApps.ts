import { handleHttpError, showToast } from '@cms/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  AppResponseData,
  HTTPResponseType,
  PaginatedList,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { APPS_QUERY_KEYS } from '@/helpers';

import type { AppsParams } from '../Apps.types';

export function useGetApps(params: AppsParams = {}) {
  const { t } = useTranslation('app');

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: [APPS_QUERY_KEYS.getAllApps, params],
    queryFn: async () => {
      const response = await axiosInstance.get<
        HTTPResponseType<PaginatedList<AppResponseData>>,
        ApiResponse<PaginatedList<AppResponseData>>
      >('/apps', { params });

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

  return { data, isLoading, isFetching };
}
