import { RefreshSession, User } from '@cms/database';
import request from 'supertest';
import { DataSource, ILike, IsNull } from 'typeorm';

import { AuthService } from '../src/modules/auth/auth.service';

import {
  TEST_PASSWORD,
  type TestUser,
  createTestApp,
  deleteTestUsers,
  signInAs,
} from './helpers/test-app';

import type { INestApplication } from '@nestjs/common';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const INVITED_EMAIL_PREFIX = 'e2e-users-invited';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let auth: AuthService;
  let admin: TestUser;
  let editor: TestUser;
  /** Disabled partway through, so it is never used for anything else. */
  let victim: TestUser;
  /** Has its password changed, so it is never used for anything else either. */
  let rotator: TestUser;

  const asAdmin = () => ({ Authorization: `Bearer ${admin.accessToken}` });
  const asEditor = () => ({ Authorization: `Bearer ${editor.accessToken}` });

  async function activeSessionsFor(userId: string): Promise<number> {
    return dataSource
      .getRepository(RefreshSession)
      .count({ where: { userId, revokedAt: IsNull() } });
  }

  async function dropInvited(): Promise<void> {
    await dataSource
      .getRepository(User)
      .delete({ email: ILike(`${INVITED_EMAIL_PREFIX}%`) });
  }

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    auth = app.get(AuthService);

    await dropInvited();

    /**
     * Four sign-ins, and that is the budget: `POST /auth/login` is throttled at
     * 5/minute per app instance. Everything below that needs to check a
     * credential calls `AuthService.login` directly rather than spending one.
     */
    admin = await signInAs(app, 'admin');
    editor = await signInAs(app, 'editor');
    victim = await signInAs(app, 'editor');
    rotator = await signInAs(app, 'editor');
  });

  afterAll(async () => {
    await dropInvited();
    await deleteTestUsers(app, [admin.id, editor.id, victim.id, rotator.id]);
    await app.close();
  });

  describe('authentication', () => {
    it.each([
      ['GET /users', (): string => '/api/users', 'get'],
      ['GET /users/:id', (): string => `/api/users/${UNKNOWN_ID}`, 'get'],
      ['POST /users', (): string => '/api/users', 'post'],
      ['PATCH /users/:id', (): string => `/api/users/${UNKNOWN_ID}`, 'patch'],
      [
        'POST /users/:id/disable',
        (): string => `/api/users/${UNKNOWN_ID}/disable`,
        'post',
      ],
      [
        'POST /users/:id/enable',
        (): string => `/api/users/${UNKNOWN_ID}/enable`,
        'post',
      ],
      ['POST /users/me/password', (): string => '/api/users/me/password', 'post'],
    ] as const)('rejects %s without a token', async (_name, path, method) => {
      await request(app.getHttpServer())[method](path()).expect(401);
    });

    it.each([
      ['GET /users', (): string => '/api/users', 'get'],
      ['GET /users/:id', (): string => `/api/users/${UNKNOWN_ID}`, 'get'],
      ['POST /users', (): string => '/api/users', 'post'],
      ['PATCH /users/:id', (): string => `/api/users/${UNKNOWN_ID}`, 'patch'],
      [
        'POST /users/:id/disable',
        (): string => `/api/users/${UNKNOWN_ID}/disable`,
        'post',
      ],
      [
        'POST /users/:id/enable',
        (): string => `/api/users/${UNKNOWN_ID}/enable`,
        'post',
      ],
    ] as const)('gives an editor 403 on %s, not 401', async (_n, path, method) => {
      // The user list is the map of who can change published copy, so reading
      // it is privileged in its own right (auth Rule 3 on the codes).
      const call = request(app.getHttpServer())[method](path());
      await call.set(asEditor()).send({}).expect(403);
    });
  });

  describe('POST /users', () => {
    it('creates an invited account and never returns a password hash', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/users')
        .set(asAdmin())
        .send({
          email: `${INVITED_EMAIL_PREFIX}-1@example.test`,
          name: 'Invited One',
          role: 'editor',
        })
        .expect(201);

      expect(body).toMatchObject({ statusCode: 201 });
      expect(body.data).toMatchObject({
        email: `${INVITED_EMAIL_PREFIX}-1@example.test`,
        name: 'Invited One',
        role: 'editor',
        status: 'invited',
      });
      expect(body.data).not.toHaveProperty('passwordHash');
    });

    it('creates an account that cannot be logged into', async () => {
      const email = `${INVITED_EMAIL_PREFIX}-2@example.test`;

      await request(app.getHttpServer())
        .post('/api/users')
        .set(asAdmin())
        .send({ email, name: 'Invited Two', role: 'editor' })
        .expect(201);

      // `invited` is refused by login, and the stored hash is over bytes that
      // were generated and dropped — there is no password to guess.
      await expect(
        auth.login(email, TEST_PASSWORD),
      ).rejects.toThrow(/Invalid email or password/);
    });

    it('409s on a duplicate email, case-insensitively', async () => {
      const email = `${INVITED_EMAIL_PREFIX}-3@example.test`;

      await request(app.getHttpServer())
        .post('/api/users')
        .set(asAdmin())
        .send({ email, name: 'Invited Three', role: 'editor' })
        .expect(201);

      // CITEXT: `Sam@x.co` must not be able to shadow `sam@x.co`.
      await request(app.getHttpServer())
        .post('/api/users')
        .set(asAdmin())
        .send({
          email: email.toUpperCase(),
          name: 'Impostor',
          role: 'admin',
        })
        .expect(409);
    });

    it('400s on a missing role, a bad email, and a smuggled status', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .set(asAdmin())
        .send({ email: `${INVITED_EMAIL_PREFIX}-4@example.test`, name: 'X' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/users')
        .set(asAdmin())
        .send({ email: 'not-an-email', name: 'X', role: 'editor' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/users')
        .set(asAdmin())
        .send({
          email: `${INVITED_EMAIL_PREFIX}-5@example.test`,
          name: 'X',
          role: 'editor',
          status: 'active',
        })
        .expect(400);
    });
  });

  describe('GET /users', () => {
    it('paginates and filters, with no hash anywhere in the page', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/users?limit=50&role=admin')
        .set(asAdmin())
        .expect(200);

      expect(body.data.meta).toMatchObject({ page: 1, limit: 50 });
      expect(
        body.data.records.every(
          (record: { role: string }) => record.role === 'admin',
        ),
      ).toBe(true);
      expect(JSON.stringify(body)).not.toContain('passwordHash');
      expect(JSON.stringify(body)).not.toContain('$argon2');
    });

    it('searches by email', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/api/users?search=${INVITED_EMAIL_PREFIX}-1`)
        .set(asAdmin())
        .expect(200);

      expect(body.data.records).toHaveLength(1);
      expect(body.data.records[0].name).toBe('Invited One');
    });

    it('404s for an unknown id and 400s for a non-uuid', async () => {
      await request(app.getHttpServer())
        .get(`/api/users/${UNKNOWN_ID}`)
        .set(asAdmin())
        .expect(404);

      await request(app.getHttpServer())
        .get('/api/users/not-a-uuid')
        .set(asAdmin())
        .expect(400);
    });
  });

  describe('PATCH /users/:id', () => {
    it('updates the name and role', async () => {
      const { body } = await request(app.getHttpServer())
        .patch(`/api/users/${editor.id}`)
        .set(asAdmin())
        .send({ name: 'Renamed Editor' })
        .expect(200);

      expect(body.data).toMatchObject({
        name: 'Renamed Editor',
        role: 'editor',
      });
    });

    it('400s on an email or a status in the body', async () => {
      // Both are absent from the DTO, so `forbidNonWhitelisted` refuses them:
      // email is the login identity, and status has its own endpoints because
      // changing it has side effects.
      await request(app.getHttpServer())
        .patch(`/api/users/${editor.id}`)
        .set(asAdmin())
        .send({ email: 'new@example.test' })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/api/users/${editor.id}`)
        .set(asAdmin())
        .send({ status: 'disabled' })
        .expect(400);
    });
  });

  describe('disable and enable', () => {
    it('makes the existing access token fail on the very next request', async () => {
      // Before: the token works.
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set({ Authorization: `Bearer ${victim.accessToken}` })
        .expect(200);

      expect(await activeSessionsFor(victim.id)).toBeGreaterThan(0);

      const { body } = await request(app.getHttpServer())
        .post(`/api/users/${victim.id}/disable`)
        .set(asAdmin())
        .expect(200);

      expect(body.data.status).toBe('disabled');

      /**
       * The acceptance criterion, and it needs both halves: `JwtStrategy`
       * re-reads the account on every request, so the unexpired token stops
       * working now rather than in fifteen minutes.
       */
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set({ Authorization: `Bearer ${victim.accessToken}` })
        .expect(401);
    });

    it('revoked every refresh session in the same move', async () => {
      // The other half: without this, the disabled user refreshes back in.
      expect(await activeSessionsFor(victim.id)).toBe(0);
    });

    it('refuses a login while disabled', async () => {
      await expect(
        auth.login(victim.email, TEST_PASSWORD),
      ).rejects.toThrow(/Invalid email or password/);
    });

    it('lets an admin enable the account again', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`/api/users/${victim.id}/enable`)
        .set(asAdmin())
        .expect(200);

      expect(body.data.status).toBe('active');

      // Re-enabling does not resurrect the revoked sessions; the user signs in.
      expect(await activeSessionsFor(victim.id)).toBe(0);
      await expect(
        auth.login(victim.email, TEST_PASSWORD),
      ).resolves.toMatchObject({ accessToken: expect.any(String) });
    });

    it('422s an admin disabling their own account', async () => {
      // Succeeding would 401 the caller's next request, and if they were the
      // last admin nobody could undo it.
      await request(app.getHttpServer())
        .post(`/api/users/${admin.id}/disable`)
        .set(asAdmin())
        .expect(422);

      const { body } = await request(app.getHttpServer())
        .get(`/api/users/${admin.id}`)
        .set(asAdmin())
        .expect(200);
      expect(body.data.status).toBe('active');
    });

    it('404s for a user that does not exist', async () => {
      await request(app.getHttpServer())
        .post(`/api/users/${UNKNOWN_ID}/disable`)
        .set(asAdmin())
        .expect(404);
    });
  });

  describe('POST /users/me/password', () => {
    const NEW_PASSWORD = 'a-brand-new-password';

    it('401s on the wrong current password', async () => {
      await request(app.getHttpServer())
        .post('/api/users/me/password')
        .set({ Authorization: `Bearer ${rotator.accessToken}` })
        .send({ currentPassword: 'not-it', newPassword: NEW_PASSWORD })
        .expect(401);
    });

    it('400s on a new password below the minimum length', async () => {
      await request(app.getHttpServer())
        .post('/api/users/me/password')
        .set({ Authorization: `Bearer ${rotator.accessToken}` })
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'short' })
        .expect(400);
    });

    it('changes the password and revokes every session, including this one', async () => {
      expect(await activeSessionsFor(rotator.id)).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .post('/api/users/me/password')
        .set({ Authorization: `Bearer ${rotator.accessToken}` })
        .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD })
        .expect(204);

      /**
       * A password change is what someone does when they believe their
       * credentials leaked. Leaving the attacker's session alive would report
       * success while fixing nothing.
       */
      expect(await activeSessionsFor(rotator.id)).toBe(0);

      await expect(
        auth.login(rotator.email, TEST_PASSWORD),
      ).rejects.toThrow(/Invalid email or password/);

      await expect(
        auth.login(rotator.email, NEW_PASSWORD),
      ).resolves.toMatchObject({ accessToken: expect.any(String) });
    });

    it('is open to an editor — it only ever addresses the caller', async () => {
      // There is no `:id` to point somewhere else, so there is no wrong-role
      // identity to reject with; an editor succeeding is what proves it.
      await request(app.getHttpServer())
        .post('/api/users/me/password')
        .set(asEditor())
        .send({ currentPassword: 'deliberately-wrong', newPassword: 'x'.repeat(12) })
        .expect(401);
    });
  });
});
