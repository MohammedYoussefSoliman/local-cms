import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

import type { UpsertTranslationPayload } from '@cms/contracts';

export class UpsertTranslationDto implements UpsertTranslationPayload {
  /**
   * Not optional and not empty. "This language has no translation yet" is
   * represented by the absence of a row, not by an empty string — an empty
   * string would publish a blank where the client app expects copy, and
   * `missingLocale` would stop finding the key.
   */
  @IsString()
  @IsNotEmpty()
  value: string;

  /**
   * The version the editor was looking at. Omitting it is a deliberate
   * last-write-wins — the importer does that, an editor never should.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
