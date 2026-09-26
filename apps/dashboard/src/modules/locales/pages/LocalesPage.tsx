
import { Alert, Button, EmptyState, PageHeader } from '@cms/ui';
import { Globe, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppContext } from '@/layouts';
import { useAuthStore } from '@/store';

import { CreateLocaleDialog, LocalesTable } from '../components';
import {
  useGetAppLocales,
  useGetLocales,
  useToggleAppLocale,
} from '../services';

import type { LocaleRow } from '../components';

export function LocalesPage() {
  const { t } = useTranslation('locales');
  const { appId, app } = useAppContext();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);

  const role = useAuthStore((state) => state.user?.role);
  const canManage = role === 'admin';

  const { data: locales, isLoading: isLoadingLocales } = useGetLocales({
    limit: 100,
  });
  const { data: appLocales, isLoading: isLoadingAppLocales } =
    useGetAppLocales(appId);
  const toggleLocale = useToggleAppLocale();

  // Derived during render. The two lists are joined by locale id, which is the
  // only stable key — a code match would break the moment canonicalization
  // changes one of them.
  const rows: LocaleRow[] = useMemo(() => {
    const byLocaleId = new Map(
      (appLocales ?? []).map((item) => [item.localeId, item]),
    );

    return (locales?.records ?? []).map((locale) => ({
      locale,
      appLocale: byLocaleId.get(locale.id),
    }));
  }, [locales, appLocales]);

  const isLoading = isLoadingLocales || isLoadingAppLocales;

  function handleOpenCreate() {
    setIsCreateOpen(true);
  }

  async function handleToggle(row: LocaleRow) {
    setTogglingCode(row.locale.code);
    try {
      await toggleLocale.mutateAsync({
        appId,
        localeCode: row.locale.code,
        enable: !row.appLocale?.isEnabled,
      });
    } catch {
      // The hook toasts; the row stays as it was.
    } finally {
      setTogglingCode(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          canManage ? (
            <Button type="button" size="small" onClick={handleOpenCreate}>
              <Plus size={16} />
              {t('addLocale')}
            </Button>
          ) : null
        }
      />

      {!canManage && <Alert status="information">{t('readOnlyNotice')}</Alert>}

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          icon={<Globe size={28} />}
          title={t('emptyTitle')}
          className="rounded-12 border border-soft-light bg-white"
        />
      ) : (
        <LocalesTable
          rows={rows}
          isLoading={isLoading}
          appName={app?.name}
          canManage={canManage}
          togglingCode={togglingCode}
          onToggle={handleToggle}
        />
      )}

      <CreateLocaleDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
