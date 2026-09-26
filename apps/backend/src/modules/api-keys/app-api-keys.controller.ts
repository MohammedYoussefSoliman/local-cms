import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { CurrentUser, Roles } from '@/common';

import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

/**
 * Admin-only throughout. A service credential reads an app's entire published
 * content, so issuing one is a wider decision than writing a translation — and
 * `@Roles('admin')` on the list matters as much as on the create, because the
 * list is what tells you which credentials exist to go looking for.
 */
@Controller('apps/:appId/api-keys')
@Roles('admin')
export class AppApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  findAll(@Param('appId', ParseUUIDPipe) appId: string) {
    return this.apiKeys.findAll(appId);
  }

  /**
   * The response carries the plaintext key, and this is the only time it ever
   * will — the dashboard has to make the reader copy it before navigating away.
   */
  @Post()
  create(
    @Param('appId', ParseUUIDPipe) appId: string,
    @Body() dto: CreateApiKeyDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.apiKeys.create(appId, dto, userId);
  }
}
