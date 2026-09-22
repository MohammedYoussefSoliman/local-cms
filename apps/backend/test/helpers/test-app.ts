import { randomUUID } from 'node:crypto';

import { User } from '@cms/database';
import { Test, type TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { DataSource } from 'typeorm';

import type { UserRole } from '@cms/domain';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

import type { INestApplication } from '@nestjs/common';

/** Long enough to pass any future password policy; meaningless by design. */
const TEST_PASSWORD = 'e2e-password-not-a-secret';

/**
 * Boots the real application through `configureApp`, so a spec exercises the
 * same prefix, versioning, validation and guard stack that production does.
 * Building a bespoke pipeline in tests is how a suite ends up green against
 * an app that validates differently from the deployed one.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app, { apiPrefix: 'api', corsOrigins: [] });
  await app.init();

  return app;
}

export type TestUser = {
  id: string;
  email: string;
  accessToken: string;
};

/**
 * Creates a throwaway user with the given role and logs it in over HTTP, so
 * the token under test is one the real login path minted. Each caller owns the
 * user it creates and passes the id to `deleteTestUsers` afterwards
 * (testing Rule 5).
 *
 * `POST /auth/login` is throttled at 5/minute per IP and the limiter is
 * in-memory per app instance — a spec that needs more than a handful of
 * identities should reuse tokens rather than signing in repeatedly.
 */
export async function signInAs(
  app: INestApplication,
  role: UserRole,
): Promise<TestUser> {
  const dataSource = app.get(DataSource);
  const email = `e2e-${role}-${randomUUID()}@example.test`;

  const user = await dataSource.getRepository(User).save({
    email,
    name: `E2E ${role}`,
    role,
    status: 'active',
    passwordHash: await argon2.hash(TEST_PASSWORD),
  });

  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);

  return { id: user.id, email, accessToken: response.body.data.accessToken };
}

/** `refresh_sessions` is ON DELETE CASCADE, so the login rows go with them. */
export async function deleteTestUsers(
  app: INestApplication,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await app.get(DataSource).getRepository(User).delete(ids);
}
