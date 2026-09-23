import { createHash } from 'node:crypto';

import { TranslationValue } from '@cms/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  AppLocaleResponseData,
  RuntimeLocalesResponseData,
} from '@cms/contracts';
import type { LocalizationApp } from '@cms/database';
import type { ModuleScope, TranslationBundleResponse } from '@cms/domain';

import type { ApiKeyContext } from '@/common';

import { ApiKeysService } from '../api-keys/api-keys.service';
import { AppLocalesService } from '../apps/app-locales.service';
import { AppsService } from '../apps/apps.service';
import { TranslationModulesService } from '../translation-modules/translation-modules.service';


/** One row of the bundle query. Raw, because the select is deliberately narrow. */
type BundleRow = {
  moduleSlug: string;
  moduleScope: ModuleScope;
  entryKey: string;
  value: string;
  localeId: string;
  updatedAt: Date;
};

type BundleContext = {
  app: LocalizationApp;
  localeId: string;
  localeCode: string;
  fallbackLocaleId: string | null;
};

/**
 * The read path client applications actually call, and the **only**
 * implementation of `RESOLUTION_ORDER` (invariant Rule 5). The dashboard
 * preview and any future `i18n-client` adapter call this endpoint rather than
 * rebuilding the chain — three implementations of a fallback chain is three
 * different answers to "why is this key showing in English?".
 */
