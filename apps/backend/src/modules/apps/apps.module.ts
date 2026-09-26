import { AppLocale, LocalizationApp } from '@cms/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LocalesModule } from '../locales/locales.module';

import { AppLocalesController } from './app-locales.controller';
import { AppLocalesService } from './app-locales.service';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';

/**
 * Two controllers, one feature: `/apps` and its `/apps/:appId/locales`
 * sub-resource are the same bounded context, and splitting them into two Nest
 * modules would mean exporting `AppsService` only to import it straight back.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LocalizationApp, AppLocale]), LocalesModule],
  controllers: [AppsController, AppLocalesController],
  providers: [AppsService, AppLocalesService],
  // B4 resolves `:appId` for app-scoped translation modules through this
  // service, and B5 asks `AppLocalesService` which languages an app serves —
  // both go through a service rather than reaching for a repository.
  exports: [AppsService, AppLocalesService],
})
export class AppsModule {}
