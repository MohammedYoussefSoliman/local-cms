import { handleHttpError, showToast } from '@cms/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { AppLocaleResponseData, HTTPResponseType } from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { LOCALES_QUERY_KEYS } from '@/helpers';

/**
 * The languages one app serves, with each one's direction and fallback.
 *
 * This is what the translation editor builds its columns from — one column per
 * enabled locale, from data. Enabling French must change nothing but this
 * response.
 */
export function useGetAppLocales(appId: string | undefined) {
  const { t } = useTranslation('app');

  const { data, error, isLoading } = useQuery({
    queryKey: [LOCALES_QUERY_KEYS.getAppLocales, appId],
    queryFn: async () => {
      const response = await axiosInstance.get<
        HTTPResponseType<AppLocaleResponseData[]>,
        ApiResponse<AppLocaleResponseData[]>
      >(`/apps/${appId}/locales`);

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
