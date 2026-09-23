import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  Inject,
  Param,
  Query,
  Res,
} from '@nestjs/common';

import type { TranslationBundleResponse } from '@cms/domain';

import { type ApiKeyContext, CurrentApiKey, ServiceCredential } from '@/common';

import { appConfig } from '../../config/configuration';

import { BundleQueryDto } from './dto/bundle.query.dto';
import { RuntimeService } from './runtime.service';

import type { ConfigType } from '@nestjs/config';
import type { Response } from 'express';

/**
 * The public face of the CMS: the endpoints a deployed client application calls
 * on every cold start.
 *
 * `@ServiceCredential()` on the class, so every route here authenticates with
 * an `X-API-Key` instead of a user session. It is **not** `@Public()` — auth
 * Rule 2 caps that at three routes and names these as explicitly not an
 * exception. `@Roles()` would be meaningless here: there is no `request.user`,
 * and the authorization question is *which app* the key was issued for, which
 * `RuntimeService` asks on every path.
 *
 * Versioned at `/api/v1/...` because these URLs are compiled into client
 * bundles that ship on their own schedule (invariant Rule 8). The CMS surface
 * stays unversioned.
 */
@ServiceCredential()
@Controller({ path: 'apps/:appSlug/locales', version: '1' })
export class RuntimeController {
  constructor(
    private readonly runtime: RuntimeService,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  @Get()
  locales(
    @Param('appSlug') appSlug: string,
    @CurrentApiKey() apiKey: ApiKeyContext,
  ) {
    return this.runtime.getLocales(appSlug, apiKey);
  }

  @Get(':localeCode')
  async bundle(
    @Param('appSlug') appSlug: string,
    @Param('localeCode') localeCode: string,
    @Query() query: BundleQueryDto,
    @CurrentApiKey() apiKey: ApiKeyContext,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TranslationBundleResponse | undefined> {
    const bundle = await this.runtime.getBundle(
      appSlug,
      localeCode,
      query.includeGlobal,
      apiKey,
    );

    return this.withCaching(response, ifNoneMatch, bundle);
  }

  @Get(':localeCode/modules/:moduleSlug')
  async moduleBundle(
    @Param('appSlug') appSlug: string,
    @Param('localeCode') localeCode: string,
    @Param('moduleSlug') moduleSlug: string,
    @CurrentApiKey() apiKey: ApiKeyContext,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TranslationBundleResponse | undefined> {
    const bundle = await this.runtime.getModuleBundle(
      appSlug,
      localeCode,
      moduleSlug,
      apiKey,
    );

    return this.withCaching(response, ifNoneMatch, bundle);
  }

  /**
   * A bundle endpoint with no caching turns every client app's cold start into
   * a full table read (HTTP contract Rule 7). The `releaseId` already changes
   * whenever anything in the bundle is published, so it *is* the validator —
   * deriving the ETag from anything else would be a second thing to keep in
   * sync with the first.
   *
   * Returning `undefined` on a 304 is deliberate and safe: Express strips the
   * body of a 304 in `res.send`, so `ResponseInterceptor` wrapping `undefined`
   * never reaches the wire. The alternative — bypassing the interceptor with a
   * raw `@Res()` — would give these three routes a different response shape
   * from the rest of the API.
   */
  private withCaching(
    response: Response,
    ifNoneMatch: string | undefined,
    bundle: TranslationBundleResponse,
  ): TranslationBundleResponse | undefined {
    const etag = `"${bundle.releaseId}"`;

    response.setHeader('ETag', etag);
    response.setHeader(
      'Cache-Control',
      `public, max-age=${this.config.runtimeCacheMaxAge}, stale-while-revalidate=300`,
    );

    if (ifNoneMatch === etag) {
      response.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }

    return bundle;
  }
}
