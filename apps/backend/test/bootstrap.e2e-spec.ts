import { Controller, Get, type INestApplication, Version } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Public } from '../src/common';

/**
 * Declared here rather than in `src/` on purpose: it exists only to prove the
 * routing setup in `configureApp`, and a real `*.controller.ts` carrying
 * `@Public()` would (correctly) be reported by the audit-api-auth agent.
 */
@Controller('version-probe')
class VersionProbeController {
  @Public()
  @Version('1')
  @Get()
  probe(): { ok: true } {
    return { ok: true };
  }
}

describe('Application bootstrap (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [VersionProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app, { apiPrefix: 'api', corsOrigins: [] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('URI versioning', () => {
    it('serves a @Version("1") route under the version segment', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/version-probe')
        .expect(200);
    });

    it('does not serve a versioned route without the version segment', async () => {
      await request(app.getHttpServer()).get('/api/version-probe').expect(404);
    });

    it('still serves undecorated routes with no version segment', async () => {
      // VERSION_NEUTRAL is what keeps the whole CMS surface reachable; drop it
      // and every route below demands a /v1.
      await request(app.getHttpServer()).get('/api/health').expect(200);
    });
  });

  describe('global pipeline', () => {
    it('rejects an unauthenticated request to a protected route with 401', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('wraps a success in the response envelope', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/version-probe')
        .expect(200);

      expect(response.body).toEqual({
        data: { ok: true },
        message: null,
        statusCode: 200,
      });
    });

    it('strips unknown properties instead of passing them to the handler', async () => {
      // forbidNonWhitelisted turns a smuggled field into a 400 rather than a
      // silently ignored one — the mass-assignment guard.
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'a@b.com', password: 'password123', role: 'admin' })
        .expect(400);
    });
  });
});
