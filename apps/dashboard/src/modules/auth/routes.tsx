
import { URLS } from '@/helpers';

import { AcceptInvitationPage, LoginPage } from './pages';

import type { RouteObject } from 'react-router-dom';

/**
 * The two routes that must render without a session — and the only two the
 * router serves outside `AppLayout`.
 */
export const authRoutes: RouteObject[] = [
  { path: URLS.login, element: <LoginPage /> },
  { path: URLS.acceptInvitation, element: <AcceptInvitationPage /> },
];
