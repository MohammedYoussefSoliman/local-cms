import { handleHttpError, showToast } from '@cms/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  HTTPResponseType,
  PaginatedList,
  TranslationHistoryData,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { TRANSLATIONS_QUERY_KEYS } from '@/helpers';

/**
 * Every version ever written for one value, newest first.
 *
 * The table is append-only — nothing in it is updated or deleted — which is
 * what makes rollback possible and what this panel is reading.
 */
export function useGetValueHistory(valueId: string | undefined) {
  const { t } = useTranslation('app');

  const { data, error, isLoading } = useQuery({
    queryKey: [TRANSLATIONS_QUERY_KEYS.getValueHistory, valueId],
    queryFn: async () => {
      const response = await axiosInstance.get<
        HTTPResponseType<PaginatedList<TranslationHistoryData>>,
        ApiResponse<PaginatedList<TranslationHistoryData>>
      >(`/translations/${valueId}/history`, { params: { limit: 50 } });

      return response.data;
    },
    enabled: Boolean(valueId),
    throwOnError: false,
  });

  useEffect(() => {
    if (!error) return;
    const { message } = handleHttpError(error, t('someThingWentWrong'));
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [error, t]);

  return { data, isLoading };
}
