import { handleHttpError, showToast } from '@cms/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  HTTPResponseType,
  PaginatedList,
  UserResponseData,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { USERS_QUERY_KEYS } from '@/helpers';

import type { UsersParams } from '../Users.types';

export function useGetUsers(params: UsersParams = {}) {
  const { t } = useTranslation('app');

  const { data, error, isLoading } = useQuery({
    queryKey: [USERS_QUERY_KEYS.getAllUsers, params],
    queryFn: async () => {
      const response = await axiosInstance.get<
        HTTPResponseType<PaginatedList<UserResponseData>>,
        ApiResponse<PaginatedList<UserResponseData>>
      >('/users', { params });

      return response.data;
    },
    placeholderData: (previous) => previous,
    throwOnError: false,
  });

  useEffect(() => {
    if (!error) return;
    const { message } = handleHttpError(error, t('someThingWentWrong'));
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [error, t]);

  return { data, isLoading };
}
