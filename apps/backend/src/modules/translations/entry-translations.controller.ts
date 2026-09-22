import { Body, Controller, Param, ParseUUIDPipe, Put } from '@nestjs/common';

import { CurrentUser, Roles } from '@/common';

import { UpsertTranslationDto } from './dto/upsert-translation.dto';
import { TranslationsService } from './translations.service';

@Controller('entries/:entryId/translations')
export class EntryTranslationsController {
  constructor(private readonly translations: TranslationsService) {}

  /**
   * Addressed by locale **code**, not id — the code is what the dashboard, the
   * runtime API and the importer all speak.
   *
   * 200 for both the create and the update, deliberately. PUT is an upsert of a
   * resource the caller named in full, so there is no new location to hand back
   * and nothing for a 201 to tell them that the body does not (HTTP contract
   * Rule 6 reads 201 as "a resource the server placed").
   */
  @Roles('admin', 'editor')
  @Put(':localeCode')
  upsert(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Param('localeCode') localeCode: string,
    @Body() dto: UpsertTranslationDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.translations.upsert(entryId, localeCode, dto, userId);
  }
}
