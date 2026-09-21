import { ENTITIES } from '@cms/database';

import type { DatabaseConfig } from './configuration';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Nest's runtime DataSource. It reuses the entity set from `@cms/database` so
 * the CLI (which owns migrations) and the app can never see different schemas.
 *
 * `synchronize` stays false in every environment — see the note in
 * `libs/database/src/data-source.ts`.
 */
export function typeOrmConfig(config: DatabaseConfig): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    entities: ENTITIES,
    synchronize: false,
    migrationsRun: false,
    logging: config.logging,
    autoLoadEntities: false,
  };
}
