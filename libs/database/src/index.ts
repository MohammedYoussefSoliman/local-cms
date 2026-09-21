export * from './entities';

/**
 * `data-source.ts` is deliberately NOT re-exported. It is the TypeORM CLI's
 * entry point: it calls `loadEnv()` and constructs a `DataSource` at import
 * time, so exporting it here made the API do both as a side effect of
 * importing `ENTITIES` — a second connection object, and a `.env` read going
 * on behind `ConfigModule`'s back.
 *
 * The CLI references it by path (`-d src/data-source.ts`) and the seeder
 * imports it relatively, so neither needs it in this barrel.
 */
