import { handleHttpError, showToast } from '@cms/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { CurrentUserResponseData, HTTPResponseType } from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { AUTH_QUERY_KEYS } from '@/helpers';
import { useAuthStore } from '@/store';

/**
 * Re-reads the signed-in account on load.
 *
 * The persisted `user` in the store is only what was true when the tab was last
 * open: a role change or a disable happened server-side and the store knows
 * nothing about it. This is what makes the sidebar and the role guards reflect
 * the account as it is now rather than as it was.
 */
export function useGetCurrentUser() {
  const { t } = useTranslation('app');
  const refreshToken = useAuthStore((state) => state.refreshToken);

  const { data, error, isLoading } = useQuery({
    queryKey: [AUTH_QUERY_KEYS.getCurrentUser],
    queryFn: async () => {
      const response =
        await axiosInstance.get<
        HTTPResponseType<CurrentUserResponseData>,
        ApiResponse<CurrentUserResponseData>
      >(
          '/auth/me',
        );

      return response.data;
    },
    enabled: Boolean(refreshToken),
    throwOnError: false,
  });

  useEffect(() => {
    if (!error) return;
    const { message, status } = handleHttpError(error, t('someThingWentWrong'));
    // A 401 here is the session ending, which the axios layer already handles
    // by clearing the store and bouncing to login. A toast on top of that is
    // noise on a screen the user is being moved away from.
    if (status === 401) return;
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [error, t]);

  return { data, isLoading };
}
