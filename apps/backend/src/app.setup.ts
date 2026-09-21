import {
  VERSION_NEUTRAL,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import helmet from 'helmet';

import type { AppConfig } from './config/configuration';
import type { INestApplication } from '@nestjs/common';

/**
 * Everything that turns a bare Nest app into this API, in one place so the
 * e2e suite exercises the same pipeline production runs. Duplicating this
 * setup inside tests is how a suite ends up passing against an app that
 * validates differently from the deployed one.
 */
export function configureApp(
  app: INestApplication,
  config: Pick<AppConfig, 'apiPrefix' | 'corsOrigins'>,
): void {
  app.use(helmet());
  app.setGlobalPrefix(config.apiPrefix);

  /**
   * CMS endpoints stay unversioned at `/api/...`; only the runtime read API
   * carries `@Version('1')` and lands at `/api/v1/apps/...` (arch doc §9).
   * Without an explicit default, `enableVersioning()` demands a version on
   * every route and the whole CMS surface 404s.
   */
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: VERSION_NEUTRAL,
  });

  app.enableCors({ origin: config.corsOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      // Strips properties with no decorator, so a client cannot smuggle
      // `role: 'admin'` into a profile update.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
}
