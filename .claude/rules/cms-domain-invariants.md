---
paths:
  - 'apps/backend/**'
  - 'libs/domain/**'
  - 'libs/database/**'
  - 'libs/contracts/**'
---

# Localization CMS Domain Invariants

These are the rules that make the data model correct. They are enforced in the
database (see `libs/database/src/migrations/`), and application code must not
work around them. Everything here comes from the architecture doc in
`docs/Localization-CMS-Initial-Architecture.md` — read §4–§6 before changing a
schema.

---

## Rule 1 — Languages are rows, never columns and never a type union

Adding French must be an `INSERT` into `locales`. Not a migration, not a new
column, not a TypeScript change.

```ts
// ❌ — every new language is now a migration AND a breaking type change
type Entry = { ar: string; en: string };
@Column() ar: string;

// ❌ — compile-time union; `fr` does not typecheck until every call site moves
type Values = Record<'ar' | 'en', string>;

// ✅ — one row per (entry, locale)
@Entity({ name: 'translation_values' })
export class TranslationValue {
  @Column({ name: 'entry_id', type: 'uuid' }) entryId: string;
  @Column({ name: 'locale_id', type: 'uuid' }) localeId: string;
  @Column({ type: 'text' }) value: string;
}
```

`BOOTSTRAP_LOCALES` in `@cms/domain` seeds `ar` and `en` on a fresh install.
It is a seed list, not a type source. Never write
`Record<(typeof BOOTSTRAP_LOCALES)[number], string>`.

The **API response** is still nested JSON keyed by locale code — that is a
serialization concern, built from rows at read time. Shaping the response like
the storage, or the storage like the response, is the mistake this rule exists
to prevent.

---

## Rule 2 — A module is app-scoped or global, never both and never neither

```
scope = 'app'    ⇒ app_id IS NOT NULL
scope = 'global' ⇒ app_id IS NULL
```

Enforced by `ck_modules_scope_app_id`. Do not write a service that "fixes up"
a mismatched pair — construct it correctly or let the constraint reject it.

Uniqueness follows the same split, via two partial indexes:

- `uq_modules_app_slug` — one `products` namespace per app
- `uq_modules_global_slug` — one global `authentication` namespace overall

A plain `UNIQUE (app_id, slug)` does **not** give you the second one: in
Postgres, `NULL` is distinct from `NULL`, so it would happily allow ten global
modules all called `authentication`.

---

## Rule 3 — A translation entry has no `app_id`

The entry's module already decides app vs. global. A second foreign key is a
second source of truth, and the two will disagree the first time a module is
moved.

```ts
// ❌ — derivable, and therefore capable of being wrong
export class TranslationEntry {
  @Column() moduleId: string;
  @Column() appId: string; // ← no
}
```

When a query needs the app, join through `modules`. If that join is hot enough
to hurt, the answer is an index or a materialized read model — not a
denormalized column that nothing keeps in sync.

---

## Rule 4 — Runtime endpoints return published values only

`GET /v1/apps/:appSlug/locales/:localeCode` is public-facing content. A
`draft` or `in_review` value reaching it is a content leak — unreleased copy
on a live storefront.

```ts
// ✅ — status filter belongs in the query, not in a post-filter
.where('value.status = :status', { status: 'published' })

// ❌ — loads everything, then hopes the caller filters
const values = await repo.find({ where: { entryId } });
```

Every runtime read path needs a test that asserts a `draft` row is absent from
the response. The CMS/admin endpoints are the ones that see all statuses.

---

## Rule 5 — Resolution order is fixed, and one implementation owns it

1. app-specific entry
2. global entry
3. configured fallback locale
4. the translation key itself

It is exported as `RESOLUTION_ORDER` in `@cms/domain` for documentation. The
runtime service implements it **once**; the dashboard preview and the
`i18n-client` adapter call the API rather than re-implementing the chain.
Three implementations of a fallback chain is three different answers to
"why is this key showing in English?".

---

## Rule 6 — History is append-only

`translation_value_versions` is written on every change to a
`translation_values` row and is never updated or deleted by application code.
Rollback means *inserting* the old value as a new version — not rewinding the
history table.

```ts
// ❌ — destroys the audit trail the feature exists to provide
await versionsRepo.delete({ translationValueId: id, version: 5 });

// ✅ — rollback is a forward operation
await this.updateValue(id, { value: historical.value, changeNote: 'Rollback to v5' });
```

---

## Rule 7 — Concurrent edits fail loudly

`TranslationValue.version` is a TypeORM `@VersionColumn`. Two editors on the
same key is the expected case, not the exotic one.

- Never assign `version` by hand; TypeORM owns it.
- A write carrying a stale `expectedVersion` returns **409 Conflict** with the
  current value, so the dashboard can show a diff.
- Silently overwriting is the one unacceptable outcome.

---

## Rule 8 — Slugs in runtime URLs are immutable once published

`apps.slug` and `modules.slug` appear in
`/v1/apps/:appSlug/locales/:localeCode/modules/:moduleSlug`. A client app has
that path compiled into its bundle. Renaming a slug breaks every deployed
client that has not shipped since.

Renaming is a product decision with a migration path (dual-serve the old slug,
then retire it) — never a plain `UPDATE`.

---

## Rule 9 — The importer is idempotent and dry-run first

`libs/importer` (Phase 4) must be safe to run twice. Re-running imports zero
new rows and reports zero conflicts. Every run records the source commit SHA
and produces a report before it writes anything.

---

## Checklist before changing the schema

1. Does it add a language-shaped column? Stop — it is a row.
2. Does it duplicate a foreign key already reachable through a join?
3. Does the invariant belong in a CHECK/partial unique index rather than in a
   service method?
4. Does a runtime read path still filter on `status = 'published'`?
5. Does the change need a history row, and is the history still append-only?
6. Is there a migration, hand-written where TypeORM cannot express the
   constraint, with a working `down()`?
