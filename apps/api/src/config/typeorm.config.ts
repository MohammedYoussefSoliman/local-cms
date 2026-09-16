import { ENTITIES } from '@cms/database';

import type { Env } from './env.validation';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Nest's runtime DataSource. It reuses the entity set from `@cms/database` so
 * the CLI (which owns migrations) and the app can never see different schemas.
 *
 * `synchronize` stays false in every environment — see the note in
 * `libs/database/src/data-source.ts`.
 */
export function typeOrmConfig(env: Env): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    entities: ENTITIES,
    synchronize: false,
    migrationsRun: false,
    logging: env.DATABASE_LOGGING,
    autoLoadEntities: false,
  };
}
