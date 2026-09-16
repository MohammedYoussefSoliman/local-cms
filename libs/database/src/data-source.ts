import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import { ENTITIES } from './entities';

loadEnv();

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

export const AppDataSource = new DataSource(dataSourceOptions);

export default AppDataSource;
