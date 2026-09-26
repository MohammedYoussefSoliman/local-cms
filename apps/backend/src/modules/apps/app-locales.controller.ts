import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { Roles } from '@/common';

import { AppLocalesService } from './app-locales.service';
import { SetAppLocaleFallbackDto } from './dto/set-fallback.dto';

@Controller('apps/:appId/locales')
export class AppLocalesController {
  constructor(private readonly appLocales: AppLocalesService) {}

  /**
   * no-role: deliberate. The translation editor renders one column per enabled
   * locale, built from this response — an editor cannot work without it.
   */
  @Get()
  findAll(@Param('appId', ParseUUIDPipe) appId: string) {
    return this.appLocales.findAll(appId);
  }

  /** 200, not 201: enabling an already-configured locale updates its row. */
  @Roles('admin')
  @Post(':localeCode/enable')
  @HttpCode(HttpStatus.OK)
  enable(
    @Param('appId', ParseUUIDPipe) appId: string,
    @Param('localeCode') localeCode: string,
  ) {
    return this.appLocales.enable(appId, localeCode);
  }

  /**
   * `DELETE` by verb, deactivation by effect: the `app_locales` row survives so
   * the fallback configured for this language is still there when it is
   * switched back on. Returns the updated row rather than 204 for that reason —
   * nothing was actually deleted.
   */
  @Roles('admin')
  @Delete(':localeCode/disable')
  @HttpCode(HttpStatus.OK)
  disable(
    @Param('appId', ParseUUIDPipe) appId: string,
    @Param('localeCode') localeCode: string,
  ) {
    return this.appLocales.disable(appId, localeCode);
  }

  @Roles('admin')
  @Patch(':localeCode/fallback')
  setFallback(
    @Param('appId', ParseUUIDPipe) appId: string,
    @Param('localeCode') localeCode: string,
    @Body() dto: SetAppLocaleFallbackDto,
  ) {
    return this.appLocales.setFallback(appId, localeCode, dto);
  }
}
