import {
  AppLocale,
  Locale,
  LocalizationApp,
  TranslationEntry,
  TranslationModule,
  TranslationValue,
  TranslationValueVersion,
} from '@cms/database';
import { In } from 'typeorm';

import type { TranslationStatus } from '@cms/domain';

import type { SourceCatalogue, SourceModule } from './catalogue';
import type { Findings, ImportCounts } from './report';
import type { DataSource, EntityManager } from 'typeorm';

export type ImportOptions = {
  /** Without this nothing survives the transaction. */
  commit: boolean;
  /** The default language for apps this run creates. */
  defaultLocaleCode: string;
  /** What imported values are written as. */
  status: TranslationStatus;
  /** Replace a CMS value that differs from the source, rather than reporting it. */
  overwrite: boolean;
  /** Goes into every history row, so a value can be traced back to a revision. */
  changeNote: string;
};

/** Thrown to roll a dry run back. Never escapes `runImport`. */
class DryRunRollback extends Error {}

/**
 * The write pass — the whole batch in one transaction (arch doc §11 step 6).
 *
 * A dry run takes the **same** path and rolls back at the end, rather than
 * running a separate read-only simulation. Two code paths would drift, and the
 * one that drifts is always the one nobody runs for real until the day it
 * matters: the dry run would report a clean import of a batch that then fails
 * on a constraint. The cost is that a dry run briefly holds write locks.
 */
export async function runImport(
  dataSource: DataSource,
  catalogue: SourceCatalogue,
  options: ImportOptions,
  findings: Findings,
): Promise<ImportCounts> {
  const counts: ImportCounts = {
    apps: 0,
    modules: 0,
    entries: 0,
    values: 0,
    versions: 0,
    unchanged: 0,
  };

  try {
    await dataSource.transaction(async (manager) => {
      const locales = await loadLocales(manager);

      for (const module of catalogue.values()) {
        await importModule(manager, module, locales, options, findings, counts);
      }

      if (!options.commit) throw new DryRunRollback();
    });
  } catch (error) {
    if (!(error instanceof DryRunRollback)) throw error;
  }

  return counts;
}

/** Code → row, for the languages this CMS actually has (invariant Rule 1). */
async function loadLocales(
  manager: EntityManager,
): Promise<Map<string, Locale>> {
  const rows = await manager.find(Locale);
  return new Map(rows.map((locale) => [locale.code, locale]));
}

async function importModule(
  manager: EntityManager,
  source: SourceModule,
  locales: Map<string, Locale>,
  options: ImportOptions,
  findings: Findings,
  counts: ImportCounts,
): Promise<void> {
  const usable = usableLocales(source, locales, findings);
  if (usable.length === 0) return;

  const app = await resolveApp(manager, source, usable, locales, options, findings, counts);
  const module = await resolveModule(manager, app, source, counts);

  // Preloaded per module rather than looked up per key: a module is a few
  // hundred keys, and one query for the set beats one query per key
  // (typeorm Rule 7).
  const entries = await manager.find(TranslationEntry, {
    where: { moduleId: module.id },
  });
  const entryByKey = new Map(entries.map((entry) => [entry.key, entry]));

  const values =
    entries.length === 0
      ? []
      : await manager.find(TranslationValue, {
          where: { entryId: In(entries.map((entry) => entry.id)) },
        });
  const valueByIdentity = new Map(
    values.map((value) => [`${value.entryId}:${value.localeId}`, value]),
  );

  for (const code of usable) {
    const locale = locales.get(code) as Locale;
    const keys = source.byLocale.get(code) as Map<string, string>;

    for (const [key, text] of keys) {
      let entry = entryByKey.get(key);

      if (!entry) {
        entry = await manager.save(
          manager.create(TranslationEntry, {
            moduleId: module.id,
            key,
            // Everything imported is plain text. An existing frontend bundle
            // may well hold ICU, but deciding that per key is a content
            // decision, and `contentType` is editable in the CMS afterwards.
            contentType: 'text',
            createdBy: null,
          }),
        );
        entryByKey.set(key, entry);
        counts.entries += 1;
      }

      await importValue(
        manager,
        valueByIdentity.get(`${entry.id}:${locale.id}`),
        { entry, locale, text, source, key, code },
        options,
        findings,
        counts,
      );
    }
  }
}

async function importValue(
  manager: EntityManager,
  existing: TranslationValue | undefined,
  context: {
    entry: TranslationEntry;
    locale: Locale;
    text: string;
    source: SourceModule;
    key: string;
    code: string;
  },
  options: ImportOptions,
  findings: Findings,
  counts: ImportCounts,
): Promise<void> {
  const { entry, locale, text, source, key, code } = context;

  if (existing && existing.value === text) {
    // The idempotence case: a second run of the same source lands here for
    // every key and writes nothing at all.
    counts.unchanged += 1;
    return;
  }

  if (existing && !options.overwrite) {
    findings.add({
      severity: 'warning',
      kind: 'conflict',
      file: source.files.get(code)?.relativePath,
      app: source.appSlug,
      module: source.moduleSlug,
      locale: code,
      key,
      detail:
        'The CMS holds a different string; kept it. Re-run with --overwrite to replace it.',
    });
    return;
  }

  const saved = await manager.save(
    existing
      ? Object.assign(existing, { value: text })
      : manager.create(TranslationValue, {
          entryId: entry.id,
          localeId: locale.id,
          value: text,
          status: options.status,
          // `ck_values_published_at` refuses a published row without a date.
          publishedAt: options.status === 'published' ? new Date() : null,
          updatedBy: null,
        }),
  );

  counts.values += 1;

  /**
   * The history row that makes the import auditable (invariant Rule 6). Its
   * `version` is read back off the saved row rather than computed — TypeORM
   * owns that column (typeorm Rule 8) — and `changed_by` is null because no
   * person made this change; `change_note` names the source revision instead.
   */
  await manager.insert(TranslationValueVersion, {
    translationValueId: saved.id,
    version: saved.version,
    value: saved.value,
    status: saved.status,
    changedBy: null,
    changeNote: options.changeNote,
  });

  counts.versions += 1;
}

