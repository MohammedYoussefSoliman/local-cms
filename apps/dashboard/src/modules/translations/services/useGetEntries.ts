import { handleHttpError, showToast } from '@cms/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  HTTPResponseType,
  PaginatedList,
  TranslationRow,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { TRANSLATIONS_QUERY_KEYS } from '@/helpers';

import type { EntriesParams } from '../Translations.types';

/**
 * The editor's main table.
 *
 * Returns one row per entry with a `values` map keyed by **locale code**,
 * including languages that have no value yet. The storage behind it is one flat
 * row per (entry × language); this response is nested, built at read time.
 * Shaping one like the other is the mistake the schema exists to prevent.
 */
export function useGetEntries({ moduleId, ...params }: EntriesParams) {
  const { t } = useTranslation('app');

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: [TRANSLATIONS_QUERY_KEYS.getEntries, moduleId, params],
    queryFn: async () => {
      const response = await axiosInstance.get<
        HTTPResponseType<PaginatedList<TranslationRow>>,
        ApiResponse<PaginatedList<TranslationRow>>
      >(`/modules/${moduleId}/entries`, { params });

      return response.data;
    },
    enabled: Boolean(moduleId),
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
