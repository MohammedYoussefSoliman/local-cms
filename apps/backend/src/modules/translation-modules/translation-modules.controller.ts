import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { Roles } from '@/common';

import { CreateTranslationModuleDto } from './dto/create-translation-module.dto';
import { ListTranslationModulesQueryDto } from './dto/list-translation-modules.query.dto';
import { UpdateTranslationModuleDto } from './dto/update-translation-module.dto';
import { TranslationModulesService } from './translation-modules.service';

/**
 * The global half of the surface, plus the by-id routes that serve either
 * scope.
 *
 * Handler order matters here: Nest matches in declaration order, so
 * `GET /modules/global` must be declared before `GET /modules/:id` or the
 * literal segment would be swallowed by the parameter.
 */
@Controller('modules')
export class TranslationModulesController {
  constructor(private readonly modules: TranslationModulesService) {}

  /** no-role: global namespaces are shared reference data for every editor. */
  @Get('global')
  findAllGlobal(@Query() query: ListTranslationModulesQueryDto) {
    return this.modules.findAllGlobal(query);
  }

  /**
   * A global module is created here and nowhere else, so `appId` is null by
   * construction rather than by validation (invariant Rule 2).
   */
  @Roles('admin')
  @Post('global')
  createGlobal(@Body() dto: CreateTranslationModuleDto) {
    return this.modules.createGlobal(dto);
  }

  /** no-role: reading a namespace is not privileged, whatever its scope. */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.modules.findOne(id);
  }

  /**
   * There is no DELETE. `modules` cascades to `entries` and on to
   * `translation_values`, so deleting one would take every translation in the
   * namespace, and its append-only history with it.
   */
  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTranslationModuleDto,
  ) {
    return this.modules.update(id, dto);
  }
}
