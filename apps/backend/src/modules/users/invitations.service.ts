import { createHash, randomBytes } from 'node:crypto';

import { User, UserInvitation } from '@cms/database';
import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';

import type {
  InvitationPreviewResponseData,
  InvitationResponseData,
  IssuedInvitationResponseData,
  LoginResponseData,
} from '@cms/contracts';

// By path, not through `@/common`: that barrel re-exports `InviteTokenGuard`,
// which imports this file, and routing a load-time dependency back through the
// barrel is a cycle.
import { ttlToSeconds } from '../../common/ttl';
import { invitationConfig } from '../../config/configuration';
import { AuthService } from '../auth/auth.service';

import type { AcceptInvitationDto } from './dto/accept-invitation.dto';
import type { ConfigType } from '@nestjs/config';
import type { EntityManager } from 'typeorm';

/** 32 bytes of entropy, base64url-encoded, behind a greppable prefix. */
const TOKEN_BYTES = 32;

/**
 * The invitation half of the user lifecycle.
 *
 * `POST /users` creates an account whose password hash is over bytes that were
 * generated, used once and dropped — there is no password to guess, and until
 * this service hands out a token there is also no way in. The delivery plan's
 * B9 shipped the first half and flagged the second as needing a product
 * decision; this is that decision, taken as: **an admin mints a single-use
 * link and delivers it**, because the CMS has no mail transport and an
 * admin-chosen password would be a credential two people know.
 */
