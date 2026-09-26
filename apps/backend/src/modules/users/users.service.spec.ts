import { User } from '@cms/database';
import {
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';

import { AuthService } from '../auth/auth.service';

import { InvitationsService } from './invitations.service';
import { UsersService } from './users.service';

function userRow(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'sam@example.test',
    name: 'Sam',
    role: 'editor',
    status: 'active',
    passwordHash: 'stored-hash',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as User;
}

describe('UsersService', () => {
  let service: UsersService;
  let users: Record<string, jest.Mock>;
  let auth: { revokeAllForUser: jest.Mock };
  let invitations: { issueWithin: jest.Mock };
  let builder: Record<string, jest.Mock>;

  beforeEach(async () => {
    builder = {
      select: jest.fn(() => builder),
      addSelect: jest.fn(() => builder),
      where: jest.fn(() => builder),
      andWhere: jest.fn(() => builder),
      orderBy: jest.fn(() => builder),
      setLock: jest.fn(() => builder),
      getOne: jest.fn(async () => null),
      // The active-admin lock query. Empty by default: the fixtures below are
      // editors, so nothing reaches it unless a test says otherwise.
      getMany: jest.fn(async () => []),
    };

    users = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(async () => [[], 0]),
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: Partial<User>) => userRow(row)),
      createQueryBuilder: jest.fn(() => builder),
    };
    auth = { revokeAllForUser: jest.fn() };
    invitations = {
      issueWithin: jest.fn(async () => ({
        id: 'invitation-1',
        userId: 'user-1',
        expiresAt: '2026-01-08T00:00:00.000Z',
        invitedBy: 'admin-9',
        createdAt: '2026-01-01T00:00:00.000Z',
        token: 'inv_plaintext',
        acceptUrl: 'http://localhost:4051/invite?token=inv_plaintext',
      })),
    };

    /**
     * Every write path that has to be atomic runs inside a transaction, and the
     * manager it hands back is the same repository mock — so an assertion on
     * `users.save` still sees the write regardless of which side of the
     * transaction boundary it happened on.
     */
    const dataSource = {
      transaction: jest.fn(
        async (run: (manager: { getRepository: () => unknown }) => unknown) =>
          run({ getRepository: () => users }),
      ),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: AuthService, useValue: auth },
        { provide: InvitationsService, useValue: invitations },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('create', () => {
    it('creates an invited account with an unknowable password', async () => {
      const result = await service.create(
        { email: 'new@example.test', name: 'New', role: 'editor' },
        'admin-9',
      );

      const saved = users.save.mock.calls[0][0] as User;
      expect(saved.status).toBe('invited');
      // The plaintext is generated, hashed and dropped — there is no password,
      // rather than a guessable one. The invitation is the only way in.
      expect(saved.passwordHash).toMatch(/^\$argon2/);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('mints the first invitation in the same transaction', async () => {
      // A user row with no token is an account nobody can reach, and nobody
      // can see is unreachable — the state B9 shipped and this closes.
      const result = await service.create(
        { email: 'new@example.test', name: 'New', role: 'admin' },
        'admin-9',
      );

      expect(invitations.issueWithin).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        'admin-9',
      );
      expect(result.invitation.token).toBe('inv_plaintext');
    });
  });

  describe('findAll', () => {
    it('repeats the role and status filters into each search branch', async () => {
      await service.findAll({
        page: 1,
        limit: 20,
        search: 'sam',
        role: 'admin',
      });

      // An array of conditions is OR'd — a filter in only one branch would let
      // a search return users the caller filtered out.
      expect(users.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            expect.objectContaining({ role: 'admin', email: expect.anything() }),
            expect.objectContaining({ role: 'admin', name: expect.anything() }),
          ],
        }),
      );
    });
  });

  describe('update', () => {
    it('assigns only name and role', async () => {
      users.findOne.mockResolvedValue(userRow());

      await service.update('user-1', { role: 'admin' });

      const saved = users.save.mock.calls[0][0] as User;
      expect(saved.role).toBe('admin');
      expect(saved.email).toBe('sam@example.test');
      expect(saved.status).toBe('active');
    });

    it('does not revoke sessions on a role change', async () => {
      // `JwtStrategy` re-reads the role from the database on every request, so
      // a demotion already takes effect on the next call.
      users.findOne.mockResolvedValue(userRow());

      await service.update('user-1', { role: 'editor' });

      expect(auth.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('404s for a user that does not exist', async () => {
      users.findOne.mockResolvedValue(null);

      await expect(
        service.update('user-1', { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('disable', () => {
    it('sets the status and revokes every session', async () => {
      users.findOne.mockResolvedValue(userRow());

      const result = await service.disable('user-1', 'admin-9');

      expect(result.status).toBe('disabled');
      // Both halves, or a disabled user keeps working until their access token
      // expires.
      expect(auth.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('422s a self-disable rather than locking the caller out', async () => {
      await expect(
        service.disable('admin-9', 'admin-9'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(users.save).not.toHaveBeenCalled();
      expect(auth.revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  describe('the last active admin', () => {
    const lastAdmin = () =>
      userRow({ id: 'admin-1', role: 'admin', status: 'active' });

    it('422s a demotion that would leave nobody able to administer', async () => {
      users.findOne.mockResolvedValue(lastAdmin());
      // The lock query sees only the account being demoted.
      builder.getMany.mockResolvedValue([{ id: 'admin-1' }]);

      await expect(
        service.update('admin-1', { role: 'editor' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(users.save).not.toHaveBeenCalled();
    });

    it('allows the demotion once a second admin exists', async () => {
      users.findOne.mockResolvedValue(lastAdmin());
      builder.getMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);

      const result = await service.update('admin-1', { role: 'editor' });

      expect(result.role).toBe('editor');
    });

    it('422s disabling the only remaining admin', async () => {
      // Self-disable is refused separately; this is the path that was not —
      // one admin disabling the only other one, or disabling an admin after
      // having been demoted in between.
      users.findOne.mockResolvedValue(lastAdmin());
      builder.getMany.mockResolvedValue([{ id: 'admin-1' }]);

      await expect(
        service.disable('admin-1', 'someone-else'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(users.save).not.toHaveBeenCalled();
      expect(auth.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('takes a row lock over the active admins, in a fixed order', async () => {
      // Without the lock two admins demoting each other at the same instant
      // both read "one other admin exists" and both commit, leaving zero. The
      // ordering is what makes the pair block instead of deadlock.
      users.findOne.mockResolvedValue(lastAdmin());
      builder.getMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);

      await service.update('admin-1', { role: 'editor' });

      expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(builder.orderBy).toHaveBeenCalledWith('user.id', 'ASC');
    });

    it('leaves a non-admin demotion and an editor disable alone', async () => {
      users.findOne.mockResolvedValue(userRow());

      await service.update('user-1', { name: 'Renamed' });
      await service.disable('user-1', 'admin-9');

      // No reason to lock the admin set for a write that cannot change it.
      expect(builder.getMany).not.toHaveBeenCalled();
    });
  });

  describe('enable', () => {
    it('restores active status without restoring sessions', async () => {
      users.findOne.mockResolvedValue(userRow({ status: 'disabled' }));

      const result = await service.enable('user-1');

      expect(result.status).toBe('active');
      expect(auth.revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('verifies the current password, rehashes, and revokes every session', async () => {
      const passwordHash = await argon2.hash('the-old-password');
      builder.getOne.mockResolvedValue(userRow({ passwordHash }));

      await service.changePassword('user-1', {
        currentPassword: 'the-old-password',
        newPassword: 'a-brand-new-password',
      });

      const saved = users.save.mock.calls[0][0] as User;
      expect(saved.passwordHash).not.toBe(passwordHash);
      await expect(
        argon2.verify(saved.passwordHash, 'a-brand-new-password'),
      ).resolves.toBe(true);

      // Including the caller's own: a change made because credentials leaked
      // must not leave the attacker's session alive.
      expect(auth.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('401s on a wrong current password and changes nothing', async () => {
      builder.getOne.mockResolvedValue(
        userRow({ passwordHash: await argon2.hash('the-old-password') }),
      );

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'not-it',
          newPassword: 'a-brand-new-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(users.save).not.toHaveBeenCalled();
      expect(auth.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('asks for the hash explicitly, since the column is select:false', async () => {
      builder.getOne.mockResolvedValue(
        userRow({ passwordHash: await argon2.hash('the-old-password') }),
      );

      await service.changePassword('user-1', {
        currentPassword: 'the-old-password',
        newPassword: 'a-brand-new-password',
      });

      expect(builder.addSelect).toHaveBeenCalledWith('user.passwordHash');
    });
  });
});
