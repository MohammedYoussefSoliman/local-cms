import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type RenderOptions,
  type RenderResult,
  render,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { ReactElement, ReactNode } from 'react';

import '@/locales';

/**
 * Every component under test needs the query client and the router, and a
 * fresh QueryClient per test — a shared one leaks cached data between tests
 * and produces failures that only reproduce in suite order.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & { route?: string } = {},
): RenderResult {
  const { route = '/', ...renderOptions } = options;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
