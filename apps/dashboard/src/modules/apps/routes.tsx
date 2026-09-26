
import { URLS } from '@/helpers';

import { AppsPage } from './pages';

import type { RouteObject } from 'react-router-dom';

export const appsRoutes: RouteObject[] = [
  { path: URLS.apps, element: <AppsPage /> },
  // The app-scoped modules list is the same screen, already scoped by the rail.
  { path: URLS.appModules, element: <AppsPage /> },
];
