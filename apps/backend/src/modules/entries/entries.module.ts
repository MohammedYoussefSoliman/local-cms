import { TranslationEntry, TranslationValue } from '@cms/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppsModule } from '../apps/apps.module';
import { LocalesModule } from '../locales/locales.module';
import { TranslationModulesModule } from '../translation-modules/translation-modules.module';

import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';
import { ModuleEntriesController } from './module-entries.controller';

/**
 * `TranslationValue` is registered read-only here: B5 reads values to build the
 * editor's table but never writes one. Writing them — with the history row and
 * the optimistic-lock check that go with it — is B6's job.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TranslationEntry, TranslationValue]),
    TranslationModulesModule,
    AppsModule,
    LocalesModule,
  ],
  controllers: [ModuleEntriesController, EntriesController],
  providers: [EntriesService],
  // B6 addresses a value by its entry and resolves `:entryId` here.
  exports: [EntriesService],
})
export class EntriesModule {}
