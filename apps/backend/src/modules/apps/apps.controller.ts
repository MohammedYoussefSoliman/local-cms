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

import { AppsService } from './apps.service';
import { CreateAppDto } from './dto/create-app.dto';
import { ListAppsQueryDto } from './dto/list-apps.query.dto';
import { UpdateAppDto } from './dto/update-app.dto';

@Controller('apps')
export class AppsController {
  constructor(private readonly apps: AppsService) {}

  /**
   * no-role: deliberate. An editor has to pick the app they are translating
   * before they can do anything at all, so the list is readable by every
   * authenticated user. Only the writes below are admin.
   */
  @Get()
  findAll(@Query() query: ListAppsQueryDto) {
    return this.apps.findAll(query);
  }

  /** no-role: same reasoning as the list — reading an app is not privileged. */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.apps.findOne(id);
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateAppDto) {
    return this.apps.create(dto);
  }

  /**
   * There is no DELETE. `apps` is the root of everything — modules, entries,
   * values — and `ON DELETE CASCADE` from here would take a product's entire
   * translation history with it on one mistaken click.
   */
  @Roles('admin')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAppDto) {
    return this.apps.update(id, dto);
  }
}
