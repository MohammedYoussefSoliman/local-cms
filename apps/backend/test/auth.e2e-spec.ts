import { RequestMethod } from '@nestjs/common';
import {
  METHOD_METADATA,
  PATH_METADATA,
  VERSION_METADATA,
} from '@nestjs/common/constants';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import request from 'supertest';

import type { UserRole } from '@cms/domain';

import { IS_PUBLIC_KEY, ROLES_KEY, SERVICE_CREDENTIAL_KEY } from '../src/common';

import {
  type TestUser,
  createTestApp,
  deleteTestUsers,
  signInAs,
} from './helpers/test-app';

import type { INestApplication } from '@nestjs/common';

/**
 * The three routes `.claude/rules/nestjs-auth.md` Rule 2 allows to be
 * `@Public()`. Adding a fourth is a review-blocking change, and this is where
 * it stops being a convention and becomes a failing test.
 */
const PUBLIC_ALLOWLIST = [
  'GET /api/health',
  'POST /api/auth/login',
  'POST /api/auth/refresh',
];

/**
 * Stand-ins for route parameters. Guards run before pipes, so none of these
 * ever reach a `ParseUUIDPipe` — they exist to make a URL, and to make the
 * failure message readable when one of these requests does not 401.
 */
const PLACEHOLDER_ID = '00000000-0000-4000-8000-000000000000';
const PARAM_VALUES: Record<string, string> = {
  localeCode: 'ar',
  appSlug: 'e2e-auth-sweep',
  moduleSlug: 'e2e-auth-sweep',
  version: '1',
};

type Route = {
  /** `GET /api/apps/:appId/locales` — the template, for failure messages. */
  signature: string;
  /** Lowercased and param-substituted, ready for supertest. */
  method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';
  url: string;
  isPublic: boolean;
  isServiceCredential: boolean;
  roles: UserRole[] | undefined;
};

/**
 * Every route the application actually registered, read back out of the
 * decorator metadata Nest itself routes on.
 *
 * Deliberately not the Express router stack: Express 5 moved it and
 * path-to-regexp 8 no longer surfaces the original path strings, so a suite
 * built on those internals breaks on a framework patch release and — worse —
 * breaks by finding *fewer* routes, which looks like a pass. Reading
 * `PATH_METADATA` asks the same source Nest asks.
 */
function collectRoutes(app: INestApplication, prefix: string): Route[] {
  const scanner = new MetadataScanner();
  const routes: Route[] = [];

  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;

      const prototype = Object.getPrototypeOf(instance) as object;

      for (const name of scanner.getAllMethodNames(prototype)) {
        const handler = (prototype as Record<string, unknown>)[name];
        const verb = Reflect.getMetadata(METHOD_METADATA, handler as object);

        // `RequestMethod.GET` is 0, so this cannot be a truthiness check.
        if (verb === undefined) continue;

        const version =
          Reflect.getMetadata(VERSION_METADATA, handler as object) ??
          Reflect.getMetadata(VERSION_METADATA, metatype);

        const template = join(
          prefix,
          typeof version === 'string' ? `v${version}` : '',
          Reflect.getMetadata(PATH_METADATA, metatype),
          Reflect.getMetadata(PATH_METADATA, handler as object),
        );

        const method = RequestMethod[verb].toLowerCase() as Route['method'];

        routes.push({
          signature: `${RequestMethod[verb]} ${template}`,
          method,
          url: substituteParams(template),
          isPublic:
            Reflect.getMetadata(IS_PUBLIC_KEY, handler as object) === true ||
            Reflect.getMetadata(IS_PUBLIC_KEY, metatype) === true,
          isServiceCredential:
            Reflect.getMetadata(SERVICE_CREDENTIAL_KEY, handler as object) ===
              true ||
            Reflect.getMetadata(SERVICE_CREDENTIAL_KEY, metatype) === true,
          roles:
            Reflect.getMetadata(ROLES_KEY, handler as object) ??
            Reflect.getMetadata(ROLES_KEY, metatype),
        });
      }
    }
  }

  return routes.sort((a, b) => a.signature.localeCompare(b.signature));
}

/** Joins path fragments into one absolute path, tolerating `/` and `''`. */
function join(...fragments: unknown[]): string {
  const segments = fragments
    .filter((fragment): fragment is string => typeof fragment === 'string')
    .flatMap((fragment) => fragment.split('/'))
    .filter(Boolean);

  return `/${segments.join('/')}`;
}

function substituteParams(template: string): string {
  return template.replace(
    /:([A-Za-z0-9_]+)/g,
    (_match, name: string) => PARAM_VALUES[name] ?? PLACEHOLDER_ID,
  );
}

