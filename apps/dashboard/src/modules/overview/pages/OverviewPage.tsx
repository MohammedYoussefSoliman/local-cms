import { Button, Card, LtrText, PageHeader, Skeleton } from '@cms/ui';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { generatePath, useNavigate } from 'react-router-dom';

import type { TranslationModuleResponseData } from '@cms/contracts';

import { URLS } from '@/helpers';
import { useAppContext } from '@/layouts';
import { useGetAppModules, useGetApps } from '@/modules/apps/services';
import { useGetAppDraftsCount } from '@/modules/drafts/services';
import { useGetAppLocales } from '@/modules/locales/services';

import { StatTile } from '../components';

export function OverviewPage() {
  const { t } = useTranslation('overview');
  const navigate = useNavigate();
  const { appId, app } = useAppContext();

  const { data: apps, isLoading: isLoadingApps } = useGetApps({ limit: 1 });
  const { data: modules, isLoading: isLoadingModules } = useGetAppModules({
    appId,
    limit: 100,
  });
  const { data: appLocales, isLoading: isLoadingLocales } =
    useGetAppLocales(appId);
  const { count: draftsCount, isLoading: isLoadingDrafts } =
    useGetAppDraftsCount(appId);

  const moduleRecords = modules?.records ?? [];
  const enabledLocales = (appLocales ?? []).filter(
    (locale) => locale.isEnabled,
  );

  function handleOpenTranslations() {
    const first = moduleRecords[0];
    if (!first) return;
    void navigate(
      generatePath(URLS.translations, { appId, moduleId: first.id }),
    );
  }

  function handleOpenModule(module: TranslationModuleResponseData) {
    void navigate(
      generatePath(URLS.translations, { appId, moduleId: module.id }),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={app?.name ?? <Skeleton className="h-3 w-24 rounded-4" />}
        title={t('title')}
        actions={
          <Button
            type="button"
            size="small"
            disabled={moduleRecords.length === 0}
            onClick={handleOpenTranslations}
          >
            <Languages size={16} />
            {t('openTranslations')}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t('statModules')}
          value={modules?.meta.total}
          note={t('statModulesNote')}
          isLoading={isLoadingModules}
        />
        <StatTile
          label={t('statLocales')}
          value={enabledLocales.length}
          note={t('statLocalesNote')}
          isLoading={isLoadingLocales}
        />
        <StatTile
          label={t('statDrafts')}
          value={draftsCount}
          note={t('statDraftsNote')}
          isLoading={isLoadingDrafts}
        />
        <StatTile
          label={t('statApps')}
          value={apps?.meta.total}
          note={t('statAppsNote')}
          isLoading={isLoadingApps}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title={t('languages')} description={t('languagesDescription')}>
          {isLoadingLocales ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-28 rounded-4" />
                  <Skeleton className="h-3.5 w-24 rounded-4" />
                </div>
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {enabledLocales.map((locale) => (
                <li
                  key={locale.localeId}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-1.5 text-paragraph-sm text-strong">
                    <LtrText mono>{locale.locale.code}</LtrText>
                    <span dir={locale.locale.direction}>
                      {locale.locale.nativeName}
                    </span>
                    {locale.isDefault && (
                      <span className="text-paragraph-xs text-primary-base">
                        · {t('defaultLocale')}
                      </span>
                    )}
                  </span>
                  <span className="text-paragraph-xs text-sub-dark">
                    {locale.fallbackLocaleCode
                      ? t('fallsBackTo', { code: locale.fallbackLocaleCode })
                      : t('noFallback')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('modules')} description={t('modulesDescription')}>
          {isLoadingModules ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-3.5 w-full rounded-4" />
              ))}
            </div>
          ) : moduleRecords.length === 0 ? (
            <p className="text-paragraph-sm text-sub-dark">{t('noModules')}</p>
          ) : (
            <ul className="flex flex-col">
              {moduleRecords.map((module) => (
                <ModuleLine
                  key={module.id}
                  module={module}
                  onOpen={handleOpenModule}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

type ModuleLineProps = {
  module: TranslationModuleResponseData;
  onOpen: (module: TranslationModuleResponseData) => void;
};

/** Its own component so the handler closes over the module, not an inline arrow. */
function ModuleLine({ module, onOpen }: ModuleLineProps) {
  function handleClick() {
    onOpen(module);
  }

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-8 px-2 py-2 text-start transition-colors hover:bg-weak"
      >
        <span className="truncate text-paragraph-sm text-strong">
          {module.name}
        </span>
        <LtrText mono className="shrink-0 text-paragraph-xs text-sub-dark">
          {module.slug}
        </LtrText>
      </button>
    </li>
  );
}
