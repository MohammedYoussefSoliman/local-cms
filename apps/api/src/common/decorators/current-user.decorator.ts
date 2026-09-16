import { type ExecutionContext, createParamDecorator } from '@nestjs/common';

import type { AccessTokenClaims } from '@cms/domain';

import type { Request } from 'express';

/**
 * Reads the authenticated user off the request. Controllers never touch
 * `request.user` directly — that is what makes the claim shape typed.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AccessTokenClaims | undefined, context: ExecutionContext) => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AccessTokenClaims }>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
