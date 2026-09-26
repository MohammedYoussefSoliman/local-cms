import 'reflect-metadata';

import { readFileSync } from 'node:fs';

import {
  Locale,
  LocalizationApp,
  TranslationEntry,
  TranslationModule,
  TranslationValue,
  TranslationValueVersion,
} from '@cms/database';
import { AppDataSource } from '@cms/database/src/data-source';

import { DEFAULT_PATTERN, runPipeline } from '../src';

import { createFixture, fixtureOptions } from './helpers/fixture';

import type { ImportReport } from '../src';
import type { Fixture, FixtureTree } from './helpers/fixture';

const APP_SLUG = 'e2e-importer';
const MODULE_SLUG = 'checkout';

/**
 * One app, one module, two languages — and `cta` deliberately absent from
 * Arabic, because "translated into English, not yet into Arabic" is the normal
 * state of the repositories this importer drains.
 */
const SOURCE: FixtureTree = {
  'apps/e2e-importer/src/modules/Checkout/locales/en.json': JSON.stringify({
    summary: { title: 'Order summary' },
    cta: 'Pay now',
  }),
  'apps/e2e-importer/src/modules/Checkout/locales/ar.json': JSON.stringify({
    summary: { title: 'ملخص الطلب' },
  }),
};

describe('Importer (e2e)', () => {
  const fixtures: Fixture[] = [];

  /** Registers the fixture for teardown, so a failing test still cleans up. */
  function fixture(tree: FixtureTree = SOURCE, git = true): Fixture {
    const created = createFixture(tree, { git });
    fixtures.push(created);
    return created;
  }

  function readReport(path: string): ImportReport {
    return JSON.parse(readFileSync(path, 'utf8')) as ImportReport;
  }

  async function countRows(): Promise<{
    apps: number;
    modules: number;
    entries: number;
    values: number;
  }> {
    const app = await AppDataSource.getRepository(LocalizationApp).findOne({
      where: { slug: APP_SLUG },
    });

    if (!app) return { apps: 0, modules: 0, entries: 0, values: 0 };

    const modules = await AppDataSource.getRepository(TranslationModule).find({
      where: { appId: app.id },
    });

    const entries = await AppDataSource.getRepository(TranslationEntry)
      .createQueryBuilder('entry')
      .innerJoin('entry.module', 'module')
      .where('module.appId = :appId', { appId: app.id })
      .getMany();

    const values = await AppDataSource.getRepository(TranslationValue)
      .createQueryBuilder('value')
      .innerJoin('value.entry', 'entry')
      .innerJoin('entry.module', 'module')
      .where('module.appId = :appId', { appId: app.id })
      .getMany();

    return {
      apps: 1,
      modules: modules.length,
      entries: entries.length,
      values: values.length,
    };
  }

  beforeAll(async () => {
    await AppDataSource.initialize();
  });

  afterEach(async () => {
    // `apps` cascades to modules, entries, values and history (testing Rule 5).
    await AppDataSource.getRepository(LocalizationApp).delete({
      slug: APP_SLUG,
    });
  });

  afterAll(async () => {
    for (const created of fixtures) created.remove();
    await AppDataSource.destroy();
  });

  describe('a dry run', () => {
    it('writes a report and makes no database changes whatsoever', async () => {
      const source = fixture();

      const { report } = await runPipeline(
        fixtureOptions(source),
        AppDataSource,
      );

      // It reports what a commit *would* write — a dry run that reported
      // nothing would be useless, and one that reported a guess would be worse.
      expect(report.mode).toBe('dry-run');
      expect(report.written).toMatchObject({
        apps: 1,
        modules: 1,
        entries: 2,
        values: 3,
        versions: 3,
      });

      expect(await countRows()).toEqual({
        apps: 0,
        modules: 0,
        entries: 0,
        values: 0,
      });

      expect(readReport(source.reportPath).discovered.files).toBe(2);
    });

    it('names the source commit it read from', async () => {
      const source = fixture();

      const { report } = await runPipeline(
        fixtureOptions(source),
        AppDataSource,
      );

      // Invariant Rule 9: every run is attributable to a source revision.
      expect(report.source.commitSha).toBe(source.sha);
      expect(report.source.dirty).toBe(false);
      expect(readReport(source.reportPath).source.commitSha).toBe(source.sha);
    });

    it('says so when the source is not a git checkout', async () => {
      const source = fixture(SOURCE, false);

      const { report } = await runPipeline(
        fixtureOptions(source),
        AppDataSource,
      );

      expect(report.source.commitSha).toBeNull();
      expect(report.findings).toContainEqual(
        expect.objectContaining({ kind: 'no_source_commit' }),
      );
    });

    it('writes the report before it touches the database', async () => {
      const source = fixture();

      // The pre-write copy has no counts in it yet. That is the copy that
      // survives a run which dies inside the transaction.
      const captured: ImportReport[] = [];
      const spy = jest
        .spyOn(AppDataSource, 'transaction')
        .mockImplementation(async () => {
          captured.push(readReport(source.reportPath));
          throw new Error('transaction exploded');
        });

      await expect(
        runPipeline(fixtureOptions(source), AppDataSource),
      ).rejects.toThrow('transaction exploded');

      spy.mockRestore();

      expect(captured).toHaveLength(1);
      expect(captured[0].written).toBeNull();
      expect(captured[0].discovered.keys).toBe(3);
    });
  });

  describe('--commit', () => {
    it('imports the source, and a second run imports nothing', async () => {
      const source = fixture();

      const first = await runPipeline(
        fixtureOptions(source, { commit: true }),
        AppDataSource,
      );

      expect(first.report.written).toEqual({
        apps: 1,
        modules: 1,
        entries: 2,
        values: 3,
        versions: 3,
        unchanged: 0,
      });

      expect(await countRows()).toEqual({
        apps: 1,
        modules: 1,
        entries: 2,
        values: 3,
      });

      const second = await runPipeline(
        fixtureOptions(source, { commit: true }),
        AppDataSource,
      );

      // Rule 9's whole point: a re-run is safe, and it is safe by writing
      // nothing rather than by rewriting the same thing.
      expect(second.report.written).toEqual({
        apps: 0,
        modules: 0,
        entries: 0,
        values: 0,
        versions: 0,
        unchanged: 3,
      });

      expect(
        second.report.findings.filter((finding) => finding.kind === 'conflict'),
      ).toEqual([]);

      expect(await countRows()).toEqual({
        apps: 1,
        modules: 1,
        entries: 2,
        values: 3,
      });
    });

    it('reports a key one language is missing rather than failing the batch', async () => {
      const source = fixture();

      const { report } = await runPipeline(
        fixtureOptions(source, { commit: true }),
        AppDataSource,
      );

      expect(report.findings).toContainEqual(
        expect.objectContaining({
          kind: 'missing_key',
          locale: 'ar',
          key: 'cta',
          severity: 'warning',
        }),
      );

      // And the rest of the module still landed.
      expect(report.written?.values).toBe(3);
    });

    it('flattens nesting into the dotted keys the CMS stores', async () => {
      const source = fixture();

      await runPipeline(fixtureOptions(source, { commit: true }), AppDataSource);

      const entries = await AppDataSource.getRepository(TranslationEntry)
        .createQueryBuilder('entry')
        .innerJoin('entry.module', 'module')
        .innerJoin('module.app', 'app')
        .where('app.slug = :slug', { slug: APP_SLUG })
        .orderBy('entry.key')
        .getMany();

      expect(entries.map((entry) => entry.key)).toEqual([
        'cta',
        'summary.title',
      ]);
    });

    it('publishes what it writes, with a history row behind it', async () => {
      const source = fixture();

      await runPipeline(fixtureOptions(source, { commit: true }), AppDataSource);

      const value = await published('summary.title', 'ar');

      // Published, because this copy is already live in the source app —
      // importing it as a draft would empty the runtime bundle on day one.
      expect(value.status).toBe('published');
      expect(value.publishedAt).not.toBeNull();

      const history = await AppDataSource.getRepository(
        TranslationValueVersion,
      ).find({ where: { translationValueId: value.id } });

      // Invariant Rule 6: the import is a change like any other, and it says
      // where it came from even though no person made it.
      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(value.version);
      expect(history[0].changedBy).toBeNull();
      expect(history[0].changeNote).toContain(source.sha ?? '');
    });

    it('switches on a language the app did not serve', async () => {
      const source = fixture();

      const { report } = await runPipeline(
        fixtureOptions(source, { commit: true }),
        AppDataSource,
      );

      expect(report.findings).toContainEqual(
        expect.objectContaining({ kind: 'locale_enabled', locale: 'ar' }),
      );
    });
  });

  describe('a value the CMS already holds', () => {
    it('is reported, not overwritten', async () => {
      const source = fixture();

      await runPipeline(fixtureOptions(source, { commit: true }), AppDataSource);

      const edited = await published('cta', 'en');
      edited.value = 'Checkout now';
      await AppDataSource.getRepository(TranslationValue).save(edited);

      const { report } = await runPipeline(
        fixtureOptions(source, { commit: true }),
        AppDataSource,
      );

      // After the first import the CMS is the source of truth. An editor's fix
      // being silently undone by a re-run is the failure mode this guards.
      expect(report.findings).toContainEqual(
        expect.objectContaining({ kind: 'conflict', key: 'cta', locale: 'en' }),
      );
      expect((await published('cta', 'en')).value).toBe('Checkout now');
    });

    it('is replaced when --overwrite says so, forward, with history', async () => {
      const source = fixture();

      await runPipeline(fixtureOptions(source, { commit: true }), AppDataSource);

      const edited = await published('cta', 'en');
      edited.value = 'Checkout now';
      await AppDataSource.getRepository(TranslationValue).save(edited);

      await runPipeline(
        fixtureOptions(source, { commit: true, overwrite: true }),
        AppDataSource,
      );

      const current = await published('cta', 'en');
      expect(current.value).toBe('Pay now');

      const history = await AppDataSource.getRepository(
        TranslationValueVersion,
      ).find({
        where: { translationValueId: current.id },
        order: { version: 'ASC' },
      });

      // The correction is a new row; nothing in history was rewritten.
      expect(history.map((row) => row.value)).toEqual(['Pay now', 'Pay now']);
      expect(history).toHaveLength(2);
    });
  });

  describe('a language the CMS does not have', () => {
    it('is reported rather than invented', async () => {
      const source = fixture({
        ...SOURCE,
        'apps/e2e-importer/src/modules/Checkout/locales/fr.json': JSON.stringify(
          { cta: 'Payer' },
        ),
      });

      const { report } = await runPipeline(
        fixtureOptions(source, { commit: true }),
        AppDataSource,
      );

      expect(report.findings).toContainEqual(
        expect.objectContaining({ kind: 'unknown_locale', locale: 'fr' }),
      );

      // Adding a language is an INSERT into `locales` — but a deliberate one,
      // with a direction and a native name (invariant Rule 1).
      expect(
        await AppDataSource.getRepository(Locale).findOne({
          where: { code: 'fr' },
        }),
      ).toBeNull();

      // The languages it does know still imported.
      expect(report.written?.values).toBe(3);
    });
  });

  describe('TypeScript locale files', () => {
    it('are evaluated, not parsed', async () => {
      // The source monorepo ships `en.ts`, not `en.json` — typed objects a
      // bundler consumes. Reading them means running them.
      const source = fixture({
        'apps/e2e-importer/src/modules/Checkout/locales/en.ts':
          "export default { cta: 'Pay now' };\n",
      });

      const { report } = await runPipeline(
        fixtureOptions(source, { commit: true, pattern: DEFAULT_PATTERN }),
        AppDataSource,
      );

      expect(report.written?.values).toBe(1);
      expect((await published('cta', 'en')).value).toBe('Pay now');
    });
  });
});

/** The stored value for one key and language of the fixture app. */
async function published(
  key: string,
  localeCode: string,
): Promise<TranslationValue> {
  const value = await AppDataSource.getRepository(TranslationValue)
    .createQueryBuilder('value')
    .innerJoin('value.entry', 'entry')
    .innerJoin('entry.module', 'module')
    .innerJoin('module.app', 'app')
    .innerJoin('value.locale', 'locale')
    .where('app.slug = :slug', { slug: APP_SLUG })
    .andWhere('module.slug = :moduleSlug', { moduleSlug: MODULE_SLUG })
    .andWhere('entry.key = :key', { key })
    .andWhere('locale.code = :localeCode', { localeCode })
    .getOne();

  if (!value) throw new Error(`No stored value for ${key}/${localeCode}.`);

  return value;
}
