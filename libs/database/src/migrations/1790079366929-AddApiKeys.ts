import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Service credentials for the runtime read API (delivery plan B7).
 *
 * Hand-written rather than generated: the index that matters is partial
 * (`WHERE revoked_at IS NULL`), which TypeORM cannot express from decorators,
 * and a revoked key staying in the table is the whole point of that predicate.
 */
export class AddApiKeys1790079366929 implements MigrationInterface {
  name = 'AddApiKeys1790079366929';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "app_id" uuid NOT NULL REFERENCES "apps"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "key_hash" varchar(255) NOT NULL,
        "prefix" varchar(12) NOT NULL,
        "last_used_at" timestamptz,
        "revoked_at" timestamptz,
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_api_keys_key_hash" UNIQUE ("key_hash")
      )
    `);

    /**
     * Partial: the guard's lookup and the dashboard's list both only ever ask
     * for live keys, and revoked rows are kept forever for the audit. Indexing
     * them would grow the index with history nothing queries.
     */
    await queryRunner.query(
      `CREATE INDEX "ix_api_keys_app" ON "api_keys" ("app_id") WHERE "revoked_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_api_keys_app"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys"`);
  }
}
