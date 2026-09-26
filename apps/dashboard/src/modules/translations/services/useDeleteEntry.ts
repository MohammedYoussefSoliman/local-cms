import { handleHttpError, showToast } from '@cms/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { axiosInstance } from '@/config';
import {
  DRAFTS_QUERY_KEYS,
  MODULES_QUERY_KEYS,
  TRANSLATIONS_QUERY_KEYS,
} from '@/helpers';

/**
 * Removes a key and every translation of it.
 *
 * The delete cascades to values and their history, so any draft of this key
 * leaves the queue too — which is why the drafts key is in the set even though
 * nothing here mentions publishing.
 */
export function useDeleteEntry() {
  const { t } = useTranslation('translations');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (entryId: string) => {
      await axiosInstance.delete(`/entries/${entryId}`);
    },
    onSuccess: async () => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: t('keyDeleted'),
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
