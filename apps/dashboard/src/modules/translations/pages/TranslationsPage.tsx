
import { Button, EmptyState, PageHeader, Pagination } from '@cms/ui';
import { Languages, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import type { TranslationRow } from '@cms/contracts';

import { ConfirmDialog } from '@/components';
import { useAppContext } from '@/layouts';
import { useGetAppLocales } from '@/modules/locales/services';
import { useAuthStore } from '@/store';

import {
  CreateEntryDialog,
  EditorToolbar,
  EntriesTable,
  TranslationPanel,
} from '../components';
import { cellKey, readCell } from '../functions';
import {
  useDeleteEntry,
  useGetEntries,
  useGetModuleById,
  useUpsertTranslation,
} from '../services';

import type { DraftMap, EntryFilter } from '../Translations.types';

const PAGE_SIZE = 20;

export function TranslationsPage() {
  const { t } = useTranslation('translations');
  const { t: tApp } = useTranslation('app');
  const { moduleId = '' } = useParams();
  const { appId, app } = useAppContext();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<EntryFilter>('all');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TranslationRow | null>(
    null,
  );

  const role = useAuthStore((state) => state.user?.role);
  const canDelete = role === 'admin';

  const { data: module } = useGetModuleById(moduleId);
  const { data: appLocales, isLoading: isLoadingLocales } =
    useGetAppLocales(appId);

  // One column per ENABLED locale, built from data. The default language comes
  // first so the reference text is the first thing read; the rest keep the
  // order the API returned.
  const locales = useMemo(
    () =>
      (appLocales ?? [])
        .filter((locale) => locale.isEnabled)
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    [appLocales],
  );

  const defaultLocaleCode = app?.defaultLocaleCode;

  const { data, isLoading } = useGetEntries({
    moduleId,
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    // The API answers "untranslated" directly; filtering client-side would only
    // ever see the current page.
    missingLocale:
      filter === 'missing' ? (defaultLocaleCode ?? undefined) : undefined,
  });

  const upsert = useUpsertTranslation();
  const deleteEntry = useDeleteEntry();

  const records = data?.records;

  // Derived during render — never mirrored into state through an effect.
  // `records` rather than a defaulted `[]`: a fresh array literal on every
  // render would invalidate this memo on every render.
  const rows = useMemo(() => {
    const all = records ?? [];
    if (filter !== 'draft') return all;

    return all.filter((row) =>
      locales.some((locale) => {
        const cell = readCell(row, locale.locale.code);
        return cell.status === 'draft' || cell.status === 'in_review';
      }),
    );
  }, [records, filter, locales]);

  const selectedRow = rows.find((row) => row.entryId === selectedEntryId);
  const meta = data?.meta;

  function handleChangeCell(
    entryId: string,
    localeCode: string,
    value: string,
  ) {
    setDrafts((current) => ({
      ...current,
      [cellKey(entryId, localeCode)]: value,
    }));
  }

  function handleDiscard(entryId: string) {
    setDrafts((current) => {
      const next = { ...current };
      for (const locale of locales) {
        delete next[cellKey(entryId, locale.locale.code)];
      }
      return next;
    });
  }

  /**
   * One `PUT` per edited language, sequentially.
   *
   * Sequential rather than parallel on purpose: they are writes to the same
   * entry, and a failure part-way through should leave the remaining languages
   * untouched rather than half-applied in an order nobody chose.
   */
  async function handleSave(entryId: string) {
    const row = rows.find((item) => item.entryId === entryId);
    if (!row) return;

    const saved: string[] = [];

    for (const locale of locales) {
      const key = cellKey(entryId, locale.locale.code);
      const draft = drafts[key];
      if (draft === undefined) continue;

      const cell = readCell(row, locale.locale.code);

      try {
        await upsert.mutateAsync({
          entryId,
          localeCode: locale.locale.code,
          value: draft,
          expectedVersion: cell.version,
          wasPublished: cell.status === 'published',
        });
        saved.push(key);
      } catch {
        // The hook toasts, and the 409 carries the current value. Stop here so
        // the languages after this one are not written against a stale read.
        break;
      }
    }

    if (saved.length === 0) return;

    setDrafts((current) => {
      const next = { ...current };
      for (const key of saved) delete next[key];
      return next;
    });
  }

  function handleSelect(entryId: string) {
    setSelectedEntryId(entryId);
  }

  function handleClosePanel() {
    setSelectedEntryId(null);
  }

  function handleOpenCreate() {
    setIsCreateOpen(true);
  }

  function handleRequestDelete(row: TranslationRow) {
    setPendingDelete(row);
  }

  function handleCancelDelete(open: boolean) {
    if (!open) setPendingDelete(null);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    await deleteEntry.mutateAsync(pendingDelete.entryId);
    setPendingDelete(null);
    setSelectedEntryId(null);
  }

  function handleSaveSelected(entryId: string) {
    void handleSave(entryId);
  }

  const isEmpty = !isLoading && !isLoadingLocales && rows.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={
          module ? `${app?.name ?? ''} / ${module.name}` : app?.name
        }
        title={t('title')}
        actions={
          <Button type="button" size="small" onClick={handleOpenCreate}>
            <Plus size={16} />
            {t('newKey')}
          </Button>
        }
      />

      <EditorToolbar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        endpoint={`GET /v1/apps/${app?.slug ?? ':app'}/locales/:code`}
      />

      {isEmpty ? (
        <EmptyState
          icon={<Languages size={28} />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          className="rounded-12 border border-soft-light bg-white"
          action={
            <Button type="button" size="small" onClick={handleOpenCreate}>
              <Plus size={16} />
              {t('newKey')}
            </Button>
          }
        />
      ) : (
        <EntriesTable
          rows={rows}
          locales={locales}
          isLoading={isLoading || isLoadingLocales}
          selectedEntryId={selectedEntryId}
          onSelect={handleSelect}
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

      {!!selectedRow && (
        <TranslationPanel
          row={selectedRow}
          locales={locales}
          moduleSlug={module?.slug}
          appSlug={app?.slug}
          drafts={drafts}
          isSaving={upsert.isPending}
          canDelete={canDelete}
          onChange={handleChangeCell}
          onSave={handleSaveSelected}
          onDiscard={handleDiscard}
          onDelete={handleRequestDelete}
          onClose={handleClosePanel}
        />
      )}

      <CreateEntryDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        moduleId={moduleId}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={handleCancelDelete}
        type="error"
        confirmColor="error"
        title={t('deleteKeyTitle', { key: pendingDelete?.key ?? '' })}
        description={t('deleteKeyDescription')}
        confirmLabel={t('deleteKeyCta')}
        isPending={deleteEntry.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
