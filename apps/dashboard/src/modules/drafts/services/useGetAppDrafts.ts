import { handleHttpError, showToast } from '@cms/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  DraftValueRow,
  HTTPResponseType,
  PaginatedList,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { DRAFTS_QUERY_KEYS } from '@/helpers';

import type { DraftsParams } from '../Drafts.types';

export function useGetAppDrafts({ appId, ...params }: DraftsParams) {
  const { t } = useTranslation('app');

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: [DRAFTS_QUERY_KEYS.getAppDrafts, appId, params],
    queryFn: async () => {
      const response = await axiosInstance.get<
        HTTPResponseType<PaginatedList<DraftValueRow>>,
        ApiResponse<PaginatedList<DraftValueRow>>
      >(`/apps/${appId}/drafts`, { params });

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
