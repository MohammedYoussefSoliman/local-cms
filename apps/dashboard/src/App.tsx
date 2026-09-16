import { Toaster } from '@cms/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { queryClient } from '@/config';
import { useLocale } from '@/hooks';

// Feature modules register their routes here as they land (Phase 3).
const router = createBrowserRouter([
  {
    path: '/',
    element: <Placeholder />,
  },
]);

function Placeholder() {
  useLocale();

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <p className="text-paragraph-md text-neutral-600">
        Localization CMS dashboard — Phase 3 scaffold.
      </p>
    </main>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
