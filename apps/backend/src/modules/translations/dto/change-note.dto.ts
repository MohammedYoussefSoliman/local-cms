import { IsOptional, IsString, MaxLength } from 'class-validator';

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
}
