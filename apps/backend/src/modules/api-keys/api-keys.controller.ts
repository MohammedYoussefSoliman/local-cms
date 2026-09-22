import { Controller, Delete, Param, ParseUUIDPipe } from '@nestjs/common';

import { Roles } from '@/common';

import { ApiKeysService } from './api-keys.service';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  /**
   * `DELETE` that revokes rather than deletes, and answers 200 with the revoked
   * key rather than 204. The row survives — `last_used_at` and the creator are
   * the audit — so there *is* something to return, and returning it lets the
   * dashboard show when the key was last used by whatever it just cut off.
   */
  @Roles('admin')
  @Delete(':id')
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeys.revoke(id);
  }
}