describe('Authentication coverage (e2e)', () => {
  let app: INestApplication;
  let editor: TestUser;
  let routes: Route[];

  beforeAll(async () => {
    app = await createTestApp();
    routes = collectRoutes(app, 'api');
    editor = await signInAs(app, 'editor');
  });

  afterAll(async () => {
    await deleteTestUsers(app, [editor.id]);
    await app.close();
  });

  describe('the route enumeration itself', () => {
    /**
     * Without this the rest of the file is a sweep over an empty list, which
     * passes silently. Every assertion below depends on the collector having
     * found the real application, so that is the first thing asserted.
     */
    it('found the application', () => {
      expect(routes.length).toBeGreaterThan(20);
      expect(routes.map((route) => route.signature)).toContain(
        'POST /api/auth/login',
      );
      expect(routes.map((route) => route.signature)).toContain(
        'GET /api/v1/apps/:appSlug/locales/:localeCode',
      );
    });
  });

  describe('@Public()', () => {
    it('is carried by exactly the three routes auth Rule 2 allows', () => {
      const actual = routes
        .filter((route) => route.isPublic)
        .map((route) => route.signature);

      // A fourth public route is the single fastest way to leak the CMS, and
      // it is invisible in a diff that only adds a decorator.
      expect(actual).toEqual(PUBLIC_ALLOWLIST);
    });

    it('is never combined with the service-credential marker', () => {
      // `@Public()` wins in `JwtAuthGuard`, so the pair reads as "authenticated
      // by a key" while behaving as "open to the internet".
      const both = routes.filter(
        (route) => route.isPublic && route.isServiceCredential,
      );

      expect(both.map((route) => route.signature)).toEqual([]);
    });
  });

  describe('@ServiceCredential()', () => {
    it('is never combined with @Roles()', () => {
      // A key has no `request.user`, so `RolesGuard` would reject every call —
      // the route would be dead, not stricter.
      const withRoles = routes.filter(
        (route) => route.isServiceCredential && route.roles?.length,
      );

      expect(withRoles.map((route) => route.signature)).toEqual([]);
    });
  });

  describe('no credential', () => {
    /**
     * The sweep. This is the test that catches an endpoint nobody thought
     * about, which no per-endpoint test can do — a new controller is covered
     * the moment it is registered, with nothing to add here.
     *
     * One test rather than `it.each`, because the route list only exists after
     * the app has booted and Jest builds an `each` table before that.
     *
     * The two sweeps together spend roughly two thirds of the global 120/min
     * throttle budget, from one IP, against this file's own app instance. If
     * the surface roughly doubles, this starts failing with 429s rather than
     * with a real finding — raise the limit for the test environment then,
     * rather than trimming the sweep.
     */
    it('rejects every non-public route with 401', async () => {
      const unexpected: string[] = [];

      for (const route of routes.filter((candidate) => !candidate.isPublic)) {
        const response = await request(app.getHttpServer())[route.method](
          route.url,
        );

        if (response.status !== 401) {
          unexpected.push(`${route.signature} answered ${response.status}`);
        }
      }

      expect(unexpected).toEqual([]);
    });

    it('answers in the error envelope', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/apps')
        .expect(401);

      expect(body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
        error: expect.any(String),
        path: '/api/apps',
      });
    });
  });

  describe('a credential without the role', () => {
    /**
     * 403, not 401, everywhere — the dashboard logs people out on a 401, so
     * collapsing the two signs an editor out for opening a page they merely
     * lack permission for.
     */
    it('answers 403 on every route an editor is not allowed to call', async () => {
      const adminOnly = routes.filter(
        (route) =>
          !route.isPublic &&
          !route.isServiceCredential &&
          route.roles?.length &&
          !route.roles.includes('editor'),
      );

      // Same reasoning as the enumeration guard: an empty list would pass.
      expect(adminOnly.length).toBeGreaterThan(5);

      const unexpected: string[] = [];

      for (const route of adminOnly) {
        // Hoisted: a newline before `[route.method]` reads as array indexing.
        const call = request(app.getHttpServer())[route.method](route.url);
        const response = await call.set(
          'Authorization',
          `Bearer ${editor.accessToken}`,
        );

        if (response.status !== 403) {
          unexpected.push(`${route.signature} answered ${response.status}`);
        }
      }

      expect(unexpected).toEqual([]);
    });

    it('answers in the error envelope', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/locales')
        .set('Authorization', `Bearer ${editor.accessToken}`)
        .send({ code: 'fr', name: 'French', nativeName: 'Français' })
        .expect(403);

      expect(body).toMatchObject({
        statusCode: 403,
        error: expect.any(String),
        path: '/api/locales',
      });
    });
  });
});
