import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';

import type { UpdateLocalePayload } from '@cms/contracts';
import type { TextDirection } from '@cms/domain';

/**
 * `code` is absent on purpose, and absence is the enforcement: `ValidationPipe`
 * runs with `forbidNonWhitelisted`, so `PATCH /locales/:id {"code":"fr"}` is a
 * 400 rather than a silently ignored field. A locale code is part of the
 * runtime bundle URL, so renaming one breaks every deployed client app —
 * the same reasoning as invariant Rule 8 for app and module slugs.
 *
 * Deactivate with `isActive: false`; there is no DELETE, because `locales` is
 * referenced `ON DELETE RESTRICT` from `apps`, `app_locales` and
 * `translation_values`.
 */
export class UpdateLocaleDto implements UpdateLocalePayload {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  nativeName?: string;

  @IsOptional()
  @IsIn(['ltr', 'rtl'])
  direction?: TextDirection;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
