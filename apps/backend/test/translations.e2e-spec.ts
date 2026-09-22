import {
  LocalizationApp,
  TranslationEntry,
  TranslationModule,
  TranslationValue,
  TranslationValueVersion,
} from '@cms/database';
import request from 'supertest';
import { DataSource, In } from 'typeorm';

import {
  type TestUser,
  createTestApp,
  deleteTestUsers,
  signInAs,
} from './helpers/test-app';

import type { INestApplication } from '@nestjs/common';

const OWNED_APP_SLUGS = ['e2e-translations', 'e2e-translations-solo'];
const OWNED_GLOBAL_SLUGS = ['e2e-translations-global'];
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Translations (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let admin: TestUser;
  let editor: TestUser;
  let appId: string;
  let moduleId: string;
  let globalModuleId: string;

  const asAdmin = () => ({ Authorization: `Bearer ${admin.accessToken}` });
  const asEditor = () => ({ Authorization: `Bearer ${editor.accessToken}` });

  async function dropOwned(): Promise<void> {
    await dataSource
      .getRepository(TranslationModule)
      .delete({ slug: In(OWNED_GLOBAL_SLUGS) });
    // The app cascades to modules → entries → values → versions.
    await dataSource
      .getRepository(LocalizationApp)
      .delete({ slug: In(OWNED_APP_SLUGS) });
  }

  async function createEntry(
    key: string,
    contentType = 'text',
    inModule = moduleId,
  ): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post(`/api/modules/${inModule}/entries`)
      .set(asAdmin())
      .send({ key, contentType })
      .expect(201);

    return body.data.id;
  }

  function upsert(
    entryId: string,
    localeCode: string,
    payload: object,
    headers = asEditor(),
  ) {
    return request(app.getHttpServer())
      .put(`/api/entries/${entryId}/translations/${localeCode}`)
      .set(headers)
      .send(payload);
  }

  /** Unique, regex-legal entry keys without leaning on the clock. */
  let keyCounter = 0;
  const nextKey = (prefix: string) => `${prefix}_${(keyCounter += 1)}`;

  async function historyOf(valueId: string) {
    const { body } = await request(app.getHttpServer())
      .get(`/api/translations/${valueId}/history?limit=100`)
      .set(asEditor())
      .expect(200);

    return body.data;
  }

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    await dropOwned();

    admin = await signInAs(app, 'admin');
    editor = await signInAs(app, 'editor');

    const { body: created } = await request(app.getHttpServer())
      .post('/api/apps')
      .set(asAdmin())
      .send({
        name: 'E2E translations',
        slug: 'e2e-translations',
        defaultLocaleCode: 'ar',
      })
      .expect(201);
    appId = created.data.id;

    await request(app.getHttpServer())
      .post(`/api/apps/${appId}/locales/en/enable`)
      .set(asAdmin())
      .expect(200);

    const { body: appModule } = await request(app.getHttpServer())
      .post(`/api/apps/${appId}/modules`)
      .set(asAdmin())
      .send({ name: 'Copy', slug: 'copy' })
      .expect(201);
    moduleId = appModule.data.id;

    const { body: globalModule } = await request(app.getHttpServer())
      .post('/api/modules/global')
      .set(asAdmin())
      .send({ name: 'Shared', slug: 'e2e-translations-global' })
      .expect(201);
    globalModuleId = globalModule.data.id;
  });

  afterAll(async () => {
    await dropOwned();
    await deleteTestUsers(app, [admin.id, editor.id]);
    await app.close();
  });

  /**
   * One un-tokened request per endpoint. A single 401 would only prove the
   * global guard is registered — it would still pass if a later change put
   * `@Public()` on one of these routes (auth Rule 2).
   */
  describe('authentication', () => {
    it.each([
      [
        'PUT /entries/:entryId/translations/:localeCode',
        (): string => `/api/entries/${UNKNOWN_ID}/translations/ar`,
        'put',
      ],
      [
        'POST /translations/:id/submit-review',
        (): string => `/api/translations/${UNKNOWN_ID}/submit-review`,
        'post',
      ],
      [
        'POST /translations/:id/publish',
        (): string => `/api/translations/${UNKNOWN_ID}/publish`,
        'post',
      ],
      [
        'POST /translations/:id/archive',
        (): string => `/api/translations/${UNKNOWN_ID}/archive`,
        'post',
      ],
      [
        'GET /translations/:id/history',
        (): string => `/api/translations/${UNKNOWN_ID}/history`,
        'get',
      ],
      [
        'POST /translations/:id/rollback/:version',
        (): string => `/api/translations/${UNKNOWN_ID}/rollback/1`,
        'post',
      ],
    ] as const)('rejects %s without a token', async (_name, path, method) => {
      await request(app.getHttpServer())[method](path()).expect(401);
    });
  });

  describe('PUT /entries/:entryId/translations/:localeCode', () => {
    let entryId: string;

    beforeAll(async () => {
      entryId = await createEntry('checkout.title');
    });

    it('creates the first value as a draft, written by an editor', async () => {
      const { body } = await upsert(entryId, 'ar', {
        value: 'إتمام الشراء',
      }).expect(200);

      expect(body.data).toMatchObject({
        entryId,
        localeCode: 'ar',
        value: 'إتمام الشراء',
        status: 'draft',
        version: 1,
        publishedAt: null,
      });
    });

    it('writes exactly one history row per write', async () => {
      const id = (await upsert(entryId, 'en', { value: 'Checkout' })).body.data
        .id;

      await upsert(entryId, 'en', { value: 'Check out' }).expect(200);
      await upsert(entryId, 'en', { value: 'Pay now' }).expect(200);

      const history = await historyOf(id);
      expect(history.meta.total).toBe(3);
      expect(history.records.map((row: { version: number }) => row.version)).toEqual([
        3, 2, 1,
      ]);
    });

    it('404s for a locale that does not exist', async () => {
      await upsert(entryId, 'zz', { value: 'x' }).expect(404);
    });

    it('422s for a locale the app does not serve', async () => {
      // A second app that only ever enabled its default `ar`. `en` is a real,
      // active locale — it is this app that does not serve it, which is the
      // distinction between this 422 and the 404 above.
      const { body: solo } = await request(app.getHttpServer())
        .post('/api/apps')
        .set(asAdmin())
        .send({
          name: 'E2E translations solo',
          slug: 'e2e-translations-solo',
          defaultLocaleCode: 'ar',
        })
        .expect(201);

      const { body: soloModule } = await request(app.getHttpServer())
        .post(`/api/apps/${solo.data.id}/modules`)
        .set(asAdmin())
        .send({ name: 'Copy', slug: 'copy' })
        .expect(201);

      const soloEntry = await createEntry(
        'solo.key',
        'text',
        soloModule.data.id,
      );

      await upsert(soloEntry, 'ar', { value: 'مسموح' }).expect(200);
      await upsert(soloEntry, 'en', { value: 'not allowed' }).expect(422);
    });

    it('404s for an entry that does not exist', async () => {
      await upsert(UNKNOWN_ID, 'ar', { value: 'x' }).expect(404);
    });

    it('400s on an empty value and on an unknown field', async () => {
      await upsert(entryId, 'ar', { value: '' }).expect(400);
      await upsert(entryId, 'ar', { value: 'x', status: 'published' }).expect(
        400,
      );
    });
  });

  describe('optimistic concurrency', () => {
    let valueId: string;

    beforeAll(async () => {
      const entryId = await createEntry('cart.empty');
      valueId = (await upsert(entryId, 'ar', { value: 'السلة فارغة' })).body.data
        .id;
    });

    it('409s a stale expectedVersion and returns the current value', async () => {
      await upsert2(valueId, 'موقع آخر');

      const response = await request(app.getHttpServer())
        .put(`/api/entries/${await entryIdOf(valueId)}/translations/ar`)
        .set(asEditor())
        .send({ value: 'كتابتي', expectedVersion: 1 })
        .expect(409);

      // Invariant Rule 7: the rejection carries what landed, so the dashboard
      // can show a diff instead of a dead end.
      expect(response.body.details).toMatchObject({
        currentValue: 'موقع آخر',
        currentVersion: 2,
      });
    });

    it('never lets two writes at the same version both win', async () => {
      const entryId = await entryIdOf(valueId);
      const current = await versionOf(valueId);

      const [first, second] = await Promise.all([
        upsert(entryId, 'ar', { value: 'أ', expectedVersion: current }),
        upsert(entryId, 'ar', { value: 'ب', expectedVersion: current }),
      ]);

      // The row lock serializes them; the loser reads the version the winner
      // just wrote.
      expect([first.status, second.status].sort()).toEqual([200, 409]);
    });

    async function upsert2(id: string, value: string) {
      return upsert(await entryIdOf(id), 'ar', { value }).expect(200);
    }

    async function entryIdOf(id: string): Promise<string> {
      const value = await dataSource
        .getRepository(TranslationValue)
        .findOneOrFail({ where: { id } });
      return value.entryId;
    }

    async function versionOf(id: string): Promise<number> {
      const value = await dataSource
        .getRepository(TranslationValue)
        .findOneOrFail({ where: { id } });
      return value.version;
    }
  });

  describe('status transitions', () => {
    let valueId: string;

    beforeEach(async () => {
      const entryId = await createEntry(nextKey('status'));
      valueId = (await upsert(entryId, 'ar', { value: 'نص' })).body.data.id;
    });

    it('lets an editor submit for review and then publish', async () => {
      await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/submit-review`)
        .set(asEditor())
        .send({ changeNote: 'ready' })
        .expect(200)
        .expect(({ body }) => expect(body.data.status).toBe('in_review'));

      const { body } = await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/publish`)
        .set(asEditor())
        .expect(200);

      expect(body.data.status).toBe('published');
      expect(body.data.publishedAt).not.toBeNull();
    });

    it('keeps a published value published when it is edited', async () => {
      await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/publish`)
        .set(asEditor())
        .expect(200);

      const entryId = (
        await dataSource
          .getRepository(TranslationValue)
          .findOneOrFail({ where: { id: valueId } })
      ).entryId;

      // Demoting to draft here would drop the key out of every live bundle —
      // a content regression dressed up as caution.
      const { body } = await upsert(entryId, 'ar', { value: 'نص محدث' }).expect(
        200,
      );

      expect(body.data.status).toBe('published');
      expect(body.data.publishedAt).not.toBeNull();
    });

    it('422s a transition the state machine does not allow', async () => {
      await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/publish`)
        .set(asEditor())
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/submit-review`)
        .set(asEditor())
        .expect(422);
    });

    it('gives an editor 403 on archive, and an admin 200', async () => {
      await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/publish`)
        .set(asEditor())
        .expect(200);

      // Archiving is the one transition that removes copy from live apps.
      await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/archive`)
        .set(asEditor())
        .expect(403);

      const { body } = await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/archive`)
        .set(asAdmin())
        .expect(200);

      expect(body.data.status).toBe('archived');
    });

    it('lets an archived value be published again', async () => {
      await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/publish`)
        .set(asEditor())
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/archive`)
        .set(asAdmin())
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/publish`)
        .set(asEditor())
        .expect(200)
        .expect(({ body }) => expect(body.data.status).toBe('published'));
    });

    it('404s for a value that does not exist', async () => {
      await request(app.getHttpServer())
        .post(`/api/translations/${UNKNOWN_ID}/publish`)
        .set(asEditor())
        .expect(404);
    });
  });

  describe('history and rollback', () => {
    let valueId: string;

    beforeAll(async () => {
      const entryId = await createEntry('rollback.target');
      valueId = (await upsert(entryId, 'ar', { value: 'v1' })).body.data.id;
      await upsert(entryId, 'ar', { value: 'v2' }).expect(200);
      await upsert(entryId, 'ar', { value: 'v3' }).expect(200);
      await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/publish`)
        .set(asEditor())
        .expect(200);
    });

    it('rolls back forward: v2 becomes v5, and v2 is still there', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/rollback/2`)
        .set(asEditor())
        .expect(200);

      expect(body.data).toMatchObject({ value: 'v2', version: 5 });

      const history = await historyOf(valueId);
      const versions = history.records.map(
        (row: { version: number; value: string }) => [row.version, row.value],
      );

      // Nothing was removed (invariant Rule 6) — the rollback is itself a row.
      expect(versions).toEqual([
        [5, 'v2'],
        [4, 'v3'],
        [3, 'v3'],
        [2, 'v2'],
        [1, 'v1'],
      ]);
      expect(history.records[0].changeNote).toBe('Rollback to v2');
    });

    it('does not change whether the value is live', async () => {
      const { body } = await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/rollback/1`)
        .set(asEditor())
        .expect(200);

      expect(body.data.status).toBe('published');
    });

    it('404s for a version that was never written', async () => {
      await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/rollback/99`)
        .set(asEditor())
        .expect(404);
    });

    it('paginates the history, newest first', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/api/translations/${valueId}/history?page=1&limit=2`)
        .set(asEditor())
        .expect(200);

      expect(body.data.records).toHaveLength(2);
      expect(body.data.records[0].version).toBeGreaterThan(
        body.data.records[1].version,
      );
    });
  });

  describe('content validation', () => {
    it('422s malformed ICU and ICU whose placeholders differ', async () => {
      const entryId = await createEntry('icu.greeting', 'icu_message');

      await upsert(entryId, 'ar', { value: 'مرحبا {name' }).expect(422);

      // `ar` is the app's default, so it is the reference the others match.
      await upsert(entryId, 'ar', { value: 'مرحبا {name}' }).expect(200);
      await upsert(entryId, 'en', { value: 'Hello' }).expect(422);
      await upsert(entryId, 'en', { value: 'Hello {name} {title}' }).expect(422);
      await upsert(entryId, 'en', { value: 'Hello {name}' }).expect(200);
    });

    it('sanitizes rich text rather than storing what was sent', async () => {
      const entryId = await createEntry('rich.banner', 'rich_text');

      const { body } = await upsert(entryId, 'ar', {
        value: '<p onclick="steal()">مرحبا<script>steal()</script></p>',
      }).expect(200);

      expect(body.data.value).toBe('<p>مرحبا</p>');
    });

    it('422s rich text that is entirely disallowed markup', async () => {
      const entryId = await createEntry('rich.hostile', 'rich_text');

      await upsert(entryId, 'ar', {
        value: '<script>steal()</script>',
      }).expect(422);
    });

    it('lets a global module use any active language', async () => {
      const entryId = await createEntry('shared.ok', 'text', globalModuleId);

      await upsert(entryId, 'en', { value: 'OK' }).expect(200);
      await upsert(entryId, 'ar', { value: 'حسنا' }).expect(200);
    });
  });

  describe('the value and its history are written together', () => {
    it('leaves neither behind when the transaction fails', async () => {
      const entryId = await createEntry('atomic.check');
      const locale = await dataSource.query<{ id: string }[]>(
        `SELECT id FROM locales WHERE code = 'ar'`,
      );

      /**
       * The two writes the service pairs, with a failure between them. This is
       * the crash in "a crash between the value write and the history write
       * leaves neither" — asserted against the real database, because the
       * guarantee is the transaction's, not the service's.
       */
      await expect(
        dataSource.transaction(async (manager) => {
          const value = await manager.save(
            manager.create(TranslationValue, {
              entryId,
              localeId: locale[0].id,
              value: 'half a write',
              status: 'draft',
              updatedBy: admin.id,
            }),
          );

          throw new Error(`crashed before the history row for ${value.id}`);
        }),
      ).rejects.toThrow('crashed before');

      expect(
        await dataSource
          .getRepository(TranslationValue)
          .count({ where: { entryId } }),
      ).toBe(0);
    });

    it('has a history row for every value it wrote', async () => {
      const entryId = await createEntry('audit.parity');
      const { body } = await upsert(entryId, 'ar', { value: 'مدقق' }).expect(
        200,
      );

      expect(
        await dataSource
          .getRepository(TranslationValueVersion)
          .count({ where: { translationValueId: body.data.id } }),
      ).toBe(1);
    });
  });

  describe('entry deletion', () => {
    it('cascades to the values and their history', async () => {
      const entryId = await createEntry('doomed.key');
      const valueId = (await upsert(entryId, 'ar', { value: 'مؤقت' })).body.data
        .id;

      await request(app.getHttpServer())
        .delete(`/api/entries/${entryId}`)
        .set(asAdmin())
        .expect(204);

      expect(
        await dataSource
          .getRepository(TranslationValueVersion)
          .count({ where: { translationValueId: valueId } }),
      ).toBe(0);
      expect(
        await dataSource.getRepository(TranslationEntry).count({
          where: { id: entryId },
        }),
      ).toBe(0);
    });
  });
});
