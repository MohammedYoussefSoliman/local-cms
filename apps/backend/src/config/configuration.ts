import { registerAs } from '@nestjs/config';

import { type Env, validateEnv } from './env.validation';

/**
 * Typed accessors over the validated env, registered as `ConfigModule`
 * namespaces so feature code injects a typed object instead of reaching for
 * string keys. `process.env` is never read outside this folder.
 *
 * Each factory re-runs `validateEnv` rather than receiving the `Env` that
 * `ConfigModule` already parsed: `registerAs` factories take no arguments, and
 * `validateEnv` is pure and runs once per namespace at boot, so the duplicate
 * parse costs nothing and keeps a single source of truth for the shape.
 */
export type AppConfig = {
  env: Env['NODE_ENV'];
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  /** `max-age` on runtime bundle responses, in seconds. */
  runtimeCacheMaxAge: number;
};

export type JwtConfig = {
  accessSecret: string;
  /**
   * Unused by `AuthService` — refresh tokens are opaque random strings, not
   * JWTs. It stays validated and exposed because the two secrets must differ
   * in production, which is only checkable if both are required.
   */
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
  issuer: string;
  audience: string;
};

export type DatabaseConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  logging: boolean;
};

export const appConfig = registerAs('app', (): AppConfig => {
  const env = validateEnv(process.env);

  return {
    env: env.NODE_ENV,
    port: env.PORT,
    apiPrefix: env.API_PREFIX,
    corsOrigins: env.CORS_ORIGINS,
    runtimeCacheMaxAge: env.RUNTIME_CACHE_MAX_AGE,
  };
});

export const jwtConfig = registerAs('jwt', (): JwtConfig => {
  const env = validateEnv(process.env);

  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  };
});

export const databaseConfig = registerAs('database', (): DatabaseConfig => {
  const env = validateEnv(process.env);

  return {
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    logging: env.DATABASE_LOGGING,
  };
});
