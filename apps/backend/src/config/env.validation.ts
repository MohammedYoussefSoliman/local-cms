import { z } from 'zod';

/**
 * The process refuses to boot on a bad or missing variable. A typo in
 * `JWT_ACCESS_SECRET` must fail at startup, not on the first login attempt in
 * production.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4050),
  API_PREFIX: z.string().default('api'),
  // Seconds. Drives `Cache-Control: max-age` on the runtime bundle reads;
  // the ETag is what makes a stale cache cheap to revalidate.
  RUNTIME_CACHE_MAX_AGE: z.coerce.number().int().nonnegative().default(60),

  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_NAME: z.string().min(1),
  DATABASE_LOGGING: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  // 32 chars minimum so a placeholder like "secret" cannot reach an
  // environment where it would actually sign tokens.
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),

  /**
   * Where the dashboard is served from. Used to build the invitation accept
   * link an admin hands to a new user — the API knows the token, only this
   * knows the URL that can spend it.
   */
  DASHBOARD_URL: z.string().url().default('http://localhost:4051'),
  /**
   * How long an invitation stays acceptable. Long enough to survive a weekend,
   * short enough that a token forwarded in an old email thread is dead.
   */
  INVITE_TTL: z.string().default('7d'),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  if (
    result.data.NODE_ENV === 'production' &&
    result.data.JWT_ACCESS_SECRET === result.data.JWT_REFRESH_SECRET
  ) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ in production.',
    );
  }

  return result.data;
}
