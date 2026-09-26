import { Toaster, TooltipProvider } from '@cms/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { queryClient } from '@/config';
import { URLS } from '@/helpers';
import { AppLayout, HomeRedirect } from '@/layouts';
import { appsRoutes } from '@/modules/apps/routes';
import { authRoutes } from '@/modules/auth/routes';
import { draftsRoutes } from '@/modules/drafts/routes';
import { localesRoutes } from '@/modules/locales/routes';
import { overviewRoutes } from '@/modules/overview/routes';
import { translationsRoutes } from '@/modules/translations/routes';
import { usersRoutes } from '@/modules/users/routes';

/**
 * Two trees: the unauthenticated screens, and everything under `AppLayout`,
 * which owns the session check and the app scope. A feature module contributes
 * routes and nothing else — no module registers itself anywhere but here.
 */
const router = createBrowserRouter([
  ...authRoutes,
  {
    element: <AppLayout />,
    children: [
      { path: URLS.home, element: <HomeRedirect /> },
      ...overviewRoutes,
      ...appsRoutes,
      ...translationsRoutes,
      ...draftsRoutes,
      ...localesRoutes,
      ...usersRoutes,
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
