import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ApiKeysService } from '../../modules/api-keys/api-keys.service';
import {
  API_KEY_HEADER,
  type ServiceCredentialRequest,
} from '../decorators/service-credential.decorator';

/**
 * Authenticates a route marked `@ServiceCredential()`. Not registered globally:
 * `JwtAuthGuard` delegates to it when it finds the marker, which keeps one
 * guard answering "who is this request" for the whole API.
 *
 * Everything here is 401, never 403 — a missing or revoked key is an identity
 * problem (auth Rule 3). Whether a valid key may read a *particular* app is a
 * separate question, answered by `ApiKeysService.assertServesApp`.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<ServiceCredentialRequest>();

    const presented = request.header(API_KEY_HEADER);
    if (!presented) {
      throw new UnauthorizedException('A service credential is required.');
    }

    const apiKey = await this.apiKeys.resolve(presented);
    if (!apiKey) {
      // One message for "no such key" and "revoked key" alike: telling a caller
      // which of the two it was confirms that a key exists.
      throw new UnauthorizedException('Invalid service credential.');
    }

    request.apiKey = {
      id: apiKey.id,
      appId: apiKey.appId,
      prefix: apiKey.prefix,
    };

    return true;
  }
}
