import { handleHttpError, showToast } from '@cms/ui';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { HTTPResponseType, LoginResponseData } from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { useAuthStore } from '@/store';

import type { LoginFormValues } from '../Auth.types';

/**
 * No cache invalidation: there is nothing cached before a session exists. The
 * store write is the whole point — every subsequent request reads its token
 * from there through the axios interceptor.
 */
export function useLogin() {
  const { t } = useTranslation('app');
  const setSession = useAuthStore((state) => state.setSession);

  const mutation = useMutation({
    mutationFn: async (payload: LoginFormValues) => {
      const response = await axiosInstance.post<
        HTTPResponseType<LoginResponseData>,
        ApiResponse<LoginResponseData>
      >('/auth/login', payload);

      return response.data;
    },
    onSuccess: (data) => {
      // `refreshToken` is optional in the contract — it is omitted when the API
      // hands it over as an HttpOnly cookie instead. Signing in without one is
      // not an error; the session simply will not survive a reload.
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? '',
        user: data.user,
      });
    },
  });

  useEffect(() => {
    if (!mutation.error) return;
    const { message } = handleHttpError(mutation.error, t('someThingWentWrong'));
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [mutation.error, t]);

  return mutation;
}
