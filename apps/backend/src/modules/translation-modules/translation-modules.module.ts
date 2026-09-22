import { TranslationModule } from '@cms/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppsModule } from '../apps/apps.module';

import { AppTranslationModulesController } from './app-translation-modules.controller';
import { TranslationModulesController } from './translation-modules.controller';
import { TranslationModulesService } from './translation-modules.service';

/**
 * `TranslationModulesModule`, not `ModulesModule`: the domain's "module" is a
 * translation namespace and `@Module()` is the decorator, so the two never
 * share a name (module-structure rule).
 *
 * Two controllers, one feature — `/apps/:appId/modules` and `/modules` are the
 * two scopes of the same table.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TranslationModule]), AppsModule],
  controllers: [AppTranslationModulesController, TranslationModulesController],
  providers: [TranslationModulesService],
  // B5 addresses entries through their module and resolves `:moduleId` here.
  exports: [TranslationModulesService],
})
export class TranslationModulesModule {}
