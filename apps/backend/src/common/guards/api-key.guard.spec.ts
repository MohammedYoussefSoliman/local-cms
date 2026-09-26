import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { ApiKey } from '@cms/database';


import {
  INVITE_CREDENTIAL_KEY,
  IS_PUBLIC_KEY,
  SERVICE_CREDENTIAL_KEY,
  type ServiceCredentialRequest,
} from '..';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service';

import { ApiKeyGuard } from './api-key.guard';
import { InviteTokenGuard } from './invite-token.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

import type { ExecutionContext } from '@nestjs/common';

type Headers = Record<string, string>;

function requestWith(headers: Headers = {}): ServiceCredentialRequest {
  return {
    header: (name: string) => headers[name.toLowerCase()],
  } as ServiceCredentialRequest;
}

function contextFor(request: object): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

/** A reflector that answers only for the metadata keys it is handed. */
function reflectorFor(metadata: Record<string, boolean>): Reflector {
  return {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
}

describe('ApiKeyGuard', () => {
  let apiKeys: { resolve: jest.Mock };
  let guard: ApiKeyGuard;

  beforeEach(() => {
    apiKeys = { resolve: jest.fn() };
    guard = new ApiKeyGuard(apiKeys as unknown as ApiKeysService);
  });

  it('401s when no key is presented', async () => {
    await expect(
      guard.canActivate(contextFor(requestWith())),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('401s for a key that does not resolve', async () => {
    apiKeys.resolve.mockResolvedValue(null);

    await expect(
      guard.canActivate(contextFor(requestWith({ 'x-api-key': 'nonsense' }))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('401s for a revoked key', async () => {
    // `resolve` filters on `revoked_at IS NULL`, so a revoked key is
    // indistinguishable here from one that never existed — deliberately, since
    // telling them apart confirms that a key exists.
    apiKeys.resolve.mockResolvedValue(null);

    const failure = await guard
      .canActivate(contextFor(requestWith({ 'x-api-key': 'cms_dead.beef' })))
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UnauthorizedException);
    expect((failure as UnauthorizedException).message).toBe(
      'Invalid service credential.',
    );
  });

  it('attaches the credential and its app to the request', async () => {
    apiKeys.resolve.mockResolvedValue({
      id: 'key-1',
      appId: 'app-1',
      prefix: 'cms_a3f91b2c',
      keyHash: 'never-leaves-the-table',
    } as ApiKey);

    const request = requestWith({ 'x-api-key': 'cms_a3f91b2c.secret' });
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.apiKey).toEqual({
      id: 'key-1',
      appId: 'app-1',
      prefix: 'cms_a3f91b2c',
    });
    // Whatever else the row carries stays on the row.
    expect(request.apiKey).not.toHaveProperty('keyHash');
  });
});

describe('JwtAuthGuard delegation', () => {
  let apiKeyGuard: { canActivate: jest.Mock };
  let inviteTokenGuard: { canActivate: jest.Mock };
  let passport: jest.SpyInstance;

  beforeEach(() => {
    apiKeyGuard = { canActivate: jest.fn().mockResolvedValue(true) };
    inviteTokenGuard = { canActivate: jest.fn().mockResolvedValue(true) };
    // `AuthGuard('jwt')` builds the base class; this is the JWT strategy run.
    passport = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);
  });

  afterEach(() => passport.mockRestore());

  function guardWith(metadata: Record<string, boolean>): JwtAuthGuard {
    return new JwtAuthGuard(
      reflectorFor(metadata),
      apiKeyGuard as unknown as ApiKeyGuard,
      inviteTokenGuard as unknown as InviteTokenGuard,
    );
  }

  it('runs the JWT strategy on an ordinary route', () => {
    guardWith({}).canActivate(contextFor(requestWith()));

    expect(passport).toHaveBeenCalled();
    expect(apiKeyGuard.canActivate).not.toHaveBeenCalled();
  });

  it('lets a @Public() route straight through', () => {
    expect(
      guardWith({ [IS_PUBLIC_KEY]: true }).canActivate(
        contextFor(requestWith()),
      ),
    ).toBe(true);

    expect(passport).not.toHaveBeenCalled();
  });

  it('hands a @ServiceCredential() route to ApiKeyGuard', async () => {
    // This is what keeps the runtime endpoints off the `@Public()` list: they
    // authenticate, just not with a user session (auth Rule 2).
    const context = contextFor(requestWith({ 'x-api-key': 'cms_x.secret' }));

    await guardWith({ [SERVICE_CREDENTIAL_KEY]: true }).canActivate(context);

    expect(apiKeyGuard.canActivate).toHaveBeenCalledWith(context);
    expect(passport).not.toHaveBeenCalled();
  });

  it('hands an @InviteCredential() route to InviteTokenGuard', async () => {
    // Someone accepting an invitation has no account to log into yet, so there
    // is no bearer token — but there is still a credential, and it is checked.
    // This is what keeps the accept screen off the `@Public()` list.
    const context = contextFor(requestWith({ 'x-invite-token': 'inv_secret' }));

    await guardWith({ [INVITE_CREDENTIAL_KEY]: true }).canActivate(context);

    expect(inviteTokenGuard.canActivate).toHaveBeenCalledWith(context);
    expect(passport).not.toHaveBeenCalled();
    expect(apiKeyGuard.canActivate).not.toHaveBeenCalled();
  });

  it('prefers @Public() over the service-credential marker', () => {
    // Both on one route is a contradiction; the more permissive answer is the
    // one a reader would expect from `@Public()`, and A1 flags the decorator.
    expect(
      guardWith({
        [IS_PUBLIC_KEY]: true,
        [SERVICE_CREDENTIAL_KEY]: true,
      }).canActivate(contextFor(requestWith())),
    ).toBe(true);

    expect(apiKeyGuard.canActivate).not.toHaveBeenCalled();
  });
});
