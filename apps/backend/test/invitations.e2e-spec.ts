import { User, UserInvitation } from '@cms/database';
import request from 'supertest';
import { DataSource, ILike } from 'typeorm';

import {
  type TestUser,
  createTestApp,
  deleteTestUsers,
  signInAs,
} from './helpers/test-app';

import type { INestApplication } from '@nestjs/common';

const EMAIL_PREFIX = 'e2e-invite';
const FIRST_PASSWORD = 'a-first-password-12';

type Issued = { token: string; acceptUrl: string; expiresAt: string };

describe('Invitations (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let admin: TestUser;
  let editor: TestUser;

  const asAdmin = () => ({ Authorization: `Bearer ${admin.accessToken}` });

  /** One `POST /users`, which mints the account and its first token together. */
  async function invite(
    suffix: string,
    role: 'admin' | 'editor' = 'editor',
  ): Promise<{ userId: string; email: string; invitation: Issued }> {
    const email = `${EMAIL_PREFIX}-${suffix}@example.test`;

    const { body } = await request(app.getHttpServer())
      .post('/api/users')
      .set(asAdmin())
      .send({ email, name: `Invitee ${suffix}`, role })
      .expect(201);

    return { userId: body.data.id, email, invitation: body.data.invitation };
  }

  async function dropInvitees(): Promise<void> {
    // `user_invitations.user_id` is ON DELETE CASCADE, so the tokens go too.
    await dataSource
      .getRepository(User)
      .delete({ email: ILike(`${EMAIL_PREFIX}%`) });
  }

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    await dropInvitees();

    admin = await signInAs(app, 'admin');
    editor = await signInAs(app, 'editor');
  });

  afterAll(async () => {
    await dropInvitees();
    await deleteTestUsers(app, [admin.id, editor.id]);
    await app.close();
  });

  describe('issuing', () => {
    it('returns the token exactly once, and never stores the plaintext', async () => {
      const { userId, invitation } = await invite('once');

      expect(invitation.token).toMatch(/^inv_/);
      expect(invitation.acceptUrl).toContain(
        `token=${encodeURIComponent(invitation.token)}`,
      );

      const stored = await dataSource
        .getRepository(UserInvitation)
        .findOneOrFail({ where: { userId } });
      expect(stored.tokenHash).not.toContain(invitation.token);

      // Nothing hands it back afterwards — not the list, not the detail.
      const { body } = await request(app.getHttpServer())
        .get(`/api/users/${userId}/invitations`)
        .set(asAdmin())
        .expect(200);

      expect(body.data).toMatchObject({ userId });
      expect(JSON.stringify(body)).not.toContain(invitation.token);
    });

    it('revokes the previous token when a new one is issued', async () => {
      const { userId, invitation } = await invite('resend');

      const { body } = await request(app.getHttpServer())
        .post(`/api/users/${userId}/invitations`)
        .set(asAdmin())
        .expect(201);

      const reissued: Issued = body.data;
      expect(reissued.token).not.toBe(invitation.token);

      // The old link is dead the moment a new one exists — otherwise
      // re-sending an invite would leave two ways in and cancelling one of
      // them would accomplish nothing.
      await request(app.getHttpServer())
        .get('/api/invitations/me')
        .set('X-Invite-Token', invitation.token)
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/invitations/me')
        .set('X-Invite-Token', reissued.token)
        .expect(200);
    });

    it('lets an admin cancel an invitation without touching the account', async () => {
      const { userId, invitation } = await invite('cancelled');

      await request(app.getHttpServer())
        .delete(`/api/users/${userId}/invitations`)
        .set(asAdmin())
        .expect(204);

      await request(app.getHttpServer())
        .get('/api/invitations/me')
        .set('X-Invite-Token', invitation.token)
        .expect(401);

      const { body } = await request(app.getHttpServer())
        .get(`/api/users/${userId}`)
        .set(asAdmin())
        .expect(200);
      expect(body.data.status).toBe('invited');
    });

    it('403s an editor, and 422s an account that is already active', async () => {
      await request(app.getHttpServer())
        .post(`/api/users/${admin.id}/invitations`)
        .set({ Authorization: `Bearer ${editor.accessToken}` })
        .expect(403);

      // An active account has a password and a way to change it; a token for
      // one would be a password reset wearing the wrong name.
      await request(app.getHttpServer())
        .post(`/api/users/${admin.id}/invitations`)
        .set(asAdmin())
        .expect(422);
    });
  });

  describe('the credential itself', () => {
    it('401s with no token, a malformed token, and an unknown token', async () => {
      await request(app.getHttpServer()).get('/api/invitations/me').expect(401);

      await request(app.getHttpServer())
        .get('/api/invitations/me')
        .set('X-Invite-Token', 'not-a-token')
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/invitations/accept')
        .set('X-Invite-Token', 'inv_nope')
        .send({ password: FIRST_PASSWORD })
        .expect(401);
    });

    it('does not accept a CMS bearer token in its place', async () => {
      // These routes authenticate differently, not more loosely.
      await request(app.getHttpServer())
        .get('/api/invitations/me')
        .set(asAdmin())
        .expect(401);
    });

    it('401s an expired token', async () => {
      const { userId, invitation } = await invite('expired');

      await dataSource
        .getRepository(UserInvitation)
        .update({ userId }, { expiresAt: new Date(Date.now() - 1000) });

      await request(app.getHttpServer())
        .get('/api/invitations/me')
        .set('X-Invite-Token', invitation.token)
        .expect(401);
    });
  });

  describe('accepting', () => {
    it('walks the whole flow: preview, set a password, land signed in', async () => {
      const { userId, email, invitation } = await invite('accepted', 'admin');

      const preview = await request(app.getHttpServer())
        .get('/api/invitations/me')
        .set('X-Invite-Token', invitation.token)
        .expect(200);

      // Enough to render "you were invited as an admin", and nothing more.
      expect(preview.body.data).toMatchObject({
        email,
        name: 'Invitee accepted',
        role: 'admin',
      });
      expect(preview.body.data).not.toHaveProperty('id');
      expect(preview.body.data).not.toHaveProperty('status');

      const { body } = await request(app.getHttpServer())
        .post('/api/invitations/accept')
        .set('X-Invite-Token', invitation.token)
        .send({ password: FIRST_PASSWORD })
        .expect(200);

      // Signed in on the spot: the alternative is a redirect to a login form
      // that spends one of the five logins a minute the throttler allows.
      expect(body.data).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: { id: userId, status: 'active', role: 'admin' },
      });
      expect(JSON.stringify(body)).not.toContain('passwordHash');

      // The token it was issued with is the session it now holds.
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set({ Authorization: `Bearer ${body.data.accessToken}` })
        .expect(200);
    });

    it('spends the token — a second accept is a 401', async () => {
      const { invitation } = await invite('replay');

      await request(app.getHttpServer())
        .post('/api/invitations/accept')
        .set('X-Invite-Token', invitation.token)
        .send({ password: FIRST_PASSWORD })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/invitations/accept')
        .set('X-Invite-Token', invitation.token)
        .send({ password: 'a-different-password' })
        .expect(401);
    });

    it('400s a password below the minimum, and changes nothing', async () => {
      const { userId, invitation } = await invite('weak');

      await request(app.getHttpServer())
        .post('/api/invitations/accept')
        .set('X-Invite-Token', invitation.token)
        .send({ password: 'short' })
        .expect(400);

      const { body } = await request(app.getHttpServer())
        .get(`/api/users/${userId}`)
        .set(asAdmin())
        .expect(200);
      expect(body.data.status).toBe('invited');

      // And the token survives a rejected attempt, or a typo would burn it.
      await request(app.getHttpServer())
        .get('/api/invitations/me')
        .set('X-Invite-Token', invitation.token)
        .expect(200);
    });
  });
});
