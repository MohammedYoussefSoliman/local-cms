import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AccessTokenClaims, UserRole } from '@cms/domain';

import { ROLES_KEY } from '@/common';

import type { Request } from 'express';

/**
 * Runs after `JwtAuthGuard`. A missing token is 401 (handled upstream);
 * a valid token without the required role is 403 — the two are never
 * collapsed, because the dashboard treats them differently (re-login vs.
 * "you don't have access").
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AccessTokenClaims }>();
    const user = request.user;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }

    return true;
  }
}
