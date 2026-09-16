import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AccessTokenClaims } from '@cms/domain';

import { UsersService } from '../../users/users.service';

/**
 * Validates signature, expiry, issuer and audience (arch doc §5) — checking
 * only the signature would accept a token minted for a different service that
 * happens to share the secret.
 *
 * It also re-reads the user on every request so that disabling an account
 * takes effect immediately instead of at access-token expiry.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      issuer: config.getOrThrow<string>('JWT_ISSUER'),
      audience: config.getOrThrow<string>('JWT_AUDIENCE'),
    });
  }

  async validate(payload: AccessTokenClaims): Promise<AccessTokenClaims> {
    const user = await this.users.findById(payload.sub);

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Account is no longer active.');
    }

    // Role comes from the database, not the token, so a role change does not
    // wait for the access token to expire.
    return { ...payload, role: user.role };
  }
}
