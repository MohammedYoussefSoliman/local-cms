import { QueryClient } from '@tanstack/react-query';

/**
 * Retries are off: the axios layer already handles the one failure worth
 * retrying (an expired access token), and retrying anything else just delays
 * the error toast by three round trips.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
