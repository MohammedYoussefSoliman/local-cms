import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser, Roles } from '@/common';

import { CreateEntryDto } from './dto/create-entry.dto';
import { ListEntriesQueryDto } from './dto/list-entries.query.dto';
import { EntriesService } from './entries.service';

/**
 * Entries are addressed through their module, never through an app: the module
 * is what decides app vs. global scope, so an entry carries no `appId` of its
 * own (invariant Rule 3).
 */
@Controller('modules/:moduleId/entries')
export class ModuleEntriesController {
  constructor(private readonly entries: EntriesService) {}

  /**
   * no-role: deliberate. This is the translation editor's main table — an
   * editor who cannot read it cannot do the job the role exists for.
   */
  @Get()
  findAll(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Query() query: ListEntriesQueryDto,
  ) {
    return this.entries.findAll(moduleId, query);
  }

  /**
   * Editors create keys as well as translate them — adding copy is the job,
   * not an administrative act.
   */
  @Roles('admin', 'editor')
  @Post()
  create(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: CreateEntryDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.entries.create(moduleId, dto, userId);
  }
}
