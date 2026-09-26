
import { URLS } from '@/helpers';

import { DraftsPage } from './pages';

import type { RouteObject } from 'react-router-dom';

export const draftsRoutes: RouteObject[] = [
  { path: URLS.drafts, element: <DraftsPage /> },
];