@Injectable()
export class RuntimeService {
  constructor(
    @InjectRepository(TranslationValue)
    private readonly values: Repository<TranslationValue>,
    private readonly apps: AppsService,
    private readonly appLocales: AppLocalesService,
    private readonly modules: TranslationModulesService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  /**
   * The languages the app serves, so a client app does not hard-code its own
   * list. Disabled languages are omitted: a client offering a language the CMS
   * has switched off would render an empty bundle.
   */
  async getLocales(
    appSlug: string,
    apiKey: ApiKeyContext,
  ): Promise<RuntimeLocalesResponseData> {
    const app = await this.resolveApp(appSlug, apiKey);
    const appLocales = await this.appLocales.findAll(app.id);
    const enabled = appLocales.filter((record) => record.isEnabled);

    const defaultLocale = enabled.find((record) => record.isDefault);

    return {
      appSlug: app.slug,
      // Every app has exactly one, written in the same transaction that created
      // the app — but the type says `find` can miss, so this says what happens.
      defaultLocaleCode: defaultLocale?.locale.code ?? '',
      locales: enabled.map((record) => ({
        code: record.locale.code,
        name: record.locale.name,
        nativeName: record.locale.nativeName,
        direction: record.locale.direction,
        isDefault: record.isDefault,
        fallbackLocaleCode: record.fallbackLocaleCode,
      })),
    };
  }

  async getBundle(
    appSlug: string,
    localeCode: string,
    includeGlobal: boolean,
    apiKey: ApiKeyContext,
  ): Promise<TranslationBundleResponse> {
    const context = await this.resolveContext(appSlug, localeCode, apiKey);
    const rows = await this.loadRows(context, { includeGlobal });

    return this.toBundleResponse(context, rows);
  }

  /**
   * One namespace rather than the whole catalogue — what a code-split client
   * asks for when it reaches a route it has not loaded copy for yet.
   */
  async getModuleBundle(
    appSlug: string,
    localeCode: string,
    moduleSlug: string,
    apiKey: ApiKeyContext,
  ): Promise<TranslationBundleResponse> {
    const context = await this.resolveContext(appSlug, localeCode, apiKey);

    /**
     * Checked rather than inferred from an empty result: a namespace that
     * exists but has nothing published yet and a slug the client misspelled are
     * completely different problems, and an empty bundle for both sends a
     * client developer looking in the wrong place.
     */
    const modules = await this.modules.findForAppBySlug(
      context.app.id,
      moduleSlug,
    );

    if (modules.length === 0) {
      throw new NotFoundException(
        `Module "${moduleSlug}" does not exist for this app.`,
      );
    }

    const rows = await this.loadRows(context, {
      includeGlobal: true,
      moduleSlug,
    });

    return this.toBundleResponse(context, rows);
  }

  private async resolveApp(
    appSlug: string,
    apiKey: ApiKeyContext,
  ): Promise<LocalizationApp> {
    const app = await this.apps.findEntityBySlugOrFail(appSlug);

    /**
     * The scope check, on every runtime path without exception. `ApiKeyGuard`
     * only establishes *that* the credential is valid; this is what establishes
     * *where*. Skipping it on one handler serves one customer's copy to
     * another's key, and nothing upstream would catch it.
     */
    this.apiKeys.assertServesApp(apiKey, app.id);

    return app;
  }

  private async resolveContext(
    appSlug: string,
    localeCode: string,
    apiKey: ApiKeyContext,
  ): Promise<BundleContext> {
    const app = await this.resolveApp(appSlug, apiKey);
    const appLocales = await this.appLocales.findAll(app.id);

    const requested = appLocales.find(
      (record) => record.locale.code === localeCode && record.isEnabled,
    );

    if (!requested) {
      throw new NotFoundException(
        `App "${appSlug}" does not serve locale "${localeCode}".`,
      );
    }

    return {
      app,
      localeId: requested.localeId,
      localeCode: requested.locale.code,
      fallbackLocaleId: resolveFallbackId(requested, appLocales),
    };
  }

  /**
   * One query for the whole bundle, both languages at once.
   *
   * Fetching the fallback language in a second pass would double the round
   * trips on the API's hottest read for no benefit — the rows are
   * distinguishable by `locale_id`, and choosing between them is a comparison
   * in JS, not a query.
   */
  private async loadRows(
    context: BundleContext,
    options: { includeGlobal: boolean; moduleSlug?: string },
  ): Promise<BundleRow[]> {
    const localeIds = context.fallbackLocaleId
      ? [context.localeId, context.fallbackLocaleId]
      : [context.localeId];

    const builder = this.values
      .createQueryBuilder('value')
      .innerJoin('value.entry', 'entry')
      .innerJoin('entry.module', 'module')
      .select('module.slug', 'moduleSlug')
      .addSelect('module.scope', 'moduleScope')
      .addSelect('entry.key', 'entryKey')
      .addSelect('value.value', 'value')
      .addSelect('value.localeId', 'localeId')
      .addSelect('value.updatedAt', 'updatedAt')
      // In the WHERE clause, never a post-filter: a `draft` reaching a client
      // app is unreleased copy on a live storefront (invariant Rule 4). The
      // partial index `ix_values_locale_published` covers exactly this.
      .where('value.status = :status', { status: 'published' })
      .andWhere('value.localeId IN (:...localeIds)', { localeIds });

    if (options.includeGlobal) {
      builder.andWhere(
        '(module.appId = :appId OR module.scope = :globalScope)',
        { appId: context.app.id, globalScope: 'global' },
      );
    } else {
      builder.andWhere('module.appId = :appId', { appId: context.app.id });
    }

    if (options.moduleSlug) {
      builder.andWhere('module.slug = :moduleSlug', {
        moduleSlug: options.moduleSlug,
      });
    }

    return builder.getRawMany<BundleRow>();
  }

  private toBundleResponse(
    context: BundleContext,
    rows: BundleRow[],
  ): TranslationBundleResponse {
    return {
      appSlug: context.app.slug,
      localeCode: context.localeCode,
      releaseId: releaseIdOf(rows),
      bundle: buildBundle(rows, context.localeId),
    };
  }
}

/**
 * The fallback language's id, if the app configured one **and** still serves
 * it. A fallback pointing at a language that has since been switched off would
 * contribute nothing, so treating it as absent is the honest reading.
 */
function resolveFallbackId(
  requested: AppLocaleResponseData,
  appLocales: AppLocaleResponseData[],
): string | null {
  if (!requested.fallbackLocaleId) return null;

  const fallback = appLocales.find(
    (record) => record.localeId === requested.fallbackLocaleId,
  );

  return fallback?.isEnabled ? fallback.localeId : null;
}

/** Separates a module slug from an entry key; neither may contain it. */
const IDENTITY_SEPARATOR = ' ';

/**
 * `RESOLUTION_ORDER`, implemented once.
 *
 *   1. app-specific entry
 *   2. global entry
 *   3. configured fallback locale
 *   4. the translation key itself
 *
 * Steps 1-3 are the rank below: the requested language outranks the fallback,
 * and within a language the app's own namespace outranks the global one — so an
 * app that defines `checkout.title` shadows a global module of the same name,
 * which is the whole point of having both.
 *
 * Step 4 is an **omission**, not an entry. A key with nothing published anywhere
 * is simply absent, and every i18n client renders a missing key as the key.
 * Emitting `add_to_cart: 'add_to_cart'` instead would look identical on screen
 * while making "is this translated yet?" unanswerable from the response — and
 * would ship the untranslated 90% of a young app in every bundle.
 */
function buildBundle(
  rows: BundleRow[],
  requestedLocaleId: string,
): TranslationBundleResponse['bundle'] {
  const bundle: TranslationBundleResponse['bundle'] = {};
  const ranks = new Map<string, number>();

  for (const row of rows) {
    const rank =
      (row.localeId === requestedLocaleId ? 2 : 0) +
      (row.moduleScope === 'app' ? 1 : 0);

    const identity = `${row.moduleSlug}${IDENTITY_SEPARATOR}${row.entryKey}`;

    if ((ranks.get(identity) ?? -1) >= rank) continue;
    ranks.set(identity, rank);

    bundle[row.moduleSlug] ??= {};
    bundle[row.moduleSlug][row.entryKey] = row.value;
  }

  return bundle;
}

/**
 * Derived, so publishing invalidates caches with no `releases` table and no
 * cut-a-release step.
 *
 * `max(updated_at)` rather than the plan's `max(published_at)`: B6 decided that
 * editing an already-published value keeps it published and leaves
 * `published_at` alone, so a `published_at` digest would not move when live copy
 * was corrected — every cache would serve the typo until something unrelated was
 * published. `count` is what catches a value *leaving* the set, where the
 * maximum can only go down.
 */
function releaseIdOf(rows: BundleRow[]): string {
  const latest = rows.reduce(
    (newest, row) => Math.max(newest, new Date(row.updatedAt).getTime()),
    0,
  );

  return createHash('sha256')
    .update(`${new Date(latest).toISOString()}:${rows.length}`)
    .digest('hex')
    .slice(0, 16);
}
