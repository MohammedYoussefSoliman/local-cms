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

import { CreateLocaleDto } from './dto/create-locale.dto';
import { ListLocalesQueryDto } from './dto/list-locales.query.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';
import { LocalesService } from './locales.service';

@Controller('locales')
export class LocalesController {
  constructor(private readonly locales: LocalesService) {}

  /**
   * no-role: deliberate. Every authenticated user needs the locale list to
   * render the translation editor's columns, editors included.
   */
  @Get()
  findAll(@Query() query: ListLocalesQueryDto) {
    return this.locales.findAll(query);
  }

  /** Adding a language is an admin action, and only an INSERT. */
  @Roles('admin')
  @Post()
  create(@Body() dto: CreateLocaleDto) {
    return this.locales.create(dto);
  }

  /**
   * There is no DELETE: `locales` is referenced `ON DELETE RESTRICT` from
   * three tables, so retiring a language is `isActive: false`.
   */
  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocaleDto,
  ) {
    return this.locales.update(id, dto);
  }
}
