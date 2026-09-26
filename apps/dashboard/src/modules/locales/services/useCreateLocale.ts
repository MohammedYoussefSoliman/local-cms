import { handleHttpError, showToast } from '@cms/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { HTTPResponseType, LocaleResponseData } from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { LOCALES_QUERY_KEYS } from '@/helpers';

import type { CreateLocaleFormValues } from '../Locales.types';

export function useCreateLocale() {
  const { t } = useTranslation('locales');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: CreateLocaleFormValues) => {
      const response = await axiosInstance.post<
        HTTPResponseType<LocaleResponseData>,
        ApiResponse<LocaleResponseData>
      >('/locales', payload);

      return response.data;
    },
    onSuccess: async () => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: t('localeCreated'),
      });

      await queryClient.invalidateQueries({
        queryKey: [LOCALES_QUERY_KEYS.getAllLocales],
      });
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
