import { handleHttpError, showToast } from '@cms/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  HTTPResponseType,
  InvitedUserResponseData,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { USERS_QUERY_KEYS } from '@/helpers';

import type { InviteUserFormValues } from '../Users.types';

/**
 * Creates the account AND mints its single-use invitation, in one transaction.
 *
 * The plaintext token comes back exactly once and is unrecoverable afterwards —
 * there is no mail transport in the CMS, so the caller has to make the admin
 * copy the link before they navigate away.
 */
export function useInviteUser() {
  const { t } = useTranslation('users');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: InviteUserFormValues) => {
      const response = await axiosInstance.post<
        HTTPResponseType<InvitedUserResponseData>,
        ApiResponse<InvitedUserResponseData>
      >('/users', payload);

      return response.data;
    },
    onSuccess: async () => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: t('userInvited'),
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [USERS_QUERY_KEYS.getAllUsers],
        }),
        queryClient.invalidateQueries({
          queryKey: [USERS_QUERY_KEYS.getUserInvitation],
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
