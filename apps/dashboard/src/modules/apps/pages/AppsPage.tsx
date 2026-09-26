
import { Button, EmptyState, PageHeader, Skeleton } from '@cms/ui';
import { Layers, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, useNavigate } from 'react-router-dom';

import type { TranslationModuleResponseData } from '@cms/contracts';

import { URLS } from '@/helpers';
import { useAppContext } from '@/layouts';
import { useAuthStore, useUiStore } from '@/store';

import {
  AppCard,
  CreateAppDialog,
  CreateModuleDialog,
  ModulesTable,
} from '../components';
import {
  useGetAppModules,
  useGetApps,
  useGetGlobalModules,
} from '../services';

export function AppsPage() {
  const { t } = useTranslation('apps');
  const navigate = useNavigate();
  const { appId, app } = useAppContext();

  const [isCreateAppOpen, setIsCreateAppOpen] = useState(false);
  const [isCreateModuleOpen, setIsCreateModuleOpen] = useState(false);

  const role = useAuthStore((state) => state.user?.role);
  const setSelectedAppId = useUiStore((state) => state.setSelectedAppId);
  const isAdmin = role === 'admin';

  const { data: apps, isLoading: isLoadingApps } = useGetApps({ limit: 100 });
  const { data: modules, isLoading: isLoadingModules } = useGetAppModules({
    appId,
    limit: 100,
  });
  const { data: globalModules, isLoading: isLoadingGlobal } =
    useGetGlobalModules({ limit: 100 });

  function handleSelectApp(nextAppId: string) {
    setSelectedAppId(nextAppId);
    void navigate(generatePath(URLS.overview, { appId: nextAppId }));
  }

  function handleOpenModule(module: TranslationModuleResponseData) {
    void navigate(
      generatePath(URLS.translations, { appId, moduleId: module.id }),
    );
  }

  function handleOpenCreateApp() {
    setIsCreateAppOpen(true);
  }

  function handleOpenCreateModule() {
    setIsCreateModuleOpen(true);
  }

  const appRecords = apps?.records ?? [];
  const moduleRecords = modules?.records ?? [];
  const globalRecords = globalModules?.records ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        actions={
          isAdmin ? (
            <Button
              type="button"
              variant="outline"
              color="neutral"
              size="small"
              onClick={handleOpenCreateApp}
            >
              <Plus size={16} />
              {t('newApp')}
            </Button>
          ) : null
        }
      />

      {isLoadingApps ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-12" />
          ))}
        </div>
      ) : appRecords.length === 0 ? (
        <EmptyState
          icon={<Layers size={28} />}
          title={t('appsEmptyTitle')}
          description={t('appsEmptyDescription')}
          className="rounded-12 border border-soft-light bg-white"
          action={
            isAdmin ? (
              <Button type="button" size="small" onClick={handleOpenCreateApp}>
                <Plus size={16} />
                {t('newApp')}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {appRecords.map((item) => (
            <AppCard
              key={item.id}
              app={item}
              isActive={item.id === appId}
              onSelect={handleSelectApp}
            />
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-label-lg text-strong">
            {t('modulesOf', { app: app?.name ?? '' })}
          </h2>
          {isAdmin && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleOpenCreateModule}
            >
              <Plus size={14} />
              {t('newModule')}
            </Button>
          )}
        </div>

        {!isLoadingModules && moduleRecords.length === 0 ? (
          <EmptyState
            icon={<Layers size={24} />}
            title={t('modulesEmptyTitle')}
            description={t('modulesEmptyDescription')}
            className="rounded-12 border border-soft-light bg-white"
          />
        ) : (
          <ModulesTable
            modules={moduleRecords}
            isLoading={isLoadingModules}
            appSlug={app?.slug}
            onOpen={handleOpenModule}
          />
        )}
      </section>

      {(isLoadingGlobal || globalRecords.length > 0) && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-label-lg text-strong">{t('globalModules')}</h2>
            <p className="max-w-2xl text-paragraph-sm text-sub-dark">
              {t('globalModulesDescription')}
            </p>
          </div>

          <ModulesTable
            modules={globalRecords}
            isLoading={isLoadingGlobal}
            appSlug={app?.slug}
            onOpen={handleOpenModule}
          />
        </section>
      )}

      <CreateAppDialog
        open={isCreateAppOpen}
        onOpenChange={setIsCreateAppOpen}
      />
      <CreateModuleDialog
        open={isCreateModuleOpen}
        onOpenChange={setIsCreateModuleOpen}
        appId={appId}
      />
    </div>
  );
}
