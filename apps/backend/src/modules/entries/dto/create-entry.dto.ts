import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

import type { CreateEntryPayload } from '@cms/contracts';
import type { ContentType } from '@cms/domain';

/**
 * Translation keys as i18n libraries write them: `add_to_cart`, `cart.title`,
 * `errors.network-timeout`. Anchored so a key cannot start with a separator,
 * which is what keeps a flattened import from producing `.title`.
 */
const ENTRY_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const CONTENT_TYPES: ContentType[] = ['text', 'rich_text', 'icu_message'];

export class CreateEntryDto implements CreateEntryPayload {
  @IsString()
  @Length(1, 255)
  @Matches(ENTRY_KEY, {
    message:
      'key must start with a letter or digit and contain only letters, digits, dots, underscores and hyphens.',
  })
  key: string;

  /** Context for translators — shown beside the key in the editor. */
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string | null;

  /** `ck_entries_content_type` rejects anything else; this makes it a 400. */
  @IsOptional()
  @IsIn(CONTENT_TYPES)
  contentType?: ContentType;
}
