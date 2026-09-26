import { RefreshSession } from '@cms/database';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { type JwtConfig, jwtConfig } from '../../config/configuration';
import { UsersService } from '../users/users.service';

import { AuthService } from './auth.service';

const JWT: JwtConfig = {
  accessSecret: 'a'.repeat(32),
  refreshSecret: 'b'.repeat(32),
  accessTtl: '15m',
  refreshTtl: '30d',
  issuer: 'local-cms',
  audience: 'local-cms-dashboard',
};

describe('AuthService', () => {
  let service: AuthService;
  let users: { findByEmailWithPassword: jest.Mock; findById: jest.Mock };
  let sessions: Record<string, jest.Mock>;

  beforeEach(async () => {
    users = { findByEmailWithPassword: jest.fn(), findById: jest.fn() };
    sessions = {
      findOne: jest.fn(),
      save: jest.fn(async (row: unknown) => row),
      create: jest.fn((row: unknown) => row),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn(async () => 'token') },
        },
        { provide: jwtConfig.KEY, useValue: JWT },
        { provide: getRepositoryToken(RefreshSession), useValue: sessions },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('rejects an unknown email without revealing that it is unknown', async () => {
    users.findByEmailWithPassword.mockResolvedValue(null);

    await expect(
      service.login('nobody@example.com', 'password123'),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password.'));
  });

  it('revokes every session when a already-used refresh token is replayed', async () => {
    sessions.findOne.mockResolvedValue({
      userId: 'user-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      user: { status: 'active' },
    });

    await expect(service.refresh('stolen-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(sessions.update).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
  });

  it('scopes a logout to the caller, so it cannot revoke a session owned by another user', async () => {
    await service.logout('user-1', 'some-refresh-token');

    // The userId in the criteria is the whole point: without it, possession of
    // any refresh token is enough to end that session, whoever presents it.
    expect(sessions.update).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
  });
});
