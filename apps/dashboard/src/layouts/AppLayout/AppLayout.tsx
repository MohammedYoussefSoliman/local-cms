import { Sidebar } from '@cms/ui';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

import { URLS } from '@/helpers';
import { useLocale } from '@/hooks';
import { AppSwitcher } from '@/modules/apps/components';
import { useGetAppById, useGetApps } from '@/modules/apps/services';
import { useLogout } from '@/modules/auth/services';
import { DraftsNavBadge } from '@/modules/drafts/components';
import { useAuthStore, useUiStore } from '@/store';

import {
  LanguageSwitch,
  SidebarBrand,
  SidebarUser,
  useSidebarNavItems,
} from '../AppSidebar';

import type { AppOutletContext } from './AppLayout.types';

/**
 * The signed-in shell: navigation rail plus the routed page.
 *
 * It resolves the **effective app** once, for everything below it. Two of the
 * routes it hosts are not app-scoped (`/locales`, `/users`) but still show
 * per-app information, so the app comes from the route when there is one and
 * falls back to the last one used — the rail must never be pointing at a
 * different application than the page.
 */
export function AppLayout() {
  useLocale();

  const navigate = useNavigate();
  const { appId: routeAppId } = useParams();

  const refreshToken = useAuthStore((state) => state.refreshToken);
  const selectedAppId = useUiStore((state) => state.selectedAppId);

  const logout = useLogout();
  const { data: apps } = useGetApps({ limit: 1 });

  const effectiveAppId =
    routeAppId ?? selectedAppId ?? apps?.records[0]?.id ?? undefined;

  const { data: app, isLoading: isLoadingApp } = useGetAppById(effectiveAppId);

  const navItems = useSidebarNavItems(
    effectiveAppId,
    <DraftsNavBadge appId={effectiveAppId} />,
  );

  function handleSignOut() {
    logout.mutate(undefined, {
      onSettled: () => navigate(URLS.login, { replace: true }),
    });
  }

  // Derived during render rather than redirected from an effect: an effect
  // would render the protected tree once before bouncing.
  if (!refreshToken) return <Navigate to={URLS.login} replace />;

  const context: AppOutletContext = {
    appId: effectiveAppId ?? '',
    app,
    isLoadingApp,
  };

  return (
    <div className="flex min-h-dvh bg-weak">
      <Sidebar
        header={<SidebarBrand />}
        toolbar={<AppSwitcher appId={effectiveAppId} />}
        items={navItems}
        footer={
          <div className="flex flex-col gap-3">
            <LanguageSwitch />
            <SidebarUser onSignOut={handleSignOut} />
          </div>
        }
      />

      <main className="min-w-0 flex-1 overflow-x-hidden px-6 py-6 lg:px-8">
        <Outlet context={context} />
      </main>
    </div>
  );
}
