import { ApiKey } from '@cms/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeyGuard } from '@/common';

import { AppsModule } from '../apps/apps.module';

import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { AppApiKeysController } from './app-api-keys.controller';

/**
 * Provides and exports `ApiKeyGuard`. The guard is not registered globally —
 * `JwtAuthGuard` delegates to it — but `JwtAuthGuard` is constructed by
 * `AppModule`, so the guard has to be resolvable from there, which is what this
 * export is for.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ApiKey]), AppsModule],
  controllers: [AppApiKeysController, ApiKeysController],
  providers: [ApiKeysService, ApiKeyGuard],
  // B8's runtime controller asks `assertServesApp` whether the presented
  // credential may read the app in the URL.
  exports: [ApiKeysService, ApiKeyGuard],
})
export class ApiKeysModule {}
