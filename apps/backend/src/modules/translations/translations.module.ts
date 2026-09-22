import { TranslationValue, TranslationValueVersion } from '@cms/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppsModule } from '../apps/apps.module';
import { EntriesModule } from '../entries/entries.module';
import { LocalesModule } from '../locales/locales.module';
import { TranslationModulesModule } from '../translation-modules/translation-modules.module';

import { EntryTranslationsController } from './entry-translations.controller';
import { TranslationsController } from './translations.controller';
import { TranslationsService } from './translations.service';

/**
 * Two controllers, one feature. A value is written through its entry
 * (`PUT /entries/:entryId/translations/:localeCode`, because the language has
 * no identity of its own until it has a value) and then addressed by its own id
 * for everything afterwards.
 *
 * Not exported: B8's runtime read has its own narrow query and must not reach
 * through the write path to get it.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TranslationValue, TranslationValueVersion]),
    EntriesModule,
    TranslationModulesModule,
    AppsModule,
    LocalesModule,
  ],
  controllers: [EntryTranslationsController, TranslationsController],
  providers: [TranslationsService],
})
export class TranslationsModule {}
