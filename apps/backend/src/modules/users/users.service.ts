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
import { ILike, Repository } from 'typeorm';

import type { PaginatedList, UserResponseData } from '@cms/contracts';
import type { UserStatus } from '@cms/domain';


import { AuthService } from '../auth/auth.service';

import type { ChangePasswordDto } from './dto/change-password.dto';
import type { CreateUserDto } from './dto/create-user.dto';
import type { ListUsersQueryDto } from './dto/list-users.query.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { FindOptionsWhere } from 'typeorm';

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
   * one, until an invite-acceptance flow sets a real one.
   *
   * That flow does not exist yet (no ticket in B1-B12 covers it), so a user
   * created here cannot log in. Flagged rather than worked around: inventing an
   * `active` account with an admin-chosen password here would be a different
   * product decision made silently.
   */
  async create(dto: CreateUserDto): Promise<UserResponseData> {
    // No pre-check on the email: `uq_users_email` is the check, and the filter
    // turns its 23505 into a 409 (typeorm Rule 5). CITEXT makes it
    // case-insensitive, so `Sam@x.co` cannot shadow `sam@x.co`.
    const user = await this.users.save(
      this.users.create({
        email: dto.email,
        name: dto.name,
        role: dto.role,
        status: 'invited',
        passwordHash: await argon2.hash(randomBytes(32).toString('base64url')),
      }),
    );

    return toUserResponse(user);
  }

  /**
   * A role change needs no session revocation: `JwtStrategy` re-reads the user
   * on every request and takes `role` from the database rather than from the
   * token, so a demotion takes effect on the next call.
   */
  async update(id: string, dto: UpdateUserDto): Promise<UserResponseData> {
    const user = await this.findEntityOrFail(id);

    // Field by field, so an omitted optional cannot null a stored value — and
    // so neither `email` nor `status` has anywhere to sneak in.
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.role !== undefined) user.role = dto.role;

    await this.users.save(user);
    return toUserResponse(user);
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

    const user = await this.setStatus(id, 'disabled');
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
