import { IsOptional, IsString, Length, Matches } from 'class-validator';

import { PaginationQueryDto } from '@/common';

const BCP_47 = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** `search` matches the entry key. */
export class ListEntriesQueryDto extends PaginationQueryDto {
  /**
   * Returns only entries with no value at all in this language — the
   * missing-translation filter behind the dashboard's completeness indicator.
   * A locale code, not an id: the dashboard never sees locale ids.
   */
  @IsOptional()
  @IsString()
  @Length(2, 35)
  @Matches(BCP_47, {
    message: 'missingLocale must be a BCP 47 language tag, for example "ar".',
  })
  missingLocale?: string;
}
