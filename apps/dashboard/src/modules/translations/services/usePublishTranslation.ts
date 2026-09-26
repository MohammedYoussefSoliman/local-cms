import { handleHttpError, showToast } from '@cms/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  HTTPResponseType,
  TranslationValueResponseData,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import {
  DRAFTS_QUERY_KEYS,
  MODULES_QUERY_KEYS,
  TRANSLATIONS_QUERY_KEYS,
} from '@/helpers';

/**
 * Publishes a value that already exists — the "publish now" beside a draft.
 *
 * Separate from the upsert because publishing an unchanged draft is one call,
 * not a write followed by a transition.
 */
export function usePublishTranslation() {
  const { t } = useTranslation('translations');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      valueId,
      expectedVersion,
    }: {
      valueId: string;
      expectedVersion?: number;
    }) => {
      const response = await axiosInstance.post<
        HTTPResponseType<TranslationValueResponseData>,
        ApiResponse<TranslationValueResponseData>
      >(`/translations/${valueId}/publish`, { expectedVersion });

      return response.data;
    },
    onSuccess: async () => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: t('published'),
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [TRANSLATIONS_QUERY_KEYS.getEntries],
        }),
        queryClient.invalidateQueries({
          queryKey: [TRANSLATIONS_QUERY_KEYS.getValueHistory],
        }),
        queryClient.invalidateQueries({
          queryKey: [DRAFTS_QUERY_KEYS.getAppDrafts],
        }),
        queryClient.invalidateQueries({
          queryKey: [MODULES_QUERY_KEYS.getModuleById],
        }),
      ]);
    },
  });

  useEffect(() => {
    if (!mutation.error) return;
    const { message } = handleHttpError(
      mutation.error,
      tApp('someThingWentWrong'),
    );
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [mutation.error, tApp]);

  return mutation;
}
