import { handleHttpError, showToast } from '@cms/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { AppResponseData, HTTPResponseType } from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { APPS_QUERY_KEYS } from '@/helpers';

export function useGetAppById(appId: string | undefined) {
  const { t } = useTranslation('app');

  const { data, error, isLoading } = useQuery({
    queryKey: [APPS_QUERY_KEYS.getAppById, appId],
    queryFn: async () => {
      const response = await axiosInstance.get<
        HTTPResponseType<AppResponseData>,
        ApiResponse<AppResponseData>
      >(`/apps/${appId}`);

      return response.data;
    },
    enabled: Boolean(appId),
    throwOnError: false,
  });

  useEffect(() => {
    if (!error) return;
    const { message } = handleHttpError(error, t('someThingWentWrong'));
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [error, t]);

  return { data, isLoading };
}
