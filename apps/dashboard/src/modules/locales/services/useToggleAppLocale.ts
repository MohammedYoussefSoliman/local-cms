import { handleHttpError, showToast } from '@cms/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { axiosInstance } from '@/config';
import { LOCALES_QUERY_KEYS, TRANSLATIONS_QUERY_KEYS } from '@/helpers';

type ToggleAppLocalePayload = {
  appId: string;
  localeCode: string;
  enable: boolean;
};

/**
 * Switches a language on or off for one app.
 *
 * The cross-entity invalidation is the one that gets forgotten: the translation
 * editor renders **one column per enabled locale**, so enabling a language
 * changes every entries table in that app even though no translation was
 * touched (`.claude/rules/global-api-service.md` Rule 3).
 */
export function useToggleAppLocale() {
  const { t } = useTranslation('locales');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      appId,
      localeCode,
      enable,
    }: ToggleAppLocalePayload) => {
      const url = `/apps/${appId}/locales/${localeCode}/${
        enable ? 'enable' : 'disable'
      }`;

      const response = enable
        ? await axiosInstance.post(url)
        : await axiosInstance.delete(url);

      return response.data;
    },
    onSuccess: async (_data, variables) => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: variables.enable ? t('localeEnabled') : t('localeDisabled'),
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [LOCALES_QUERY_KEYS.getAppLocales],
        }),
        queryClient.invalidateQueries({
          queryKey: [TRANSLATIONS_QUERY_KEYS.getEntries],
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
