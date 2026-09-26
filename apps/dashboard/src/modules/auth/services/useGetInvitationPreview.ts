import { useQuery } from '@tanstack/react-query';

import type {
  HTTPResponseType,
  InvitationPreviewResponseData,
} from '@cms/contracts';

import { type ApiResponse, axiosInstance } from '@/config';
import { AUTH_QUERY_KEYS } from '@/helpers';

/**
 * Renders the accept screen from the token in the invite link.
 *
 * The token travels in `X-Invite-Token`, never as a path parameter: a secret in
 * a URL lands in access logs, browser history and `Referer`. The dashboard
 * reads `?token=` off the link it was opened with and moves it into the header
 * for both calls.
 *
 * No toast on failure. Unknown, expired, revoked and already-spent tokens all
 * answer identically on purpose — the endpoint is not an oracle for who has
 * been invited — so the page renders one honest "this link is no longer valid"
 * rather than echoing a message that says nothing.
 */
export function useGetInvitationPreview(token: string | null) {
  const { data, error, isLoading } = useQuery({
    queryKey: [AUTH_QUERY_KEYS.getInvitationPreview, token],
    queryFn: async () => {
      const response = await axiosInstance.get<
        HTTPResponseType<InvitationPreviewResponseData>,
        ApiResponse<InvitationPreviewResponseData>
      >('/invitations/me', { headers: { 'X-Invite-Token': token } });

      return response.data;
    },
    enabled: Boolean(token),
    retry: false,
    throwOnError: false,
  });

  return { data, isLoading, isInvalid: Boolean(error) };
}
