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

import type { PublishDraftPayload } from '../Drafts.types';

/**
 * Publishes one value.
 *
 * `expectedVersion` is always sent. Without it the API takes last-write-wins,
 * which on this screen means shipping text that arrived after the queue was
 * rendered — copy nobody read going live on a storefront.
 */
export function usePublishDraft() {
  const { t } = useTranslation('drafts');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ id, expectedVersion }: PublishDraftPayload) => {
      const response = await axiosInstance.post<
        HTTPResponseType<TranslationValueResponseData>,
        ApiResponse<TranslationValueResponseData>
      >(`/translations/${id}/publish`, { expectedVersion });

      return response.data;
    },
    onSuccess: async () => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: t('draftPublished'),
      });

      // Key roots only. Enumerated rather than blanket-invalidated so the list
      // stays meaningful — see `.claude/rules/global-api-service.md` Rule 3.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [DRAFTS_QUERY_KEYS.getAppDrafts],
        }),
        queryClient.invalidateQueries({
          queryKey: [TRANSLATIONS_QUERY_KEYS.getEntries],
        }),
        queryClient.invalidateQueries({
          queryKey: [TRANSLATIONS_QUERY_KEYS.getValueHistory],
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
