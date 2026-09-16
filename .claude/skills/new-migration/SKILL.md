---
name: new-migration
description: Create, review, and verify a TypeORM migration in libs/database — including the constraints TypeORM cannot generate (partial unique indexes, CHECK constraints, extensions). Usage: /new-migration AddReviewerRole
---

# New Migration

Create a migration following `.claude/rules/nestjs-typeorm.md`. Schema changes
are always migrations — `synchronize` is never turned on.

---

## Arguments

- `$1` — migration name in PascalCase (`AddReviewerRole`, `AddIcuValidation`)

---

## Step 1: Decide generated or hand-written

**Generate** when the change is a plain column, table, or index that maps
cleanly from a decorator:

```bash
pnpm migration:generate libs/database/src/migrations/$1
```

**Hand-write** when the change involves anything TypeORM cannot express —
which in this schema is common:

```bash
pnpm migration:create libs/database/src/migrations/$1
```

Hand-write it if the change involves any of:

- a partial index (`CREATE UNIQUE INDEX … WHERE …`)
- a CHECK constraint
- a Postgres extension (`citext`, `pgcrypto`)
- a data backfill
- a column type Postgres has and TypeORM abstracts away

`InitialSchema` is hand-written for exactly these reasons — read it first.

---

## Step 2: Review the migration

A generated migration is a draft, never a result. Before committing:

1. **Delete spurious churn.** Generation routinely emits `ALTER COLUMN`
   statements caused by a decorator/DB type mismatch that was always there.
   Those rewrite tables for nothing.
2. **Add what generation missed** — the partial indexes and CHECKs above.
3. **Write a real `down()`.** An empty `down()` is discovered during an
   incident. Every `up()` statement needs its inverse, in reverse order.
4. **Check the invariants still hold.** Cross-reference
   `.claude/rules/cms-domain-invariants.md`: does this change let a global
   module have an `app_id`? Let an app have two default locales? Let a
   published value exist with no `published_at`?

---

## Step 3: Verify the round trip

```bash
pnpm db:up
pnpm migration:run
pnpm migration:revert
pnpm migration:run
```

All four must succeed. A migration that runs but cannot revert is not
finished.

Then confirm the constraint actually bites:

```sql
-- should be rejected by ck_modules_scope_app_id
INSERT INTO modules (app_id, name, slug, scope) VALUES (NULL, 'X', 'x', 'app');
```

A constraint that accepts the row it was written to reject is worse than no
constraint, because it is documented as protection.

---

## Step 4: Language changes are not migrations

If the change is "support French", stop. Adding a language is an `INSERT` into
`locales` — a seed or an admin API call, never a schema change. A migration
that adds a language-shaped column violates the central design decision of the
architecture (§4). Say so rather than writing it.

---

## Rules

- Never edit a migration that has run in a shared environment. Fix it forward
  with a new one.
- Migration filenames keep their generated timestamp prefix; do not renumber.
- One logical change per migration. A migration that adds a table *and*
  backfills *and* drops a column cannot be partially reverted.
- Update the seed in `libs/database/src/seeds/` in the same commit when the
  change affects bootstrap data.
