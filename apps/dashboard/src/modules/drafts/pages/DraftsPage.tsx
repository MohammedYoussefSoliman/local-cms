
import {
  Button,
  EmptyState,
  PageHeader,
  Pagination,
  Skeleton,
} from '@cms/ui';
import { CheckCircle2, Zap } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, useNavigate } from 'react-router-dom';

import type { DraftValueRow } from '@cms/contracts';

import { ConfirmDialog } from '@/components';
import { URLS } from '@/helpers';
import { useAppContext } from '@/layouts';

import { BatchResultSummary, DraftsTable } from '../components';
import {
  useGetAppDrafts,
  useLazyGetAllDrafts,
  usePublishDraft,
  usePublishDrafts,
} from '../services';

import type {
  DraftPublishFailure,
  DraftsPublishResult,
  PublishDraftPayload,
} from '../Drafts.types';

const PAGE_SIZE = 20;

type PendingBatch = { rows: PublishDraftPayload[] } | null;

export function DraftsPage() {
  const { t } = useTranslation('drafts');
  const { t: tApp } = useTranslation('app');
  const { appId, app } = useAppContext();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingBatch, setPendingBatch] = useState<PendingBatch>(null);
  const [batchResult, setBatchResult] = useState<DraftsPublishResult | null>(
    null,
  );
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const { data, isLoading } = useGetAppDrafts({
    appId,
    page,
    limit: PAGE_SIZE,
  });

  const publishOne = usePublishDraft();
  const publishMany = usePublishDrafts();
  const enumerateAll = useLazyGetAllDrafts();

  const rows = data?.records ?? [];
  const meta = data?.meta;

  // Derived during render, never mirrored in an effect: a row that vanished on
  // a refetch stops counting on its own, with no stale id left behind
  // (`.claude/rules/global-react-useeffect.md` Rules 1 and 2).
  const selectedRows = rows.filter((row) => selected.has(row.id));

  const failures: Map<string, DraftPublishFailure> = new Map(
    (batchResult?.failed ?? []).map((failure) => [failure.id, failure]),
  );

  const isBusy =
    publishOne.isPending || publishMany.isPending || enumerateAll.isPending;

  function handleToggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleTogglePage(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const row of rows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  function toPayload(row: DraftValueRow): PublishDraftPayload {
    return { id: row.id, expectedVersion: row.version };
  }

  async function runBatch(batch: PublishDraftPayload[]) {
    const result = await publishMany.mutateAsync({ rows: batch });
    setBatchResult(result.failed.length > 0 ? result : null);
    // Keep only what failed selected, so the obvious next click retries
    // exactly those rows rather than re-publishing the successes.
    setSelected(new Set(result.failed.map((failure) => failure.id)));
    setPendingBatch(null);
  }

  function handlePublishSelected() {
    setPendingBatch({ rows: selectedRows.map(toPayload) });
  }

  /**
   * "Publish all" means the whole queue, not the visible page — so every id is
   * enumerated first and only then published. Interleaving the two would let
   * publishing shift the result set under the paging cursor and silently skip
   * rows.
   */
  async function handlePublishAll() {
    const all = await enumerateAll.mutateAsync(appId);
    setPendingBatch({ rows: all.map(toPayload) });
  }

  function handlePublishAllClick() {
    void handlePublishAll();
  }

  function handleConfirmBatch() {
    if (!pendingBatch) return;
    void runBatch(pendingBatch.rows);
  }

  function handleCancelBatch(open: boolean) {
    if (!open) setPendingBatch(null);
  }

  async function handlePublishRow(row: DraftValueRow) {
    setPublishingId(row.id);
    try {
      await publishOne.mutateAsync(toPayload(row));
      setBatchResult(null);
    } catch {
      // The hook toasts. The row stays put so the editor can see what happened.
    } finally {
      setPublishingId(null);
    }
  }

  async function handlePublishVersion(
    row: DraftValueRow,
    expectedVersion: number,
  ) {
    setPublishingId(row.id);
    try {
      await publishOne.mutateAsync({ id: row.id, expectedVersion });
      setBatchResult(null);
    } catch {
      // Same: the conflict disclosure stays open with the newer value shown.
    } finally {
      setPublishingId(null);
    }
  }

  function handleOpenInEditor(row: DraftValueRow) {
    void navigate(
      generatePath(URLS.translations, { appId, moduleId: row.moduleId }),
    );
  }

  function handleSelectFailed() {
    setSelected(new Set((batchResult?.failed ?? []).map((item) => item.id)));
  }

  function handleDismissResult() {
    setBatchResult(null);
  }

  const isEmpty = !isLoading && rows.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={app?.name ?? <Skeleton className="h-3 w-24 rounded-4" />}
        title={t('title')}
        description={t('description')}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              color="neutral"
              size="small"
              disabled={selectedRows.length === 0 || isBusy}
              onClick={handlePublishSelected}
            >
              {t('publishSelected', { count: selectedRows.length })}
            </Button>
            <Button
              type="button"
              size="small"
              disabled={(meta?.total ?? 0) === 0 || isBusy}
              loading={publishMany.isPending || enumerateAll.isPending}
              onClick={handlePublishAllClick}
            >
              <Zap size={16} />
              {t('publishAll')}
            </Button>
          </>
        }
      />

      {!!batchResult && (
        <BatchResultSummary
          result={batchResult}
          onSelectFailed={handleSelectFailed}
          onDismiss={handleDismissResult}
        />
      )}

      {isEmpty ? (
        <EmptyState
          icon={<CheckCircle2 size={28} />}
          title={t('emptyTitle')}
          className="rounded-12 border border-soft-light bg-white"
        />
      ) : (
        <DraftsTable
          rows={rows}
          isLoading={isLoading}
          selected={selected}
          onToggleRow={handleToggleRow}
          onTogglePage={handleTogglePage}
          onPublishRow={handlePublishRow}
          onPublishVersion={handlePublishVersion}
          onOpenInEditor={handleOpenInEditor}
          publishingId={publishingId}
          failures={failures}
        />
      )}

      {!!meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-paragraph-sm text-sub-dark">
            {tApp('page', { current: meta.page, last: meta.totalPages })}
          </p>
          <Pagination
            currentPage={meta.page}
            lastPage={meta.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!pendingBatch}
        onOpenChange={handleCancelBatch}
        title={t('confirmTitle', { count: pendingBatch?.rows.length ?? 0 })}
        description={t('confirmDescription', {
          count: pendingBatch?.rows.length ?? 0,
          app: app?.name ?? '',
        })}
        confirmLabel={t('confirmCta')}
        isPending={publishMany.isPending}
        onConfirm={handleConfirmBatch}
      />
    </div>
  );
}
