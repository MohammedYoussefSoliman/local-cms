import { User } from '@cms/database';
import {
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as argon2 from 'argon2';

import { AuthService } from '../auth/auth.service';

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
  let builder: Record<string, jest.Mock>;

  beforeEach(async () => {
    builder = {
      addSelect: jest.fn(() => builder),
      where: jest.fn(() => builder),
      getOne: jest.fn(async () => null),
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

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('create', () => {
    it('creates an invited account with an unknowable password', async () => {
      const result = await service.create({
        email: 'new@example.test',
        name: 'New',
        role: 'editor',
      });

      const saved = users.save.mock.calls[0][0] as User;
      expect(saved.status).toBe('invited');
      // The plaintext is generated, hashed and dropped — there is no password,
      // rather than a guessable one.
      expect(saved.passwordHash).toMatch(/^\$argon2/);
      expect(result).not.toHaveProperty('passwordHash');
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
