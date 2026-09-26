import { Skeleton } from '@cms/ui';
import { Navigate, generatePath } from 'react-router-dom';


import { URLS } from '@/helpers';
import { useGetApps } from '@/modules/apps/services';
import { useUiStore } from '@/store';


/**
 * What a bare `/` resolves to.
 *
 * The last app used, then the first the account can see — and only the empty
 * applications screen once we actually know there is nothing to open. Sending
 * someone to "no applications" while the list is still loading is the flash
 * this component exists to avoid.
 */
export function HomeRedirect() {
  const selectedAppId = useUiStore((state) => state.selectedAppId);
  const { data, isLoading } = useGetApps({ limit: 1 });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40 rounded-4" />
        <Skeleton className="h-64 w-full rounded-12" />
      </div>
    );
  }

  const appId = selectedAppId ?? data?.records[0]?.id;
  if (!appId) return <Navigate to={URLS.apps} replace />;

  return <Navigate to={generatePath(URLS.overview, { appId })} replace />;
}
