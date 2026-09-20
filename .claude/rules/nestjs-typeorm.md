---
paths:
  - 'apps/backend/src/**/*.service.ts'
  - 'libs/database/**'
---

# TypeORM & Migrations

Entities and migrations live in `libs/database` so the CLI, the seeder, and
the Nest app all see one schema.

---

## Rule 1 — `synchronize` is never true

Not in development, not "just this once". The schema depends on partial unique
indexes, CHECK constraints, and CITEXT — none of which `synchronize` can
express. It would drop them on the next boot and the invariants in
`.claude/rules/cms-domain-invariants.md` would quietly stop holding.

Schema changes are migrations. Always.

---

## Rule 2 — Generate, then read and fix the migration

```bash
pnpm migration:generate libs/database/src/migrations/AddReviewerRole
pnpm migration:run
```

A generated migration is a draft. Before committing it:

- Delete spurious `ALTER COLUMN` churn caused by decorator/DB type mismatches.
- Add anything TypeORM cannot express: partial indexes, CHECK constraints,
  `CREATE EXTENSION`, data backfills.
- Write a real `down()`. An empty or wrong `down()` is discovered during an
  incident, which is the worst possible time.
- Run `migration:run`, then `migration:revert`, then `migration:run` again.

Hand-written is fine and often better — `InitialSchema` is hand-written for
exactly this reason.

---

## Rule 3 — Repositories are injected, never reached through the DataSource

```ts
// ✅
constructor(
  @InjectRepository(TranslationValue)
  private readonly values: Repository<TranslationValue>,
) {}

// ❌ — untestable; no way to substitute a mock
constructor(private readonly dataSource: DataSource) {}
getRepo() { return this.dataSource.getRepository(TranslationValue); }
```

`DataSource` is injected only for transactions (Rule 4).

---

## Rule 4 — Multi-table writes run in one transaction

Publishing a value writes `translation_values` **and**
`translation_value_versions`. A crash between the two leaves a published value
with no audit row — the exact thing the history table exists to guarantee.

```ts
// ✅
await this.dataSource.transaction(async (manager) => {
  await manager.save(TranslationValue, value);
  await manager.insert(TranslationValueVersion, historyRow);
});

// ❌ — two independent writes
await this.values.save(value);
await this.versions.insert(historyRow);
```

The importer (Phase 4) runs its whole batch in one transaction so a failed
import leaves nothing behind.

---

## Rule 5 — Let constraints do the checking

```ts
// ❌ — TOCTOU: two concurrent requests both see "no existing row"
const existing = await this.apps.findOne({ where: { slug } });
if (existing) throw new ConflictException('Slug taken');
return this.apps.save(dto);

// ✅ — the unique index is the check; the filter turns 23505 into a 409
return this.apps.save(dto);
```

A pre-check is acceptable *as a friendlier message*, but it never replaces the
constraint, and the insert must still be wrapped for the race.

---

## Rule 6 — Never `find()` a table that grows without bound

`translation_values` grows with entries × locales, and
`translation_value_versions` grows forever. Every list query is paginated and
every hot filter has an index.

```ts
// ❌
const all = await this.values.find();

// ✅
const [records, total] = await this.values.findAndCount({
  where: { entryId },
  take: limit,
  skip: (page - 1) * limit,
});
```

---

## Rule 7 — Select the columns you need on wide reads

The runtime bundle read touches every published value for a locale. Pulling
full entities (plus relations) to build a flat `{ key: value }` map is the
difference between one query and thousands.

```ts
// ✅
await this.values
  .createQueryBuilder('value')
  .innerJoin('value.entry', 'entry')
  .innerJoin('entry.module', 'module')
  .select(['module.slug', 'entry.key', 'value.value'])
  .where('value.status = :status', { status: 'published' })
  .getRawMany();
```

---

## Rule 8 — `@VersionColumn` is owned by TypeORM

Never set `version` in application code. Read it to send to the client, and
compare an incoming `expectedVersion` against it — assigning it defeats the
optimistic locking that makes concurrent editing safe.

---

## Rule 9 — Migrations are forward-only once deployed

A migration that has run in any shared environment is never edited. Fix it
with a new migration. Editing it makes every environment's
`cms_migrations` table disagree about what the schema is.
