import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { Roles } from '@/common';

import { CreateTranslationModuleDto } from './dto/create-translation-module.dto';
import { ListTranslationModulesQueryDto } from './dto/list-translation-modules.query.dto';
import { TranslationModulesService } from './translation-modules.service';

/**
 * The app-scoped half of the surface. Everything routed here is
 * `scope: 'app'` by construction — the path segment is the scope.
 */
@Controller('apps/:appId/modules')
export class AppTranslationModulesController {
  constructor(private readonly modules: TranslationModulesService) {}

  /**
   * no-role: deliberate. An editor picks a namespace before translating
   * anything in it, so the list is readable by every authenticated user.
   */
  @Get()
  findAll(
    @Param('appId', ParseUUIDPipe) appId: string,
    @Query() query: ListTranslationModulesQueryDto,
  ) {
    return this.modules.findAllForApp(appId, query);
  }

  @Roles('admin')
  @Post()
  create(
    @Param('appId', ParseUUIDPipe) appId: string,
    @Body() dto: CreateTranslationModuleDto,
  ) {
    return this.modules.createForApp(appId, dto);
  }
}
