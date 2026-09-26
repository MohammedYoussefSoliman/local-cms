import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Single-use invitation tokens, so an account created by `POST /users` can set
 * its first password and become `active`.
 *
 * Hand-written rather than generated, for the same reason `AddApiKeys` was:
 * the index that carries the invariant is partial, and TypeORM cannot express
 * a partial unique index from decorators.
 */
export class AddUserInvitations1790141220836 implements MigrationInterface {
  name = 'AddUserInvitations1790141220836';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_invitations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" varchar(255) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "accepted_at" timestamptz,
        "revoked_at" timestamptz,
        "invited_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_user_invitations_token_hash" UNIQUE ("token_hash")
      )
    `);

    /**
     * At most one outstanding invitation per user, enforced by the database
     * rather than by remembering to revoke first. Re-issuing therefore *has*
     * to revoke the previous token in the same transaction, which is the
     * behaviour we want: two live tokens for one account means revoking one of
     * them accomplishes nothing.
     *
     * Partial, so accepted and revoked rows stay in the table for the audit
     * without competing for the constraint.
     */
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_user_invitations_outstanding"
        ON "user_invitations" ("user_id")
        WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_user_invitations_outstanding"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_invitations"`);
  }
}