@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(UserInvitation)
    private readonly invitations: Repository<UserInvitation>,
    /**
     * The `User` repository rather than `UsersService`: both entities are owned
     * by this module, so this is not reaching around another feature's public
     * surface (module-structure rule). Going through `UsersService` would make
     * the two services mutually dependent, which is a `forwardRef` bought for
     * nothing.
     */
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    @Inject(invitationConfig.KEY)
    private readonly config: ConfigType<typeof invitationConfig>,
    /** Accepting an invitation signs the new user straight in. */
    @Inject(forwardRef(() => AuthService))
    private readonly auth: AuthService,
  ) {}

  /**
   * Mints a token for an `invited` account. The plaintext exists only in this
   * return value — nothing logs it, nothing stores it, and no later request can
   * recover it, exactly as `POST /apps/:id/api-keys` behaves.
   */
  issue(
    userId: string,
    invitedBy: string | null,
  ): Promise<IssuedInvitationResponseData> {
    return this.dataSource.transaction((manager) =>
      this.issueWithin(manager, userId, invitedBy),
    );
  }

  /**
   * The same thing inside a caller's transaction, so creating a user and
   * inviting them are one atomic act. A user row with no invitation is a
   * recoverable mess; it is still better not to create one.
   */
  async issueWithin(
    manager: EntityManager,
    userId: string,
    invitedBy: string | null,
  ): Promise<IssuedInvitationResponseData> {
    const user = await manager.getRepository(User).findOne({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found.');

    if (user.status !== 'invited') {
      // An active account has a password and a way to change it; a disabled one
      // is deliberately locked out. Neither is an invitation's business, and
      // minting a token for either would be a password reset wearing the wrong
      // name.
      throw new UnprocessableEntityException(
        'Only an account awaiting its first sign-in can be invited.',
      );
    }

    const repository = manager.getRepository(UserInvitation);

    /**
     * Revoke before insert, because `uq_user_invitations_outstanding` allows
     * exactly one live row per user. That constraint is the point: two valid
     * tokens for one account means cancelling one of them accomplishes
     * nothing.
     */
    await repository.update(
      { userId, acceptedAt: IsNull(), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    const token = `inv_${randomBytes(TOKEN_BYTES).toString('base64url')}`;

    const record = await repository.save(
      repository.create({
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttlToSeconds(this.config.ttl) * 1000),
        invitedBy,
        acceptedAt: null,
        revokedAt: null,
      }),
    );

    return {
      ...toInvitationResponse(record),
      token,
      acceptUrl: this.acceptUrl(token),
    };
  }

  /**
   * What the dashboard shows beside an `invited` user: whether a live token
   * exists and when it dies. Never the token itself.
   */
  async findOutstanding(userId: string): Promise<InvitationResponseData | null> {
    await this.findUserOrFail(userId);

    const record = await this.invitations.findOne({
      where: { userId, acceptedAt: IsNull(), revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    return record ? toInvitationResponse(record) : null;
  }

  /**
   * Cancels an invitation without touching the account. The row survives, so
   * "who invited this person, how often, and who called it off" stays
   * answerable.
   */
  async revokeOutstanding(userId: string): Promise<void> {
    await this.findUserOrFail(userId);

    await this.invitations.update(
      { userId, acceptedAt: IsNull(), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /**
   * Resolves a presented token. Used by `InviteTokenGuard` and nothing else.
   *
   * Every disqualifier — unknown, expired, revoked, already accepted — comes
   * back as the same `null`, and the guard turns all of them into one 401. A
   * caller who can tell "expired" from "never existed" can enumerate which
   * addresses have been invited.
   */
  async resolve(presented: string): Promise<UserInvitation | null> {
    const record = await this.invitations.findOne({
      where: {
        tokenHash: hashToken(presented),
        acceptedAt: IsNull(),
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    return record ?? null;
  }

  /** Renders the accept screen: who this is for, and what they were invited as. */
  async preview(invitationId: string): Promise<InvitationPreviewResponseData> {
    const record = await this.invitations.findOne({
      where: { id: invitationId },
      relations: { user: true },
    });

    // Unreachable through the guard, which resolved this id a moment ago —
    // kept because the service is callable without it.
    if (!record) throw new UnauthorizedException('This invitation is invalid.');

    return {
      email: record.user.email,
      name: record.user.name,
      role: record.user.role,
      expiresAt: record.expiresAt.toISOString(),
    };
  }

  /**
   * Sets the first password, activates the account, spends the token, and
   * signs the new user in.
   *
   * Signing them in is not a convenience: the alternative is redirecting to a
   * login form that then spends one of the five logins a minute the throttler
   * allows, immediately after the person has typed the password once already.
   */
  async accept(
    invitationId: string,
    dto: AcceptInvitationDto,
    userAgent?: string,
  ): Promise<LoginResponseData> {
    const email = await this.dataSource.transaction(async (manager) => {
      const invitations = manager.getRepository(UserInvitation);

      /**
       * Re-read under a row lock rather than trusting what the guard resolved.
       * Two submissions of the accept form arriving together would otherwise
       * both pass the check and both hash a password — the second one
       * overwriting the first, which is a silent credential swap if the two
       * requests did not come from the same person.
       */
      const record = await invitations
        .createQueryBuilder('invitation')
        .setLock('pessimistic_write')
        .where('invitation.id = :id', { id: invitationId })
        .getOne();

      if (
        !record ||
        record.acceptedAt ||
        record.revokedAt ||
        record.expiresAt.getTime() <= Date.now()
      ) {
        throw new UnauthorizedException(
          'This invitation is invalid or has expired.',
        );
      }

      const users = manager.getRepository(User);
      const user = await users.findOne({ where: { id: record.userId } });

      if (!user) {
        throw new UnauthorizedException('This invitation is invalid.');
      }

      if (user.status !== 'invited') {
        throw new UnprocessableEntityException(
          'This account has already been activated.',
        );
      }

      // `update` rather than `save`: `password_hash` is `select: false`, so the
      // loaded entity carries `undefined` there and a diff-based save is a
      // worse thing to reason about than an explicit column list.
      await users.update(
        { id: user.id },
        { passwordHash: await argon2.hash(dto.password), status: 'active' },
      );

      record.acceptedAt = new Date();
      await invitations.save(record);

      return user.email;
    });

    /**
     * Outside the transaction on purpose. Logging in writes a refresh session;
     * rolling the activation back because session persistence hiccuped would
     * burn the token and leave the account unusable.
     */
    const { user, ...tokens } = await this.auth.login(
      email,
      dto.password,
      userAgent,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    };
  }

  private acceptUrl(token: string): string {
    const base = this.config.dashboardUrl.replace(/\/+$/, '');
    return `${base}/invite?token=${encodeURIComponent(token)}`;
  }

  private async findUserOrFail(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }
}

/**
 * SHA-256, not argon2, for the same reason `api_keys` uses it: the token is 32
 * bytes of uniform randomness rather than a human-chosen password, so there is
 * no dictionary to slow an attacker against, and the guard runs this on every
 * request to the accept screen.
 */
function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/**
 * `tokenHash` is on the entity, so returning the record directly is one
 * refactor away from shipping it (HTTP contract Rule 5).
 */
function toInvitationResponse(record: UserInvitation): InvitationResponseData {
  return {
    id: record.id,
    userId: record.userId,
    expiresAt: record.expiresAt.toISOString(),
    invitedBy: record.invitedBy,
    createdAt: record.createdAt.toISOString(),
  };
}
