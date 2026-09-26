import { useMutation, useQueryClient } from '@tanstack/react-query';

import { axiosInstance } from '@/config';
import { useAuthStore } from '@/store';

/**
 * Ends the session on both sides.
 *
 * The local clear runs whatever the request does. A network failure must not
 * leave someone signed in on a shared machine after they asked to leave — and
 * the server-side revocation is the part that can be retried, not the part the
 * user is waiting on.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const clear = useAuthStore((state) => state.clear);

  return useMutation({
    mutationFn: async () => {
      const refreshToken = useAuthStore.getState().refreshToken;
      try {
        await axiosInstance.post('/auth/logout', { refreshToken });
      } catch {
        // Deliberately swallowed — see the doc comment.
      }
    },
    onSettled: () => {
      clear();
      queryClient.clear();
    },
  });
}
