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
} from '@nestjs/common';

import { Roles } from '@/common';

import { UpdateEntryDto } from './dto/update-entry.dto';
import { EntriesService } from './entries.service';

@Controller('entries')
export class EntriesController {
  constructor(private readonly entries: EntriesService) {}

  /** no-role: reading a key is not privileged. */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.entries.findOne(id);
  }

  @Roles('admin', 'editor')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEntryDto,
  ) {
    return this.entries.update(id, dto);
  }

  /**
   * Admin only, and narrower than it looks: this cascades to every language's
   * value and to their append-only history, so it destroys the audit trail for
   * the key. Archiving is the better default once B6 gives entries a status.
   */
  @Roles('admin')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.entries.remove(id);
  }
}
