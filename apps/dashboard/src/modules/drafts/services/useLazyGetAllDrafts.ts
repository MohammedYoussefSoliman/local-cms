import { handleHttpError, showToast } from '@cms/ui';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  DraftValueRow,
  HTTPResponseType,
  PaginatedList,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import { DRAFTS_QUERY_KEYS } from '@/helpers';

/** One page per request while walking the queue. */
const PAGE_SIZE = 100;

/**
 * Walks the whole queue and returns every row, for "publish all".
 *
 * A `useMutation` rather than a `useQuery` because the call site drives it —
 * it runs when a button is pressed, not when the component renders, which is
 * exactly the case `useLazyGet*` exists for. `useQuery` with a toggled
 * `enabled` is the substitute the rule forbids.
 *
 * Enumerate first, publish second. Interleaving them lets publishing shift the
 * result set under the paging cursor, and rows get silently skipped.
 */
export function useLazyGetAllDrafts() {
  const { t } = useTranslation('app');

  const mutation = useMutation({
    mutationKey: [DRAFTS_QUERY_KEYS.getAppDrafts, 'all'],
    mutationFn: async (appId: string): Promise<DraftValueRow[]> => {
      const collected: DraftValueRow[] = [];
      let page = 1;

      for (;;) {
        const response = await axiosInstance.get<
        HTTPResponseType<PaginatedList<DraftValueRow>>,
        ApiResponse<PaginatedList<DraftValueRow>>
      >(`/apps/${appId}/drafts`, { params: { page, limit: PAGE_SIZE } });

        collected.push(...response.data.records);
        if (page >= response.data.meta.totalPages) break;
        page += 1;
      }

      return collected;
    },
  });

  useEffect(() => {
    if (!mutation.error) return;
    const { message } = handleHttpError(mutation.error, t('someThingWentWrong'));
    showToast({ status: 'error', variant: 'filled', title: message });
  }, [mutation.error, t]);

  return mutation;
}
