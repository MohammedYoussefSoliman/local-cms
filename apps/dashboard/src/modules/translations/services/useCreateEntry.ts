import { handleHttpError, showToast } from '@cms/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  CreateEntryPayload,
  EntryResponseData,
  HTTPResponseType,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { MODULES_QUERY_KEYS, TRANSLATIONS_QUERY_KEYS } from '@/helpers';

/**
 * Adds a key. It carries no text — an entry is the language-independent
 * identity of a piece of copy, and the words arrive one `PUT` per language
 * afterwards.
 */
export function useCreateEntry(moduleId: string) {
  const { t } = useTranslation('translations');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: CreateEntryPayload) => {
      const response = await axiosInstance.post<
        HTTPResponseType<EntryResponseData>,
        ApiResponse<EntryResponseData>
      >(`/modules/${moduleId}/entries`, payload);

      return response.data;
    },
    onSuccess: async () => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: t('keyCreated'),
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [TRANSLATIONS_QUERY_KEYS.getEntries],
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
