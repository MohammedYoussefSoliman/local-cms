import { Select, Skeleton } from '@cms/ui';
import { useTranslation } from 'react-i18next';
import { generatePath, useNavigate } from 'react-router-dom';


import { URLS } from '@/helpers';
import { useUiStore } from '@/store';

import { useGetApps } from '../../services';

/**
 * The sidebar's app scope.
 *
 * Exported from this module so the layout imports a *component* rather than
 * this module's hook and query key — the same one-dependency-instead-of-three
 * rule the drafts badge follows.
 *
 * Changing the app navigates rather than only writing to the store: the route
 * carries `:appId`, so leaving the URL behind would put the sidebar and the
 * page on different applications.
 */
export function AppSwitcher({ appId }: { appId: string | undefined }) {
  const { t } = useTranslation('app');
  const navigate = useNavigate();
  const setSelectedAppId = useUiStore((state) => state.setSelectedAppId);

  const { data, isLoading } = useGetApps({ limit: 100 });
  const apps = data?.records ?? [];

  function handleChange(nextAppId: string) {
    setSelectedAppId(nextAppId);
    void navigate(generatePath(URLS.overview, { appId: nextAppId }));
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-16 rounded-4" />
        <Skeleton className="h-9 w-full rounded-8" />
      </div>
    );
  }

  return (
    <Select
      label={t('selectApplication')}
      size="sm"
      value={appId ?? ''}
      onValueChange={handleChange}
      placeholder={t('selectApplication')}
      options={apps.map((item) => ({ value: item.id, label: item.name }))}
    />
  );
}
