import { type ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';

import type { Request } from 'express';

export const SERVICE_CREDENTIAL_KEY = 'serviceCredential';

/** The header a client application presents its key in. */
export const API_KEY_HEADER = 'x-api-key';

/** What `ApiKeyGuard` attaches to the request once a key checks out. */
export type ApiKeyContext = {
  id: string;
  /** The one app this credential may read. Everything else is 403. */
  appId: string;
  prefix: string;
};

export type ServiceCredentialRequest = Request & { apiKey?: ApiKeyContext };

/**
 * Marks a route as authenticated by an API key rather than by a user session.
 *
 * This is **not** `@Public()`. The route still authenticates — `JwtAuthGuard`
 * reads this marker and hands the request to `ApiKeyGuard` instead of running
 * the JWT strategy. That is what lets the runtime endpoints serve client apps
 * while `@Public()` stays capped at the three routes auth Rule 2 allows, and
 * while the authorization model stays greppable from the HTTP surface.
 *
 * A route carrying this marker has no `request.user`, so `@Roles()` on one is
 * meaningless — the scope check is the key's `appId`.
 */
export const ServiceCredential = () =>
  SetMetadata(SERVICE_CREDENTIAL_KEY, true);

/**
 * Reads the authenticated credential off the request. The service-credential
 * counterpart to `@CurrentUser()`, and for the same reason: controllers never
 * touch the raw request.
 */
export const CurrentApiKey = createParamDecorator(
  (data: keyof ApiKeyContext | undefined, context: ExecutionContext) => {
    const request = context
      .switchToHttp()
      .getRequest<ServiceCredentialRequest>();
    const apiKey = request.apiKey;
    if (!apiKey) return undefined;
    return data ? apiKey[data] : apiKey;
  },
);
