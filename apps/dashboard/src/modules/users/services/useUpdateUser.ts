import { handleHttpError, showToast } from '@cms/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { HTTPResponseType, UserResponseData } from '@cms/contracts';
import type { UserRole } from '@cms/domain';


import { type ApiResponse, axiosInstance } from '@/config';
import { USERS_QUERY_KEYS } from '@/helpers';

/**
 * Name and role only.
 *
 * `email` is absent because it is the login identity, and `status` because
 * enabling and disabling have side effects — revoking every session — that a
 * general-purpose PATCH would hide. Both are 400 at the validation pipe.
 */
export function useUpdateUser() {
  const { t } = useTranslation('users');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      userId,
      role,
      name,
    }: {
      userId: string;
      role?: UserRole;
      name?: string;
    }) => {
      const response = await axiosInstance.patch<
        HTTPResponseType<UserResponseData>,
        ApiResponse<UserResponseData>
      >(`/users/${userId}`, { role, name });

      return response.data;
    },
    onSuccess: async () => {
      showToast({
        status: 'success',
        variant: 'filled',
        title: t('userUpdated'),
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
