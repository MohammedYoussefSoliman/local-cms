import { handleHttpError, showToast } from '@cms/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  HTTPResponseType,
  LocaleResponseData,
  PaginatedList,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { LOCALES_QUERY_KEYS } from '@/helpers';

import type { LocalesParams } from '../Locales.types';

/**
 * Every language the CMS knows about.
 *
 * Adding one is an INSERT here, never a migration and never a TypeScript
 * change — this list is the reason the schema stores languages as rows.
 */
export function useGetLocales(params: LocalesParams = {}) {
  const { t } = useTranslation('app');

  const { data, error, isLoading } = useQuery({
    queryKey: [LOCALES_QUERY_KEYS.getAllLocales, params],
    queryFn: async () => {
      const response = await axiosInstance.get<
        HTTPResponseType<PaginatedList<LocaleResponseData>>,
        ApiResponse<PaginatedList<LocaleResponseData>>
      >('/locales', { params });

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
