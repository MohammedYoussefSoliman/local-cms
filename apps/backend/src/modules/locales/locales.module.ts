import { Locale } from '@cms/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LocalesController } from './locales.controller';
import { LocalesService } from './locales.service';

@Module({
  imports: [TypeOrmModule.forFeature([Locale])],
  controllers: [LocalesController],
  providers: [LocalesService],
  // B3 resolves `:localeCode` to a locale when enabling one for an app, and
  // goes through this service rather than reaching for the repository.
  exports: [LocalesService],
})
export class LocalesModule {}
