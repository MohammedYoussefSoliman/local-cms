import { LocalizationApp, TranslationModule } from '@cms/database';
import request from 'supertest';
import { DataSource, In } from 'typeorm';

import {
  type TestUser,
  createTestApp,
  deleteTestUsers,
  signInAs,
} from './helpers/test-app';

import type { INestApplication } from '@nestjs/common';

const OWNED_APP_SLUGS = ['e2e-drafts'];
const OWNED_GLOBAL_SLUGS = ['e2e-drafts-global'];
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Drafts queue (e2e)', () => {
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

  let keyCounter = 0;
  const nextKey = (prefix: string) => `${prefix}_${(keyCounter += 1)}`;

  async function createEntry(key: string, inModule = moduleId): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post(`/api/modules/${inModule}/entries`)
      .set(asAdmin())
      .send({ key })
      .expect(201);

    return body.data.id;
  }

  /** Writes a value and returns the `translation_values` id the queue lists. */
  async function draft(
    key: string,
    localeCode: string,
    value: string,
    inModule = moduleId,
  ): Promise<string> {
    const entryId = await createEntry(key, inModule);
    const { body } = await request(app.getHttpServer())
      .put(`/api/entries/${entryId}/translations/${localeCode}`)
      .set(asEditor())
      .send({ value })
      .expect(200);

    return body.data.id;
  }

  async function listDrafts(query = '', headers = asEditor()) {
    const { body } = await request(app.getHttpServer())
      .get(`/api/apps/${appId}/drafts${query}`)
      .set(headers)
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
        name: 'E2E drafts',
        slug: 'e2e-drafts',
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
      .send({ name: 'Shared', slug: 'e2e-drafts-global' })
      .expect(201);
    globalModuleId = globalModule.data.id;
  });

  afterAll(async () => {
    await dropOwned();
    await deleteTestUsers(app, [admin.id, editor.id]);
    await app.close();
  });

  it('lists a saved value, and drops it once published', async () => {
    const valueId = await draft(nextKey('lifecycle'), 'ar', 'مسودة');

    const before = await listDrafts('?limit=100');
    expect(before.records.map((row: { id: string }) => row.id)).toContain(
      valueId,
    );

    await request(app.getHttpServer())
      .post(`/api/translations/${valueId}/publish`)
      .set(asEditor())
      .send({})
      .expect(200);

    const after = await listDrafts('?limit=100');
    expect(after.records.map((row: { id: string }) => row.id)).not.toContain(
      valueId,
    );
  });

  it('carries the locale direction from the locale row, not from a code list', async () => {
    const arabic = await draft(nextKey('dir_ar'), 'ar', 'قيمة');
    const english = await draft(nextKey('dir_en'), 'en', 'value');

    const { records } = await listDrafts('?limit=100');
    const byId = new Map(
      records.map((row: { id: string }) => [row.id, row] as const),
    );

    expect(byId.get(arabic)).toMatchObject({
      localeCode: 'ar',
      localeDirection: 'rtl',
    });
    expect(byId.get(english)).toMatchObject({
      localeCode: 'en',
      localeDirection: 'ltr',
    });
  });

  it('names the author, and the row survives when there is none', async () => {
    const valueId = await draft(nextKey('author'), 'ar', 'بواسطة');

    const { records } = await listDrafts('?limit=100');
    const row = records.find((item: { id: string }) => item.id === valueId);
    expect(row.updatedByName).toBe('E2E editor');

    // `updated_by` is ON DELETE SET NULL and the importer writes null
    // deliberately, so the join has to be LEFT or every imported draft vanishes.
    await dataSource.query(
      'UPDATE translation_values SET updated_by = NULL WHERE id = $1',
      [valueId],
    );

    const { records: after } = await listDrafts('?limit=100');
    const orphan = after.find((item: { id: string }) => item.id === valueId);
    expect(orphan).toBeDefined();
    expect(orphan.updatedByName).toBeNull();
  });

  it('excludes drafts in a global module — they are not one app to publish', async () => {
    const globalValue = await draft(
      nextKey('global'),
      'ar',
      'عالمي',
      globalModuleId,
    );

    const { records } = await listDrafts('?limit=100');
    expect(records.map((row: { id: string }) => row.id)).not.toContain(
      globalValue,
    );
  });

  it('matches the entry key on ?search=', async () => {
    const key = nextKey('searchable_needle');
    await draft(key, 'ar', 'إبرة');

    const { records } = await listDrafts('?search=searchable_needle&limit=100');
    expect(records).toHaveLength(1);
    expect(records[0].key).toBe(key);
  });

  it('reports the same total at limit=1 as at limit=100 — the badge contract', async () => {
    const page = await listDrafts('?limit=100');
    const badge = await listDrafts('?limit=1');

    expect(badge.meta.total).toBe(page.meta.total);
    expect(badge.records).toHaveLength(Math.min(1, page.meta.total));
  });

  it('answers 404 for an unknown app and 400 for a malformed id', async () => {
    await request(app.getHttpServer())
      .get(`/api/apps/${UNKNOWN_ID}/drafts`)
      .set(asEditor())
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/apps/not-a-uuid/drafts')
      .set(asEditor())
      .expect(400);
  });

  it('requires a session', async () => {
    await request(app.getHttpServer())
      .get(`/api/apps/${appId}/drafts`)
      .expect(401);
  });

  describe('publishing with expectedVersion', () => {
    it('rejects a stale one with the current value in details', async () => {
      const entryId = await createEntry(nextKey('stale'));

      const { body: first } = await request(app.getHttpServer())
        .put(`/api/entries/${entryId}/translations/ar`)
        .set(asEditor())
        .send({ value: 'الأولى' })
        .expect(200);

      // Someone else edits the row while the queue is on screen.
      await request(app.getHttpServer())
        .put(`/api/entries/${entryId}/translations/ar`)
        .set(asAdmin())
        .send({ value: 'الثانية' })
        .expect(200);

      const { body: conflict } = await request(app.getHttpServer())
        .post(`/api/translations/${first.data.id}/publish`)
        .set(asEditor())
        .send({ expectedVersion: first.data.version })
        .expect(409);

      expect(conflict.details).toMatchObject({
        currentValue: 'الثانية',
        currentStatus: 'draft',
      });
      expect(conflict.details.currentVersion).toBeGreaterThan(
        first.data.version,
      );
    });

    it('still publishes when no expectedVersion is sent — the importer path', async () => {
      const valueId = await draft(nextKey('no_version'), 'ar', 'بدون نسخة');

      await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/publish`)
        .set(asEditor())
        .send({})
        .expect(200);
    });

    it('answers 409, not 422, when someone else already published it', async () => {
      const valueId = await draft(nextKey('already'), 'ar', 'منشور');

      const { body: published } = await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/publish`)
        .set(asAdmin())
        .send({})
        .expect(200);

      // The stale version is what the editor's queue still holds.
      const { body: conflict } = await request(app.getHttpServer())
        .post(`/api/translations/${valueId}/publish`)
        .set(asEditor())
        .send({ expectedVersion: published.data.version - 1 })
        .expect(409);

      expect(conflict.details.currentStatus).toBe('published');
    });
  });
});
