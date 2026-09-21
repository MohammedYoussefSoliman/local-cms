import { resolve } from 'node:path';

import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import { ENTITIES } from './entities';

/**
 * Explicit paths rather than a bare `loadEnv()`. The CLI and the seeder run
 * with `libs/database` as the working directory, where there is no `.env`, so
 * the default lookup silently fell through to the hard-coded values below —
 * meaning a changed `DATABASE_PASSWORD` in `apps/backend/.env` was ignored by
 * `migration:run` while the API picked it up.
 *
 * `apps/backend/.env` comes first because that is the file `.env.example`
 * documents; a repo-root `.env` is the fallback for CI and containers. dotenv
 * does not overwrite a variable that is already set, so real environment
 * variables still win over both.
 */
const REPO_ROOT = resolve(__dirname, '../../..');

loadEnv({
  path: [
    resolve(REPO_ROOT, 'apps/backend/.env'),
    resolve(REPO_ROOT, '.env'),
  ],
});

/**
 * Single DataSource used by both the TypeORM CLI (migrations) and the Nest
 * `TypeOrmModule`, so the two can never drift apart.
 *
 * `synchronize` is hard-coded to false. It is never turned on, not even in
 * development — a schema this app cares about (partial unique indexes, CHECK
 * constraints, CITEXT) cannot be expressed by synchronize, and it would
 * silently drop them.
 */
export const dataSourceOptions = {
  type: 'postgres' as const,
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'cms',
  password: process.env.DATABASE_PASSWORD ?? 'cms',
  database: process.env.DATABASE_NAME ?? 'localization_cms',
  entities: ENTITIES,
  migrations: [`${__dirname}/migrations/*.{ts,js}`],
  migrationsTableName: 'cms_migrations',
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === 'true',
};

/**
 * Named export only. TypeORM's CLI scans this file's exports for `DataSource`
 * instances and refuses to run when it finds more than one — a `default` that
 * re-exports `AppDataSource` counts as a second instance, not as an alias.
 */
export const AppDataSource = new DataSource(dataSourceOptions);
