
import { URLS } from '@/helpers';

import { TranslationsPage } from './pages';

import type { RouteObject } from 'react-router-dom';

export const translationsRoutes: RouteObject[] = [
  { path: URLS.translations, element: <TranslationsPage /> },
];
