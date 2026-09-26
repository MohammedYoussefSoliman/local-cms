import { handleHttpError, showToast } from '@cms/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { axiosInstance } from '@/config';
import { USERS_QUERY_KEYS } from '@/helpers';

/**
 * Disabling revokes every session the account holds, immediately — the JWT
 * strategy re-reads the account on each request, so the victim's next call is
 * a 401 rather than a wait for their access token to expire.
 */
export function useToggleUserStatus() {
  const { t } = useTranslation('users');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      userId,
      enable,
    }: {
      userId: string;
      enable: boolean;
    }) => {
      const response = await axiosInstance.post(
        `/users/${userId}/${enable ? 'enable' : 'disable'}`,
      );

      return response.data;
    },
    onSuccess: async (_data, variables) => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: variables.enable ? t('userEnabled') : t('userDisabled'),
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [USERS_QUERY_KEYS.getAllUsers],
        }),
        queryClient.invalidateQueries({
          queryKey: [USERS_QUERY_KEYS.getUserById],
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
