import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import type { TranslationNotePayload } from '@cms/contracts';

/**
 * The body every status transition and the rollback accept. There is no
 * `status` field: the route names the transition, and a status in the body
 * would be a second source of truth able to disagree with the URL.
 */
export class ChangeNoteDto implements TranslationNotePayload {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  changeNote?: string;

  /**
   * Optional on purpose. The importer, the smoke script and the existing e2e
   * suite all publish without one, and omitting it keeps the documented
   * last-write-wins behaviour. The dashboard always sends it: a batch publish
   * that skips the check can put text on a live storefront that nobody read.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
