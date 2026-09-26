import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { DraftsService } from './drafts.service';
import { ListDraftsQueryDto } from './dto/list-drafts.query.dto';

/**
 * The dashboard's drafts queue, scoped to one app.
 *
 * Addressed through the app rather than through a module because "what have we
 * saved and not shipped?" is an application-wide question — asking it per
 * module is the fan-out this endpoint exists to remove.
 */
@ApiTags('drafts')
@Controller('apps/:appId/drafts')
export class AppDraftsController {
  constructor(private readonly drafts: DraftsService) {}

  /**
   * no-role: deliberate. Same reasoning as `GET /modules/:moduleId/entries` —
   * an editor who cannot see what they have left unpublished cannot do the job
   * the role exists for.
   */
  @ApiOperation({ summary: "List an app's saved-but-unpublished values." })
  @Get()
  findAll(
    @Param('appId', ParseUUIDPipe) appId: string,
    @Query() query: ListDraftsQueryDto,
  ) {
    return this.drafts.findAll(appId, query);
  }
}
