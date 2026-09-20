import type { Env } from './env.validation';

/**
 * Typed accessors over the validated env. Feature code injects `ConfigService`
 * and reads through these keys — `process.env` is never read outside this
 * folder.
 */
export type AppConfig = {
  env: Env['NODE_ENV'];
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
};

export type JwtConfig = {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
  issuer: string;
  audience: string;
};

export function appConfig(env: Env): AppConfig {
  return {
    env: env.NODE_ENV,
    port: env.PORT,
    apiPrefix: env.API_PREFIX,
    corsOrigins: env.CORS_ORIGINS,
  };
}

export function jwtConfig(env: Env): JwtConfig {
  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  };
}
