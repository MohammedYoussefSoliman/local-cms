import { IsOptional, IsString, Length, Matches } from 'class-validator';

import type { CreateAppPayload } from '@cms/contracts';

/**
 * Lowercase alphanumerics and hyphens. This shape ends up inside a URL path
 * segment, so anything that could be percent-decoded into a traversal or a
 * second path segment is rejected here rather than at the router.
 */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const BCP_47 = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export class CreateAppDto implements CreateAppPayload {
  @IsString()
  @Length(1, 255)
  name: string;

  @IsString()
  @Length(1, 128)
  @Matches(SLUG, {
    message:
      'slug must be lowercase alphanumerics separated by single hyphens, for example "storefront-web".',
  })
  slug: string;

  /** `@IsOptional()` skips `null` as well as `undefined`, so null is allowed. */
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;

  @IsString()
  @Length(2, 35)
  @Matches(BCP_47, {
    message: 'defaultLocaleCode must be a BCP 47 language tag, e.g. "ar".',
  })
  defaultLocaleCode: string;
}
