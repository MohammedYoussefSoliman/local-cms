import {
  IsDefined,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

import type { SetAppLocaleFallbackPayload } from '@cms/contracts';

const BCP_47 = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/**
 * `null` is a meaningful value here, not an omission: it clears the fallback so
 * resolution for this language ends at the translation key itself (invariant
 * Rule 5, step 4).
 *
 * Hence `@ValidateIf` rather than `@IsOptional()`. `@IsOptional()` would skip
 * `undefined` too, and an empty body would then silently clear a configured
 * fallback. `@ValidateIf` lets `null` through and leaves `@IsDefined()` to
 * reject the omission with a 400.
 */
export class SetAppLocaleFallbackDto implements SetAppLocaleFallbackPayload {
  @ValidateIf((_object, value) => value !== null)
  @IsDefined()
  @IsString()
  @Length(2, 35)
  @Matches(BCP_47, {
    message: 'fallbackLocaleCode must be a BCP 47 language tag, or null.',
  })
  fallbackLocaleCode: string | null;
}