/**
 * The languages of this module that the CMS can actually store, reporting the
 * ones it cannot.
 *
 * A language the CMS has never heard of is not invented here: adding one is an
 * administrative act with a direction, a native name and a fallback to decide,
 * and an importer guessing at those would put a half-configured language in
 * front of readers.
 */
function usableLocales(
  source: SourceModule,
  locales: Map<string, Locale>,
  findings: Findings,
): string[] {
  const usable: string[] = [];

  for (const code of source.byLocale.keys()) {
    const locale = locales.get(code);

    if (!locale || !locale.isActive) {
      findings.add({
        severity: 'error',
        kind: 'unknown_locale',
        file: source.files.get(code)?.relativePath,
        app: source.appSlug,
        module: source.moduleSlug,
        locale: code,
        detail: locale
          ? `"${code}" is switched off in this CMS; nothing was imported for it.`
          : `"${code}" is not a language in this CMS. Add it first — it is an INSERT, not a migration.`,
      });
      continue;
    }

    usable.push(code);
  }

  return usable;
}

async function resolveApp(
  manager: EntityManager,
  source: SourceModule,
  usable: string[],
  locales: Map<string, Locale>,
  options: ImportOptions,
  findings: Findings,
  counts: ImportCounts,
): Promise<LocalizationApp> {
  let app = await manager.findOne(LocalizationApp, {
    where: { slug: source.appSlug },
  });

  if (!app) {
    const defaultLocale = locales.get(options.defaultLocaleCode);

    if (!defaultLocale) {
      // A configuration error, not a data one: every app this run creates would
      // be wrong, so it stops rather than reporting the same line per app.
      throw new Error(
        `--default-locale "${options.defaultLocaleCode}" is not a language in this CMS.`,
      );
    }

    app = await manager.save(
      manager.create(LocalizationApp, {
        name: source.appName,
        slug: source.appSlug,
        defaultLocaleId: defaultLocale.id,
      }),
    );

    // The app and its default language in one transaction (typeorm Rule 4) —
    // an app with no enabled locale serves an empty bundle.
    await manager.save(
      manager.create(AppLocale, {
        appId: app.id,
        localeId: defaultLocale.id,
        isDefault: true,
        isEnabled: true,
      }),
    );

    counts.apps += 1;
  }

  await ensureAppLocales(manager, app, source, usable, locales, findings);

  return app;
}

/**
 * Switches on the languages this app's source files contain.
 *
 * A language the app has **deliberately disabled** is left alone and reported.
 * Re-enabling it would put copy in front of readers that someone switched off
 * on purpose, and the import is not the place that decision gets reversed.
 */
async function ensureAppLocales(
  manager: EntityManager,
  app: LocalizationApp,
  source: SourceModule,
  usable: string[],
  locales: Map<string, Locale>,
  findings: Findings,
): Promise<void> {
  for (const code of usable) {
    const locale = locales.get(code) as Locale;

    const existing = await manager.findOne(AppLocale, {
      where: { appId: app.id, localeId: locale.id },
    });

    if (!existing) {
      await manager.save(
        manager.create(AppLocale, {
          appId: app.id,
          localeId: locale.id,
          isDefault: false,
          isEnabled: true,
        }),
      );

      findings.add({
        severity: 'info',
        kind: 'locale_enabled',
        app: source.appSlug,
        locale: code,
        detail: 'The app did not serve this language; the import switched it on.',
      });
      continue;
    }

    if (!existing.isEnabled) {
      findings.add({
        severity: 'warning',
        kind: 'locale_disabled',
        app: source.appSlug,
        locale: code,
        detail:
          'The app has this language switched off, so the imported values will not be served until an admin enables it.',
      });
    }
  }
}

async function resolveModule(
  manager: EntityManager,
  app: LocalizationApp,
  source: SourceModule,
  counts: ImportCounts,
): Promise<TranslationModule> {
  const existing = await manager.findOne(TranslationModule, {
    where: { appId: app.id, slug: source.moduleSlug },
  });

  if (existing) return existing;

  // App-scoped throughout: these files live inside one application's source
  // tree, so `scope` follows the path rather than being reconciled afterwards
  // (invariant Rule 2). Promoting a shared module to global is a CMS action.
  const created = await manager.save(
    manager.create(TranslationModule, {
      appId: app.id,
      name: source.moduleName,
      slug: source.moduleSlug,
      scope: 'app',
    }),
  );

  counts.modules += 1;

  return created;
}
