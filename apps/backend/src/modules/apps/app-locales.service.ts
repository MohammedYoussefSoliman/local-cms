import { AppLocale, Locale } from '@cms/database';
import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AppLocaleResponseData } from '@cms/contracts';

import { LocalesService } from '../locales/locales.service';

import { AppsService } from './apps.service';

import type { SetAppLocaleFallbackDto } from './dto/set-fallback.dto';

/**
 * The app-locale sub-resource: which languages an app has switched on, and how
 * each one falls back. Routes address a locale by its `code`, never by its id —
 * the code is what the dashboard and the runtime API both speak.
 */
@Injectable()
export class AppLocalesService {
  constructor(
    @InjectRepository(AppLocale)
    private readonly appLocales: Repository<AppLocale>,
    private readonly apps: AppsService,
    // Cross-feature access goes through the other feature's service, never its
    // repository (module-structure rule).
    private readonly locales: LocalesService,
  ) {}

  /**
   * Not paginated, deliberately. This list is bounded by the number of
   * languages the CMS knows about — a reference set a human scans, not a table
   * that grows with content (typeorm Rule 6 is about the unbounded ones).
   */
  async findAll(appId: string): Promise<AppLocaleResponseData[]> {
    await this.apps.findEntityOrFail(appId);

    const records = await this.appLocales.find({
      where: { appId },
      relations: { locale: true, fallbackLocale: true },
      order: { locale: { code: 'ASC' } },
    });

    return records.map(toAppLocaleResponse);
  }

  /**
   * Enabling is an upsert: a language switched off earlier still has its row,
   * carrying the fallback that was configured for it, and turning it back on
   * should restore that rather than silently discard it.
   */
  async enable(
    appId: string,
    localeCode: string,
  ): Promise<AppLocaleResponseData> {
    await this.apps.findEntityOrFail(appId);
    const locale = await this.resolveLocaleOrFail(localeCode);

    if (!locale.isActive) {
      throw new UnprocessableEntityException(
        `Locale "${locale.code}" is not active and cannot be enabled for an app.`,
      );
    }

    const existing = await this.appLocales.findOne({
      where: { appId, localeId: locale.id },
      relations: { locale: true, fallbackLocale: true },
    });

    if (existing) {
      existing.isEnabled = true;
      await this.appLocales.save(existing);
      return toAppLocaleResponse(existing);
    }

    // `isDefault: false` always. The default is set once, when the app is
    // created, and moving it is a transactional promote/demote of its own.
    await this.appLocales.insert({
      appId,
      localeId: locale.id,
      isDefault: false,
      isEnabled: true,
      fallbackLocaleId: null,
    });

    return this.findOneOrFail(appId, locale.id);
  }

  async disable(
    appId: string,
    localeCode: string,
  ): Promise<AppLocaleResponseData> {
    await this.apps.findEntityOrFail(appId);
    const locale = await this.resolveLocaleOrFail(localeCode);
    const appLocale = await this.findEntityOrFail(appId, locale.id);

    /**
     * 422, not 400: the request is well-formed and the caller is allowed to
     * make it — it is the domain that refuses. An app whose default language is
     * off has no authoring language and nothing for `RESOLUTION_ORDER` to end
     * at. Move the default first, then disable this one.
     */
    if (appLocale.isDefault) {
      throw new UnprocessableEntityException(
        `Locale "${locale.code}" is this app's default language and cannot be disabled.`,
      );
    }

    // The row is kept, not deleted: it holds the fallback configuration, and
    // `translation_values` for this language stay addressable either way.
    appLocale.isEnabled = false;
    await this.appLocales.save(appLocale);

    return toAppLocaleResponse(appLocale);
  }

  async setFallback(
    appId: string,
    localeCode: string,
    dto: SetAppLocaleFallbackDto,
  ): Promise<AppLocaleResponseData> {
    await this.apps.findEntityOrFail(appId);
    const locale = await this.resolveLocaleOrFail(localeCode);
    const appLocale = await this.findEntityOrFail(appId, locale.id);

    if (dto.fallbackLocaleCode === null) {
      appLocale.fallbackLocaleId = null;
      appLocale.fallbackLocale = null;
      await this.appLocales.save(appLocale);
      return toAppLocaleResponse(appLocale);
    }

    const fallback = await this.resolveLocaleOrFail(dto.fallbackLocaleCode);

    /**
     * The fallback has to be a language this app actually serves. Pointing at
     * one it does not resolves to nothing at runtime — a silently empty step in
     * the chain rather than a loud error, which is the worst of both.
     *
     * A locale pointing at *itself* is left to
     * `ck_app_locales_fallback_not_self` to reject; the filter turns its 23514
     * into a 422 (typeorm Rule 5).
     */
    const fallbackEnabled = await this.appLocales.findOne({
      where: { appId, localeId: fallback.id, isEnabled: true },
    });

    if (!fallbackEnabled) {
      throw new UnprocessableEntityException(
        `Locale "${fallback.code}" is not enabled for this app and cannot be its fallback.`,
      );
    }

    appLocale.fallbackLocaleId = fallback.id;
    appLocale.fallbackLocale = fallback;
    await this.appLocales.save(appLocale);

    return toAppLocaleResponse(appLocale);
  }

  private async resolveLocaleOrFail(code: string): Promise<Locale> {
    const locale = await this.locales.findEntityByCode(code);
    if (!locale) throw new NotFoundException(`Locale "${code}" does not exist.`);
    return locale;
  }

  private async findEntityOrFail(
    appId: string,
    localeId: string,
  ): Promise<AppLocale> {
    const appLocale = await this.appLocales.findOne({
      where: { appId, localeId },
      relations: { locale: true, fallbackLocale: true },
    });

    if (!appLocale) {
      throw new NotFoundException('This locale is not configured for the app.');
    }

    return appLocale;
  }

  private async findOneOrFail(
    appId: string,
    localeId: string,
  ): Promise<AppLocaleResponseData> {
    return toAppLocaleResponse(await this.findEntityOrFail(appId, localeId));
  }
}

/** Entities are never returned as-is (HTTP contract Rule 5). */
function toAppLocaleResponse(appLocale: AppLocale): AppLocaleResponseData {
  return {
    appId: appLocale.appId,
    localeId: appLocale.localeId,
    locale: {
      id: appLocale.locale.id,
      code: appLocale.locale.code,
      name: appLocale.locale.name,
      nativeName: appLocale.locale.nativeName,
      direction: appLocale.locale.direction,
      isActive: appLocale.locale.isActive,
    },
    isDefault: appLocale.isDefault,
    isEnabled: appLocale.isEnabled,
    fallbackLocaleId: appLocale.fallbackLocaleId,
    fallbackLocaleCode: appLocale.fallbackLocale?.code ?? null,
  };
}
