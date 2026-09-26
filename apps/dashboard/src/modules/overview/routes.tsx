
import { URLS } from '@/helpers';

import { OverviewPage } from './pages';

import type { RouteObject } from 'react-router-dom';

export const overviewRoutes: RouteObject[] = [
  { path: URLS.overview, element: <OverviewPage /> },
];
