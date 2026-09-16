import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema for the Localization CMS (architecture doc §6).
 *
 * Written by hand rather than generated, because the invariants that make the
 * model correct are not expressible through entity decorators:
 *   - the module scope CHECK constraints
 *   - one default locale per app (partial unique index)
 *   - one global namespace per slug (partial unique index)
 *   - CITEXT for case-insensitive unique emails
 */
export class InitialSchema1726400000000 implements MigrationInterface {
  name = 'InitialSchema1726400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);

    await queryRunner.query(`
      CREATE TABLE "locales" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(35) NOT NULL,
        "name" varchar(128) NOT NULL,
        "native_name" varchar(128) NOT NULL,
        "direction" varchar(3) NOT NULL DEFAULT 'ltr',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_locales_code" UNIQUE ("code"),
        CONSTRAINT "ck_locales_direction" CHECK ("direction" IN ('ltr','rtl'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" citext NOT NULL,
        "name" varchar(255) NOT NULL,
        "role" varchar(32) NOT NULL DEFAULT 'editor',
        "status" varchar(32) NOT NULL DEFAULT 'invited',
        "password_hash" varchar(255) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "ck_users_role" CHECK ("role" IN ('admin','editor')),
        CONSTRAINT "ck_users_status" CHECK ("status" IN ('active','invited','disabled'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "refresh_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" varchar(255) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "user_agent" varchar(512),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_refresh_sessions_token_hash" UNIQUE ("token_hash")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_refresh_sessions_user" ON "refresh_sessions" ("user_id") WHERE "revoked_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "apps" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "slug" varchar(128) NOT NULL,
        "description" text,
        "default_locale_id" uuid NOT NULL REFERENCES "locales"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_apps_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "app_locales" (
        "app_id" uuid NOT NULL REFERENCES "apps"("id") ON DELETE CASCADE,
        "locale_id" uuid NOT NULL REFERENCES "locales"("id") ON DELETE RESTRICT,
        "is_default" boolean NOT NULL DEFAULT false,
        "fallback_locale_id" uuid REFERENCES "locales"("id") ON DELETE SET NULL,
        "is_enabled" boolean NOT NULL DEFAULT true,
        CONSTRAINT "pk_app_locales" PRIMARY KEY ("app_id","locale_id"),
        CONSTRAINT "ck_app_locales_fallback_not_self"
          CHECK ("fallback_locale_id" IS NULL OR "fallback_locale_id" <> "locale_id")
      )
    `);
    // Exactly one default locale per app.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_app_locales_one_default" ON "app_locales" ("app_id") WHERE "is_default"`,
    );

    await queryRunner.query(`
      CREATE TABLE "modules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "app_id" uuid REFERENCES "apps"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "slug" varchar(128) NOT NULL,
        "scope" varchar(16) NOT NULL DEFAULT 'app',
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_modules_scope" CHECK ("scope" IN ('app','global')),
        CONSTRAINT "ck_modules_scope_app_id" CHECK (
          ("scope" = 'app' AND "app_id" IS NOT NULL)
          OR ("scope" = 'global' AND "app_id" IS NULL)
        )
      )
    `);
    // One namespace per app, and one global namespace per slug.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_modules_app_slug" ON "modules" ("app_id","slug") WHERE "app_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_modules_global_slug" ON "modules" ("slug") WHERE "scope" = 'global'`,
    );

    await queryRunner.query(`
      CREATE TABLE "translation_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "module_id" uuid NOT NULL REFERENCES "modules"("id") ON DELETE CASCADE,
        "key" varchar(255) NOT NULL,
        "description" text,
        "content_type" varchar(32) NOT NULL DEFAULT 'text',
        "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_entries_module_key" UNIQUE ("module_id","key"),
        CONSTRAINT "ck_entries_content_type"
          CHECK ("content_type" IN ('text','rich_text','icu_message'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_entries_module" ON "translation_entries" ("module_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "translation_values" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "entry_id" uuid NOT NULL REFERENCES "translation_entries"("id") ON DELETE CASCADE,
        "locale_id" uuid NOT NULL REFERENCES "locales"("id") ON DELETE RESTRICT,
        "value" text NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'draft',
        "version" integer NOT NULL DEFAULT 1,
        "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "published_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_values_entry_locale" UNIQUE ("entry_id","locale_id"),
        CONSTRAINT "ck_values_status"
          CHECK ("status" IN ('draft','in_review','published','archived')),
        CONSTRAINT "ck_values_published_at"
          CHECK ("status" <> 'published' OR "published_at" IS NOT NULL)
      )
    `);
    // Covers the runtime read path: published values for one locale.
    await queryRunner.query(
      `CREATE INDEX "ix_values_locale_published" ON "translation_values" ("locale_id") WHERE "status" = 'published'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_values_entry" ON "translation_values" ("entry_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "translation_value_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "translation_value_id" uuid NOT NULL REFERENCES "translation_values"("id") ON DELETE CASCADE,
        "version" integer NOT NULL,
        "value" text NOT NULL,
        "status" varchar(16) NOT NULL,
        "changed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "change_note" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_value_versions" UNIQUE ("translation_value_id","version")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_value_versions_value_version" ON "translation_value_versions" ("translation_value_id","version" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "translation_value_versions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "translation_values"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "translation_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "modules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "app_locales"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "apps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "locales"`);
  }
}
