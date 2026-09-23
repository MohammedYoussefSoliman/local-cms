import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { LocalizationApp } from '@cms/database';
import { AppDataSource } from '@cms/database/src/data-source';
import { runPipeline } from '@cms/importer';
import request from 'supertest';
import { DataSource } from 'typeorm';

import {
  type TestUser,
  createTestApp,
  deleteTestUsers,
  signInAs,
} from './helpers/test-app';

import type { INestApplication } from '@nestjs/common';

const APP_SLUG = 'e2e-import-runtime';

/**
 * A pilot module in the shape the source monorepo ships: nested objects, one
 * file per language, English slightly ahead of Arabic.
 */
const SOURCE: Record<string, unknown> = {
  'en.json': {
    summary: { title: 'Order summary', total: 'Total' },
    cta: 'Pay now',
  },
  'ar.json': {
    summary: { title: 'ملخص الطلب', total: 'الإجمالي' },
  },
};

/**
 * What a client application must receive afterwards, written out by hand rather
 * than derived from `SOURCE` with the importer's own flattener — a check that
 * reuses the code under test only proves it is self-consistent.
 */
const EXPECTED_EN = {
  checkout: {
    'summary.title': 'Order summary',
    'summary.total': 'Total',
    cta: 'Pay now',
  },
};

const EXPECTED_AR = {
  checkout: {
    'summary.title': 'ملخص الطلب',
    'summary.total': 'الإجمالي',
    // `cta` is absent from the Arabic source and the app configures no
    // fallback, so RESOLUTION_ORDER step 4 applies: the key is simply missing
    // and the client renders the key itself.
  },
};

/**
 * The last step of the hydration plan (arch doc §11): compare the CMS's own
 * output against the JSON that was imported. Everything else in the importer's
 * suite checks rows; this checks what a client application actually receives,
 * which is the only thing the migration is judged on.
 */
describe('Imported content over the runtime API (e2e)', () => {
  let app: INestApplication;
  let admin: TestUser;
  let source: string;
  let reports: string;
  let apiKey: string;
  let appId: string;

  beforeAll(async () => {
    source = mkdtempSync(join(tmpdir(), 'cms-import-runtime-'));
    reports = mkdtempSync(join(tmpdir(), 'cms-import-runtime-report-'));

    for (const [name, tree] of Object.entries(SOURCE)) {
      const path = resolve(
        source,
        `apps/${APP_SLUG}/src/modules/Checkout/locales/${name}`,
      );
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(tree), 'utf8');
    }

    await AppDataSource.initialize();

    try {
      await runPipeline(
        {
          source,
          pattern: 'apps/<app>/src/modules/<module>/locales/<locale>.json',
          reportPath: join(reports, 'report.json'),
          defaultLocaleCode: 'en',
          status: 'published',
          commit: true,
          overwrite: false,
          strict: false,
        },
        AppDataSource,
      );
    } finally {
      await AppDataSource.destroy();
    }

    app = await createTestApp();
    admin = await signInAs(app, 'admin');

    const { body: found } = await request(app.getHttpServer())
      .get('/api/apps')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .query({ search: APP_SLUG })
      .expect(200);

    appId = found.data.records.find(
      (record: { slug: string }) => record.slug === APP_SLUG,
    ).id;

    const { body: key } = await request(app.getHttpServer())
      .post(`/api/apps/${appId}/api-keys`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'import verification' })
      .expect(201);

    apiKey = key.data.key;
  });

  afterAll(async () => {
    // Cascades to the module, entries, values and history rows the import
    // created (testing Rule 5).
    await app
      .get(DataSource)
      .getRepository(LocalizationApp)
      .delete({ slug: APP_SLUG });

    rmSync(source, { recursive: true, force: true });
    rmSync(reports, { recursive: true, force: true });
    await deleteTestUsers(app, [admin.id]);
    await app.close();
  });

  function bundle(localeCode: string) {
    return request(app.getHttpServer())
      .get(`/api/v1/apps/${APP_SLUG}/locales/${localeCode}`)
      .set('X-API-Key', apiKey);
  }

  it('created the app the source path named', () => {
    expect(appId).toEqual(expect.any(String));
  });

  it('serves the English bundle exactly as the source JSON read', async () => {
    const { body } = await bundle('en').expect(200);

    expect(body.data.bundle).toEqual(EXPECTED_EN);
  });

  it('serves the Arabic bundle, minus the key Arabic never had', async () => {
    const { body } = await bundle('ar').expect(200);

    expect(body.data.bundle).toEqual(EXPECTED_AR);
  });

  it('lists both imported languages', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/api/v1/apps/${APP_SLUG}/locales`)
      .set('X-API-Key', apiKey)
      .expect(200);

    expect(
      body.data.locales.map((locale: { code: string }) => locale.code).sort(),
    ).toEqual(['ar', 'en']);
    expect(body.data.defaultLocaleCode).toBe('en');
  });
});
