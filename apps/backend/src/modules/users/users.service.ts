import { randomBytes } from 'node:crypto';

import { User } from '@cms/database';
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
import { DataSource, ILike, Repository } from 'typeorm';

import type { InvitedUserResponseData, PaginatedList, UserResponseData } from '@cms/contracts';
import type { UserStatus } from '@cms/domain';


import { AuthService } from '../auth/auth.service';

import { InvitationsService } from './invitations.service';

import type { ChangePasswordDto } from './dto/change-password.dto';
import type { CreateUserDto } from './dto/create-user.dto';
import type { ListUsersQueryDto } from './dto/list-users.query.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { EntityManager, FindOptionsWhere } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    /**
     * Mutual dependency, and a real one: `AuthModule` needs `UsersService` to
     * load an account, and this needs `AuthService` to revoke that account's
     * sessions. `forwardRef` rather than a second copy of the revoke-all query
     * here — two implementations of "disabling locks them out" is how one of
     * them quietly stops being true.
     */
    @Inject(forwardRef(() => AuthService))
    private readonly auth: AuthService,
    /**
     * `forwardRef` for a module-level cycle rather than a service-level one:
     * this service does not call back into invitations, but the *imports* do
     * loop — `users.service` → `invitations.service` → `auth.service` →
     * `users.service`, because accepting an invitation signs the new user in.
     * Without the thunk, whichever file loads second sees `undefined` where the
     * class should be and Nest reports an unresolvable parameter index.
     */
    @Inject(forwardRef(() => InvitationsService))
    private readonly invitations: InvitationsService,
    // Injected for the create, demote and disable transactions (typeorm Rule 4).
    private readonly dataSource: DataSource,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  /**
   * `password_hash` is `select: false` on the entity, so it has to be asked
   * for explicitly. That is deliberate: no other query can leak it.
   */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findAll(
    query: ListUsersQueryDto,
  ): Promise<PaginatedList<UserResponseData>> {
    const search = query.search?.trim();
    const match = search ? ILike(`%${search}%`) : undefined;

    const filters: FindOptionsWhere<User> = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [records, total] = await this.users.findAndCount({
      // An array is OR'd, so the filters have to be repeated into each branch —
      // otherwise a search would ignore the role and status the caller asked
      // for.
      where: match
        ? [
            { ...filters, email: match },
            { ...filters, name: match },
          ]
        : filters,
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      order: { name: 'ASC' },
    });

    return {
      records: records.map(toUserResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string): Promise<UserResponseData> {
    return toUserResponse(await this.findEntityOrFail(id));
  }

  /**
   * An invitation. The account is created `invited`, which `AuthService.login`
   * already refuses, and its password hash is over bytes that are generated,
   * used once and dropped — so there is no password, rather than a guessable
   * one, until the invitee sets theirs.
   *
   * The account and its first invitation are written in **one transaction**.
   * A user row with no token is an account nobody can reach and nobody can see
   * is unreachable, which is precisely the state B9 shipped and this closes.
   *
   * The plaintext token comes back exactly once, in this response. The CMS has
   * no mail transport, so delivering the link is the admin's move — the same
   * contract `POST /apps/:id/api-keys` has, and the reason the response shape
   * is `InvitedUserResponseData` rather than a plain user.
   */
  async create(
    dto: CreateUserDto,
    invitedBy: string | null,
  ): Promise<InvitedUserResponseData> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(User);

      // No pre-check on the email: `uq_users_email` is the check, and the
      // filter turns its 23505 into a 409 (typeorm Rule 5). CITEXT makes it
      // case-insensitive, so `Sam@x.co` cannot shadow `sam@x.co`.
      const user = await repository.save(
        repository.create({
          email: dto.email,
          name: dto.name,
          role: dto.role,
          status: 'invited',
          passwordHash: await argon2.hash(
            randomBytes(32).toString('base64url'),
          ),
        }),
      );

      const invitation = await this.invitations.issueWithin(
        manager,
        user.id,
        invitedBy,
      );

      return { ...toUserResponse(user), invitation };
    });
  }

  /**
   * A role change needs no session revocation: `JwtStrategy` re-reads the user
   * on every request and takes `role` from the database rather than from the
   * token, so a demotion takes effect on the next call.
   */
  async update(id: string, dto: UpdateUserDto): Promise<UserResponseData> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const user = await repository.findOne({ where: { id } });
      if (!user) throw new NotFoundException('User not found.');

      const isDemotion =
        dto.role !== undefined &&
        dto.role !== 'admin' &&
        user.role === 'admin' &&
        user.status === 'active';

      if (isDemotion) await this.assertAnotherActiveAdminRemains(manager, id);

      // Field by field, so an omitted optional cannot null a stored value — and
      // so neither `email` nor `status` has anywhere to sneak in.
      if (dto.name !== undefined) user.name = dto.name;
      if (dto.role !== undefined) user.role = dto.role;

      await repository.save(user);
      return toUserResponse(user);
    });
  }

  /**
   * Disabling has to lock the account out **now**, not at access-token expiry,
   * and that needs both halves to be true: every refresh session is revoked
   * here, and `JwtStrategy` rejects a non-`active` account on the next request.
   * Either one alone leaves a disabled user working for up to fifteen minutes.
   */
  async disable(id: string, actingUserId: string): Promise<UserResponseData> {
    /**
     * 422 rather than letting it through: disabling yourself succeeds, then
     * 401s your very next request, and if you were the last admin nobody can
     * undo it. The request is well-formed and you are allowed to make it — it
     * is the outcome the domain refuses.
     */
    if (id === actingUserId) {
      throw new UnprocessableEntityException(
        'You cannot disable your own account.',
      );
    }

    const user = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const target = await repository.findOne({ where: { id } });
      if (!target) throw new NotFoundException('User not found.');

      if (target.role === 'admin' && target.status === 'active') {
        await this.assertAnotherActiveAdminRemains(manager, id);
      }

      target.status = 'disabled';
      await repository.save(target);

      return toUserResponse(target);
    });

    // After the commit: a revoke that ran inside the transaction and then lost
    // it would report a lockout that did not happen.
    await this.auth.revokeAllForUser(id);

    return user;
  }

  /**
   * Re-enabling does not restore sessions, and should not: they were revoked
   * when the account was disabled, and a returning user signs in again.
   */
  enable(id: string): Promise<UserResponseData> {
    return this.setStatus(id, 'active');
  }

  /**
   * Revokes **every** session including the caller's own. A password change is
   * the move someone makes when they think their credentials leaked, and a
   * change that leaves the attacker's session alive is worse than none: it
   * reports success while fixing nothing.
   */
  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();

    if (!user) throw new NotFoundException('User not found.');

    if (!(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      // 401, not 403: this is a failed credential check, not a permissions
      // problem (auth Rule 3).
      throw new UnauthorizedException('Current password is incorrect.');
    }

    user.passwordHash = await argon2.hash(dto.newPassword);
    await this.users.save(user);

    await this.auth.revokeAllForUser(id);
  }

  /**
   * Refuses the move that leaves the CMS with no way back in.
   *
   * Demoting or disabling the only remaining active admin is unrecoverable
   * through the API: `@Roles('admin')` guards every route that could undo it,
   * and the fix is then a `psql` session against production. Self-disable was
   * already refused; this covers the two paths that were not — an admin
   * demoting themselves, and an admin disabling the only other one after
   * having been demoted in between.
   *
   * 422, not 403: the caller has every permission required, and the request is
   * well-formed. It is the resulting *state* the domain refuses.
   *
   * The lock is what makes it true under concurrency. Two admins demoting each
   * other at the same instant would both read "one other admin exists" and both
   * commit, leaving zero. `FOR UPDATE` over the active-admin rows serializes
   * them, so the second transaction re-evaluates its predicate after the first
   * commits and sees the set it actually has to answer for. `ORDER BY id` keeps
   * lock acquisition in one direction, so the pair blocks rather than
   * deadlocks.
   */
  private async assertAnotherActiveAdminRemains(
    manager: EntityManager,
    targetId: string,
  ): Promise<void> {
    const admins = await manager
      .getRepository(User)
      .createQueryBuilder('user')
      .select('user.id')
      .where('user.role = :role', { role: 'admin' })
      .andWhere('user.status = :status', { status: 'active' })
      // Not `getCount()`: Postgres refuses `FOR UPDATE` alongside an aggregate,
      // and the set is small by definition.
      .orderBy('user.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();

    if (!admins.some((admin) => admin.id !== targetId)) {
      throw new UnprocessableEntityException(
        'This is the last active admin. Promote another admin first.',
      );
    }
  }

  private async setStatus(
    id: string,
    status: UserStatus,
  ): Promise<UserResponseData> {
    const user = await this.findEntityOrFail(id);
    user.status = status;
    await this.users.save(user);

    return toUserResponse(user);
  }

  private async findEntityOrFail(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }
}

/**
 * Entities are never returned as-is (HTTP contract Rule 5), and here the rule is
 * load-bearing rather than precautionary: `passwordHash` is a column on `User`,
 * and one `addSelect` upstream is all it would take for a direct return to ship
 * it to the client.
 */
function toUserResponse(user: User): UserResponseData {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
