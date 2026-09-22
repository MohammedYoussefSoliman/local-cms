import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Deliberately does **not** extend `PaginationQueryDto`, which is the one place
 * in the API that departs from HTTP contract Rule 2. That base class carries
 * `search`, and there is nothing here to search: a history row is a value, a
 * version number and a note, and an accepted-but-ignored `?search=` is a
 * contract that lies to the caller.
 */
export class ListHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
