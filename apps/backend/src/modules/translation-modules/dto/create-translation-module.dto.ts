import { IsOptional, IsString, Length, Matches } from 'class-validator';

import type { CreateTranslationModulePayload } from '@cms/contracts';

/** Same shape as an app slug: it lands in the same runtime URL. */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * No `scope` and no `appId`. The route decides both (invariant Rule 2), and
 * `forbidNonWhitelisted` turns an attempt to send either into a 400 — which is
 * the point: a body that could describe `scope: 'global'` with an `appId` is a
 * body that can reach `ck_modules_scope_app_id`.
 */
export class CreateTranslationModuleDto
  implements CreateTranslationModulePayload
{
  @IsString()
  @Length(1, 255)
  name: string;

  @IsString()
  @Length(1, 128)
  @Matches(SLUG, {
    message:
      'slug must be lowercase alphanumerics separated by single hyphens, for example "add-to-cart".',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;
}
