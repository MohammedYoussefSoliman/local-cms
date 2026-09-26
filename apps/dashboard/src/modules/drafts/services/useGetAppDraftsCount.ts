import { useQuery } from '@tanstack/react-query';

import type {
  DraftValueRow,
  HTTPResponseType,
  PaginatedList,
} from '@cms/contracts';

import { type ApiResponse, axiosInstance } from '@/config';
import { DRAFTS_QUERY_KEYS } from '@/helpers';

/**
 * The sidebar badge.
 *
 * Same route and same key ROOT as the queue itself, just `limit=1` — so one
 * root invalidation refreshes the table and the badge together and the two can
 * never disagree about how many drafts exist.
 *
 * Deliberately silent on failure. A badge fetch that fails must not put an
 * error toast on every screen in the product; the drafts page reports it when
 * the user actually goes there.
 */
export function useGetAppDraftsCount(appId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: [DRAFTS_QUERY_KEYS.getAppDrafts, appId, { page: 1, limit: 1 }],
    queryFn: async () => {
      const response = await axiosInstance.get<
        HTTPResponseType<PaginatedList<DraftValueRow>>,
        ApiResponse<PaginatedList<DraftValueRow>>
      >(`/apps/${appId}/drafts`, { params: { page: 1, limit: 1 } });

      return response.data;
    },
    enabled: Boolean(appId),
    throwOnError: false,
  });

  return { count: data?.meta.total ?? 0, isLoading };
}
