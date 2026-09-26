import { handleHttpError, showToast } from '@cms/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { axiosInstance } from '@/config';
import {
  DRAFTS_QUERY_KEYS,
  MODULES_QUERY_KEYS,
  TRANSLATIONS_QUERY_KEYS,
} from '@/helpers';

import { classifyFailure, publishInBatches } from '../functions';

import type {
  DraftsPublishPayload,
  DraftsPublishResult,
} from '../Drafts.types';


/** Each publish holds a row lock; four keeps a long queue under the throttle. */
const CONCURRENCY = 4;

/**
 * Publishes many values, independently.
 *
 * **Not all-or-nothing, on purpose.** There is no transaction spanning N HTTP
 * calls, and compensating a partial batch by archiving what succeeded would
 * move `published_at` and write junk history rows — the append-only table would
 * carry a lie. So successes stay published and the failures are reported.
 *
 * It **resolves** in every case, including total failure: a rejected mutation
 * would leave the partial successes somewhere the UI cannot reach them.
 */
export function usePublishDrafts() {
  const { t } = useTranslation('drafts');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      rows,
    }: DraftsPublishPayload): Promise<DraftsPublishResult> => {
      const settled = await publishInBatches(rows, CONCURRENCY, (row) =>
        axiosInstance.post(`/translations/${row.id}/publish`, {
          expectedVersion: row.expectedVersion,
        }),
      );

      const succeeded: string[] = [];
      const failed: DraftsPublishResult['failed'] = [];

      settled.forEach((result, index) => {
        const { id } = rows[index];
        if (result.ok) {
          succeeded.push(id);
        } else {
          failed.push(
            classifyFailure(id, result.error, tApp('someThingWentWrong')),
          );
        }
      });

      return { succeeded, failed };
    },
    onSuccess: async (result) => {
      // Once, after everything settled. N invalidations mean N refetches of a
      // table the user is staring at, each one re-rendering a live selection.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [DRAFTS_QUERY_KEYS.getAppDrafts],
        }),
        queryClient.invalidateQueries({
          queryKey: [TRANSLATIONS_QUERY_KEYS.getEntries],
        }),
        queryClient.invalidateQueries({
          queryKey: [TRANSLATIONS_QUERY_KEYS.getValueHistory],
        }),
        queryClient.invalidateQueries({
          queryKey: [MODULES_QUERY_KEYS.getModuleById],
        }),
      ]);

      const total = result.succeeded.length + result.failed.length;

      if (result.failed.length === 0) {
        showToast({
          status: 'success',
          variant: 'filled',
          title: t('publishedCount', { count: result.succeeded.length }),
        });
        return;
      }

      if (result.succeeded.length === 0) {
        showToast({
          status: 'error',
          variant: 'filled',
          title: t('publishFailedCount', { count: result.failed.length }),
        });
        return;
      }

      showToast({
        status: 'warning',
        variant: 'filled',
        title: t('publishedPartial', {
          succeeded: result.succeeded.length,
          total,
          failed: result.failed.length,
        }),
      });
    },
  });

  // `mutationFn` catches every per-row transport failure, so anything reaching
  // here is a programming fault. The handler stays because a thrown bug should
  // still surface rather than vanish.
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
