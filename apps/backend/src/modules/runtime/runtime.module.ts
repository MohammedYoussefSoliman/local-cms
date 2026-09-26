import { TranslationValue } from '@cms/database';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AppsModule } from '../apps/apps.module';
import { TranslationModulesModule } from '../translation-modules/translation-modules.module';

import { RuntimeController } from './runtime.controller';
import { RuntimeService } from './runtime.service';

/**
 * `TranslationValue` is registered here as well as in `TranslationsModule`, and
 * that is the design rather than an oversight. The runtime read is a different
 * query against the same table — published-only, narrow select, joined through
 * `modules`, no history and no locking — and `TranslationsModule` deliberately
 * does not export its service so that this path cannot be built on the write
 * path's shape.
 *
 * Everything else goes through the owning feature's service: apps and their
 * locales, module slug resolution, and the API key scope check.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TranslationValue]),
    ConfigModule,
    AppsModule,
    TranslationModulesModule,
    ApiKeysModule,
  ],
  controllers: [RuntimeController],
  providers: [RuntimeService],
})
export class RuntimeModule {}
