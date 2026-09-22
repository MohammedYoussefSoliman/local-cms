import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

import type { UpdateEntryPayload } from '@cms/contracts';
import type { ContentType } from '@cms/domain';

const ENTRY_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const CONTENT_TYPES: ContentType[] = ['text', 'rich_text', 'icu_message'];

/**
 * `moduleId` is absent: an entry does not move between namespaces, and its
 * module is what decides app vs. global scope (invariant Rule 2). `key` *is*
 * present — it is not part of any runtime URL, so Rule 8 does not reach it —
 * but renaming a shipped key breaks every client calling `t()` with the old
 * one. A rename that collides is a 409 from `uq_entries_module_key`.
 */
export class UpdateEntryDto implements UpdateEntryPayload {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  @Matches(ENTRY_KEY, {
    message:
      'key must start with a letter or digit and contain only letters, digits, dots, underscores and hyphens.',
  })
  key?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;

  @IsOptional()
  @IsIn(CONTENT_TYPES)
  contentType?: ContentType;
}
