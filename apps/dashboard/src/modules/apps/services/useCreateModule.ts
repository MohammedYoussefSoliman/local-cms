import { handleHttpError, showToast } from '@cms/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  HTTPResponseType,
  TranslationModuleResponseData,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { MODULES_QUERY_KEYS } from '@/helpers';

import type { CreateModuleFormValues } from '../Apps.types';

/**
 * Scope comes from the route, never from the body: `/apps/:appId/modules`
 * always produces an app-scoped module and `/modules/global` always a global
 * one, so there is no way to describe a pair the CHECK constraint would reject.
 */
export function useCreateModule(appId: string | undefined) {
  const { t } = useTranslation('apps');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: CreateModuleFormValues) => {
      const url = appId ? `/apps/${appId}/modules` : '/modules/global';
      const response = await axiosInstance.post<
        HTTPResponseType<TranslationModuleResponseData>,
        ApiResponse<TranslationModuleResponseData>
      >(url, payload);

      return response.data;
    },
    onSuccess: async () => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: t('moduleCreated'),
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [MODULES_QUERY_KEYS.getAllModules],
        }),
        queryClient.invalidateQueries({
          queryKey: [MODULES_QUERY_KEYS.getGlobalModules],
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
