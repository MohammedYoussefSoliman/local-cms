import { handleHttpError, showToast } from '@cms/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  HTTPResponseType,
  TranslationValueResponseData,
} from '@cms/contracts';


import { type ApiResponse, axiosInstance } from '@/config';
import {
  DRAFTS_QUERY_KEYS,
  MODULES_QUERY_KEYS,
  TRANSLATIONS_QUERY_KEYS,
} from '@/helpers';

export type UpsertTranslationPayload = {
  entryId: string;
  localeCode: string;
  value: string;
  /** Omitted when there is no row yet — nothing to be stale against. */
  expectedVersion?: number;
  /** Whether the value was live before this write. Drives the toast wording. */
  wasPublished: boolean;
};

/**
 * Writes one language of one key.
 *
 * The status is NOT touched: there is one row per (entry, locale) carrying a
 * single status, so **editing an already-published value keeps it published and
 * goes live immediately**. Demoting it to draft on edit would drop the key out
 * of a running storefront's bundle until someone republished. The UI's job is
 * to say so before the keystroke, not to soften it afterwards.
 *
 * A stale `expectedVersion` comes back as 409 carrying the current value, which
 * the editor renders as a diff rather than as a loss (invariant Rule 7).
 */
export function useUpsertTranslation() {
  const { t } = useTranslation('translations');
  const { t: tApp } = useTranslation('app');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      entryId,
      localeCode,
      value,
      expectedVersion,
    }: UpsertTranslationPayload) => {
      const response = await axiosInstance.put<
        HTTPResponseType<TranslationValueResponseData>,
        ApiResponse<TranslationValueResponseData>
      >(`/entries/${entryId}/translations/${localeCode}`, {
        value,
        expectedVersion,
      });

      return response.data;
    },
    onSuccess: async (_data, variables) => {
      showToast({
        status: 'success',
        variant: 'filled',
        // Two different sentences on purpose: in a fast editing session the
        // only signal that copy went live is this line.
        title: variables.wasPublished
          ? t('editPublishedLive')
          : t('savedAsDraft'),
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [TRANSLATIONS_QUERY_KEYS.getEntries],
        }),
        queryClient.invalidateQueries({
          queryKey: [TRANSLATIONS_QUERY_KEYS.getValueHistory],
        }),
        queryClient.invalidateQueries({
          queryKey: [MODULES_QUERY_KEYS.getModuleById],
        }),
        // The one that gets forgotten: the first value for a locale creates a
        // `draft` row, which is a new line in the drafts queue and a bumped
        // sidebar badge — from a mutation in a different module.
        queryClient.invalidateQueries({
          queryKey: [DRAFTS_QUERY_KEYS.getAppDrafts],
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
