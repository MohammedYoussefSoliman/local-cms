import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser, Roles } from '@/common';

import { ChangeNoteDto } from './dto/change-note.dto';
import { ListHistoryQueryDto } from './dto/list-history.query.dto';
import { TranslationsService } from './translations.service';

@Controller('translations')
export class TranslationsController {
  constructor(private readonly translations: TranslationsService) {}

  /**
   * Advisory: `in_review` is a signal to a colleague, not a gate. Nothing in
   * the API refuses to publish a value that skipped it — review-before-publish
   * is still an open decision (architecture doc §15).
   */
  @Roles('admin', 'editor')
  @Post(':id/submit-review')
  @HttpCode(HttpStatus.OK)
  submitForReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeNoteDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.translations.submitForReview(id, dto, userId);
  }

  /**
   * Editors publish. That is the decision the delivery plan records: a CMS
   * where copy waits on an admin is a CMS people route around, and every
   * publish is in the history with a name against it.
   */
  @Roles('admin', 'editor')
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeNoteDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.translations.publish(id, dto, userId);
  }

  /**
   * Narrower than publishing, because it is the one transition that *removes*
   * copy from live client apps — a key that stops resolving is a blank in a
   * storefront.
   */
  @Roles('admin')
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeNoteDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.translations.archive(id, dto, userId);
  }

  /**
   * Both roles, stated rather than left open: the audit trail carries who wrote
   * what, so it stays behind an explicit list. A read-only role added later is
   * then a deliberate addition here rather than an accidental inheritance.
   */
  @Roles('admin', 'editor')
  @Get(':id/history')
  findHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListHistoryQueryDto,
  ) {
    return this.translations.findHistory(id, query);
  }

  /** A forward write, never a rewind of the history (invariant Rule 6). */
  @Roles('admin', 'editor')
  @Post(':id/rollback/:version')
  @HttpCode(HttpStatus.OK)
  rollback(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() dto: ChangeNoteDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.translations.rollback(id, version, dto, userId);
  }
}
