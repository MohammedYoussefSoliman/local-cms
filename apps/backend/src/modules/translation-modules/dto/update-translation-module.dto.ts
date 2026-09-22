import { IsOptional, IsString, Length } from 'class-validator';

import type { UpdateTranslationModulePayload } from '@cms/contracts';

/**
 * `slug` and `scope` are both absent, and their absence is the enforcement:
 * `forbidNonWhitelisted` rejects either with a 400 rather than dropping it
 * silently.
 *
 * The slug is compiled into every deployed client's bundle path (Rule 8).
 * The scope is the module's identity — moving a namespace between an app and
 * the global set changes which entries resolve for whom, and would have to
 * move its entries with it.
 */
export class UpdateTranslationModuleDto
  implements UpdateTranslationModulePayload
{
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;
}
