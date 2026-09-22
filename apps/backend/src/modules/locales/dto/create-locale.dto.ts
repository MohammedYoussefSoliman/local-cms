import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

import type { CreateLocalePayload } from '@cms/contracts';
import type { TextDirection } from '@cms/domain';

/**
 * A permissive BCP 47 shape: a 2-3 letter language subtag followed by any
 * number of alphanumeric subtags. Deliberately not a registry lookup — the
 * point is to reject `../etc/passwd` and ` en `, not to arbitrate whether
 * `qaa-Qaaa-QM` is a real language.
 */
const BCP_47 = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export class CreateLocaleDto implements CreateLocalePayload {
  @IsString()
  @Length(2, 35)
  @Matches(BCP_47, {
    message: 'code must be a BCP 47 language tag, for example "ar" or "pt-BR".',
  })
  code: string;

  /** English name, e.g. "Arabic". */
  @IsString()
  @Length(1, 128)
  name: string;

  /** Endonym, e.g. "العربية". */
  @IsString()
  @Length(1, 128)
  nativeName: string;

  /** `ck_locales_direction` rejects anything else; this turns it into a 400. */
  @IsOptional()
  @IsIn(['ltr', 'rtl'])
  direction?: TextDirection;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
