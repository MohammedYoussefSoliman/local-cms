import { createHash } from 'node:crypto';

import { User, UserInvitation } from '@cms/database';
import {
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';

import { invitationConfig } from '../../config/configuration';
import { AuthService } from '../auth/auth.service';

import { InvitationsService } from './invitations.service';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function userRow(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'sam@example.test',
    name: 'Sam',
    role: 'editor',
    status: 'invited',
    passwordHash: 'unknowable',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as User;
}

function invitationRow(overrides: Partial<UserInvitation> = {}): UserInvitation {
  return {
    id: 'invitation-1',
    userId: 'user-1',
    tokenHash: 'stored-hash',
    expiresAt: new Date('2026-01-08T00:00:00.000Z'),
    acceptedAt: null,
    revokedAt: null,
    invitedBy: 'admin-9',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as UserInvitation;
}

describe('InvitationsService', () => {
  let service: InvitationsService;
  let invitations: Record<string, jest.Mock>;
  let users: Record<string, jest.Mock>;
  let auth: { login: jest.Mock };
  let builder: Record<string, jest.Mock>;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);

    builder = {
      setLock: jest.fn(() => builder),
      where: jest.fn(() => builder),
      getOne: jest.fn(async () => invitationRow()),
    };

    invitations = {
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: Partial<UserInvitation>) => invitationRow(row)),
      update: jest.fn(),
      findOne: jest.fn(async () => null),
      createQueryBuilder: jest.fn(() => builder),
    };

    users = {
      findOne: jest.fn(async () => userRow()),
      update: jest.fn(),
    };

    auth = {
      login: jest.fn(async () => ({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 900,
        user: userRow({ status: 'active' }),
      })),
    };

    const manager = {
      getRepository: (entity: unknown) =>
        entity === User ? users : invitations,
    };

    const dataSource = {
      transaction: jest.fn(async (run: (m: unknown) => unknown) => run(manager)),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: getRepositoryToken(UserInvitation), useValue: invitations },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: DataSource, useValue: dataSource },
        {
          provide: invitationConfig.KEY,
          useValue: { ttl: '7d', dashboardUrl: 'http://localhost:4051' },
        },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();

    service = moduleRef.get(InvitationsService);
  });

  afterEach(() => jest.useRealTimers());

  describe('issue', () => {
    it('stores only a hash, and returns the plaintext exactly once', async () => {
      const result = await service.issue('user-1', 'admin-9');

      const saved = invitations.save.mock.calls[0][0] as UserInvitation;
      expect(saved.tokenHash).toBe(
        createHash('sha256').update(result.token).digest('hex'),
      );
      // A token this table could hand back is an account takeover for anyone
      // holding a database dump.
      expect(saved).not.toHaveProperty('token');
      expect(JSON.stringify(saved)).not.toContain(result.token);
    });

    it('revokes the outstanding invitation before minting the next', async () => {
      // `uq_user_invitations_outstanding` allows exactly one live row per user,
      // and that is the point: two valid tokens for one account means
      // cancelling one of them accomplishes nothing.
      await service.issue('user-1', 'admin-9');

      expect(invitations.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );

      const revokeCall = invitations.update.mock.invocationCallOrder[0];
      const insertCall = invitations.save.mock.invocationCallOrder[0];
      expect(revokeCall).toBeLessThan(insertCall);
    });

    it('expires the token after the configured TTL', async () => {
      await service.issue('user-1', 'admin-9');

      const saved = invitations.save.mock.calls[0][0] as UserInvitation;
      expect(saved.expiresAt).toEqual(
        new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000),
      );
    });

    it('builds an accept link the dashboard can spend', async () => {
      const result = await service.issue('user-1', 'admin-9');

      expect(result.acceptUrl).toBe(
        `http://localhost:4051/invite?token=${encodeURIComponent(result.token)}`,
      );
    });

    it('422s for an account that is already active', async () => {
      // An active account has a password and a way to change it. Minting a
      // token for one would be a password reset wearing the wrong name.
      users.findOne.mockResolvedValue(userRow({ status: 'active' }));

      await expect(service.issue('user-1', 'admin-9')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );

      expect(invitations.save).not.toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    it('asks for an outstanding, unexpired row by hash', async () => {
      await service.resolve('inv_plaintext');

      expect(invitations.findOne).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tokenHash: createHash('sha256')
            .update('inv_plaintext')
            .digest('hex'),
        }),
      });

      const [{ where }] = invitations.findOne.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      // Accepted, revoked and expired rows all have to be excluded in the
      // query — a post-filter is one refactor away from being dropped.
      expect(where).toHaveProperty('acceptedAt');
      expect(where).toHaveProperty('revokedAt');
      expect(where).toHaveProperty('expiresAt');
    });

    it('answers null for anything it cannot spend', async () => {
      // One answer for unknown, expired, revoked and accepted alike: a caller
      // who can tell them apart can enumerate who has been invited.
      invitations.findOne.mockResolvedValue(null);

      await expect(service.resolve('inv_nope')).resolves.toBeNull();
    });
  });

  describe('accept', () => {
    it('sets the first password, activates, and spends the token', async () => {
      await service.accept('invitation-1', { password: 'a-first-password' });

      const [, changes] = users.update.mock.calls[0] as [
        unknown,
        { passwordHash: string; status: string },
      ];
      expect(changes.status).toBe('active');
      await expect(
        argon2.verify(changes.passwordHash, 'a-first-password'),
      ).resolves.toBe(true);

      const spent = invitations.save.mock.calls[0][0] as UserInvitation;
      expect(spent.acceptedAt).toEqual(NOW);
    });

    it('re-reads the invitation under a row lock', async () => {
      // Two submissions of the accept form arriving together would otherwise
      // both hash a password, the second silently replacing the first.
      await service.accept('invitation-1', { password: 'a-first-password' });

      expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
    });

    it('401s on a token that was already spent', async () => {
      builder.getOne.mockResolvedValue(invitationRow({ acceptedAt: NOW }));

      await expect(
        service.accept('invitation-1', { password: 'a-first-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(users.update).not.toHaveBeenCalled();
    });

    it('401s on a token that has expired since the guard read it', async () => {
      builder.getOne.mockResolvedValue(
        invitationRow({ expiresAt: new Date(NOW.getTime() - 1) }),
      );

      await expect(
        service.accept('invitation-1', { password: 'a-first-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('422s when the account was activated by some other route', async () => {
      users.findOne.mockResolvedValue(userRow({ status: 'active' }));

      await expect(
        service.accept('invitation-1', { password: 'a-first-password' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('signs the new user in, outside the transaction', async () => {
      const result = await service.accept('invitation-1', {
        password: 'a-first-password',
      });

      expect(auth.login).toHaveBeenCalledWith(
        'sam@example.test',
        'a-first-password',
        undefined,
      );
      expect(result.accessToken).toBe('access');
      // The login path returns the entity; the response must not.
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });
});
