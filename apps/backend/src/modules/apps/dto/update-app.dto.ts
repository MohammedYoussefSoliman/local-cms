import { IsOptional, IsString, Length } from 'class-validator';

import type { UpdateAppPayload } from '@cms/contracts';

/**
 * `slug` is absent, and its absence is the enforcement: `ValidationPipe` runs
 * with `forbidNonWhitelisted`, so `PATCH /apps/:id {"slug":"x"}` is a 400 and
 * not a silently dropped field. The slug is compiled into every deployed
 * client's bundle URL (invariant Rule 8) — renaming one is a migration path,
 * never an UPDATE.
 *
 * `defaultLocaleCode` is absent for a different reason: promoting a new default
 * means demoting the old one in the same transaction, or
 * `uq_app_locales_one_default` rejects the pair. That is its own endpoint.
 */
export class UpdateAppDto implements UpdateAppPayload {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;
}
