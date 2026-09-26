import {
  type ExecutionContext,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';

import type { Request } from 'express';

export const INVITE_CREDENTIAL_KEY = 'inviteCredential';

/** The header an invitee presents their single-use token in. */
export const INVITE_TOKEN_HEADER = 'x-invite-token';

/** What `InviteTokenGuard` attaches once a token checks out. */
export type InvitationContext = {
  id: string;
  /** The account this token may activate, and nothing else. */
  userId: string;
};

export type InviteCredentialRequest = Request & {
  invitation?: InvitationContext;
};

/**
 * Marks a route as authenticated by a single-use invitation token rather than
 * by a user session.
 *
 * The fifth marker, and — like `@ServiceCredential()` — it is **not**
 * `@Public()`. Someone accepting an invitation has no account they can log
 * into yet, so there is no bearer token to present; what they do hold is a
 * credential, and it is checked. `JwtAuthGuard` reads this marker and delegates
 * to `InviteTokenGuard`, which SHA-256s `X-Invite-Token`, looks up an
 * outstanding `user_invitations` row and attaches `request.invitation`.
 *
 * The token travels in a header rather than in the path, deliberately: a secret
 * in a URL lands in access logs, browser history and `Referer`.
 *
 * A route carrying this marker has no `request.user`, so `@Roles()` on one is
 * meaningless — the scope check is the invitation's own `userId`.
 */
export const InviteCredential = () => SetMetadata(INVITE_CREDENTIAL_KEY, true);

/**
 * Reads the resolved invitation off the request. The invitation counterpart to
 * `@CurrentUser()`, and for the same reason: controllers never touch the raw
 * request, so the shape stays typed and the credential cannot be read from
 * somewhere the guard did not put it.
 */
export const CurrentInvitation = createParamDecorator(
  (data: keyof InvitationContext | undefined, context: ExecutionContext) => {
    const request = context
      .switchToHttp()
      .getRequest<InviteCredentialRequest>();
    const invitation = request.invitation;
    if (!invitation) return undefined;
    return data ? invitation[data] : invitation;
  },
);
