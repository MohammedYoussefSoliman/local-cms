
import {
  FileEdit,
  Globe,
  Languages,
  Layers,
  LayoutGrid,
  Users,
} from 'lucide-react';
import { createElement } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, useLocation, useNavigate } from 'react-router-dom';

import type { SidebarNavItem } from '@cms/ui';

import { URLS } from '@/helpers';
import { useAuthStore } from '@/store';

import type { ReactNode } from 'react';

type NavItemSpec = SidebarNavItem & { adminOnly?: boolean };

/**
 * The sidebar's contents, derived from the route and the signed-in role.
 *
 * `badge` is passed in by the caller rather than read here: the drafts count
 * belongs to the drafts module, and a hook in `layouts/` reaching into a
 * feature module's services is the import direction the module rules forbid.
 */
export function useSidebarNavItems(
  appId: string | undefined,
  draftsBadge: ReactNode,
): SidebarNavItem[] {
  const { t } = useTranslation('app');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);

  function go(path: string) {
    return () => navigate(path);
  }

  /** App-scoped routes need an id; without one the rail points at the list. */
  function appPath(template: string): string {
    return appId ? generatePath(template, { appId }) : URLS.apps;
  }

  const items: NavItemSpec[] = [
    {
      key: 'overview',
      label: t('navOverview'),
      icon: createElement(LayoutGrid, { size: 18 }),
      isActive: !!appId && pathname === appPath(URLS.overview),
      onClick: go(appPath(URLS.overview)),
    },
    {
      key: 'apps',
      label: t('navApps'),
      icon: createElement(Layers, { size: 18 }),
      isActive: pathname === URLS.apps || pathname.endsWith('/modules'),
      onClick: go(URLS.apps),
    },
    {
      key: 'drafts',
      label: t('navDrafts'),
      icon: createElement(FileEdit, { size: 18 }),
      badge: draftsBadge,
      isActive: !!appId && pathname === appPath(URLS.drafts),
      onClick: go(appPath(URLS.drafts)),
    },
    {
      key: 'locales',
      label: t('navLocales'),
      icon: createElement(Globe, { size: 18 }),
      isActive: pathname === URLS.locales,
      onClick: go(URLS.locales),
    },
    {
      key: 'users',
      label: t('navUsers'),
      icon: createElement(Users, { size: 18 }),
      isActive: pathname === URLS.users,
      adminOnly: true,
      onClick: go(URLS.users),
    },
  ];

  // Hiding rather than disabling: an editor cannot reach the screen anyway
  // (the API answers 403), and a dead nav item invites the click that explains
  // nothing.
  return items
    .filter((item) => !item.adminOnly || role === 'admin')
    .map(({ adminOnly: _adminOnly, ...item }) => item);
}

/** Kept out of the returned shape — `Languages` is only here for the brand mark. */
export const BRAND_ICON = Languages;
