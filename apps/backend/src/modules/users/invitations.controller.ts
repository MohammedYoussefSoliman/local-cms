import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import type {
  InvitationPreviewResponseData,
  LoginResponseData,
} from '@cms/contracts';

import { CurrentInvitation, InviteCredential } from '@/common';

import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InvitationsService } from './invitations.service';

import type { Request } from 'express';

/**
 * The two routes an invitee calls before they have an account they can log
 * into. Both authenticate with `X-Invite-Token` (auth Rule 2's fifth marker),
 * so neither is `@Public()` and neither carries `@Roles()` — there is no
 * `request.user` to read a role from, and the scope check is the token itself,
 * which can only ever address the one account it was minted for.
 */
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  /**
   * Throttled: the token is a bearer credential in a header, so this is a
   * guessing surface even though the odds are 2^256 against.
   */
  @InviteCredential()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('me')
  preview(
    @CurrentInvitation('id') invitationId: string,
  ): Promise<InvitationPreviewResponseData> {
    return this.invitations.preview(invitationId);
  }

  /**
   * 200 rather than 201: nothing is created here that the caller addresses by
   * URL afterwards — an account is activated and a session is issued, which is
   * what `POST /auth/login` also answers 200 to.
   */
  @InviteCredential()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentInvitation('id') invitationId: string,
    @Body() dto: AcceptInvitationDto,
    @Req() request: Request,
  ): Promise<LoginResponseData> {
    return this.invitations.accept(
      invitationId,
      dto,
      request.headers['user-agent'],
    );
  }
}
