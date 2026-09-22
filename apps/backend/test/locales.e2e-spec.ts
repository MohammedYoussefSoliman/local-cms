import { Locale } from '@cms/database';
import request from 'supertest';
import { DataSource, In } from 'typeorm';

import {
  type TestUser,
  createTestApp,
  deleteTestUsers,
  signInAs,
} from './helpers/test-app';

import type { INestApplication } from '@nestjs/common';

/**
 * Codes this suite owns. `ar` and `en` are seeded bootstrap data and are
 * deliberately left alone (testing Rule 5).
 */
const OWNED_CODES = ['fr', 'pt-BR', 'nl'];

describe('Locales (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let admin: TestUser;
  let editor: TestUser;

  const asAdmin = () => ({ Authorization: `Bearer ${admin.accessToken}` });
  const asEditor = () => ({ Authorization: `Bearer ${editor.accessToken}` });

  async function dropOwnedLocales(): Promise<void> {
    await dataSource.getRepository(Locale).delete({ code: In(OWNED_CODES) });
  }

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    // Defensive: a previous interrupted run may have left rows behind, and
    // `uq_locales_code` would then fail the first create with a 409.
    await dropOwnedLocales();

    admin = await signInAs(app, 'admin');
    editor = await signInAs(app, 'editor');
  });

  afterAll(async () => {
    await dropOwnedLocales();
    await deleteTestUsers(app, [admin.id, editor.id]);
    await app.close();
  });

  describe('GET /locales', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/api/locales').expect(401);
    });

    it('is readable by an editor, paginated, inside the envelope', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/locales')
        .set(asEditor())
        .expect(200);

      expect(body).toMatchObject({
        statusCode: 200,
        message: null,
        data: {
          records: expect.any(Array),
          meta: { page: 1, limit: 20, total: expect.any(Number) },
        },
      });
      // The bootstrap seed is the floor.
      expect(body.data.records.map((l: { code: string }) => l.code)).toEqual(
        expect.arrayContaining(['ar', 'en']),
      );
    });

    it('searches by code, name or endonym', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/locales?search=arab')
        .set(asEditor())
        .expect(200);

      const codes = body.data.records.map((l: { code: string }) => l.code);
      expect(codes).toContain('ar');
      expect(codes).not.toContain('en');
    });
  });

  describe('POST /locales', () => {
    it('refuses an editor with 403, not 401', async () => {
      // 401 would make the dashboard log the user out for a permissions
      // problem (auth Rule 3).
      await request(app.getHttpServer())
        .post('/api/locales')
        .set(asEditor())
        .send({ code: 'fr', name: 'French', nativeName: 'Français' })
        .expect(403);
    });

    /**
     * Invariant Rule 1, end to end: adding French is one HTTP call. No
     * migration ran, no column was added, no TypeScript union changed.
     */
    it('adds a language with a single request', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/locales')
        .set(asAdmin())
        .send({ code: 'fr', name: 'French', nativeName: 'Français' })
        .expect(201);

      expect(body.data).toMatchObject({
        id: expect.any(String),
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        direction: 'ltr',
        isActive: true,
      });
    });

    it('returns 409 on a duplicate code instead of a 500', async () => {
      await request(app.getHttpServer())
        .post('/api/locales')
        .set(asAdmin())
        .send({ code: 'fr', name: 'French (again)', nativeName: 'Français' })
        .expect(409);
    });

    it('canonicalizes the code so a language has one spelling', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/locales')
        .set(asAdmin())
        .send({ code: 'pt-br', name: 'Portuguese (Brazil)', nativeName: 'Português' })
        .expect(201);

      expect(body.data.code).toBe('pt-BR');

      // And the canonical form is what collides, so `PT-BR` cannot slip in
      // past the case-sensitive unique index as a second row.
      await request(app.getHttpServer())
        .post('/api/locales')
        .set(asAdmin())
        .send({ code: 'PT-BR', name: 'Portuguese', nativeName: 'Português' })
        .expect(409);
    });

    it('rejects a code that is not a language tag', async () => {
      await request(app.getHttpServer())
        .post('/api/locales')
        .set(asAdmin())
        .send({ code: '../etc/passwd', name: 'Nope', nativeName: 'Nope' })
        .expect(400);
    });

    it('rejects a direction the CHECK constraint would reject anyway', async () => {
      await request(app.getHttpServer())
        .post('/api/locales')
        .set(asAdmin())
        .send({
          code: 'nl',
          name: 'Dutch',
          nativeName: 'Nederlands',
          direction: 'sideways',
        })
        .expect(400);
    });
  });

  describe('PATCH /locales/:id', () => {
    let frenchId: string;

    beforeAll(async () => {
      const french = await dataSource
        .getRepository(Locale)
        .findOneOrFail({ where: { code: 'fr' } });
      frenchId = french.id;
    });

    it('refuses an editor with 403', async () => {
      await request(app.getHttpServer())
        .patch(`/api/locales/${frenchId}`)
        .set(asEditor())
        .send({ isActive: false })
        .expect(403);
    });

    it('retires a language by deactivating it, since there is no DELETE', async () => {
      const { body } = await request(app.getHttpServer())
        .patch(`/api/locales/${frenchId}`)
        .set(asAdmin())
        .send({ isActive: false })
        .expect(200);

      expect(body.data).toMatchObject({ code: 'fr', isActive: false });

      await request(app.getHttpServer())
        .patch(`/api/locales/${frenchId}`)
        .set(asAdmin())
        .send({ isActive: true })
        .expect(200);
    });

    it('rejects an attempt to rename the code', async () => {
      // The code is part of `/v1/apps/:appSlug/locales/:localeCode`, which
      // client apps have compiled into their bundles. `UpdateLocaleDto` has no
      // `code`, so `forbidNonWhitelisted` turns this into a 400 rather than a
      // silently dropped field.
      const { body } = await request(app.getHttpServer())
        .patch(`/api/locales/${frenchId}`)
        .set(asAdmin())
        .send({ code: 'fra' })
        .expect(400);

      expect(body).toMatchObject({ statusCode: 400, error: expect.any(String) });
    });

    it('returns 404 for an id that does not exist', async () => {
      await request(app.getHttpServer())
        .patch('/api/locales/00000000-0000-0000-0000-000000000000')
        .set(asAdmin())
        .send({ name: 'Nobody' })
        .expect(404);
    });

    it('returns 400 for a malformed id rather than letting it reach Postgres', async () => {
      await request(app.getHttpServer())
        .patch('/api/locales/not-a-uuid')
        .set(asAdmin())
        .send({ name: 'Nobody' })
        .expect(400);
    });
  });
});
