import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { INVITE_CREDENTIAL_KEY } from '../decorators/invite-credential.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SERVICE_CREDENTIAL_KEY } from '../decorators/service-credential.decorator';

import { ApiKeyGuard } from './api-key.guard';
import { InviteTokenGuard } from './invite-token.guard';

/**
 * Registered globally in `app.module.ts`, so **every** endpoint is protected
 * unless it carries `@Public()`. This is the inverse of guarding route by
 * route: a new controller is safe by default, and forgetting a decorator
 * fails closed (401) rather than open.
 *
 * It is also the single place that decides *how* a request authenticates. A
 * route marked `@ServiceCredential()` is handed to `ApiKeyGuard` rather than to
 * the JWT strategy — it is still authenticated, just by a client application
 * instead of a person. A route marked `@InviteCredential()` goes to
 * `InviteTokenGuard` the same way, for someone who has been invited and has no
 * account to log into yet. Keeping both forks here is what stops the runtime
 * and invitation endpoints from becoming the fourth and fifth `@Public()`
 * routes (auth Rule 2).
 *
 * The decorators are imported by path rather than through `@/common`: the
 * barrel re-exports this file, and routing a load-time dependency back through
 * it is a cycle.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyGuard: ApiKeyGuard,
    private readonly inviteTokenGuard: InviteTokenGuard,
  ) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const isServiceCredential = this.reflector.getAllAndOverride<boolean>(
      SERVICE_CREDENTIAL_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isServiceCredential) return this.apiKeyGuard.canActivate(context);

    const isInviteCredential = this.reflector.getAllAndOverride<boolean>(
      INVITE_CREDENTIAL_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isInviteCredential) return this.inviteTokenGuard.canActivate(context);

    return super.canActivate(context);
  }
}
