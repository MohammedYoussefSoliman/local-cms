import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SERVICE_CREDENTIAL_KEY } from '../decorators/service-credential.decorator';

import { ApiKeyGuard } from './api-key.guard';

/**
 * Registered globally in `app.module.ts`, so **every** endpoint is protected
 * unless it carries `@Public()`. This is the inverse of guarding route by
 * route: a new controller is safe by default, and forgetting a decorator
 * fails closed (401) rather than open.
 *
 * It is also the single place that decides *how* a request authenticates. A
 * route marked `@ServiceCredential()` is handed to `ApiKeyGuard` rather than to
 * the JWT strategy — it is still authenticated, just by a client application
 * instead of a person. Keeping that fork here is what stops the runtime
 * endpoints from becoming a fourth `@Public()` route (auth Rule 2).
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

    return super.canActivate(context);
  }
}
