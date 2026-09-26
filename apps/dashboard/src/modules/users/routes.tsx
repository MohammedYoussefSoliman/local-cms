
import { URLS } from '@/helpers';

import { UsersPage } from './pages';

import type { RouteObject } from 'react-router-dom';

export const usersRoutes: RouteObject[] = [
  { path: URLS.users, element: <UsersPage /> },
];
