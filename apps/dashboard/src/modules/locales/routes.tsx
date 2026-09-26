
import { URLS } from '@/helpers';

import { LocalesPage } from './pages';

import type { RouteObject } from 'react-router-dom';

export const localesRoutes: RouteObject[] = [
  { path: URLS.locales, element: <LocalesPage /> },
];
