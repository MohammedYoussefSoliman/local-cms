import { handleHttpError, showToast } from '@cms/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { axiosInstance } from '@/config';
import { LOCALES_QUERY_KEYS } from '@/helpers';

type SetFallbackPayload = {
  appId: string;
  localeCode: string;
  /** `null` clears it, leaving resolution to end at the key itself. */
  fallbackLocaleCode: string | null;
};

/**
 * Where a key with no value in this language resolves next.
 *
 * Runtime bundles only — nothing in the dashboard reads through a fallback, so
 * no translation query is affected by this.
 */
export function useSetLocaleFallback() {
  const { t } = useTranslation('locales');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      appId,
      localeCode,
      fallbackLocaleCode,
    }: SetFallbackPayload) => {
      const response = await axiosInstance.patch(
        `/apps/${appId}/locales/${localeCode}/fallback`,
        { fallbackLocaleCode },
      );

      return response.data;
    },
    onSuccess: async () => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: t('fallbackUpdated'),
      });

      await queryClient.invalidateQueries({
        queryKey: [LOCALES_QUERY_KEYS.getAppLocales],
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
