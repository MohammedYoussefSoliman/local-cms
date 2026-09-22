import { createHash, randomBytes } from 'node:crypto';

import { RefreshSession, User } from '@cms/database';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { IsNull, LessThan, Repository } from 'typeorm';

import type { AccessTokenClaims } from '@cms/domain';

import { jwtConfig } from '../../config/configuration';
import { UsersService } from '../users/users.service';

import type { ConfigType } from '@nestjs/config';

type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly config: ConfigType<typeof jwtConfig>,
    @InjectRepository(RefreshSession)
    private readonly sessions: Repository<RefreshSession>,
  ) {}

  async login(
    email: string,
    password: string,
    userAgent?: string,
  ): Promise<IssuedTokens & { user: User }> {
    const user = await this.users.findByEmailWithPassword(email);

    // Same message and roughly the same work for "no such user" and "wrong
    // password", so the endpoint is not a user-enumeration oracle.
    const passwordMatches = user
      ? await argon2.verify(user.passwordHash, password)
      : await this.dummyVerify(password);

    if (!user || !passwordMatches || user.status !== 'active') {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const tokens = await this.issueTokens(user);
    await this.persistSession(user.id, tokens.refreshToken, userAgent);

    return { ...tokens, user };
  }

  /**
   * Rotation: the presented token is revoked and a new pair is issued. Reusing
   * a revoked token is treated as theft and kills every session for that user.
   */
  async refresh(
    refreshToken: string,
    userAgent?: string,
  ): Promise<IssuedTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.sessions.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!session) throw new UnauthorizedException('Invalid refresh token.');

    if (session.revokedAt) {
      await this.revokeAllForUser(session.userId);
      throw new UnauthorizedException('Refresh token has already been used.');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    if (session.user.status !== 'active') {
      await this.revokeAllForUser(session.userId);
      throw new UnauthorizedException('Account is no longer active.');
    }

    session.revokedAt = new Date();
    await this.sessions.save(session);

    const tokens = await this.issueTokens(session.user);
    await this.persistSession(session.userId, tokens.refreshToken, userAgent);

    return tokens;
  }

  /**
   * Scoped to `userId` deliberately. Matching on the token hash alone would let
   * any authenticated caller revoke a session belonging to someone else merely
   * by presenting that person's refresh token — the access token says who is
   * asking, so it decides whose sessions are in reach.
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.sessions.update(
      { userId, tokenHash: this.hashToken(refreshToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Called on logout-everywhere, disable, and credential change. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.sessions.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Housekeeping for expired rows; safe to run on a schedule. */
  async pruneExpiredSessions(): Promise<number> {
    const result = await this.sessions.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }

  private async issueTokens(user: User): Promise<IssuedTokens> {
    const claims: Pick<AccessTokenClaims, 'sub' | 'email' | 'role'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Seconds, not '15m': the string form's type varies across jsonwebtoken
    // versions, and a number means exactly one thing.
    const expiresIn = this.ttlToSeconds(this.config.accessTtl);

    const accessToken = await this.jwt.signAsync(claims, {
      secret: this.config.accessSecret,
      expiresIn,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });

    // Opaque random string, not a JWT: it is only ever compared against a
    // stored hash, so it carries no claims that could be trusted by mistake.
    const refreshToken = randomBytes(48).toString('base64url');

    return { accessToken, refreshToken, expiresIn };
  }

  private async persistSession(
    userId: string,
    refreshToken: string,
    userAgent?: string,
  ): Promise<void> {
    const ttlSeconds = this.ttlToSeconds(this.config.refreshTtl);

    await this.sessions.save(
      this.sessions.create({
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        userAgent: userAgent ?? null,
        revokedAt: null,
      }),
    );
  }

  /** Only the hash is stored, so a database dump cannot be replayed. */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async dummyVerify(password: string): Promise<boolean> {
    // Constant-ish work for unknown emails.
    await argon2.hash(password);
    return false;
  }

  private ttlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) return Number(ttl) || 0;

    const amount = Number(match[1]);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit];

    return amount * multiplier;
  }
}
