import { handleHttpError, showToast } from '@cms/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { AppResponseData, HTTPResponseType } from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { APPS_QUERY_KEYS, LOCALES_QUERY_KEYS } from '@/helpers';

import type { CreateAppFormValues } from '../Apps.types';

/**
 * Creating an app also writes its default `app_locales` row, in the same
 * transaction — so the new app's locale list exists the moment this resolves
 * and `getAppLocales` is stale even though nobody touched a locale.
 */
export function useCreateApp() {
  const { t } = useTranslation('apps');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: CreateAppFormValues) => {
      const response = await axiosInstance.post<
        HTTPResponseType<AppResponseData>,
        ApiResponse<AppResponseData>
      >('/apps', payload);

      return response.data;
    },
    onSuccess: async () => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: t('appCreated'),
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [APPS_QUERY_KEYS.getAllApps],
        }),
        queryClient.invalidateQueries({
          queryKey: [LOCALES_QUERY_KEYS.getAppLocales],
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
