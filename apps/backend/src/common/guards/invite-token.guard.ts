import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { InvitationsService } from '../../modules/users/invitations.service';
import {
  INVITE_TOKEN_HEADER,
  type InviteCredentialRequest,
} from '../decorators/invite-credential.decorator';

/**
 * Authenticates a route marked `@InviteCredential()`. Not registered globally:
 * `JwtAuthGuard` delegates to it when it finds the marker, so one guard still
 * answers "who is this request" for the whole API.
 *
 * Everything here is 401, never 403 and never 404 — a missing, unknown,
 * expired, revoked or already-accepted token is an identity problem (auth
 * Rule 3), and telling the caller which of those it was turns the endpoint
 * into an oracle for which invitations exist.
 */
@Injectable()
export class InviteTokenGuard implements CanActivate {
  constructor(private readonly invitations: InvitationsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<InviteCredentialRequest>();

    const presented = request.header(INVITE_TOKEN_HEADER);
    if (!presented) {
      throw new UnauthorizedException('An invitation token is required.');
    }

    const invitation = await this.invitations.resolve(presented);
    if (!invitation) {
      throw new UnauthorizedException(
        'This invitation is invalid or has expired.',
      );
    }

    request.invitation = { id: invitation.id, userId: invitation.userId };

    return true;
  }
}
