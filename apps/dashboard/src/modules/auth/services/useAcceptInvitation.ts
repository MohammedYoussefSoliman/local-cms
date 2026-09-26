import { handleHttpError, showToast } from '@cms/ui';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { HTTPResponseType, LoginResponseData } from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { useAuthStore } from '@/store';

/**
 * Spends the invitation: sets the first password and lands the invitee signed
 * in. Single use — replaying the same token answers 401.
 */
export function useAcceptInvitation(token: string | null) {
  const { t } = useTranslation('app');
  const setSession = useAuthStore((state) => state.setSession);

  const mutation = useMutation({
    mutationFn: async (payload: { password: string }) => {
      const response = await axiosInstance.post<
        HTTPResponseType<LoginResponseData>,
        ApiResponse<LoginResponseData>
      >('/invitations/accept', payload, {
        headers: { 'X-Invite-Token': token },
      });

      return response.data;
    },
    onSuccess: (data) => {
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
